import { Box } from '@mui/material'
import type { ItemPrice } from '../../../shared/contracts'

export function DmarketPriceChange({ data }: { data: ItemPrice[] }): JSX.Element {
  const current = data.find((price) => price.ServiceType === 2)
  const previous = current?.PreviousPrice
  if (
    !current ||
    previous == null ||
    previous <= 0 ||
    current.Price <= 0 ||
    !Number.isFinite(previous) ||
    !Number.isFinite(current.Price)
  ) {
    return <span title="Sem capturas válidas para comparação">—</span>
  }

  const change = ((current.Price - previous) / previous) * 100
  const percentage = Math.abs(change).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  const label = `${change > 0 ? '+' : change < 0 ? '−' : ''}${percentage}%`

  return (
    <Box
      component="span"
      aria-label={`Variação DMarket: ${label}`}
      title={`DMarket: ${previous.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → ${current.Price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        color: change > 0 ? 'success.light' : change < 0 ? 'error.light' : 'text.secondary'
      }}
    >
      {label}
    </Box>
  )
}
