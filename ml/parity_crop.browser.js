// Paste into the browser console on the running app (npm run dev) after
// `python parity_crop.py <crop>`. Grades every parity photo through the same
// path as a real upload (640px JPEG, then gradeCrop) and compares with the
// Keras model and the dataset label. Set CROP / DIR for the crop you prepared.
const CROP = 'sugarcane' // or 'kulachi_melon'
const DIR = '/__parity_sugarcane' // or '/__parity_melon'
const GRADES = CROP === 'sugarcane' ? ['A', 'C'] : ['A', 'B', 'C']
const { fileToDataUrl } = await import('/src/lib/image.ts')
const { gradeCrop } = await import('/src/lib/grader.ts')
const expected = await (await fetch(`${DIR}/expected.json`)).json()
const r = { n: 0, agreeWithPython: 0, correct: 0, pythonCorrect: 0, rejected: [], errors: [] }
for (const e of expected) {
  const blob = await (await fetch(`${DIR}/${e.file}`)).blob()
  const url = await fileToDataUrl(new File([blob], e.file, { type: blob.type }))
  r.n++
  const py = e.python.indexOf(Math.max(...e.python))
  if (py === e.label) r.pythonCorrect++
  try {
    const m = await gradeCrop([url], CROP)
    if (m.grade === GRADES[py]) r.agreeWithPython++
    if (m.grade === GRADES[e.label]) r.correct++
  } catch (err) {
    ;(err.issue ? r.rejected : r.errors).push(`${e.file}: ${err.issue ?? err.message}`)
  }
}
console.log(r)
