# Homevault project instructions

## Theme colors

`src/config/themes.ts` is the single source of truth for every color used by the application.

- Never add literal colors outside `src/config/themes.ts`. This includes hex values, `rgb()`/`rgba()`, `hsl()`/`hsla()`, named colors, `transparent`, color stops in gradients, shadows, borders, focus rings, SVG attributes, canvas/chart configuration, and inline style values.
- In CSS, consume theme tokens with `var(--color-...)`. Use semantic token names such as `--color-background`, `--color-surface`, `--color-ink`, `--color-primary`, and `--color-border`; do not encode a visual color's meaning in a component selector.
- In React or other TypeScript code, use CSS custom properties or the theme catalog instead of hard-coded color values. Do not introduce a second color map in a component, feature, or stylesheet.
- When a new color role is needed, add a semantic token to every supported theme in `src/config/themes.ts` before using it. Keep the token contract consistent across themes.
- Keep theme application centralized through `applyTheme`; do not set theme colors ad hoc from individual components.
- Before finishing a visual change, search the changed files for literal color syntax and run the project build. Any intentional color literal must live in the theme catalog and be explained in the change.

## Working with the web front end (homevault-web)

- Cross-repo features are built in parallel with one agent session per repository. The web repo lives at `C:\Users\Usuário\source\repos\Homevault-web`; the API repo is `Homevault`.
- Agree on the HTTP contract (`/api/v1/...` routes, fields, validation) first and send it to the other session. The API is the source of truth: the web app only consumes it, and unknown PATCH fields are rejected with 400.
- Branch from an up-to-date `main`, validate (lint, build, tests), then commit. Do not push or open a PR until the integrated test passes and the user approves.
- Open linked PRs in both repos. Merge the API first, then the web app. Afterwards update local `main` and delete merged branches.
- Integrated test: run the new API on a separate port (for example 5199) with a temporary database and CORS for the Vite origin, and run Vite with `VITE_API_BASE_URL` pointing to it. Never touch the user's Visual Studio API on 5099; ask the user to restart it after merging.
- Use `npm.cmd` on Windows and the `gh` credential helper for git network operations: `git -c credential.helper= -c "credential.helper=!gh auth git-credential" <push|pull|fetch>`.