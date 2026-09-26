import type { CropId } from '../types'

/*
  Drawn sample "photos" so someone without crop photos (a judge on a laptop)
  can still walk through the flow. They are clearly labelled in the UI as
  drawings. The grader was tuned while looking at drawings like these, so a
  grade from a sample says nothing about how it handles real photos.
*/
export type SampleQuality = 'good' | 'mixed' | 'poor'

interface Look {
  hue: [number, number]
  sat: number
  light: [number, number]
  rx: [number, number]
  ry: [number, number]
  count: number
}

const LOOKS: Record<CropId, Look> = {
  dhakki_dates: { hue: [24, 34], sat: 70, light: [30, 42], rx: [18, 24], ry: [30, 38], count: 70 },
  kulachi_melon: { hue: [48, 62], sat: 45, light: [58, 68], rx: [70, 80], ry: [48, 56], count: 6 },
  wheat: { hue: [38, 46], sat: 55, light: [55, 65], rx: [5, 6], ry: [9, 11], count: 900 },
  sugarcane: { hue: [60, 85], sat: 45, light: [45, 58], rx: [14, 16], ry: [200, 230], count: 9 },
  other: { hue: [20, 40], sat: 60, light: [40, 55], rx: [30, 36], ry: [30, 36], count: 24 },
}

export function drawSample(crop: CropId, quality: SampleQuality, seed = 1): string {
  let s = seed * 7919 + 17
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const between = ([a, b]: [number, number]) => a + rnd() * (b - a)

  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 500
  const g = canvas.getContext('2d')
  if (!g) throw new Error('canvas unavailable')

  // A plain cotton cloth, with a little weave so it doesn't look flat.
  g.fillStyle = '#ebe6dc'
  g.fillRect(0, 0, 640, 500)
  g.globalAlpha = 0.05
  g.fillStyle = '#7a6a55'
  for (let y = 0; y < 500; y += 4) g.fillRect(0, y, 640, 1)
  g.globalAlpha = 1

  const look = LOOKS[crop]
  const badShare = quality === 'good' ? 0 : quality === 'mixed' ? 0.45 : 0.9

  for (let i = 0; i < look.count; i++) {
    const bad = rnd() < badShare
    const x = crop === 'sugarcane' ? 70 + i * 60 + rnd() * 10 : 70 + rnd() * 500
    const y = crop === 'sugarcane' ? 250 : 60 + rnd() * 380
    const rx = between(look.rx) * (bad && crop !== 'sugarcane' ? 0.75 : 1)
    const ry = between(look.ry) * (bad && crop !== 'sugarcane' ? 0.75 : 1)
    const hue = bad ? between(look.hue) + 25 : between(look.hue)
    const sat = bad ? look.sat * 0.6 : look.sat
    const light = bad ? between(look.light) + 6 : between(look.light)

    g.save()
    g.translate(x, y)
    g.rotate(crop === 'sugarcane' ? (rnd() - 0.5) * 0.12 : rnd() * Math.PI)
    // soft contact shadow
    g.fillStyle = 'rgba(60,40,20,0.18)'
    g.beginPath()
    g.ellipse(3, 4, rx, ry, 0, 0, Math.PI * 2)
    g.fill()
    const grd = g.createRadialGradient(-rx * 0.35, -ry * 0.35, 1, 0, 0, Math.max(rx, ry))
    grd.addColorStop(0, `hsl(${hue},${sat}%,${light + 18}%)`)
    grd.addColorStop(1, `hsl(${hue},${sat}%,${light}%)`)
    g.fillStyle = grd
    g.beginPath()
    g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    g.fill()

    if (crop === 'sugarcane') {
      g.strokeStyle = `hsl(${hue},${sat}%,${light - 15}%)`
      g.lineWidth = 2
      for (let k = -ry + 40; k < ry; k += 55) {
        g.beginPath()
        g.moveTo(-rx, k)
        g.lineTo(rx, k)
        g.stroke()
      }
    }
    if (crop === 'kulachi_melon') {
      g.strokeStyle = `hsla(${hue},${sat}%,${light - 20}%,0.5)`
      g.lineWidth = 1.5
      for (let k = -2; k <= 2; k++) {
        g.beginPath()
        g.ellipse(0, 0, Math.abs(k) * rx * 0.3 + 4, ry, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    if (bad) {
      // bruise or rot, sometimes an unripe green patch
      g.fillStyle = rnd() > 0.4 ? '#161009' : '#6d8d3c'
      g.beginPath()
      g.ellipse((rnd() - 0.5) * rx, (rnd() - 0.5) * ry * 0.6, Math.max(3, rx * 0.55), Math.max(4, Math.min(ry, 60) * 0.45), 0, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }

  return canvas.toDataURL('image/jpeg', 0.78)
}
