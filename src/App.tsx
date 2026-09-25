import { useEffect, useState } from 'react'
import { apiConfig } from './config/api'

type HealthStatus = 'checking' | 'available' | 'unavailable'

function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
      setHealthStatus('unavailable')
    }, 5000)

    async function checkHealth() {
      try {
        const response = await fetch(apiConfig.healthUrl, {
          headers: { accept: '*/*' },
          signal: controller.signal,
        })
        const healthMessage = (await response.text()).trim().toLowerCase()

        if (response.ok && healthMessage === 'healthy') {
          setHealthStatus('available')
        } else {
          setHealthStatus('unavailable')
        }
      } catch {
        if (!controller.signal.aborted) {
          setHealthStatus('unavailable')
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void checkHealth()

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  if (healthStatus === 'available') {
    return (
      <main className="homevault-page">
        <h1>Homevault</h1>
      </main>
    )
  }

  return (
    <main className="homevault-page homevault-status">
      <p role={healthStatus === 'unavailable' ? 'alert' : 'status'}>
        {healthStatus === 'checking'
          ? 'Verificando disponibilidade...'
          : 'Site indisponível por enquanto.'}
      </p>
    </main>
  )
}

export default App
