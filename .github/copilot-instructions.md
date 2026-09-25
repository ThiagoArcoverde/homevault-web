# Homevault project instructions

## Theme colors

`src/config/themes.ts` is the single source of truth for every color used by the application.

- Never add literal colors outside `src/config/themes.ts`. This includes hex values, `rgb()`/`rgba()`, `hsl()`/`hsla()`, named colors, `transparent`, color stops in gradients, shadows, borders, focus rings, SVG attributes, canvas/chart configuration, and inline style values.
- In CSS, consume theme tokens with `var(--color-...)`. Use semantic token names such as `--color-background`, `--color-surface`, `--color-ink`, `--color-primary`, and `--color-border`; do not encode a visual color's meaning in a component selector.
- In React or other TypeScript code, use CSS custom properties or the theme catalog instead of hard-coded color values. Do not introduce a second color map in a component, feature, or stylesheet.
- When a new color role is needed, add a semantic token to every supported theme in `src/config/themes.ts` before using it. Keep the token contract consistent across themes.
- Keep theme application centralized through `applyTheme`; do not set theme colors ad hoc from individual components.
- Before finishing a visual change, search the changed files for literal color syntax and run the project build. Any intentional color literal must live in the theme catalog and be explained in the change.
