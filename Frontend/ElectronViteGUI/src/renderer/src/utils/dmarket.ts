import type { ItemPrice } from '../../../shared/contracts'

export function dmarketPriceChange(data: ItemPrice[]): number | null {
  const current = data.find((price) => price.ServiceType === 2)
  const previous = current?.PreviousPrice
  if (
    !current ||
    previous == null ||
    previous <= 0 ||
    current.Price <= 0 ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current.Price)
  )
    return null

  return ((current.Price - previous) / previous) * 100
}
