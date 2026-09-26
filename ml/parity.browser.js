// Paste into the browser console on the running app (npm run dev) after
// `python parity_prep.py`. Runs every parity photo through the SAME path as a
// real upload (downscale to 640px JPEG, then gradeCrop) and compares with the
// Keras model's grade and the dataset label.
const { fileToDataUrl } = await import('/src/lib/image.ts')
const { gradeCrop, gradeCropRulesOnly } = await import('/src/lib/grader.ts')
const expected = await (await fetch('/__parity/expected.json')).json()
const G = ['A', 'B', 'C']
const r = { n: 0, agreeWithPython: 0, modelCorrect: 0, rulesCorrect: 0, rejected: [], unfamiliar: 0, fallback: 0 }
for (const e of expected) {
  const blob = await (await fetch('/__parity/' + e.file)).blob()
  const url = await fileToDataUrl(new File([blob], e.file, { type: 'image/jpeg' }))
  r.n++
  try {
    const m = await gradeCrop([url], 'dhakki_dates')
    if (m.source !== 'model') r.fallback++
    if (m.unfamiliar) r.unfamiliar++
    const py = G[e.python.indexOf(Math.max(...e.python))]
    if (m.grade === py) r.agreeWithPython++
    if (m.grade === G[e.label]) r.modelCorrect++
  } catch (err) {
    r.rejected.push(e.file + ':' + (err.issue ?? err.message))
  }
  try {
    const h = await gradeCropRulesOnly([url], 'dhakki_dates')
    if (h.grade === G[e.label]) r.rulesCorrect++
  } catch {}
}
console.log(r)
