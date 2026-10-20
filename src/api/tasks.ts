import { apiConfig } from '../config/api'

const tasksUrl = `${apiConfig.baseUrl}/api/v1/tasks`

export type HomeTask = {
  id: string
  title: string
  meta: string
  assignee: string
  done: boolean
  repeatsDaily: boolean
}

export type CreateHomeTask = {
  title: string
  meta?: string
  assignee?: string
  repeatsDaily?: boolean
}

export type UpdateHomeTask = Partial<Omit<HomeTask, 'id'>>

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body) {
    headers.set('content-type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, { ...init, headers })
  } catch (error) {
    if (init.signal?.aborted) {
      throw error
    }

    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('O servidor está com problemas no momento. Tente novamente em instantes.')
    }

    const problem = await response.json().catch(() => null) as { detail?: string; title?: string } | null
    throw new Error(problem?.detail || problem?.title || 'Não foi possível concluir a ação. Tente novamente.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return await response.json() as T
}

export function getTasks(signal?: AbortSignal): Promise<{ items: HomeTask[] }> {
  return requestJson(tasksUrl, { signal })
}

export function createTask(task: CreateHomeTask): Promise<HomeTask> {
  return requestJson(tasksUrl, { method: 'POST', body: JSON.stringify(task) })
}

export function updateTask(id: string, patch: UpdateHomeTask): Promise<HomeTask> {
  return requestJson(`${tasksUrl}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteTask(id: string): Promise<void> {
  return requestJson(`${tasksUrl}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
