import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import dayjs from 'dayjs'
import type { Item, ItemHistory } from '../../../shared/contracts'
import { generalStatistics, type ItemMovement, type Ownership } from '../utils/generalStatistics'

const money = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const date = (value: string): string => value.split('-').reverse().join('/')

function Ranking({
  title,
  rows,
  frequency,
  onSelect
}: {
  title: string
  rows: ItemMovement[]
  frequency?: boolean
  onSelect: (item: Item) => void
}): JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      {!rows.length && (
        <Typography color="text.secondary" sx={{ py: 3 }}>
          Nenhum item com dados suficientes para este ranking.
        </Typography>
      )}
      {rows.slice(0, 5).map((row, index) => (
        <Box key={row.item.ItemId} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography color="text.secondary">{index + 1}.</Typography>
            <Button
              onClick={() => onSelect(row.item)}
              sx={{
                textTransform: 'none',
                justifyContent: 'flex-start',
                textAlign: 'left',
                flex: 1
              }}
            >
              {row.item.Name}
            </Button>
            {Boolean(row.item.Purchased) && <Chip label="Owned" size="small" variant="outlined" />}
            <Typography
              fontWeight={700}
              color={
                row.change < 0
                  ? 'success.light'
                  : row.change > 0
                    ? 'warning.light'
                    : 'text.secondary'
              }
            >
              {frequency ? `${row.drops} quedas` : percent(row.percent)}
            </Typography>
          </Stack>
          <Typography variant="body2">
            {money(row.first)} → {money(row.last)} · {row.change > 0 ? '+' : ''}
            {money(row.change)}
            {frequency ? ` · ${percent(row.percent)}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {date(row.firstDate)} → {date(row.lastDate)} · {row.observations} dias com preço
          </Typography>
        </Box>
      ))}
    </Paper>
  )
}

export function GeneralStatistics({
  refreshKey,
  onSelect
}: {
  refreshKey: string
  onSelect: (item: Item) => void
}): JSX.Element {
  const [period, setPeriod] = useState(5)
  const [ownership, setOwnership] = useState<Ownership>('all')
  const [market, setMarket] = useState('all')
  const [sort, setSort] = useState<'percent' | 'change'>('percent')
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [data, setData] = useState<{ items: Item[]; history: ItemHistory[] } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
    dayjs(endDate).isValid() &&
    dayjs(endDate).format('YYYY-MM-DD') === endDate
  useEffect(() => {
    let active = true
    if (!validDate) return
    setLoading(true)
    setError('')
    Promise.all([window.api.getItems(), window.api.getGeneralHistory(endDate)])
      .then(([items, history]) => {
        if (active) setData({ items, history })
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar as estatísticas. Tente novamente.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return (): void => {
      active = false
    }
  }, [endDate, refreshKey, retry, validDate])
  const stats = useMemo(
    () =>
      data && validDate
        ? generalStatistics(data.items, data.history, endDate, period, ownership)
        : null,
    [data, endDate, period, ownership, validDate]
  )
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Estatísticas gerais
        </Typography>
        <Typography color="text.secondary">
          Acompanhe os movimentos de preços da sua coleção e dos itens que deseja comprar.
        </Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={period}
            onChange={(_, value: number | null) => value !== null && setPeriod(value)}
            aria-label="Período geral"
          >
            {[3, 5, 10, 30].map((days) => (
              <ToggleButton key={days} value={days}>
                {days} dias
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField
            select
            size="small"
            label="Itens"
            value={ownership}
            onChange={(event) => setOwnership(event.target.value as Ownership)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">Todos os itens</MenuItem>
            <MenuItem value="owned">Somente owned</MenuItem>
            <MenuItem value="unowned">Somente não owned</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Marketplace"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="1">Steam</MenuItem>
            <MenuItem value="2">DMarket</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Ordenar variações por"
            value={sort}
            onChange={(event) => setSort(event.target.value as 'percent' | 'change')}
            sx={{ minWidth: 185 }}
          >
            <MenuItem value="percent">Percentual (%)</MenuItem>
            <MenuItem value="change">Valor (R$)</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Data final"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!validDate}
          />
          <Button onClick={() => setRetry((value) => value + 1)} disabled={loading || !validDate}>
            Recarregar
          </Button>
        </Stack>
      </Paper>
      {loading && <LinearProgress aria-label="Carregando estatísticas gerais" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && stats && (
        <>
          <Typography variant="body2" color="text.secondary">
            {stats.items} itens no filtro ·{' '}
            {date(dayjs(endDate).subtract(period, 'day').format('YYYY-MM-DD'))} a {date(endDate)}.{' '}
            Compara o primeiro e o último preço válido dentro da janela, com pelo menos dois dias de
            dados. Usa a última captura válida de cada dia; datas ausentes não são preenchidas.
            Quedas frequentes contam reduções entre dias disponíveis.
          </Typography>
          {([1, 2] as const)
            .filter((service) => market === 'all' || market === String(service))
            .map((service) => {
              const rows = stats.movements.filter((row) => row.service === service)
              const down = rows
                .filter((row) => row.change < 0)
                .sort((a, b) => a[sort] - b[sort] || a.item.Name.localeCompare(b.item.Name))
              const up = rows
                .filter((row) => row.change > 0)
                .sort((a, b) => b[sort] - a[sort] || a.item.Name.localeCompare(b.item.Name))
              const frequent = rows
                .filter((row) => row.drops > 0)
                .sort(
                  (a, b) =>
                    b.drops - a.drops ||
                    a.percent - b.percent ||
                    a.item.Name.localeCompare(b.item.Name)
                )
              const average = rows.length
                ? rows.reduce((sum, row) => sum + row.percent, 0) / rows.length
                : null
              return (
                <Stack spacing={2} key={service}>
                  <Typography
                    variant="h6"
                    color={service === 1 ? 'primary.light' : 'success.light'}
                  >
                    {service === 1 ? 'Steam' : 'DMarket'}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                      gap: 2
                    }}
                  >
                    {[
                      ['Itens comparáveis', `${rows.length} / ${stats.items}`],
                      ['Em queda', String(down.length)],
                      ['Em alta', String(up.length)],
                      ['Sem variação', String(rows.length - down.length - up.length)],
                      ['Variação média', average === null ? '—' : percent(average)]
                    ].map(([label, value]) => (
                      <Paper key={label} variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography variant="h5">{value}</Typography>
                      </Paper>
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Média simples das variações dos itens comparáveis. {stats.items - rows.length}{' '}
                    itens sem histórico suficiente neste marketplace.
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
                      gap: 2
                    }}
                  >
                    <Ranking title="Top 5 · Maiores quedas" rows={down} onSelect={onSelect} />
                    <Ranking title="Top 5 · Maiores altas" rows={up} onSelect={onSelect} />
                    <Ranking
                      title="Top 5 · Quedas mais frequentes"
                      rows={frequent}
                      frequency
                      onSelect={onSelect}
                    />
                  </Box>
                </Stack>
              )
            })}
        </>
      )}
    </Stack>
  )
}
