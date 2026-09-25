$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPattern = [regex]::Escape($projectRoot)

function Get-ListeningPorts {
    param(
        [int[]] $ProcessIds
    )

    if (-not $ProcessIds) {
        return @()
    }

    return @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $ProcessIds -contains $_.OwningProcess } |
        Select-Object -ExpandProperty LocalPort -Unique |
        Sort-Object |
        ForEach-Object { [int] $_ })
}

function Get-ServiceUrls {
    param(
        [string] $Service,
        [int[]] $Ports
    )

    $urls = @()

    foreach ($port in $Ports) {
        if ($Service -eq 'Caddy LAN' -and $port -eq 80) {
            $urls += @(
                'http://homevault.home.arpa',
                'http://homevault.home.com',
                'http://homevault.home'
            )
        }

        if ($Service -eq 'Vite development') {
            $urls += @(
                "http://localhost:$port",
                "http://homevault.home.arpa:$port",
                "http://homevault.home.com:$port",
                "http://homevault.home:$port"
            )
        }
    }

    return ($urls -join ', ')
}

function Write-ServiceStatus {
    param(
        [string] $Label,
        [object[]] $Processes
    )

    if (-not $Processes) {
        Write-Output ("{0}: STOPPED" -f $Label)
        return
    }

    $processIds = @($Processes | Select-Object -ExpandProperty ProcessId -Unique | Sort-Object)
    $ports = @(Get-ListeningPorts -ProcessIds $processIds)

    if (-not $ports) {
        Write-Output ("{0}: STOPPED | process found but no listening TCP port | PID: {1}" -f $Label, ($processIds -join ', '))
        return
    }

    Write-Output ("{0}: RUNNING | PID: {1} | TCP: {2}" -f $Label, ($processIds -join ', '), ($ports -join ', '))
    Write-Output ("  URLs: {0}" -f (Get-ServiceUrls -Service $Label -Ports $ports))
}

$caddyProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'caddy.exe'" -ErrorAction SilentlyContinue)
$viteProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.CommandLine -match 'vite[\\/]bin[\\/]vite\.js' -and
        $_.CommandLine -match $projectPattern
    })

Write-Output 'Homevault process status'
Write-Output '-----------------------'
Write-ServiceStatus -Label 'Caddy LAN' -Processes $caddyProcesses
Write-ServiceStatus -Label 'Vite development' -Processes $viteProcesses
