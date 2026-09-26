/*
  Reads daily mandi rates from AMIS Punjab (Agriculture Marketing Information
  Service, www.amis.pk). AMIS publishes Rs per 100 kg per market, over plain
  HTTP and as HTML only, so a browser app cannot read it directly; this runs on
  the server (api/prices.js) and in scripts/fetch-prices.mjs for the built-in
  snapshot. Files starting with "_" are not deployed as routes.
*/

export const SOURCE_URL = 'http://www.amis.pk/ViewPrices.aspx?searchType=0&commodityId='

// AMIS commodity ids. D.I. Khan itself is not covered (AMIS is Punjab only),
// and AMIS lists Aseel and Irani dates, not Dhakki.
export const COMMODITIES = {
  wheat: [{ id: 1, name: 'Wheat' }],
  dhakki_dates: [
    { id: 81, name: 'Dates (Aseel)' },
    { id: 141, name: 'Dates (Irani)' },
  ],
  kulachi_melon: [{ id: 100, name: 'Sweet Musk Melon' }],
}

// Markets nearest D.I. Khan first (across the Indus in Bhakkar, D.G. Khan, Layyah, Multan).
export const NEAR_DIK = ['Kalurkot', 'DGKhan', 'Taunsa', 'Bhakkar', 'Layyah', 'Darya Khan', 'Multan', 'Mianwali']

const strip = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;?/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()

/** Parse one AMIS commodity page into { date, markets: [{ market, min, max }] } in Rs/100 kg. */
export function parseAmis(html) {
  const dated = html.match(/Dated:\s*(\d{2})-(\d{2})-(\d{4})/)
  const date = dated ? `${dated[3]}-${dated[2]}-${dated[1]}` : null
  const markets = []
  for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(strip)
    if (cells.length < 4) continue
    // first cell looks like "2 Faisalabad"
    const m = cells[0].match(/^\s*\d+\s+(.+)$/)
    if (!m) continue
    const min = Number(cells[2].replace(/,/g, ''))
    const max = Number(cells[3].replace(/,/g, ''))
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) continue
    // AMIS occasionally has an order-of-magnitude typo; skip rows 20x off the row's own max
    if (max < min || max > min * 3) continue
    markets.push({ market: m[1].trim(), min, max })
  }
  return { date, markets }
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

/** Summarise into PKR per kg: overall range, median, and markets nearest D.I. Khan first. */
export function summarise(pages) {
  const markets = pages.flatMap((p) => p.markets.map((m) => ({ ...m, commodity: p.name })))
  if (!markets.length) return null
  const perKg = markets.map((m) => ({ market: m.market, commodity: m.commodity, min: m.min / 100, max: m.max / 100 }))
  const rank = (name) => {
    const i = NEAR_DIK.findIndex((n) => n.toLowerCase() === name.toLowerCase())
    return i === -1 ? 99 : i
  }
  perKg.sort((a, b) => rank(a.market) - rank(b.market) || a.market.localeCompare(b.market))
  // use the middle 80% of markets for the range, so one odd market does not stretch it
  const lows = perKg.map((m) => m.min).sort((a, b) => a - b)
  const highs = perKg.map((m) => m.max).sort((a, b) => a - b)
  const cut = (arr, q) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(q * (arr.length - 1))))]
  return {
    date: pages.map((p) => p.date).filter(Boolean).sort().pop() || null,
    min: round(cut(lows, 0.1)),
    max: round(cut(highs, 0.9)),
    median: round(median(perKg.map((m) => (m.min + m.max) / 2))),
    markets: perKg.map((m) => ({ ...m, min: round(m.min), max: round(m.max) })),
    commodities: pages.map((p) => p.name),
  }
}

const round = (x) => Math.round(x * 10) / 10

export async function fetchAmis(fetchImpl = fetch, timeoutMs = 20000) {
  const out = {}
  await Promise.all(
    Object.entries(COMMODITIES).map(async ([crop, list]) => {
      const pages = await Promise.all(
        list.map(async (c) => {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), timeoutMs)
          try {
            const res = await fetchImpl(SOURCE_URL + c.id, { signal: ctrl.signal, headers: { 'User-Agent': 'DeraMandi/1.0 (+https://deramandi.vercel.app)' } })
            return { ...parseAmis(await res.text()), name: c.name, url: SOURCE_URL + c.id }
          } catch {
            return { date: null, markets: [], name: c.name, url: SOURCE_URL + c.id }
          } finally {
            clearTimeout(timer)
          }
        }),
      )
      const s = summarise(pages)
      if (s) out[crop] = { ...s, source: 'AMIS Punjab (amis.pk)', urls: pages.map((p) => p.url) }
    }),
  )
  return out
}

// Sugarcane has no daily mandi rate: it is sold to mills at a government or
// "indicative" price. Latest figures found (see src/data/marketPrices.json).
export const SUGARCANE = {
  min: 12.5,
  max: 13.75,
  median: 13.1,
  date: '2025-12-08',
  source: 'Indicative mill price Rs 500–550 per 40 kg, 2025-26 season (Profit / Pakistan Today, 8 Dec 2025). Last notified Punjab price: Rs 400 per 40 kg (2023-24).',
  urls: ['https://profit.pakistantoday.com.pk/2025/12/08/sugarcane-prices-set-at-rs500-550-per-maund-farmers-interests-safeguarded'],
  markets: [],
  commodities: ['Sugarcane (mill gate)'],
}
