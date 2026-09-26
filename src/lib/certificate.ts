import i18n from '../i18n'
import type { Buyer, Farmer, Listing, LogisticsProvider } from '../types'
import { checkUrl, payloadFor, referenceCode } from './checkCode'
import { canvasToBlob, drawCover, drawStamp, fontsReady, GRADE_HEX, INK, INK_SOFT, LINE, loadImg, paragraph, text } from './drawing'
import { fmtNum, fmtRange } from './format'
import { CROP_CARDS } from './cropModels'
import { graderFor, pct } from './modelInfo'

/*
  The grade certificate: an A4 page drawn on a canvas (so Urdu is shaped by the
  browser), then wrapped in a PDF with pdf-lib. Bilingual throughout: English
  for buyers, Urdu for the grower. States how the grade was made, how accurate
  that grader measured, and which dataset it learned from.
*/

const W = 1240 // A4 at 150 dpi
const H = 1754
const M = 80

export interface CertificateInput {
  listing: Listing
  buyer?: Buyer
  logistics?: LogisticsProvider
  farmer?: Farmer
}

export async function renderCertificateCanvas({ listing, buyer, logistics, farmer }: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady()
  const en = i18n.getFixedT('en')
  const ur = i18n.getFixedT('ur')
  const payload = payloadFor(listing)
  const ref = referenceCode(payload)
  const grader = graderFor(listing.crop, listing.gradeSource)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // header band
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, 140)
  text(ctx, 'Dera Mandi', M, 90, { size: 54, weight: 800, color: '#fbf7f0' })
  text(ctx, 'ڈیرہ منڈی', W - M, 92, { size: 46, weight: 700, color: '#fbf7f0', urdu: true })

  text(ctx, 'Crop grade certificate', M, 228, { size: 40, weight: 800 })
  text(ctx, 'فصل کا درجہ سرٹیفکیٹ', W - M, 230, { size: 36, weight: 700, urdu: true })
  const issued = new Date(listing.createdAt)
  text(ctx, `Reference ${ref}    Issued ${issued.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, M, 272, {
    size: 22,
    color: INK_SOFT,
  })
  ctx.fillStyle = LINE
  ctx.fillRect(M, 296, W - 2 * M, 2)

  // photo + stamp
  const photoX = M
  const photoY = 330
  const photoS = 540
  if (listing.photos[0]) {
    try {
      drawCover(ctx, await loadImg(listing.photos[0]), photoX, photoY, photoS, photoS)
    } catch {
      /* photo failed to decode; leave the box blank */
    }
  }
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.strokeRect(photoX, photoY, photoS, photoS)
  drawStamp(ctx, photoX + photoS - 125, photoY + photoS - 125, 105, listing.grade)

  // grade column
  const cx = photoX + photoS + 60
  const cw = W - M - cx
  const cropEn = en(`crops.${listing.crop}`)
  const cropUr = ur(`crops.${listing.crop}`)
  text(ctx, `Grade ${listing.grade}`, cx, photoY + 70, { size: 76, weight: 900, color: GRADE_HEX[listing.grade] })
  text(ctx, cropEn + (listing.variety ? `, ${listing.variety}` : ''), cx, photoY + 120, { size: 30, weight: 700, maxWidth: cw })
  text(ctx, `${cropUr}، گریڈ ${listing.grade}`, W - M, photoY + 180, { size: 30, weight: 700, urdu: true })
  let y = paragraph(ctx, en(`result.summary${listing.grade}`), cx, photoY + 236, cw, { size: 24, lineHeight: 34, color: INK_SOFT })

  if (listing.gradeProbabilities) {
    // Sugarcane's model only knows good/damaged (no B); wheat shows kernel shares per quality group.
    const task = listing.gradeSource === 'model' ? CROP_CARDS[listing.crop]?.task : undefined
    const names: Record<string, string> = task === 'wheat_kernel_class' ? { A: 'Sound', B: 'Minor', C: 'Serious' } : task === 'binary_good_damaged' ? { A: 'Good', C: 'Damaged' } : { A: 'A', B: 'B', C: 'C' }
    const labelW = task && task !== 'grade3_proxy' ? 120 : 40
    y += 20
    text(ctx, task === 'wheat_kernel_class' ? 'Kernels by quality group (estimated share)' : 'Model certainty', cx, y, { size: 22, weight: 700 })
    y += 16
    for (const g of (['A', 'B', 'C'] as const).filter((g) => names[g])) {
      const v = listing.gradeProbabilities[g]
      y += 38
      text(ctx, names[g], cx, y, { size: task && task !== 'grade3_proxy' ? 22 : 26, weight: 800, color: g === listing.grade ? GRADE_HEX[g] : INK_SOFT })
      ctx.fillStyle = '#ece6dc'
      ctx.fillRect(cx + labelW, y - 20, cw - 90 - labelW, 18)
      ctx.fillStyle = g === listing.grade ? GRADE_HEX[g] : '#b9ab9b'
      ctx.fillRect(cx + labelW, y - 20, Math.max(4, (cw - 90 - labelW) * v), 18)
      text(ctx, pct(v), W - M, y, { size: 24, weight: 700, align: 'right' })
    }
  }
  if (listing.lotCounts) {
    const [a, b, c] = listing.lotCounts
    y += 50
    text(ctx, `Whole lot: ${a} A, ${b} B, ${c} C (${a + b + c} photos)`, cx, y, { size: 24, weight: 700, maxWidth: cw })
  } else if (listing.gradePerPhoto && listing.gradePerPhoto.length > 1) {
    y += 50
    text(ctx, `Each photo: ${listing.gradePerPhoto.join(', ')}`, cx, y, { size: 24, color: INK_SOFT })
  }

  // details table
  let ty = photoY + photoS + 80
  const rows: [string, string, string][] = [
    ['Crop', `${cropEn}${listing.variety ? ` (${listing.variety})` : ''}`, 'فصل'],
    ['Quantity', `${fmtNum(listing.quantityKg)} kg (${fmtNum(Math.round((listing.quantityKg / 40) * 10) / 10)} maund)`, 'مقدار'],
    ['Area', en(`places.${listing.location}`), 'علاقہ'],
    ['Fair price, this grade', `PKR ${fmtRange(listing.priceMin, listing.priceMax)} per kg`, 'جائز قیمت'],
    ['Lot value', `PKR ${fmtRange(Math.round(listing.priceMin * listing.quantityKg), Math.round(listing.priceMax * listing.quantityKg))}`, 'مال کی مالیت'],
  ]
  if (listing.specs?.length) rows.push(['Measured from photo', listing.specs.map((s) => `${en(`specs.${s.key}`)}: ${s.value}`).join('; '), 'تصویر سے ناپا گیا'])
  if (farmer) rows.push(['Grower', [farmer.name, farmer.village, farmer.phone].filter(Boolean).join(', '), 'کاشتکار'])
  if (buyer) rows.push(['Request sent to', `${buyer.name} (${en(`buyerType.${buyer.type}`)})`, 'خریدار'])
  if (logistics) rows.push(['Storage / transport', logistics.name, 'گودام / ٹرانسپورٹ'])

  ctx.fillStyle = INK
  ctx.fillRect(M, ty - 40, W - 2 * M, 3)
  for (const [label, value, urLabel] of rows) {
    text(ctx, label, M, ty, { size: 22, color: INK_SOFT })
    const endY = paragraph(ctx, value, M + 300, ty, W - 2 * M - 300 - 170, { size: 24, lineHeight: 32, weight: 700 })
    text(ctx, urLabel, W - M, ty + 2, { size: 22, urdu: true, color: INK_SOFT })
    ty = Math.max(ty + 46, endY + 14)
    ctx.fillStyle = LINE
    ctx.fillRect(M, ty - 30, W - 2 * M, 1)
  }

  // how the grade was made
  ty += 30
  text(ctx, 'How this grade was made', M, ty, { size: 26, weight: 800 })
  text(ctx, 'یہ درجہ کیسے لگا', W - M, ty + 2, { size: 24, weight: 700, urdu: true })
  ty += 44
  const how =
    grader.kind === 'model'
      ? `${grader.name}, running on the phone. On ${grader.tested} photos it had never seen, it gave the right grade ${pct(grader.accuracy)} of the time (95% range ${pct(grader.ci95?.[0])} to ${pct(grader.ci95?.[1])}); always guessing the commonest grade scores ${pct(grader.baseline)}. Trained on ${grader.trainedOn}.`
      : `${grader.name}. This is not a trained model and its accuracy has not been measured; treat the grade as a rough guide.`
  const cite = grader.citation ? `Training data: ${grader.citation}. Licence: ${grader.licence}.` : ''
  const note = 'Estimated from photos. This is not an official inspection; confirm by inspecting the crop in person before sale.'
  const noteUr = 'یہ اندازہ تصویروں سے لگایا گیا ہے، سرکاری معائنہ نہیں۔ فروخت سے پہلے فصل کا خود معائنہ کریں۔'
  const textW = W - 2 * M - 260 // leaves room for the QR code
  // Lay the section out at full size; shrink it only if it would run into the footer.
  const section = (k: number, dry: boolean) => {
    let y2 = paragraph(ctx, how, M, ty, textW, { size: 22 * k, lineHeight: 32 * k, dry })
    if (cite) y2 = paragraph(ctx, cite, M, y2 + 14 * k, textW, { size: 20 * k, lineHeight: 29 * k, color: INK_SOFT, dry })
    y2 = paragraph(ctx, note, M, y2 + 14 * k, textW, { size: 20 * k, lineHeight: 29 * k, color: INK_SOFT, dry })
    return paragraph(ctx, noteUr, W - M - 260, y2 + 36 * k, textW, { size: 20 * k, lineHeight: 44 * k, urdu: true, color: INK_SOFT, dry })
  }
  const scale = [1, 0.92, 0.85, 0.78, 0.72].find((k) => section(k, true) <= H - 95) ?? 0.72
  section(scale, false)

  // QR code, bottom right
  const qrSize = 210
  const qx = W - M - qrSize
  const qy = H - 110 - qrSize
  await drawQr(ctx, checkUrl(listing), qx, qy, qrSize)
  text(ctx, 'Scan to check details', qx + qrSize / 2, qy + qrSize + 28, { size: 18, align: 'center', color: INK_SOFT })

  // footer
  ctx.fillStyle = LINE
  ctx.fillRect(M, H - 70, W - 2 * M, 1)
  text(ctx, 'deramandi.vercel.app', M, H - 34, { size: 18, color: INK_SOFT })
  text(ctx, 'Made with Dera Mandi for D.I. Khan growers', W - M, H - 34, { size: 18, color: INK_SOFT, align: 'right' })
  return canvas
}

async function drawQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number) {
  const { default: qrcode } = await import('qrcode-generator')
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  const cell = size / (n + 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#000000'
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 1) * cell, y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell))
}

export async function makeCertificatePdf(input: CertificateInput): Promise<File> {
  const canvas = await renderCertificateCanvas(input)
  const png = await (await canvasToBlob(canvas, 'image/png')).arrayBuffer()
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 in points
  const img = await pdf.embedPng(png)
  page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 })
  const ref = referenceCode(payloadFor(input.listing))
  pdf.setTitle(`Dera Mandi grade certificate ${ref}`)
  pdf.setAuthor('Dera Mandi')
  pdf.setSubject(`${i18n.getFixedT('en')(`crops.${input.listing.crop}`)}, Grade ${input.listing.grade}`)
  pdf.setKeywords(['Dera Mandi', 'grade certificate', ref])
  pdf.setCreator('Dera Mandi (deramandi.vercel.app)')
  const bytes = await pdf.save()
  return new File([new Uint8Array(bytes)], `dera-mandi-certificate-${ref}.pdf`, { type: "application/pdf" })
}
