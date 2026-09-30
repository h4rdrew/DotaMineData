import type { Item, ItemHistory } from '../../../shared/contracts'

export type Ownership = 'all' | 'owned' | 'unowned'
export interface ItemMovement {
  item: Item
  service: number
  firstDate: string
  lastDate: string
  first: number
  last: number
  change: number
  percent: number
  drops: number
  observations: number
}

export function generalStatistics(
  items: Item[],
  history: ItemHistory[],
  endDate: string,
  period: number,
  ownership: Ownership
): { items: number; movements: ItemMovement[] } {
  const start = new Date(Date.parse(endDate) - period * 86400000).toISOString().slice(0, 10)
  const selected = items.filter(
    (item) => ownership === 'all' || Boolean(item.Purchased) === (ownership === 'owned')
  )
  const byId = new Map(selected.map((item) => [item.ItemId, item]))
  const groups = new Map<string, Map<string, ItemHistory>>()
  for (const row of [...history].sort((a, b) => a.DateTime.localeCompare(b.DateTime))) {
    const date = row.DateTime.slice(0, 10)
    if (
      !byId.has(row.ItemId) ||
      ![1, 2].includes(row.ServiceType) ||
      !Number.isFinite(row.Price) ||
      row.Price <= 0 ||
      date < start ||
      date > endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date))
    )
      continue
    const key = `${row.ItemId}:${row.ServiceType}`
    const days = groups.get(key) ?? new Map<string, ItemHistory>()
    days.set(date, row)
    groups.set(key, days)
  }
  const movements: ItemMovement[] = []
  for (const days of groups.values()) {
    const rows = [...days.values()]
    if (rows.length < 2) continue
    const first = rows[0]
    const last = rows[rows.length - 1]
    const change = last.Price - first.Price
    movements.push({
      item: byId.get(first.ItemId)!,
      service: first.ServiceType,
      firstDate: first.DateTime.slice(0, 10),
      lastDate: last.DateTime.slice(0, 10),
      first: first.Price,
      last: last.Price,
      change,
      percent: (change / first.Price) * 100,
      drops: rows.slice(1).filter((row, index) => row.Price < rows[index].Price).length,
      observations: rows.length
    })
  }
  return { items: selected.length, movements }
}
