# Homevault Web

Homevault Web is the initial React frontend for a self-hosted Homevault
installation on a private local network. The current release is an operational
smoke test: it renders a single Homevault page and verifies the local DNS,
network, build and static publishing path.

The project is intentionally small at this stage. It does not contain a
backend, authentication, database, file storage or user-facing domain
features yet.

## Current status

- React + Vite + TypeScript scaffold is working.
- The application renders a single `Homevault` heading.
- Vite is available for development with hot reload, preferring port `5173` and
	selecting the next available port when it is occupied.
- Caddy serves the production build on port `80` without a port in the URL.
- The LAN host is `192.168.0.50`.
- Internal DNS aliases are configured for:
	- `homevault.home.arpa`
	- `homevault.home.com`
	- `homevault.home`
- HTTP access has been validated from another device on the local network.
- HTTPS is not configured yet.

## Architecture

Development uses Vite directly:

```text
Browser -> Vite :5173 -> React source
```

LAN publishing uses a static production build:

```text
Browser -> Internal DNS -> 192.168.0.50:80 -> Caddy -> dist/
```

The Caddy configuration is stored in [Caddyfile](Caddyfile). The Vite network
configuration is stored in [vite.config.ts](vite.config.ts).

## Requirements

- Windows host connected to the local network.
- Node.js and npm. The project has been validated with Node.js `22.15.0` and
	npm `10.9.2`.
- Caddy `2.x` for LAN publishing. Caddy can be installed with:

	```powershell
	winget install --id CaddyServer.Caddy --exact --scope user
	```

- An internal DNS service, such as AdGuard Home, with access from client
	devices on the same network.
- Git for source control.

The npm scripts use `scripts/caddy.ps1` to locate Caddy automatically, including
when the current terminal was opened before Caddy was installed. A new terminal
is only needed when invoking the `caddy` command directly.

## Installation

From the project directory:

```bash
npm install
```

The committed `package-lock.json` must be kept in sync with `package.json`.

## Development

Start Vite with hot reload:

```bash
npm run dev
```

The development server listens on all network interfaces, preferring port
`5173`. If that port is occupied, Vite automatically selects the next
available port. Use the URL printed in the terminal. When `5173` is available,
the URLs are:

```text
http://homevault.home.arpa:5173
http://homevault.home.com:5173
http://homevault.home:5173
```

Stop the development server with `Ctrl+C`, or use the project command when the
process is running in another terminal:

```bash
npm run stop:dev
```

The Vite development server is for local iteration only; it is not the LAN
production server.

## LAN publishing

Build the application and start Caddy in the background:

```bash
npm run start
```

`npm run start` runs the production build first and then starts Caddy with the
checked-in [Caddyfile](Caddyfile). The static files in `dist/` are served on
port `80`.

Open the application without a port:

```text
http://homevault.home.arpa
http://homevault.home.com
http://homevault.home
```

Stop or restart the Caddy server:

```bash
npm run stop
npm run restart
npm run status
```

`npm run status` reports whether the Caddy LAN server and the Vite development
server are running, including their process IDs, listening TCP ports and
available URLs.

Example:

```text
Homevault process status
-----------------------
Caddy LAN: RUNNING | PID: 1234 | TCP: 80
	URLs: http://homevault.home.arpa, http://homevault.home.com, http://homevault.home
Vite development: RUNNING | PID: 5678 | TCP: 5173
	URLs: http://localhost:5173, http://homevault.home.arpa:5173
```

The `restart` command stops Caddy if it is running and starts it again. It is
safe to use even when Caddy is already stopped.

For a foreground Caddy process, useful when inspecting logs, run:

```bash
npm run serve:lan
```

Stop the foreground process with `Ctrl+C`.

## DNS configuration

Create DNS rewrites in AdGuard Home so each alias resolves to the host running
Homevault:

| Hostname | Address |
| --- | --- |
| `homevault.home.arpa` | `192.168.0.50` |
| `homevault.home.com` | `192.168.0.50` |
| `homevault.home` | `192.168.0.50` |

Client devices must use the internal DNS service. The recommended setup is to
advertise the internal DNS server through DHCP. If a device uses only the
router DNS, the Homevault aliases will not resolve unless the router forwards
these records to AdGuard Home.

When troubleshooting an iPhone or another mobile device, verify that it is on
the same non-guest Wi-Fi network. VPNs, private DNS features and client
isolation can prevent access to internal DNS or the local server.

