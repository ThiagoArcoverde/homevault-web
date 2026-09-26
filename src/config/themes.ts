export const themes = {
  'carvalho-pinho': {
    label: 'Carvalho & Pinho',
    tokens: {
      '--font-ui': "'Sora', 'Plus Jakarta Sans', 'Avenir Next', 'Segoe UI', sans-serif",
      '--font-display': "'Sora', 'Plus Jakarta Sans', 'Avenir Next', 'Segoe UI', sans-serif",
      '--color-background': '#f4efe5',
      '--color-surface': '#fffcf5',
      '--color-ink': '#24423d',
      '--color-muted': '#6c7770',
      '--color-primary': '#244c3b',
      '--color-primary-dark': '#193a2f',
      '--color-primary-light': '#5f806f',
      '--color-accent': '#a8784f',
      '--color-yellow': '#c77a4b',
      '--color-on-primary': '#fffcf5',
      '--color-border': '#ddd5c6',
      '--color-surface-muted': '#ece7dc',
      '--color-surface-tint': '#e7eee4',
      '--color-accent-soft': '#ead8c4',
      '--color-success': '#62846a',
      '--color-page-wash': 'rgba(168, 120, 79, 0.14)',
      '--color-transparent': 'rgba(0, 0, 0, 0)',
      '--color-card-surface': 'rgba(255, 252, 245, 0.78)',
      '--color-card-shadow': 'rgba(36, 66, 61, 0.09)',
      '--color-status-ring': 'rgba(168, 120, 79, 0.16)',
      '--color-checking-ring': 'rgba(199, 122, 75, 0.18)',
    },
  },
} as const

export type ThemeName = keyof typeof themes

export const activeTheme: ThemeName = 'carvalho-pinho'

export function applyTheme(themeName: ThemeName): void {
  const theme = themes[themeName]
  const root = document.documentElement

  root.dataset.theme = themeName

  for (const [property, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(property, value)
  }
}
