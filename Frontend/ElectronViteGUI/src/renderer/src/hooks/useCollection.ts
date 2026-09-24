import { useEffect, useState } from 'react'
import { initialCollectorState, type CollectorState } from '../../../shared/collector'

export function useCollection(): {
  collection: CollectorState
  starting: boolean
  error: string
  startCollection: (itemId?: number) => Promise<void>
  cancelCollection: () => Promise<void>
} {
  const [collection, setCollection] = useState(initialCollectorState)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const receive = (next: CollectorState): void => {
    setCollection((previous) => (next.revision >= previous.revision ? next : previous))
  }
  useEffect(() => {
    const unsubscribe = window.api.onCollectionState(receive)
    window.api
      .getCollectionState()
      .then(receive)
      .catch((error) => setError(String(error)))
    return unsubscribe
  }, [])
  const startCollection = async (itemId?: number): Promise<void> => {
    setStarting(true)
    setError('')
    try {
      receive(await window.api.startCollection(itemId))
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setStarting(false)
    }
  }
  const cancelCollection = async (): Promise<void> => {
    setError('')
    try {
      receive(await window.api.cancelCollection())
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }
  return { collection, starting, error, startCollection, cancelCollection }
}
