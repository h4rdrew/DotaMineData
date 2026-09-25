import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import Chart from 'chart.js/auto'
import type { ItemHistory } from '../../../shared/contracts'
import { dailyPrices, priceSummary } from '../utils/priceStatistics'
import { ChartLine } from './chartLine.component'

const currency = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = (date: string): string => date.split('-').reverse().join('/')

function PercentageChart({
  labels,
  values,
  title,
  type
}: {
  labels: string[]
  values: (number | null)[]
  title: string
  type: 'bar' | 'line'
}): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hasData = values.some((value) => value !== null)
  useEffect(() => {
    if (!canvas.current || !hasData) return
    const chart = new Chart(canvas.current, {
      type,
      data: {
        labels: labels.map(dateLabel),
        datasets: [
          {
            label: title,
            data: values,
            borderColor: '#64b5f6',
            backgroundColor: values.map((value) =>
              value !== null && value < 0 ? '#ef5350' : '#66bb6a'
            ),
            borderWidth: type === 'line' ? 2 : 0,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context): string =>
                `${Number(context.raw).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#bdbdbd', maxTicksLimit: 6 }, grid: { display: false } },
          y: {
            ticks: { color: '#bdbdbd', callback: (value): string => `${value}%` },
            grid: { color: '#ffffff14' }
          }
        }
      }
    })
    return (): void => chart.destroy()
  }, [labels, values, title, type, hasData])

  return (
    <Box sx={{ height: 230, position: 'relative', minWidth: 0 }}>
      {hasData ? (
        <canvas ref={canvas} role="img" aria-label={title} />
      ) : (
        <Typography color="text.secondary" sx={{ py: 4 }}>
          Dados insuficientes neste período.
        </Typography>
      )}
    </Box>
  )
}

export function ItemStatistics({ history }: { history: ItemHistory[] | null }): JSX.Element {
  const [period, setPeriod] = useState(0)
  const allDays = useMemo(() => dailyPrices(history ?? []), [history])
  const days = useMemo(() => {
    if (!period || !allDays.length) return allDays
    const end = Date.parse(allDays[allDays.length - 1].date)
    return allDays.filter((day) => Date.parse(day.date) >= end - (period - 1) * 86400000)
  }, [allDays, period])
  const filteredHistory = useMemo(
    () =>
      (history ?? [])
        .filter(
          (row) =>
            days.length > 0 &&
            row.DateTime.slice(0, 10) >= days[0].date &&
            row.Price > 0 &&
            Number.isFinite(row.Price)
        )
        .sort((a, b) => a.DateTime.localeCompare(b.DateTime)),
    [history, days]
  )
  const labels = useMemo(() => days.map((day) => day.date), [days])
  const spread = useMemo(
    () =>
      days.map((day) =>
        day.steam !== null && day.dmarket !== null
          ? ((day.dmarket - day.steam) / day.steam) * 100
          : null
      ),
    [days]
  )
  const changes = useMemo(() => {
    let previous: number | null = null
    return days.map((day) => {
      if (day.dmarket === null) return null
      const change = previous === null ? null : ((day.dmarket - previous) / previous) * 100
      previous = day.dmarket
      return change
    })
  }, [days])

  if (history === null)
    return (
      <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
        Selecione um item para ver os gráficos e as estatísticas.
      </Paper>
    )
  if (!allDays.length)
    return (
      <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
        Este item ainda não tem histórico de preços válido.
      </Paper>
    )

  return (
    <Box sx={{ mt: 3, display: 'grid', gap: 2, minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1
        }}
      >
        <Box>
          <Typography variant="h6">Estatísticas do item</Typography>
          <Typography variant="caption" color="text.secondary">
            {dateLabel(days[0].date)} a {dateLabel(days[days.length - 1].date)} · Até a última
            captura disponível
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_event, value: number | null) => value !== null && setPeriod(value)}
          aria-label="Período das estatísticas"
        >
          <ToggleButton value={30}>30 dias</ToggleButton>
          <ToggleButton value={90}>90 dias</ToggleButton>
          <ToggleButton value={0}>Tudo</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 2
        }}
      >
        {(['steam', 'dmarket'] as const).map((market) => {
          const stats = priceSummary(days.map((day) => day[market]))
          return (
            <Paper key={market} variant="outlined" sx={{ p: 2 }}>
              <Typography
                sx={{ color: market === 'steam' ? '#64b5f6' : '#81c784', fontWeight: 600 }}
              >
                {market === 'steam' ? 'Steam' : 'DMarket'}
              </Typography>
              {stats ? (
                <>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, my: 1 }}>
                    {[
                      ['Mínima', stats.min],
                      ['Média', stats.average],
                      ['Máxima', stats.max]
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography sx={{ fontWeight: 600 }}>{currency(Number(value))}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {stats.count} dias com preço · Último preço válido de cada dia
                  </Typography>
                </>
              ) : (
                <Typography color="text.secondary">Sem dados neste período.</Typography>
              )}
            </Paper>
          )
        })}
      </Box>
      <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
        <Typography sx={{ mb: 2, fontWeight: 600 }}>Histórico de preços</Typography>
        <Box sx={{ height: 320, position: 'relative', minWidth: 0 }}>
          <ChartLine data={filteredHistory} labels={[]} />
        </Box>
      </Paper>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 2
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>DMarket em relação à Steam</Typography>
          <Typography variant="caption" color="text.secondary">
            Negativo: DMarket mais barato. Compara preços do mesmo dia.
          </Typography>
          <PercentageChart
            title="DMarket em relação à Steam"
            type="line"
            labels={labels}
            values={spread}
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>Variação diária do DMarket</Typography>
          <Typography variant="caption" color="text.secondary">
            Comparação com o dia anterior disponível no período.
          </Typography>
          <PercentageChart
            title="Variação diária do DMarket"
            type="bar"
            labels={labels}
            values={changes}
          />
        </Paper>
      </Box>
    </Box>
  )
}
