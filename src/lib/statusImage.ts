import i18n from '../i18n'
import type { Farmer, Listing } from '../types'
import { canvasToBlob, drawCover, drawStamp, fontsReady, GRADE_HEX, loadImg, text } from './drawing'
import { fmtNum, fmtRange, ltr } from './format'

/*
  A 1080×1920 image for WhatsApp Status: the grower's own photo, the grade
  stamp, the fair price and the quantity for sale, in Urdu first with English
  under it. Made to be shared in one tap to sell faster.
*/

const W = 1080
const H = 1920

export async function makeStatusImage(listing: Listing, farmer?: Farmer): Promise<File> {
  await fontsReady()
  const en = i18n.getFixedT('en')
  const ur = i18n.getFixedT('ur')
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(0, 0, W, H)

  // photo, full width
  if (listing.photos[0]) {
    try {
      drawCover(ctx, await loadImg(listing.photos[0]), 0, 0, W, 1080)
    } catch {
      /* keep the plain background */
    }
  }
  // fade the bottom of the photo into the panel
  const grad = ctx.createLinearGradient(0, 860, 0, 1090)
  grad.addColorStop(0, 'rgba(59,42,30,0)')
  grad.addColorStop(1, 'rgba(59,42,30,1)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 860, W, 230)

  drawStamp(ctx, W - 230, 900, 190, listing.grade)

  // brand
  text(ctx, 'ڈیرہ منڈی', W - 64, 110, { size: 52, weight: 700, urdu: true, color: '#fbf7f0' })

  // headline
  const cream = '#fbf7f0'
  text(ctx, `${ur(`crops.${listing.crop}`)}، گریڈ ${listing.grade}`, W - 64, 1210, { size: 76, weight: 700, urdu: true, color: cream })
  text(ctx, `${en(`crops.${listing.crop}`)}, Grade ${listing.grade}`, 64, 1290, { size: 46, weight: 800, color: '#e8c9a4' })

  // price and quantity
  ctx.fillStyle = GRADE_HEX[listing.grade]
  ctx.fillRect(64, 1350, W - 128, 6)
  text(ctx, `${ltr(fmtRange(listing.priceMin, listing.priceMax))} روپے فی کلو`, W - 64, 1470, { size: 64, weight: 700, urdu: true, color: cream })
  text(ctx, `PKR ${fmtRange(listing.priceMin, listing.priceMax)} per kg`, 64, 1530, { size: 38, weight: 700, color: '#e8c9a4' })
  text(ctx, `${ltr(fmtNum(listing.quantityKg))} کلو دستیاب، ${ur(`places.${listing.location}`)}`, W - 64, 1650, { size: 48, weight: 700, urdu: true, color: cream })
  text(ctx, `${fmtNum(listing.quantityKg)} kg available, ${en(`places.${listing.location}`)}`, 64, 1710, { size: 34, color: '#e8c9a4' })

  if (farmer?.phone) text(ctx, `${farmer.name}: ${farmer.phone}`, 64, 1790, { size: 36, weight: 800, color: cream })
  text(ctx, 'Graded from photo by Dera Mandi, deramandi.vercel.app', 64, H - 50, { size: 26, color: '#c9b7a3' })

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  return new File([blob], `dera-mandi-${listing.crop}-grade-${listing.grade}.jpg`, { type: 'image/jpeg' })
}
