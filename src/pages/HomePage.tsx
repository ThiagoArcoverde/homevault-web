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
  city: string
  state: string
  temperatureCelsius: number
  relativeHumidity: number
}

type WeatherState =
  | { status: 'loading' }
  | { status: 'available'; data: CurrentWeather }
  | { status: 'unavailable' }

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
  const [weather, setWeather] = useState<WeatherState>({ status: 'loading' })

  const tasksPerPage = 6
  const completedTasks = tasks.filter((task) => task.done).length
  const completionPercentage = Math.round((completedTasks / tasks.length) * 100)
  const totalTaskPages = Math.max(1, Math.ceil(tasks.length / tasksPerPage))
  const taskStart = taskPage * tasksPerPage + 1
  const taskEnd = Math.min(taskStart + tasksPerPage - 1, tasks.length)
  const visibleTasks = tasks.slice(taskPage * tasksPerPage, taskEnd)

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 5000)

    async function loadWeather() {
      try {
        const response = await fetch(apiConfig.currentWeatherUrl, {
          headers: { accept: 'text/plain' },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Weather request failed')
        }

        const data = (await response.json()) as CurrentWeather

        if (
          typeof data.city !== 'string' ||
          typeof data.state !== 'string' ||
          typeof data.temperatureCelsius !== 'number' ||
          typeof data.relativeHumidity !== 'number'
        ) {
          throw new Error('Weather response is invalid')
        }

        setWeather({ status: 'available', data })
      } catch {
        if (!controller.signal.aborted) {
          setWeather({ status: 'unavailable' })
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void loadWeather()

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
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
            <p className="homevault-eyebrow">Sexta-feira, 25 de setembro</p>
            <h1 id="home-title">Bom dia, a casa está em ordem.</h1>
            <div className="homevault-weather-inline" aria-live="polite">
              <span className="homevault-weather-marker" aria-hidden="true">
                °
              </span>
              <div className="homevault-weather-copy">
                <p>Clima agora</p>
                <strong>
                  {weather.status === 'loading'
                    ? 'Consultando...'
                    : weather.status === 'available'
                      ? `${weather.data.temperatureCelsius.toLocaleString('pt-BR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}°C`
                      : '--'}
                </strong>
                <span>
                  {weather.status === 'available'
                    ? `${weather.data.city}, ${weather.data.state} · Umidade ${weather.data.relativeHumidity.toLocaleString('pt-BR', {
                        maximumFractionDigits: 0,
                      })}%`
                    : weather.status === 'loading'
                      ? 'Buscando a temperatura da casa'
                      : 'Temperatura indisponível agora'}
                </span>
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
