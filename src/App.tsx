import { useEffect, useState } from 'react'
import { apiConfig } from './config/api'
import HomePage from './pages/HomePage'

type HealthStatus = 'checking' | 'available' | 'unavailable'

function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking')
  const [healthCheckId, setHealthCheckId] = useState(0)

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
  }, [healthCheckId])

  if (healthStatus === 'available') {
    return <HomePage />
  }

  return (
    <main className="homevault-page homevault-status">
      <div className="homevault-shell">
        <header className="homevault-header">
          <a className="homevault-brand" href="/" aria-label="Homevault, início">
            <span className="homevault-brand-mark" aria-hidden="true">
              H
            </span>
            <span>Homevault</span>
          </a>
          <span className="homevault-access">Casa compartilhada</span>
        </header>

        <section className="homevault-message" aria-labelledby="status-title">
          <div className="homevault-copy">
            <p className="homevault-eyebrow">Voltamos em breve</p>
            <h1 id="status-title">Estamos preparando a casa.</h1>
            <p className="homevault-description">
              O Homevault está temporariamente indisponível. Estamos cuidando de
              alguns detalhes para deixar tudo pronto para você.
            </p>
            <button
              className="homevault-retry"
              type="button"
              onClick={() => {
                setHealthStatus('checking')
                setHealthCheckId((currentId) => currentId + 1)
              }}
              disabled={healthStatus === 'checking'}
            >
              {healthStatus === 'checking' ? 'Verificando...' : 'Tentar novamente'}
            </button>
          </div>

          <aside className="homevault-status-card" aria-live="polite">
            <span className={`homevault-status-dot ${healthStatus}`} aria-hidden="true" />
            <div>
              <p className="homevault-status-label">Status do serviço</p>
              <p className="homevault-status-value">
                {healthStatus === 'checking' ? 'Verificando' : 'Indisponível por enquanto'}
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default App
