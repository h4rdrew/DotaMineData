import { useMemo, useState } from 'react'
import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material'
import type { ItemHistory, ItemPrice } from '../../../shared/contracts'
import steamLogo from '../assets/steam_logo.png'
import dmarketLogo from '../assets/dmarket_logo.png'
import ExternalLink from './ExternalLink'
import { historicalLow } from '../utils/priceStatistics'

const money = (price: number): string =>
  price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function PriceOverview({
  history,
  prices,
  steamHref,
  dmarketHref
}: {
  history: ItemHistory[] | null
  prices: ItemPrice[]
  steamHref: string
  dmarketHref: string
}): JSX.Element {
  const [tab, setTab] = useState(0)
  const markets = useMemo(
    () =>
      [
        { service: 1, name: 'Steam', logo: steamLogo, href: steamHref },
        { service: 2, name: 'DMarket', logo: dmarketLogo, href: dmarketHref }
      ].map((market) => {
        const current = prices.find((row) => row.ServiceType === market.service)?.Price
        const low = historicalLow(history ?? [], market.service as 1 | 2)
        return {
          ...market,
          current:
            current !== undefined && Number.isFinite(current) && current > 0 ? current : null,
          low
        }
      }),
    [history, prices, steamHref, dmarketHref]
  )

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        minWidth: 0,
        '& a': { color: 'primary.light', fontSize: 14, textDecoration: 'none' },
        '& a:hover': { textDecoration: 'underline' }
      }}
    >
      <Tabs
        value={tab}
        onChange={(_event, value: number) => setTab(value)}
        aria-label="Preços atuais e mínima histórica"
        variant="fullWidth"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 }
        }}
      >
        <Tab className="tablinks" id="price-tab-0" aria-controls="tab-0" label="Current Prices" />
        <Tab className="tablinks" id="price-tab-1" aria-controls="tab-1" label="Historical Low" />
      </Tabs>
      {[0, 1].map((panel) => {
        const values = markets.map((market) =>
          panel === 0 ? market.current : (market.low?.Price ?? null)
        )
        const comparable = values.every((value) => value !== null)
        return (
          <Box
            key={panel}
            id={`tab-${panel}`}
            role="tabpanel"
            aria-labelledby={`price-tab-${panel}`}
            sx={{ display: tab === panel ? 'block' : 'none', p: 2 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              {panel === 0
                ? 'Preços da data selecionada'
                : 'Mínima do histórico diário · Última captura válida de cada dia · Última ocorrência'}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
                gap: 2
              }}
            >
              {markets.map((market, index) => {
                const price = values[index]
                const best = comparable && price !== null && price < (values[1 - index] as number)
                const atLow =
                  market.current !== null &&
                  market.low !== null &&
                  market.current <= market.low.Price
                const aboveLow =
                  market.current !== null && market.low !== null
                    ? Math.round(((market.current - market.low.Price) / market.low.Price) * 100)
                    : null
                return (
                  <Box
                    key={market.service}
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: best ? 'success.main' : 'divider',
                      borderRadius: 1,
                      bgcolor: best ? 'rgba(102, 187, 106, 0.06)' : 'action.hover',
                      minWidth: 0
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 1,
                        mb: 1
                      }}
                    >
                      <img
                        src={market.logo}
                        alt=""
                        width="20"
                        height="20"
                        style={{ objectFit: 'contain' }}
                      />
                      <Typography sx={{ fontWeight: 600 }}>{market.name}</Typography>
                      {best && (
                        <Chip size="small" label="Menor preço" color="success" variant="outlined" />
                      )}
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 30,
                        lineHeight: 1.3,
                        fontWeight: 700,
                        color: best ? 'success.light' : 'text.primary',
                        mb: 1
                      }}
                    >
                      {price === null ? '—' : money(price)}
                    </Typography>
                    {panel === 0 ? (
                      <>
                        <Typography
                          variant="caption"
                          color={atLow ? 'success.light' : 'text.secondary'}
                          sx={{ display: 'block', minHeight: 22 }}
                        >
                          {price === null
                            ? 'Sem captura nesta data'
                            : atLow
                              ? 'Na mínima histórica'
                              : aboveLow !== null
                                ? `${aboveLow === 0 ? '<1' : `+${aboveLow}`}% acima da mínima histórica`
                                : 'Sem histórico para comparação'}
                        </Typography>
                        {price !== null && (
                          <ExternalLink href={market.href}>Ver no {market.name}</ExternalLink>
                        )}
                      </>
                    ) : (
                      <>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', minHeight: 22 }}
                        >
                          {market.low
                            ? `Registrado em ${market.low.DateTime.slice(0, 10).split('-').reverse().join('/')}`
                            : 'Sem histórico disponível'}
                        </Typography>
                        {market.low && (
                          <Box
                            component="a"
                            href="#item-price-history"
                            sx={{ color: 'primary.light', fontSize: 14 }}
                          >
                            Ver histórico de preços
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )
      })}
    </Paper>
  )
}
