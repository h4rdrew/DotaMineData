export type Market = 'steam' | 'dmarket'
export interface MarketProgress {
  completed: number
  total: number
  failed: number
  saved: boolean
}
export interface CollectorState {
  revision: number
  runId: string | null
  itemId?: number
  status: 'idle' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'partial' | 'error'
  message: string
  markets: Record<Market, MarketProgress>
}
export const initialCollectorState: CollectorState = {
  revision: 0,
  runId: null,
  status: 'idle',
  message: '',
  markets: {
    steam: { completed: 0, total: 0, failed: 0, saved: false },
    dmarket: { completed: 0, total: 0, failed: 0, saved: false }
  }
}
