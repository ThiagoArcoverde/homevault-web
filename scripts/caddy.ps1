param(
    [Parameter(Position = 0, Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]] $CaddyArguments
)

$caddyCommand = Get-Command caddy -ErrorAction SilentlyContinue
$caddyPath = if ($caddyCommand) { $caddyCommand.Source } else { $null }

if (-not $caddyPath) {
    $packagesPath = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $caddyPath = Get-ChildItem $packagesPath -Recurse -Filter 'caddy.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not $caddyPath -or -not (Test-Path -LiteralPath $caddyPath)) {
    Write-Error 'Caddy was not found. Install it with: winget install --id CaddyServer.Caddy --exact --scope user'
    exit 1
}

if ($CaddyArguments[0] -eq 'stop' -and -not (Get-Process -Name caddy -ErrorAction SilentlyContinue)) {
    Write-Output 'Caddy is not running.'
    exit 0
}

& $caddyPath @CaddyArguments
exit $LASTEXITCODE
