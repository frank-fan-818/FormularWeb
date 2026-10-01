param([Parameter(Mandatory = $true)][string]$RunnerRoot)

$ErrorActionPreference = 'Stop'
$runnerDirectory = (Resolve-Path -LiteralPath $RunnerRoot).Path
if (!(Test-Path -LiteralPath (Join-Path $runnerDirectory '.runner'))) {
    throw 'Register the dedicated runner before installing its startup task.'
}
$supervisor = Join-Path $runnerDirectory 'start-fastf1-runner.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-fastf1-runner.ps1') -Destination $supervisor -Force
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -RunnerRoot "{1}"' -f $supervisor, $runnerDirectory
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $runnerDirectory
$logon = New-ScheduledTaskTrigger -AtLogOn -User $account
$watchdog = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$task = New-ScheduledTask -Action $action -Trigger @($logon, $watchdog) -Principal $principal -Settings $settings `
    -Description 'Keep the registered FastF1 collector online while this user is logged in; restart the supervisor after failure.'
Register-ScheduledTask -TaskName 'FormularWeb-FastF1' -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName 'FormularWeb-FastF1'
Get-ScheduledTask -TaskName 'FormularWeb-FastF1' | Select-Object TaskName, State
