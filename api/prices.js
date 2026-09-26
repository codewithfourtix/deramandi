import { fetchAmis, SUGARCANE } from './_amis.js'

/*
  GET /api/prices: today's AMIS Punjab mandi rates for dates, melon and wheat,
  plus the latest sugarcane mill price, all in PKR per kg with source and date.
  Cached at Vercel's edge for 6 hours; the app falls back to its built-in
  snapshot (src/data/marketPrices.json) if this is unreachable.
*/
export default async function handler(req, res) {
  try {
    const live = await fetchAmis()
    const body = {
      fetchedAt: new Date().toISOString(),
      crops: { ...live, sugarcane: SUGARCANE },
    }
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.status(200).json(body)
  } catch (err) {
    res.status(502).json({ error: 'could not reach AMIS', detail: String(err) })
  }
}
