// Paste into the browser console on the running app (npm run dev) after
// `python make_wheat_handfuls.py` (and export_crop.py wheat, so a wheat model
// card exists). Runs the app's full wheat pipeline on each synthetic handful:
// find kernels, classify, correct the shares, grade the lot. The gate for
// shipping a wheat model: truth-A lots grade A or B, and grade agreement beats
// always answering C.
const DIR = '/__parity_wheat_lots'
const { fileToDataUrl } = await import('/src/lib/image.ts')
const { gradeWithCropModel, wheatLotGrade, WHEAT_GROUP, CROP_CARDS } = await import('/src/lib/cropModels.ts')
const labels = CROP_CARDS.wheat.labels
const truth = await (await fetch(`${DIR}/truth.json`)).json()
const rows = []
const t0 = performance.now()
for (const tr of truth) {
  const b = await (await fetch(`${DIR}/${tr.file}`)).blob()
  const url = await fileToDataUrl(new File([b], tr.file, { type: 'image/jpeg' }), 1600, 0.85)
  const r = await gradeWithCropModel([url], 'wheat')
  const g = [0, 0, 0]
  labels.forEach((l, i) => (g[WHEAT_GROUP[i]] += r.kernels.byClass[l]))
  const raw = g.map((x) => x / (r.kernels.total || 1))
  rows.push({ file: tr.file, placed: tr.kernels, found: r.kernels.total, truthSound: tr.groupShares[0], rawSound: raw[0], corrected: r.probabilities.A, truth: tr.grade, raw: wheatLotGrade(raw), app: r.grade })
}
const always = rows.filter((r) => r.truth === 'C').length
console.table(rows)
console.log({ msPerHandful: Math.round((performance.now() - t0) / rows.length), appRight: rows.filter((r) => r.app === r.truth).length, alwaysC: always, n: rows.length, truthAasAorB: rows.filter((r) => r.truth === 'A' && r.app !== 'C').length + '/' + rows.filter((r) => r.truth === 'A').length })
