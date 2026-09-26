import { useEffect, useState } from 'react'
import { apiConfig } from '../config/api'

type HomeTask = {
  id: string
  title: string
  meta: string
  assignee: string
  done: boolean
}

type CurrentWeather = {
  id: string
  city: string
  state: string
  temperatureCelsius: number
  relativeHumidity: number
  condition: WeatherCondition
  isDay: boolean
  observedAt: string
  collectedAt: string
}

type WeatherCondition =
  | 'Unknown'
  | 'Clear'
  | 'PartlyCloudy'
  | 'Cloudy'
  | 'Fog'
  | 'Drizzle'
  | 'Rain'
  | 'Showers'
  | 'Snow'
  | 'Thunderstorm'

type WeatherConditionFamily =
  | 'unknown'
  | 'clear'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'thunderstorm'

type WeatherState = {
  status: 'loading' | 'available' | 'refreshing' | 'unavailable'
  data: CurrentWeather | null
}

const weatherCollectionIntervalMs = 15 * 60 * 1000
const weatherRefreshGraceMs = 30 * 1000
const weatherRetryDelayMs = 60 * 1000
const weatherRequestTimeoutMs = 5 * 1000

const weatherConditionLabels: Record<WeatherCondition, string> = {
  Unknown: 'Condição desconhecida',
  Clear: 'Céu limpo',
  PartlyCloudy: 'Parcialmente nublado',
  Cloudy: 'Nublado',
  Fog: 'Neblina',
  Drizzle: 'Garoa',
  Rain: 'Chuvoso',
  Showers: 'Pancadas de chuva',
  Snow: 'Nevando',
  Thunderstorm: 'Tempestade',
}

const weatherConditionFamilies: Record<WeatherCondition, WeatherConditionFamily> = {
  Unknown: 'unknown',
  Clear: 'clear',
  PartlyCloudy: 'partlyCloudy',
  Cloudy: 'cloudy',
  Fog: 'fog',
  Drizzle: 'rain',
  Rain: 'rain',
  Showers: 'rain',
  Snow: 'snow',
  Thunderstorm: 'thunderstorm',
}

const weatherConditionMarkers: Record<WeatherConditionFamily, { day: string; night: string }> = {
  unknown: { day: '?', night: '?' },
  clear: { day: '☀️', night: '🌕' },
  partlyCloudy: { day: '🌤️', night: '🌥️' },
  cloudy: { day: '☁️', night: '☁️' },
  fog: { day: '💨', night: '💨' },
  rain: { day: '🌧️', night: '🌧️' },
  snow: { day: '❄️', night: '❄️' },
  thunderstorm: { day: '⛈️', night: '⛈️' },
}

function getWeatherMarker(condition: WeatherCondition, isDay: boolean): string {
  const family = weatherConditionFamilies[condition]
  const markers = weatherConditionMarkers[family]
  return isDay ? markers.day : markers.night
}

function isWeatherCondition(value: unknown): value is WeatherCondition {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(weatherConditionLabels, value)
  )
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isCurrentWeather(value: unknown): value is CurrentWeather {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const data = value as Record<string, unknown>

  return (
    typeof data.id === 'string' &&
    typeof data.city === 'string' &&
    typeof data.state === 'string' &&
    typeof data.temperatureCelsius === 'number' &&
    typeof data.relativeHumidity === 'number' &&
    isWeatherCondition(data.condition) &&
    typeof data.isDay === 'boolean' &&
    isTimestamp(data.observedAt) &&
    isTimestamp(data.collectedAt)
  )
}

function formatWeatherCollectionTime(collectedAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(collectedAt))
}

function formatCurrentDate(): string {
  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
  }).format(new Date())

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
}

function getCurrentGreeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(new Date()))

  if (hour >= 5 && hour < 12) {
    return 'Bom dia'
  }

  if (hour >= 12 && hour < 18) {
    return 'Boa tarde'
  }

  return 'Boa noite'
}

const initialTasks: HomeTask[] = [
  {
    id: 'trash',
    title: 'Levar o lixo para fora',
    meta: 'Hoje, até 20:00',
    assignee: 'Alex',
    done: false,
  },
  {
    id: 'plants',
    title: 'Regar as plantas da varanda',
    meta: 'Hoje, até 18:00',
    assignee: 'Rafa',
    done: true,
  },
  {
    id: 'groceries',
    title: 'Conferir a lista de compras',
    meta: 'Sem prazo',
    assignee: 'Todos',
    done: false,
  },
  {
    id: 'filter',
    title: 'Limpar o filtro do ar-condicionado',
    meta: 'Amanhã',
    assignee: 'Casa',
    done: false,
  },
  {
    id: 'kitchen',
    title: 'Organizar a bancada da cozinha',
    meta: 'Amanhã',
    assignee: 'Alex',
    done: false,
  },
  {
    id: 'mailbox',
    title: 'Conferir a caixa de correio',
    meta: 'Sem prazo',
    assignee: 'Rafa',
    done: false,
  },
  {
    id: 'laundry',
    title: 'Recolher as roupas do varal',
    meta: 'Sábado',
    assignee: 'Todos',
    done: false,
  },
  {
    id: 'water',
    title: 'Verificar o filtro de água',
    meta: 'Segunda-feira',
    assignee: 'Casa',
    done: false,
  },
]

