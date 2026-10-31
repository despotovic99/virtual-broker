import { useEffect, useState } from 'react'

/** Vrednost koja se menja tek kad korisnik prestane da kuca (npr. pretraga). */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
