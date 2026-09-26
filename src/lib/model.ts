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

const loaded = new Map<string, Promise<{ tf: Tf; model: LayersModel }>>()

/** Load (once) any of the app's TF.js models: khajoor at /model/, others at /models/<crop>/. */
export function loadModelAt(url: string) {
  let p = loaded.get(url)
  if (!p) {
    p = (async () => {
      const [tf, layers] = await Promise.all([import('@tensorflow/tfjs-core'), import('@tensorflow/tfjs-layers')])
      await Promise.all([import('@tensorflow/tfjs-backend-webgl'), import('@tensorflow/tfjs-backend-cpu')])
      if (tf.getBackend() !== 'webgl' && tf.getBackend() !== 'cpu') {
        try {
          if (!(await tf.setBackend('webgl'))) throw new Error('webgl unavailable')
        } catch {
          await tf.setBackend('cpu') // old phones without WebGL still work, just slower
        }
      }
      await tf.ready()
      const model = await layers.loadLayersModel(url)
      return { tf, model }
    })().catch((err) => {
      loaded.delete(url) // allow a retry next time (e.g. after coming back online)
      throw err
    })
    loaded.set(url, p)
  }
  return p
}

export function loadGradeModel() {
  return loadModelAt(MODEL_URL)
}

/** Probabilities per image, averaged over three views (as is, mirrored, upside down). */
export function predictTTA(tf: Tf, model: LayersModel, pixels: ImageData[]): number[][] {
  return tf.tidy(() => {
    const batch = tf.stack(pixels.map((p) => tf.cast(tf.browser.fromPixels(p, 3), 'float32'))) as import('@tensorflow/tfjs-core').Tensor4D
    const views = [batch, tf.reverse(batch, 2), tf.reverse(batch, [1, 2])]
    const probs = views.map((v) => model.predict(v) as import('@tensorflow/tfjs-core').Tensor2D)
    return tf.div(tf.addN(probs), views.length).arraySync() as number[][]
  })
}

/** Temperature scaling (softmax(logits / T) expressed on probabilities). */
export function calibrateWith(p: number[], T: number): number[] {
  const q = p.map((x) => Math.pow(Math.max(x, 1e-7), 1 / T))
  const sum = q.reduce((a, b) => a + b, 0)
  return q.map((x) => x / sum)
}

/** Crop the fruit out of a photo and return 224x224 RGBA pixels, like ml/preprocess.py. */
export function cropToFruit(img: HTMLImageElement | HTMLCanvasElement, size = SIZE): { pixels: ImageData; hue: number; val: number } {
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
  out.width = size
  out.height = size
  const octx = out.getContext('2d', { willReadFrequently: true })!
  octx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
  octx.fillRect(0, 0, size, size)
  const k = size / side
  octx.drawImage(work, sx, sy, sw, sh, ((side - sw) / 2) * k, ((side - sh) / 2) * k, sw * k, sh * k)
  return { pixels: octx.getImageData(0, 0, size, size), hue: median(hues), val: median(vals) }
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
  The guard's thresholds come from the model card: ml/export.py measures the
  fruit colours of the varieties the model was trained on (ml/colour_stats.py)
  and adds a margin. For the shipped training set that is hue 38 and brightness
  0.72, the fallback below. Retraining with Dhakki moves the guard to Dhakki's
  real colours. Well outside the range (yellow/green, or very pale) the model is
  guessing about something it never saw: fresh doka fruit, or a different crop.
*/
const GUARD = (modelCard as { colourGuard?: { hueMax?: number; valMax?: number } }).colourGuard ?? {}
const HUE_MAX = GUARD.hueMax ?? 38
const VAL_MAX = GUARD.valMax ?? 0.72

export function looksUnfamiliar(hue: number, val: number) {
  return hue > HUE_MAX || val > VAL_MAX
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

  const perPhotoProbs = predictTTA(tf, model, pixels)

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
  return calibrateWith(p, (modelCard as { temperature?: number }).temperature ?? 1)
}
