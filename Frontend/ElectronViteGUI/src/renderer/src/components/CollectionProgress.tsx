import { useId, useState } from 'react'
import { Alert, Box, Button, ButtonBase, Collapse, LinearProgress, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { CollectorState, Market } from '../../../shared/collector'

export function CollectionProgress({
  state,
  onCancel
}: {
  state: CollectorState
  onCancel: () => void
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(true)
  const detailsId = useId()
  if (state.status === 'idle') return null
  return (
    <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ButtonBase
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={expanded ? 'Recolher atualização' : 'Expandir atualização'}
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1,
            textAlign: 'left',
            borderRadius: 1,
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' }
          }}
        >
          <Typography component="span">
            {state.status === 'running'
              ? 'Atualizando'
              : state.status === 'cancelling'
                ? 'Cancelando…'
                : state.status === 'cancelled'
                  ? 'Atualização cancelada'
                  : 'Atualização'}
            {state.itemId ? ` — item ${state.itemId}` : ' — todos os itens'}
          </Typography>
          <ExpandMoreIcon
            sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
          />
        </ButtonBase>
        {(state.status === 'running' || state.status === 'cancelling') && (
          <Button
            color="warning"
            variant="outlined"
            onClick={onCancel}
            disabled={state.status === 'cancelling'}
            sx={{ flexShrink: 0 }}
          >
            {state.status === 'cancelling' ? 'Cancelando…' : 'Cancelar atualização'}
          </Button>
        )}
      </Box>
      <Collapse in={expanded} id={detailsId} unmountOnExit>
        <Box sx={{ pt: 1.5 }}>
          {(['steam', 'dmarket'] as Market[]).map((market) => {
            const progress = state.markets[market]
            const percent =
              progress.total > 0
                ? Math.floor((progress.completed / progress.total) * 100)
                : progress.saved
                  ? 100
                  : 0
            const label = market === 'steam' ? 'Steam' : 'DMarket'
            const color = market === 'steam' ? '#42a5f5' : '#4caf50'
            return (
              <Box key={market} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography sx={{ width: 75, flexShrink: 0 }}>{label}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={percent}
                    aria-label={`Progresso ${label}`}
                    sx={{
                      flex: 1,
                      height: 10,
                      borderRadius: 5,
                      bgcolor: `${color}25`,
                      '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 5 }
                    }}
                  />
                  <Typography sx={{ minWidth: 44, textAlign: 'right' }}>{percent}%</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {progress.completed}/{progress.total} itens processados
                  {` · ${progress.completed - progress.failed} com preço atualizado`}
                  {progress.failed > 0 && ` · ${progress.failed} sem preço atualizado`}
                  {progress.saved
                    ? progress.completed === progress.failed && progress.failed > 0
                      ? ' · nenhum preço salvo'
                      : ' · preços salvos'
                    : progress.total > 0 && progress.completed === progress.total
                      ? ' · salvando…'
                      : ''}
                </Typography>
              </Box>
            )
          })}
          <Alert
            severity={
              state.status === 'error'
                ? 'error'
                : state.status === 'partial'
                  ? 'warning'
                  : state.status === 'completed'
                    ? 'success'
                    : 'info'
            }
            role="status"
          >
            {state.message}
          </Alert>
        </Box>
      </Collapse>
    </Box>
  )
}
