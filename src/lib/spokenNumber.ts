/*
  Turn a spoken weight into kilos: "500", "۵۰۰ کلو", "پانچ سو کلو",
  "دس من" (maund = 40 kg), "two thousand kilo". Returns null when no number
  was heard, so the field is left alone.
*/

const UR_NUMBERS = (
  'صفر ایک دو تین چار پانچ چھ سات آٹھ نو دس گیارہ بارہ تیرہ چودہ پندرہ سولہ سترہ اٹھارہ انیس ' +
  'بیس اکیس بائیس تیئیس چوبیس پچیس چھبیس ستائیس اٹھائیس انتیس تیس اکتیس بتیس تینتیس چونتیس ' +
  'پینتیس چھتیس سینتیس اڑتیس انتالیس چالیس اکتالیس بیالیس تینتالیس چوالیس پینتالیس چھیالیس ' +
  'سینتالیس اڑتالیس انچاس پچاس اکیاون باون ترپن چون پچپن چھپن ستاون اٹھاون انسٹھ ساٹھ اکسٹھ ' +
  'باسٹھ تریسٹھ چونسٹھ پینسٹھ چھیاسٹھ سڑسٹھ اڑسٹھ انہتر ستر اکہتر بہتر تہتر چوہتر پچہتر چھہتر ' +
  'ستتر اٹھہتر اناسی اسی اکیاسی بیاسی تراسی چوراسی پچاسی چھیاسی ستاسی اٹھاسی نواسی نوے اکیانوے ' +
  'بانوے ترانوے چورانوے پچانوے چھیانوے ستانوے اٹھانوے ننانوے'
).split(' ')

const EN_NUMBERS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

const WORD: Record<string, number> = { ...EN_NUMBERS }
UR_NUMBERS.forEach((w, i) => (WORD[w] = i))
// common spoken spellings
Object.assign(WORD, { چھے: 6, 'تئیس': 23, 'اک': 1 })

const SCALE: Record<string, number> = { سو: 100, hundred: 100, ہزار: 1000, thousand: 1000, لاکھ: 100000, lakh: 100000, lac: 100000 }
const MAUND_WORDS = new Set(['من', 'مَن', 'maund', 'maunds', 'mun', 'mann'])
const HALF: Record<string, number> = { ڈیڑھ: 1.5, ڈھائی: 2.5 }

function toAsciiDigits(s: string) {
  return s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

export function parseSpokenKg(raw: string): number | null {
  const text = toAsciiDigits(raw.toLowerCase()).replace(/[,،]/g, '')
  const maund = text.split(/[\s.،,]+/).some((w) => MAUND_WORDS.has(w))
  let value: number | null = null

  const digits = text.match(/\d+(\.\d+)?/)
  if (digits) {
    value = Number(digits[0])
    // "5 ہزار", "2 thousand"
    const after = text.slice(text.indexOf(digits[0]) + digits[0].length).trim().split(/\s+/)[0]
    if (after && SCALE[after]) value *= SCALE[after]
  } else {
    let total = 0
    let current = 0
    let seen = false
    let sadhe = false
    for (const w of text.split(/[\s-]+/)) {
      if (w === 'ساڑھے') {
        sadhe = true
        continue
      }
      if (HALF[w] !== undefined) {
        current += HALF[w]
        seen = true
      } else if (WORD[w] !== undefined) {
        current += WORD[w] + (sadhe ? 0.5 : 0)
        sadhe = false
        seen = true
      } else if (SCALE[w]) {
        const scale = SCALE[w]
        if (scale === 100) current = (current || 1) * 100
        else {
          total += (current || 1) * scale
          current = 0
        }
        seen = true
      }
    }
    if (seen) value = total + current
  }
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(maund ? value * 40 : value)
}

/** Urdu clip keys for a number: 250 -> دو سو پچاس, 12.5 -> ساڑھے بارہ, 8000 -> آٹھ ہزار. */
export function numberSegs(value: number): string[] {
  const n = Math.round(Math.abs(value) * 2) / 2
  const whole = Math.floor(n)
  if (n - whole === 0.5 && whole < 100) {
    if (whole === 0) return ['n.0'] // not used for prices; avoids "half" wording
    if (whole === 1) return ['n.derh']
    if (whole === 2) return ['n.dhai']
    return ['n.sadhe', ...intSegs(whole)]
  }
  return intSegs(Math.round(n))
}

function intSegs(n: number): string[] {
  if (n < 100) return [`n.${n}`]
  const out: string[] = []
  const lakh = Math.floor(n / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const hundred = Math.floor((n % 1000) / 100)
  const rest = n % 100
  if (lakh) out.push(...intSegs(Math.min(lakh, 99)), 'n.lakh')
  if (thousand) out.push(`n.${thousand}`, 'n.thousand')
  if (hundred) out.push(`n.${hundred}`, 'n.hundred')
  if (rest) out.push(`n.${rest}`)
  return out
}
