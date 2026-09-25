const browserHost = window.location.hostname
const isLocalBrowser = browserHost === 'localhost' || browserHost === '127.0.0.1'
const apiBaseUrls: Record<string, string> = {
  dev: isLocalBrowser ? 'https://localhost:7234' : `http://${browserHost}:5154`,
  'local-api': 'http://localhost:5099',
  production: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5099',
}

const apiBaseUrl = apiBaseUrls[import.meta.env.MODE]

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not configured')
}

export const apiConfig = {
  baseUrl: apiBaseUrl.replace(/\/$/, ''),
  healthUrl: `${apiBaseUrl.replace(/\/$/, '')}/health`,
} as const