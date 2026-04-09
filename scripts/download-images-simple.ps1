$ErrorActionPreference = "Continue"

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$driversDir = Join-Path $baseDir "..\src\assets\drivers"
$constructorsDir = Join-Path $baseDir "..\src\assets\constructors"

$driversUrl = "https://raw.githubusercontent.com/f1db/f1db/main/public/images/drivers/photos"
$constructorsUrl = "https://raw.githubusercontent.com/f1db/f1db/main/public/images/constructors/logos"

$driverIds = @("max_verstappen","perez","leclerc","sainz","hamilton","russell","norris","piastri","gasly","ocon","alonso","stroll","tsunoda","ricciardo","bottas","zhou","magnussen","hulkenberg")
$constructorIds = @("red_bull","ferrari","mercedes","mclaren","alpine","aston_martin","alphatauri","alfa","haas","williams")

function Download-Image {
    param([string]$url,[string]$savePath)
    try {
        Write-Host "Downloading: $url"
        Invoke-WebRequest -Uri $url -OutFile $savePath -UseBasicParsing
        Write-Host "OK: $(Split-Path -Leaf $savePath)"
    } catch {
        Write-Host "ERROR: $url"
    }
}

Write-Host "Downloading driver images..."
foreach ($id in $driverIds) {
    Download-Image -url "$driversUrl/$id.png" -savePath (Join-Path $driversDir "$id.png")
}

Write-Host "Downloading constructor logos..."
foreach ($id in $constructorIds) {
    Download-Image -url "$constructorsUrl/$id.png" -savePath (Join-Path $constructorsDir "$id.png")
}

Write-Host "Done!"
