import modelCard from '../data/modelCard.json'
import type { Grade } from '../types'
import { loadImage } from './image'

/*
  The trained khajoor grade model (MobileNetV2, see ml/train.py), run in the
  browser with TensorFlow.js. Loaded lazily the first time a khajoor listing is
  graded, so the rest of the app never pays for it.

  Preprocessing mirrors ml/preprocess.py exactly: find the fruit against the
  border colour, crop to it with a 6% margin, pad to a square with the border
  colour, resize to 224. Each photo is scored as three views (as is, mirrored,
  upside down) and the probabilities averaged, same as the measured test run.
*/

const MODEL_URL = '/model/model.json'
const SIZE = 224
const WORK = 384 // working resolution for finding the fruit
const THRESHOLD = 48
const MARGIN = 0.06
export const GRADES: Grade[] = ['A', 'B', 'C']

type Tf = typeof import('@tensorflow/tfjs-core')
type LayersModel = import('@tensorflow/tfjs-layers').LayersModel

let loading: Promise<{ tf: Tf; model: LayersModel }> | null = null

export function loadGradeModel() {
  if (!loading) {
    loading = (async () => {
      const [tf, layers] = await Promise.all([import('@tensorflow/tfjs-core'), import('@tensorflow/tfjs-layers')])
      await Promise.all([import('@tensorflow/tfjs-backend-webgl'), import('@tensorflow/tfjs-backend-cpu')])
      try {
        if (!(await tf.setBackend('webgl'))) throw new Error('webgl unavailable')
      } catch {
        await tf.setBackend('cpu') // old phones without WebGL still work, just slower
      }
      await tf.ready()
      const model = await layers.loadLayersModel(MODEL_URL)
      return { tf, model }
    })().catch((err) => {
      loading = null // allow a retry next time (e.g. after coming back online)
      throw err
    })
  }
  return loading
}

/** Crop the fruit out of a photo and return 224x224 RGBA pixels, like ml/preprocess.py. */
export function cropToFruit(img: HTMLImageElement | HTMLCanvasElement): { pixels: ImageData; hue: number; val: number } {
  const w0 = img.width
  const h0 = img.height
  const scale = Math.min(1, WORK / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })!
  wctx.drawImage(img, 0, 0, w, h)
  const px = wctx.getImageData(0, 0, w, h).data

  // border colour: mean of a 4px ring
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= 4 && x < w - 4 && y >= 4 && y < h - 4) continue
      const i = (y * w + x) * 4
      r += px[i]
      g += px[i + 1]
      b += px[i + 2]
      n++
    }
  }
  r /= n
  g /= n
  b /= n

  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  let count = 0
  const hues: number[] = []
  const vals: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (Math.hypot(px[i] - r, px[i + 1] - g, px[i + 2] - b) < THRESHOLD) continue
      count++
      if ((x + y) % 3 === 0) {
        const [hh, vv] = hueVal(px[i], px[i + 1], px[i + 2])
        hues.push(hh)
        vals.push(vv)
      }
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }

  let sx = 0
  let sy = 0
  let sw = w
  let sh = h
  if (count > w * h * 0.02) {
    const my = Math.floor((y1 + 1 - y0) * MARGIN)
    const mx = Math.floor((x1 + 1 - x0) * MARGIN)
    sx = Math.max(0, x0 - mx)
    sy = Math.max(0, y0 - my)
    sw = Math.min(w, x1 + 1 + mx) - sx
    sh = Math.min(h, y1 + 1 + my) - sy
  }

  const side = Math.max(sw, sh)
  const out = document.createElement('canvas')
  out.width = SIZE
  out.height = SIZE
  const octx = out.getContext('2d', { willReadFrequently: true })!
  octx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
  octx.fillRect(0, 0, SIZE, SIZE)
  const k = SIZE / side
  octx.drawImage(work, sx, sy, sw, sh, ((side - sw) / 2) * k, ((side - sh) / 2) * k, sw * k, sh * k)
  return { pixels: octx.getImageData(0, 0, SIZE, SIZE), hue: median(hues), val: median(vals) }
}

// Hue in -180..180 (khajoor sits around red-brown, near 0) and brightness 0..1.
function hueVal(r: number, g: number, b: number): [number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  if (h > 180) h -= 360
  if (h < -180) h += 360
  return [h, max / 255]
}

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/*
  Measured on all 3,004 dataset photos (ml/colour_stats.py): dried khajoor has
  a median hue between about -108 and 26 degrees and brightness 0.11 to 0.51.
  Well outside that (yellow/green, or very pale) the model is guessing about
  something it never saw: fresh doka fruit, or a different crop.
*/
function looksUnfamiliar(hue: number, val: number) {
  return (hue > 38 && hue < 200) || val > 0.72
}

export interface ModelGrade {
  probabilities: Record<Grade, number>
  perPhoto: Grade[]
  /** True when a photo's colours fall well outside the khajoor the model learned from. */
  unfamiliar: boolean
}

export async function gradeWithModel(images: string[]): Promise<ModelGrade> {
  const { tf, model } = await loadGradeModel()
  const crops = await Promise.all(images.map(async (src) => cropToFruit(await loadImage(src))))
  const pixels = crops.map((c) => c.pixels)

  const perPhotoProbs = tf.tidy(() => {
    const batch = tf.stack(pixels.map((p) => tf.cast(tf.browser.fromPixels(p, 3), 'float32'))) as import('@tensorflow/tfjs-core').Tensor4D
    const views = [batch, tf.reverse(batch, 2), tf.reverse(batch, [1, 2])]
    const probs = views.map((v) => model.predict(v) as import('@tensorflow/tfjs-core').Tensor2D)
    return tf.div(tf.addN(probs), views.length).arraySync() as number[][]
  })

  const avg = [0, 1, 2].map((c) => perPhotoProbs.reduce((s, p) => s + p[c], 0) / perPhotoProbs.length)
  const mean = calibrate(avg)
  return {
    probabilities: { A: mean[0], B: mean[1], C: mean[2] },
    perPhoto: perPhotoProbs.map((p) => GRADES[p.indexOf(Math.max(...p))]),
    unfamiliar: crops.some((c) => looksUnfamiliar(c.hue, c.val)),
  }
}

/*
  Temperature scaling, fitted on the validation split (ml/train.py): softens or
  sharpens the model's probabilities so "82% sure" matches how often it is
  right at that level. Same as softmax(logits / T); the chosen grade never changes.
*/
function calibrate(p: number[]): number[] {
  const T = (modelCard as { temperature?: number }).temperature ?? 1
  const q = p.map((x) => Math.pow(Math.max(x, 1e-7), 1 / T))
  const sum = q.reduce((a, b) => a + b, 0)
  return q.map((x) => x / sum)
}
