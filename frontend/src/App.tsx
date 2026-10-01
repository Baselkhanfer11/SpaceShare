import { useEffect, useState } from 'react'

type Health = { status: string; time: string }

// Placeholder home page: shows whether the frontend can reach the API.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main className="placeholder">
      <h1>SpaceShare</h1>
      <p>Warehouse space, by the pallet, for as long as you need it.</p>
      <p className="status">
        API:{' '}
        {health ? <span className="ok">connected</span> : error ? <span className="bad">not reachable ({error})</span> : 'checking…'}
      </p>
    </main>
  )
}
