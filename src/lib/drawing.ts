import type { Grade } from '../types'

/*
  Canvas helpers shared by the certificate and the WhatsApp Status image.
  Canvas text goes through the browser's own shaping, so Nastaliq Urdu comes
  out correctly (PDF libraries cannot shape it).
*/

export const INK = '#3b2a1e'
export const INK_SOFT = '#6b5a4c'
export const PAPER = '#fbf7f0'
export const LINE = '#d8cfc2'
export const GRADE_HEX: Record<Grade, string> = { A: '#5c6b3c', B: '#9f5a1a', C: '#8e3b24' }

export const LATIN = '"Archivo Variable", "Helvetica Neue", Arial, sans-serif'
export const URDU = '"Noto Nastaliq Urdu", serif'

export async function fontsReady() {
  await Promise.all([
    document.fonts.load(`700 40px ${LATIN}`),
    document.fonts.load(`400 40px ${LATIN}`),
    document.fonts.load(`700 40px ${URDU}`),
    document.fonts.load(`400 40px ${URDU}`),
  ]).catch(() => undefined)
}

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Draw an image to fill a box, cropping the overflow (CSS object-fit: cover). */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { size: number; weight?: number; color?: string; urdu?: boolean; align?: CanvasTextAlign; maxWidth?: number },
) {
  ctx.save()
  ctx.font = `${opts.weight ?? 400} ${opts.size}px ${opts.urdu ? URDU : LATIN}`
  ctx.fillStyle = opts.color ?? INK
  ctx.direction = opts.urdu ? 'rtl' : 'ltr'
  ctx.textAlign = opts.align ?? (opts.urdu ? 'right' : 'left')
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(value, x, y, opts.maxWidth)
  ctx.restore()
}

/** Wrap text into lines that fit maxWidth. Returns the y after the last line. */
export function paragraph(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: { size: number; lineHeight: number; weight?: number; color?: string; urdu?: boolean; align?: CanvasTextAlign },
) {
  ctx.save()
  ctx.font = `${opts.weight ?? 400} ${opts.size}px ${opts.urdu ? URDU : LATIN}`
  const words = value.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  ctx.restore()
  lines.forEach((l, i) => text(ctx, l, x, y + i * opts.lineHeight, opts))
  return y + lines.length * opts.lineHeight
}

/** The inked grade stamp: double ring, big letter, Latin ring text. */
export function drawStamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, grade: Grade, rotate = -0.14) {
  const color = GRADE_HEX[grade]
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rotate)
  ctx.globalAlpha = 0.92
  ctx.fillStyle = 'rgba(251,247,240,0.9)'
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.02, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = r * 0.055
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = r * 0.025
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  // ring text along the top arc
  const label = 'DERA MANDI GRADE'
  ctx.fillStyle = color
  ctx.font = `800 ${r * 0.15}px ${LATIN}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const arc = Math.PI * 0.9
  for (let i = 0; i < label.length; i++) {
    const a = -Math.PI / 2 - arc / 2 + (arc * (i + 0.5)) / label.length
    ctx.save()
    ctx.rotate(a + Math.PI / 2)
    ctx.fillText(label[i], 0, -r * 0.78)
    ctx.restore()
  }
  // small diamonds at 9 and 3 o'clock
  for (const sx of [-1, 1]) {
    ctx.save()
    ctx.translate(sx * r * 0.78, 0)
    ctx.rotate(Math.PI / 4)
    ctx.fillRect(-r * 0.035, -r * 0.035, r * 0.07, r * 0.07)
    ctx.restore()
  }
  ctx.font = `900 ${r * 0.95}px ${LATIN}`
  ctx.fillText(grade, 0, r * 0.05)
  ctx.restore()
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), type, quality))
}