## Network and firewall

| Port | Protocol | Purpose | Required when |
| --- | --- | --- | --- |
| `53` | UDP/TCP | Internal DNS queries | Clients use AdGuard Home on this host |
| `80` | TCP | Caddy LAN publishing | Using `npm run start` |
| `5173+` | TCP | Vite development server | Using `npm run dev`; Vite selects the next available port |

The current machine already permits the required LAN access. If another
installation blocks HTTP, create a narrowly scoped Windows Firewall rule from
an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Homevault HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -RemoteAddress 192.168.0.0/24 -Profile Private -Action Allow
```

Do not expose these ports through router port forwarding. The application is
currently intended for the private local network only.

## HTTPS

HTTPS is intentionally not enabled yet. Public certificate authorities cannot
normally issue certificates for these internal hostnames. The next HTTPS step
requires an internal certificate authority or another certificate strategy
trusted by every client device on the network.

Until then, the LAN URLs use HTTP. Do not place sensitive data or real user
documents in this smoke-test deployment.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies from `package-lock.json` |
| `npm run dev` | Start Vite development mode, preferring port `5173` |
| `npm run stop:dev` | Stop the Vite development server for this project |
| `npm run start` | Build and start Caddy in the background on port `80` |
| `npm run stop` | Stop the Caddy server |
| `npm run restart` | Stop and start the Caddy server again |
| `npm run status` | Show Caddy and Vite process and port status |
| `npm run serve:lan` | Run Caddy in the foreground |
| `npm run build` | Typecheck and create the production build in `dist/` |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the Vite production build locally |

## Validation

Run the project checks before committing:

```bash
npm run lint
npm run build
```

Validate the LAN publication from the server:

```powershell
Invoke-WebRequest http://homevault.home
```

Validate from another device by opening one of the LAN URLs. A successful
browser response confirms DNS resolution, network reachability, Caddy host
matching and static file serving together.

## Troubleshooting

### The browser cannot find the server

The client is probably not using the internal DNS service. Confirm the DNS
rewrite in AdGuard Home, reconnect the client to Wi-Fi and check that it is not
using a guest network, VPN or private DNS relay.

### The browser times out

Check that Caddy is running, that the client is on the same LAN and that the
Windows network profile is `Private`. Check for Wi-Fi client isolation and
firewall rules affecting TCP `80`.

### The hostname returns a blank page

Confirm that the hostname appears in [Caddyfile](Caddyfile), then reload the
configuration or restart Caddy:

```bash
npm run restart
```

### Changes are not visible on the LAN URL

The LAN server serves `dist/`, not the source files. Rebuild after changing the
React code:

```bash
npm run build
```

### `caddy` is not recognized

Use the project scripts (`npm run start`, `npm run stop`, `npm run stop:dev` and
`npm run serve:lan`).
They locate the WinGet installation automatically. When invoking `caddy`
directly, open a new terminal after installing it so the updated `PATH` is
loaded.

### Port `80` is already in use

Find the process using the port from PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 80 -State Listen
```

Stop or reconfigure the conflicting service before starting Caddy.

### Port `5173` is already in use

Vite automatically selects the next available port. Run `npm run status` or
use the URL printed by Vite to find the active development URL. To stop the
development server, use `npm run stop:dev`.

## Project structure

```text
.
├── Caddyfile              # LAN static server configuration
├── public/                # Public static assets
├── src/
│   ├── App.tsx            # Initial Homevault page
│   ├── index.css          # Global styles
│   └── main.tsx           # React entry point
├── index.html             # HTML entry point
├── package.json           # Scripts and dependencies
├── package-lock.json      # npm dependency lockfile
├── scripts/
│   ├── caddy.ps1          # Resolves Caddy for npm scripts on Windows
│   ├── stop-vite.ps1      # Stops the Vite development server
│   └── status.ps1         # Reports Caddy and Vite process status
├── vite.config.ts         # Vite development server configuration
└── README.md              # Project documentation
```

## Out of scope for this milestone

- Backend API.
- Database or persistent storage.
- Authentication and authorization.
- File uploads and document handling.
- HTTPS and internal certificate distribution.
- Automated tests beyond lint, typecheck and production build.
- CI/CD and automatic Windows service installation.

These should be designed and approved before expanding the initial smoke test
into the Homevault product.
