$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPattern = [regex]::Escape($projectRoot)
$processes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
$viteProcesses = @($processes |
    Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -match 'vite[\\/]bin[\\/]vite\.js' -and
        $_.CommandLine -match $projectPattern
    })

if (-not $viteProcesses) {
    Write-Output 'Vite development is not running.'
    exit 0
}

$targetProcessIds = [System.Collections.Generic.HashSet[int]]::new()

foreach ($viteProcess in $viteProcesses) {
    [void] $targetProcessIds.Add([int] $viteProcess.ProcessId)

    $parentProcess = $processes | Where-Object { $_.ProcessId -eq $viteProcess.ParentProcessId }
    if ($parentProcess -and
        $parentProcess.Name -eq 'node.exe' -and
        $parentProcess.CommandLine -match 'npm-cli\.js.*\brun\s+dev\b') {
        [void] $targetProcessIds.Add([int] $parentProcess.ProcessId)
    }
}

foreach ($processId in $targetProcessIds) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

$remainingViteProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -match 'vite[\\/]bin[\\/]vite\.js' -and
        $_.CommandLine -match $projectPattern
    })

if (-not $remainingViteProcesses) {
    Write-Output ("Stopped Vite development process(es): {0}." -f (($targetProcessIds | Sort-Object) -join ', '))
    exit 0
}

Write-Error 'Vite processes were found, but could not be stopped.'
exit 1
