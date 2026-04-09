$ErrorActionPreference = "Continue"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$driversDir = Join-Path $baseDir "..\src\assets\drivers"
$constructorsDir = Join-Path $baseDir "..\src\assets\constructors"

$driversUrl = "https://raw.githubusercontent.com/f1db/f1db/main/public/images/drivers/photos"
$constructorsUrl = "https://raw.githubusercontent.com/f1db/f1db/main/public/images/constructors/logos"

$driverIds = @(
    "max_verstappen",
    "perez",
    "leclerc",
    "sainz",
    "hamilton",
    "russell",
    "norris",
    "piastri",
    "gasly",
    "ocon",
    "alonso",
    "stroll",
    "tsunoda",
    "ricciardo",
    "bottas",
    "zhou",
    "magnussen",
    "hulkenberg"
)

$constructorIds = @(
    "red_bull",
    "ferrari",
    "mercedes",
    "mclaren",
    "alpine",
    "aston_martin",
    "alphatauri",
    "alfa",
    "haas",
    "williams"
)

function Download-Image {
    param(
        [string]$url,
        [string]$savePath
    )
    
    try {
        Write-Host "正在下载: $url"
        Invoke-WebRequest -Uri $url -OutFile $savePath -UseBasicParsing
        Write-Host "✓ 下载成功: $(Split-Path -Leaf $savePath)"
    }
    catch {
        Write-Host "✗ 下载失败: $url" -ForegroundColor Red
        Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "开始下载车手头像..." -ForegroundColor Cyan
foreach ($driverId in $driverIds) {
    $url = "$driversUrl/$driverId.png"
    $savePath = Join-Path $driversDir "$driverId.png"
    Download-Image -url $url -savePath $savePath
}

Write-Host "`n开始下载车队Logo..." -ForegroundColor Cyan
foreach ($constructorId in $constructorIds) {
    $url = "$constructorsUrl/$constructorId.png"
    $savePath = Join-Path $constructorsDir "$constructorId.png"
    Download-Image -url $url -savePath $savePath
}

Write-Host "`n下载完成！" -ForegroundColor Green
