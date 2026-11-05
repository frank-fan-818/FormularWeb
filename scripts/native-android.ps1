param(
    [ValidateSet('test', 'build', 'verify')][string]$Task = 'verify',
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$SdkRoot = $env:ANDROID_HOME,
    [switch]$Offline,
    [switch]$Clean
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nativeRoot = Join-Path $projectRoot 'native-android'
if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin\java.exe'))) {
    throw 'Set JAVA_HOME or pass -JavaHome pointing to JDK 17 or newer (Android Studio jbr is supported).'
}
$env:JAVA_HOME = $JavaHome
$localProperties = Join-Path $nativeRoot 'local.properties'
if ($SdkRoot) {
    if (-not (Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms\android-36'))) { throw 'Android SDK platform 36 was not found.' }
    $escapedSdk = $SdkRoot.Replace('\', '\\').Replace(':', '\:')
    Set-Content -LiteralPath $localProperties -Value "sdk.dir=$escapedSdk" -Encoding utf8
}
if (-not (Test-Path -LiteralPath $localProperties)) { throw 'Pass -SdkRoot or configure native-android/local.properties.' }
$gradleCommand = Join-Path $nativeRoot 'gradlew.bat'
$existingDistribution = Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-8.14.3-all'
if (Test-Path -LiteralPath $existingDistribution) {
    $cached = Get-ChildItem -LiteralPath $existingDistribution -Directory | ForEach-Object {
        Join-Path $_.FullName 'gradle-8.14.3\bin\gradle.bat'
    } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($cached) { $gradleCommand = $cached }
}
$tasks = switch ($Task) {
    'test' { @(':app:testDebugUnitTest') }
    'build' { @(':app:assembleDebug') }
    'verify' { @(':app:testDebugUnitTest', ':app:lintDebug', ':app:assembleDebug') }
}
if ($Clean) { $tasks = @(':app:clean') + $tasks }
$arguments = @('--project-dir', $nativeRoot, '--gradle-user-home', (Join-Path $projectRoot '.cache\native-gradle'), '--no-daemon') + $tasks
if ($Offline) { $arguments += '--offline' }
& $gradleCommand @arguments
exit $LASTEXITCODE
