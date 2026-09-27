// Checks that an installed copy picks up a new deploy by itself.
//   node scripts/update-check.mjs      (expects `npx serve -s dist -l 4173` running; the script rebuilds dist once)
// 1. visit build A until the service worker is active and controlling
// 2. rebuild (build B, with a marker string) into the same dist/
// 3. reload once: the old worker serves A, the new one installs and takes over,
//    and the page should reload itself onto B with no second manual reload
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:4173'
const port = 9336
const profile = mkdtempSync(join(tmpdir(), 'dm-upd-'))
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) (pending.get(msg.id)(msg), pending.delete(msg.id))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value
const bundle = `[...document.scripts].map(s => s.src).find(s => s.includes('/assets/index-'))?.split('/').pop()`
await send('Page.enable')
await send('Runtime.enable')

await send('Page.navigate', { url: BASE + '/' })
for (let i = 0; i < 120; i++) {
  await sleep(1000)
  if (await ev(`!!navigator.serviceWorker.controller`)) break
  if (i === 20) await send('Page.reload')
}
const a = await ev(bundle)
console.log('A installed, page on', a)

// build B: same app with a visible marker, written over dist/
const en = 'src/i18n/en.json'
const original = readFileSync(en, 'utf8')
writeFileSync(en, original.replace('"privacy": "Your listings and photos stay on this phone."', '"privacy": "Your listings and photos stay on this phone. [build B]"'))
try {
  execSync('npx vite build', { stdio: 'ignore' })
} finally {
  writeFileSync(en, original)
}
const b = readFileSync('dist/index.html', 'utf8').match(/assets\/index-[^"]+\.js/)[0].split('/').pop()
console.log('B built', b)

await send('Page.reload') // one manual reload, as a grower reopening the app would
let now
for (let i = 0; i < 120; i++) {
  await sleep(1000)
  now = await ev(bundle)
  if (now === b) break
}
console.log('page now on', now)
console.log(now === b && now !== a ? 'PASS: updated to the new build by itself' : 'FAIL: still on the old build')
execSync('npx vite build', { stdio: 'ignore' }) // restore dist to the real build
ws.close()
proc.kill()
process.exit(0)
