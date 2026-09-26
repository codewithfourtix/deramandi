import { CROP_CARDS, MODEL_DIR } from './cropModels'

/*
  Fetch every crop model once so the service worker's crop-models cache holds
  it (vite.config.ts runtimeCaching). After this, all four crops grade offline.
*/


export function cropModelsMB() {
  return Math.round(Object.values(CROP_CARDS).reduce((s, c) => s + (c?.weightsMB ?? 0), 0))
}

export async function downloadAllModels(onProgress?: (done: number, total: number) => void) {
  const files: string[] = []
  for (const d of Object.keys(CROP_CARDS).map((c) => MODEL_DIR[c])) {
    const url = `/models/${d}/model.json`
    const res = await fetch(url)
    if (!res.ok) continue
    const json = (await res.json()) as { weightsManifest: { paths: string[] }[] }
    files.push(...json.weightsManifest.flatMap((g) => g.paths.map((p) => `/models/${d}/${p}`)))
  }
  let done = 0
  onProgress?.(0, files.length)
  for (const f of files) {
    const r = await fetch(f)
    if (!r.ok) throw new Error(`${f}: ${r.status}`)
    await r.arrayBuffer()
    onProgress?.(++done, files.length)
  }
  return files.length
}