function playCompletionSound() {
  if (typeof window.AudioContext === 'undefined') {
    return
  }

  const audioContext = new window.AudioContext()
  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const startTime = audioContext.currentTime
  const beepInterval = 0.16
  const beepDuration = 0.1
  const frequencies = [587, 784, 912]

  oscillator.type = 'sine'
  gain.gain.setValueAtTime(0.0001, startTime)

  frequencies.forEach((frequency, index) => {
    const beepStart = startTime + index * beepInterval

    oscillator.frequency.setValueAtTime(frequency, beepStart)
    gain.gain.setValueAtTime(0.0001, beepStart)
    gain.gain.exponentialRampToValueAtTime(1, beepStart + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, beepStart + beepDuration)
  })

  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + frequencies.length * beepInterval)
  oscillator.addEventListener('ended', () => {
    void audioContext.close()
  })
}

function HomePage() {
  const [tasks, setTasks] = useState(initialTasks)
  const [taskPage, setTaskPage] = useState(0)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherState>({ status: 'loading', data: null })
  const [currentDate, setCurrentDate] = useState(formatCurrentDate)
  const [currentGreeting, setCurrentGreeting] = useState(getCurrentGreeting)

  const tasksPerPage = 6
  const completedTasks = tasks.filter((task) => task.done).length
  const completionPercentage = Math.round((completedTasks / tasks.length) * 100)
  const totalTaskPages = Math.max(1, Math.ceil(tasks.length / tasksPerPage))
  const taskStart = taskPage * tasksPerPage + 1
  const taskEnd = Math.min(taskStart + tasksPerPage - 1, tasks.length)
  const visibleTasks = tasks.slice(taskPage * tasksPerPage, taskEnd)

  useEffect(() => {
    const dateIntervalId = window.setInterval(() => {
      setCurrentDate(formatCurrentDate())
      setCurrentGreeting(getCurrentGreeting())
    }, 60_000)

    return () => window.clearInterval(dateIntervalId)
  }, [])

  useEffect(() => {
    let disposed = false
    let lastCollectedAt: string | null = null
    let refreshTimeoutId: number | undefined
    let requestController: AbortController | null = null

    function clearScheduledRefresh() {
      if (refreshTimeoutId !== undefined) {
        window.clearTimeout(refreshTimeoutId)
        refreshTimeoutId = undefined
      }
    }

    function scheduleWeatherRetry() {
      clearScheduledRefresh()
      refreshTimeoutId = window.setTimeout(() => {
        void loadWeather()
      }, weatherRetryDelayMs)
    }

    function scheduleNextWeatherLoad(collectedAt: string) {
      clearScheduledRefresh()

      const collectedAtTime = Date.parse(collectedAt)
      const collectionChanged = lastCollectedAt !== collectedAt
      lastCollectedAt = collectedAt
      const nextCollectionTime = collectedAtTime + weatherCollectionIntervalMs
      const delay = collectionChanged
        ? Math.max(1_000, nextCollectionTime - Date.now() + weatherRefreshGraceMs)
        : weatherRetryDelayMs

      refreshTimeoutId = window.setTimeout(() => {
        void loadWeather()
      }, delay)
    }

    async function loadWeather() {
      requestController?.abort()

      const controller = new AbortController()
      requestController = controller
      let timedOut = false
      const timeoutId = window.setTimeout(() => {
        timedOut = true
        controller.abort()
      }, weatherRequestTimeoutMs)

      setWeather((currentWeather) => ({
        status: currentWeather.data === null ? 'loading' : 'refreshing',
        data: currentWeather.data,
      }))

      try {
        const response = await fetch(apiConfig.currentWeatherUrl, {
          cache: 'no-store',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Weather request failed')
        }

        const data: unknown = await response.json()

        if (!isCurrentWeather(data)) {
          throw new Error('Weather response is invalid')
        }

        if (disposed) {
          return
        }

        setWeather({ status: 'available', data })
        scheduleNextWeatherLoad(data.collectedAt)
      } catch {
        if (!disposed && (timedOut || !controller.signal.aborted)) {
          setWeather((currentWeather) => ({
            status: 'unavailable',
            data: currentWeather.data,
          }))
          scheduleWeatherRetry()
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void loadWeather()

    return () => {
      disposed = true
      clearScheduledRefresh()
      requestController?.abort()
    }
  }, [])

  function toggleTask(taskId: string) {
    const task = tasks.find((currentTask) => currentTask.id === taskId)
    const willComplete = task !== undefined && !task.done

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    )

    if (willComplete) {
      setCompletingTaskId(taskId)
      playCompletionSound()
      window.setTimeout(() => {
        setCompletingTaskId((currentTaskId) =>
          currentTaskId === taskId ? null : currentTaskId,
        )
      }, 700)
    } else {
      setCompletingTaskId(null)
    }
  }

  const weatherData = weather.data
  const hasWeatherData = weatherData !== null

  return (
    <main className="homevault-page homevault-home">
      <div className="homevault-shell">
        <header className="homevault-header homevault-home-header">
          <a className="homevault-brand" href="/" aria-label="Homevault, início">
            <span className="homevault-brand-mark" aria-hidden="true">
              H
            </span>
            <span>Homevault</span>
          </a>
          <div className="homevault-household" aria-label="Casa principal, quatro moradores">
            <span className="homevault-household-avatar" aria-hidden="true">
              CP
            </span>
            <span>
              <strong>Casa principal</strong>
              <small>4 moradores</small>
            </span>
          </div>
        </header>

        <section className="homevault-home-hero" id="home" aria-labelledby="home-title">
          <div className="homevault-home-intro">
            <p className="homevault-eyebrow">{currentDate}</p>
            <h1 id="home-title">{currentGreeting}, a casa está em ordem.</h1>
            <div
              className="homevault-weather-inline"
              aria-label="Condições meteorológicas atuais"
              aria-live="polite"
              aria-busy={weather.status === 'loading' || weather.status === 'refreshing'}
            >
              <div className="homevault-weather-visual">
                <span
                  className={`homevault-weather-marker weather-marker-${hasWeatherData ? weatherConditionFamilies[weatherData.condition] : 'unknown'}`}
                  aria-hidden="true"
                >
                  {hasWeatherData
                    ? getWeatherMarker(weatherData.condition, weatherData.isDay)
                    : weather.status === 'loading'
                      ? '…'
                      : '—'}
                </span>
                {hasWeatherData && (
                  <span className="homevault-weather-condition">
                    {weatherConditionLabels[weatherData.condition]}
                  </span>
                )}
              </div>
              <div className="homevault-weather-copy">
                <strong>
                  {hasWeatherData
                    ? `${weatherData.temperatureCelsius.toLocaleString('pt-BR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}°C`
                    : weather.status === 'loading'
                      ? 'Consultando...'
                      : '--'}
                </strong>
                <div className="homevault-weather-details">
                  {hasWeatherData ? (
                    <span>
                      {weatherData.city}, {weatherData.state} - Umidade {weatherData.relativeHumidity.toLocaleString('pt-BR', {
                        maximumFractionDigits: 0,
                      })}% · Coletado às {formatWeatherCollectionTime(weatherData.collectedAt)}
                      {weather.status === 'refreshing' ? ' · Atualizando' : ''}
                      {weather.status === 'unavailable' ? ' · Atualização indisponível' : ''}
                    </span>
                  ) : (
                    <span>
                      {weather.status === 'loading'
                        ? 'Buscando a temperatura da casa'
                        : 'Temperatura indisponível agora'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <article className="homevault-stat-card homevault-stat-progress">
            <div>
              <p>Afazeres completos</p>
              <strong>{completedTasks} de {tasks.length}</strong>
            </div>
            <span className="homevault-progress-percent">{completionPercentage}% concluído</span>
            <div
              className="homevault-progress-track"
              role="progressbar"
              aria-label="Progresso dos afazeres"
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              aria-valuenow={completedTasks}
            >
              <span
                className="homevault-progress-fill"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </article>
        </section>

        <div className="homevault-home-grid">
          <section className="homevault-panel" id="tasks" aria-labelledby="tasks-title">
            <div className="homevault-panel-heading">
              <div>
                <h2 id="tasks-title">Afazeres pendentes</h2>
              </div>
              <div className="homevault-task-controls">
                <span className="homevault-panel-count">
                  {taskStart}-{taskEnd} de {tasks.length}
                </span>
                <div
                  className="homevault-task-pagination"
                  role="group"
                  aria-label="Navegação dos afazeres"
                >
                  <button
                    className="homevault-page-button"
                    type="button"
                    aria-label="Página anterior de afazeres"
                    title="Página anterior"
                    disabled={taskPage === 0}
                    onClick={() => setTaskPage((currentPage) => Math.max(0, currentPage - 1))}
                  >
                    <span aria-hidden="true">←</span>
                  </button>
                  <span aria-live="polite">
                    {taskPage + 1} / {totalTaskPages}
                  </span>
                  <button
                    className="homevault-page-button"
                    type="button"
                    aria-label="Próxima página de afazeres"
                    title="Próxima página"
                    disabled={taskPage >= totalTaskPages - 1}
                    onClick={() => setTaskPage((currentPage) => Math.min(totalTaskPages - 1, currentPage + 1))}
                  >
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="homevault-task-list" key={taskPage}>
              {visibleTasks.map((task) => (
                <label
                  className={`homevault-task ${task.done ? 'is-done' : ''} ${completingTaskId === task.id ? 'is-completing' : ''}`}
                  key={task.id}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="homevault-task-copy">
                    <strong>{task.title}</strong>
                    <small>{task.meta}</small>
                  </span>
                  <span className="homevault-task-assignee">{task.assignee}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default HomePage
