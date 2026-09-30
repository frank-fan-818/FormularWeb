param(
    [Parameter(Mandatory = $true)][string]$RunnerRoot,
    [ValidateRange(1, 300)][int]$RestartDelaySeconds = 30
)

$ErrorActionPreference = 'Stop'
$runnerDirectory = (Resolve-Path -LiteralPath $RunnerRoot).Path
$settingsPath = Join-Path $runnerDirectory '.runner'
$launcher = Join-Path $runnerDirectory 'run.cmd'
if (!(Test-Path -LiteralPath $settingsPath) -or !(Test-Path -LiteralPath $launcher)) {
    throw 'Configure the dedicated GitHub runner before starting its supervisor.'
}
$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
if ($settings.gitHubUrl -ne 'https://github.com/frank-fan-818/FormularWeb') {
    throw 'Refusing to start a runner registered to another repository.'
}

# One supervisor per registered runner, including when logon and manual startup overlap.
$mutex = [Threading.Mutex]::new($false, "Local\FormularWeb-FastF1-$($settings.agentId)")
$ownsMutex = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (!$ownsMutex) { exit 0 }

    $gitCommand = (Get-Command git.exe -ErrorAction Stop).Source
    $gitDirectory = Split-Path $gitCommand
    $gitBin = $null
    # Git Bash exposes mingw64/bin/git.exe; PowerShell may expose cmd/git.exe.
    for ($level = 0; $level -lt 3 -and !$gitBin; $level++) {
        foreach ($relative in @('bin\bash.exe', 'usr\bin\bash.exe')) {
            $candidate = Join-Path $gitDirectory $relative
            if (Test-Path -LiteralPath $candidate) {
                $gitBin = Split-Path $candidate
                break
            }
        }
        $gitDirectory = Split-Path $gitDirectory
    }
    if (!$gitBin) {
        throw 'Git for Windows bash is required; the WSL bash launcher is not supported.'
    }
    $env:PATH = "$gitBin;$env:PATH"
    $env:AGENT_TOOLSDIRECTORY = Join-Path $runnerDirectory '_work\_tool'
    $stopFile = Join-Path $runnerDirectory 'supervisor.stop'
    $log = Join-Path $runnerDirectory 'supervisor.log'
    Set-Location -LiteralPath $runnerDirectory
    while (!(Test-Path -LiteralPath $stopFile)) {
        if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 1MB) {
            Move-Item -LiteralPath $log -Destination "$log.previous" -Force
        }
        "$(Get-Date -Format o) Starting registered FastF1 runner" | Add-Content -LiteralPath $log -Encoding UTF8
        try {
            # run.cmd handles GitHub runner self-updates and retryable disconnects.
            # The outer loop also restarts clean exits and terminal listener failures.
            $ErrorActionPreference = 'Continue'
            & $launcher 2>&1 | Out-File -LiteralPath $log -Append -Encoding UTF8
            $ErrorActionPreference = 'Stop'
            "$(Get-Date -Format o) Listener stopped (exit $LASTEXITCODE); restart in $RestartDelaySeconds seconds" | Add-Content -LiteralPath $log -Encoding UTF8
        } catch {
            # Do not persist exception bodies, which could contain credential details.
            $ErrorActionPreference = 'Stop'
            "$(Get-Date -Format o) Launcher failed ($($_.Exception.GetType().Name)); retrying" | Add-Content -LiteralPath $log -Encoding UTF8
        }
        for ($second = 0; $second -lt $RestartDelaySeconds; $second++) {
            if (Test-Path -LiteralPath $stopFile) { break }
            Start-Sleep -Seconds 1
        }
    }
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
