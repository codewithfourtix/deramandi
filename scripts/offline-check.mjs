// End-to-end check in headless Chrome.
//   npm run build && npx serve -s dist -l 4173   then   node scripts/offline-check.mjs
//   BASE=https://deramandi.vercel.app node scripts/offline-check.mjs   (live site; first visit precaches ~10 MB)
// Needs Google Chrome at the path below (edit CHROME for your machine).
// Steps:
// 1. online first visit: service worker precaches app + khajoor model + voice
// 2. online: Settings > Download all models (caches sugarcane + melon)
// 3. offline: khajoor sample -> grade (model), sugarcane drawn sample -> grade (model)
// 4. live camera guide with Chrome's fake camera: shutter adds a photo
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://localhost:4173'
const port = 9335
const profile = mkdtempSync(join(tmpdir(), 'dm-chrome-'))
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=412,900', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let targets
for (let i = 0; i < 40; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
    if (targets.length) break
  } catch {}
  await sleep(250)
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const logs = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method === 'Runtime.exceptionThrown') logs.push('EXC ' + msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description ?? ''))
  else if (msg.method === 'Runtime.consoleAPICalled' && ['error'].includes(msg.params.type)) logs.push(msg.params.type + ' ' + msg.params.args.map((a) => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.exception?.description }
  return r.result?.result?.value
}
const newestListing = `(() => new Promise((res) => { const q = indexedDB.open('deramandi'); q.onsuccess = () => { const tx = q.result.transaction('listings'); const g = tx.objectStore('listings').getAll(); g.onsuccess = () => { const l = g.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; res(l ? { crop: l.crop, grade: l.grade, source: l.gradeSource, probs: l.gradeProbabilities } : null) } }; q.onerror = () => res(null) }))()`

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

// 1. first visit online
await send('Page.navigate', { url: BASE + '/' })
let pre
for (let i = 0; i < 420; i++) {
  await sleep(1000)
  pre = await ev(`(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const urls = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    return { active: !!(reg && reg.active), n: urls.length, khajoor: urls.filter(u => u.startsWith('/model/')).length, voice: urls.filter(u => u.startsWith('/voice/')).length };
  })()`)
  if (pre?.active && pre.khajoor >= 3 && pre.voice > 100) break
}
console.log('1 first visit ->', JSON.stringify(pre))
await send('Page.reload') // let the service worker control the page
await sleep(2500)

// 2. download all crop models from Settings
await send('Page.navigate', { url: BASE + '/settings' })
await sleep(2500)
const dl = await ev(`(async () => {
  const b = [...document.querySelectorAll('button')].find(b => /Download all models|سب ماڈل/.test(b.textContent));
  if (!b) return 'no button';
  b.click();
  for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 1000)); const t = document.querySelector('#offline-title')?.parentElement?.querySelector('[aria-live]')?.textContent || ''; if (/All crop models|سب ماڈل اس فون/.test(t) || /stopped|رک گیا/.test(t)) return t; }
  return 'timeout';
})()`)
const models = await ev(`(async () => { const c = await caches.open('crop-models'); return (await c.keys()).map(r => new URL(r.url).pathname) })()`)
console.log('2 download all models ->', dl, '| cached:', JSON.stringify(models))

// 3. offline grading
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
async function gradeOffline(crop, sampleButtons) {
  await ev(`sessionStorage.setItem('deramandi.draft', JSON.stringify({crop:'${crop}', variety:'', quantityKg: 1500, location:'dik_city', photos: []})); 'ok'`)
  await send('Page.navigate', { url: BASE + '/list/photos' })
  await sleep(2500)
  const n = await ev(`(async () => {
    document.querySelector('details summary').click();
    await new Promise(r => setTimeout(r, 300));
    const btns = [...document.querySelectorAll('details button')];
    for (const i of ${JSON.stringify(sampleButtons)}) { btns[i].click(); await new Promise(r => setTimeout(r, 1200)); }
    return document.querySelectorAll('main ul img').length;
  })()`)
  await ev(`[...document.querySelectorAll('main button.btn-primary')].pop().click(); 'ok'`)
  let r
  for (let i = 0; i < 40; i++) {
    await sleep(1000)
    r = await ev(`(async () => ({ path: location.pathname, alert: document.querySelector('[role=alert]')?.textContent || null, listing: location.pathname.startsWith('/listing/') ? await ${newestListing} : null }))()`)
    if (r?.listing || r?.alert) break
  }
  console.log(`3 offline ${crop}: photos ${n} ->`, JSON.stringify(r))
  return r?.listing?.source === 'model' && r.listing.crop === crop
}
const okKhajoor = await gradeOffline('dhakki_dates', [0, 2])
const okCane = await gradeOffline('sugarcane', [0, 2])
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })

// 4. camera guide with the fake camera
await ev(`localStorage.setItem('deramandi.lang','en'); sessionStorage.setItem('deramandi.draft', JSON.stringify({crop:'kulachi_melon', variety:'', quantityKg: 800, location:'dik_city', photos: []})); 'ok'`)
await send('Page.navigate', { url: BASE + '/list/photos' })
await sleep(2500)
const cam = await ev(`(async () => {
  const takeBtn = [...document.querySelectorAll('main button')].find(b => /Take photo|تصویر لیں/.test(b.textContent));
  takeBtn.click();
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 500)); const v = document.querySelector('[role=dialog] video'); if (v && v.videoWidth) break; }
  const v = document.querySelector('[role=dialog] video');
  const status = document.querySelector('[role=dialog] [aria-live]')?.textContent;
  const shutter = document.querySelector('[role=dialog] button[aria-label="Take photo"], [role=dialog] button[aria-label="تصویر لیں"]');
  shutter?.click(); await new Promise(r => setTimeout(r, 1500));
  shutter?.click(); await new Promise(r => setTimeout(r, 1500));
  const open = !!document.querySelector('[role=dialog]');
  shutter?.click(); await new Promise(r => setTimeout(r, 1500));
  const closedItself = !document.querySelector('[role=dialog]');
  [...document.querySelectorAll('[role=dialog] button')].find(b => /Done|مکمل/.test(b.textContent))?.click();
  await new Promise(r => setTimeout(r, 800));
  return { video: v ? v.videoWidth + 'x' + v.videoHeight : null, status, stillOpenAfter2: open, closedAfter3: closedItself, photos: document.querySelectorAll('main ul img').length, dialogClosed: !document.querySelector('[role=dialog]') };
})()`)
console.log('4 camera guide ->', JSON.stringify(cam))

console.log('console errors:', logs.length ? logs.slice(0, 8) : 'none')
const pass = okKhajoor && okCane && cam?.photos === 3 && cam.stillOpenAfter2 && cam.closedAfter3
console.log(pass ? 'PASS' : 'FAIL', JSON.stringify({ okKhajoor, okCane, camera: cam?.photos === 3 }))
ws.close()
proc.kill()
process.exit(0)
