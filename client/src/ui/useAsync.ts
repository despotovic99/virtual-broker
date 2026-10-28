import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  error: unknown
  loading: boolean
  reload: () => void
}

/**
 * Učitava podatke pri promeni zavisnosti. `reload` ponovo učitava.
 * Stariji odgovor ne prepisuje noviji.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const latest = useRef(0)

  // Zavisnosti zadaje pozivalac (kao kod useEffect).
  const stableLoad = useCallback(load, deps)

  useEffect(() => {
    const call = ++latest.current
    setLoading(true)
    setError(null)
    stableLoad()
      .then((result) => {
        if (call === latest.current) setData(result)
      })
      .catch((reason: unknown) => {
        if (call === latest.current) setError(reason)
      })
      .finally(() => {
        if (call === latest.current) setLoading(false)
      })
  }, [stableLoad, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { data, error, loading, reload }
}
