import { apiConfig } from '../config/api'

const shoppingListUrl = `${apiConfig.baseUrl}/api/v1/shopping-list`

export type ShoppingCategory = {
  id: string
  name: string
  sortOrder: number
}

export type ShoppingItem = {
  id: string
  name: string
  quantity: number
  category: {
    id: string
    name: string
  }
  purchased: boolean
  createdAtUtc: string
  updatedAtUtc: string
}

export type ShoppingSummary = {
  totalItems: number
  purchasedItems: number
  pendingItems: number
}

export type ShoppingPage = {
  items: ShoppingItem[]
  page: number
  pageSize: number
  totalMatchingItems: number
  totalPages: number
  summary: ShoppingSummary
}

export type ShoppingSnapshot = {
  items: ShoppingItem[]
  summary: ShoppingSummary
  generatedAtUtc: string
}

export type ShoppingPageQuery = {
  search?: string
  categoryId?: string
  page: number
  pageSize: number
}

export type CreateShoppingItem = {
  name: string
  quantity: number
  categoryId: string
}

export type UpdateShoppingItem = Partial<Pick<ShoppingItem, 'name' | 'quantity' | 'purchased'>> & {
  categoryId?: string
}

export type ClearPurchasedResult = {
  deletedCount: number
  summary: ShoppingSummary
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (init.body) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(url, { ...init, headers })

  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string; title?: string } | null
    throw new Error(problem?.detail || problem?.title || `Falha na API (${response.status}).`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return await response.json() as T
}

export function getShoppingCategories(signal?: AbortSignal): Promise<{ categories: ShoppingCategory[] }> {
  return requestJson(`${shoppingListUrl}/categories`, { signal })
}

export function getShoppingPage(query: ShoppingPageQuery, signal?: AbortSignal): Promise<ShoppingPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  const search = query.search?.trim()
  if (search) params.set('search', search)
  if (query.categoryId) params.set('categoryId', query.categoryId)

  return requestJson(`${shoppingListUrl}/items?${params}`, { signal })
}

export function createShoppingItem(item: CreateShoppingItem): Promise<ShoppingItem> {
  return requestJson(`${shoppingListUrl}/items`, {
    method: 'POST',
    body: JSON.stringify(item),
  })
}

export function updateShoppingItem(id: string, patch: UpdateShoppingItem): Promise<ShoppingItem> {
  return requestJson(`${shoppingListUrl}/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function deleteShoppingItem(id: string): Promise<void> {
  return requestJson(`${shoppingListUrl}/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function clearPurchasedShoppingItems(): Promise<ClearPurchasedResult> {
  return requestJson(`${shoppingListUrl}/items?purchased=true`, { method: 'DELETE' })
}

export function getShoppingExportData(): Promise<ShoppingSnapshot> {
  return requestJson(`${shoppingListUrl}/export-data`)
}
