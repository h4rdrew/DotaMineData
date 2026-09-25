import type { ItemHistory } from '../../../shared/contracts'

export interface DailyPrice {
  date: string
  steam: number | null
  dmarket: number | null
}

export function dailyPrices(history: ItemHistory[]): DailyPrice[] {
  const days = new Map<string, DailyPrice>()
  const ordered = [...history].sort((a, b) => a.DateTime.localeCompare(b.DateTime))
  for (const row of ordered) {
    if (!Number.isFinite(row.Price) || row.Price <= 0 || ![1, 2].includes(row.ServiceType)) continue
    const date = row.DateTime.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) continue
    const day = days.get(date) ?? { date, steam: null, dmarket: null }
    if (row.ServiceType === 1) day.steam = row.Price
    else day.dmarket = row.Price
    days.set(date, day)
  }
  return [...days.values()]
}

export function historicalLow(
  history: ItemHistory[],
  service: 1 | 2
): { Price: number; DateTime: string } | null {
  let low: { Price: number; DateTime: string } | null = null
  for (const day of dailyPrices(history)) {
    const price = service === 1 ? day.steam : day.dmarket
    if (price !== null && (!low || price <= low.Price)) {
      low = { Price: price, DateTime: day.date }
    }
  }
  return low
}

export function priceSummary(values: (number | null)[]): {
  min: number
  max: number
  average: number
  count: number
} | null {
  const valid = values.filter(
    (value): value is number => value !== null && Number.isFinite(value) && value > 0
  )
  if (!valid.length) return null
  return {
    min: Math.min(...valid),
    max: Math.max(...valid),
    average: valid.reduce((sum, value) => sum + value, 0) / valid.length,
    count: valid.length
  }
}
