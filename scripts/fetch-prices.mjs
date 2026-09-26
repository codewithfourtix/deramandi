// Refresh the built-in price snapshot: node scripts/fetch-prices.mjs
// Writes src/data/marketPrices.json, used when /api/prices is unreachable (offline).
import { writeFileSync } from 'node:fs'
import { fetchAmis, SUGARCANE } from '../api/_amis.js'

const live = await fetchAmis(fetch, 60000)
const body = { fetchedAt: new Date().toISOString(), crops: { ...live, sugarcane: SUGARCANE } }
for (const [crop, v] of Object.entries(body.crops)) console.log(crop, v.date, `${v.min}–${v.max} PKR/kg`, `${v.markets.length} markets`)
writeFileSync(new URL('../src/data/marketPrices.json', import.meta.url), JSON.stringify(body, null, 2) + '\n')
