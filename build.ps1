# =================================================================
# DatumPlatform build script
# Usage: .\build.ps1
#        .\build.ps1 -Runtime osx-arm64
#        .\build.ps1 -Runtime linux-x64
#        .\build.ps1 -SkipFrontend
# =================================================================

param(
    [string]$Runtime   = "win-x64",
    [string]$OutputDir = "",
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$StartTime  = Get-Date

if (-not $OutputDir) {
    $OutputDir = Join-Path $ScriptRoot "publish\$Runtime"
}

Write-Host ""
Write-Host "=== DatumPlatform Build ===" -ForegroundColor Cyan
Write-Host "  Runtime  : $Runtime"
Write-Host "  OutputDir: $OutputDir"
Write-Host ""

# ---- Step 1: Build frontend ----
if (-not $SkipFrontend) {
    Write-Host "[1/4] Building frontend (React + Vite)..." -ForegroundColor Yellow
    Push-Location (Join-Path $ScriptRoot "datum-web")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend build failed (exit code $LASTEXITCODE)"
        }
    }
    finally {
        Pop-Location
    }
    Write-Host "      [OK] Frontend built -> DatumServer/wwwroot/" -ForegroundColor Green
}
else {
    Write-Host "[1/4] Skipping frontend build (-SkipFrontend)" -ForegroundColor DarkGray
}

# ---- Step 2: Restore NuGet ----
Write-Host "[2/4] Restoring NuGet packages..." -ForegroundColor Yellow
dotnet restore (Join-Path $ScriptRoot "DatumServer") -q
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed" }
Write-Host "      [OK] Packages restored" -ForegroundColor Green

# ---- Step 3: Publish single-file exe ----
Write-Host "[3/4] Publishing single-file executable ($Runtime)..." -ForegroundColor Yellow
dotnet publish (Join-Path $ScriptRoot "DatumServer") `
    -c Release `
    -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o $OutputDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
Write-Host "      [OK] Published -> $OutputDir" -ForegroundColor Green

# ---- Step 4: Copy datum_export/ ----
Write-Host "[4/4] Preparing datum_export/ data..." -ForegroundColor Yellow
$srcExport  = Join-Path $ScriptRoot "datum_export"
$destExport = Join-Path $OutputDir  "datum_export"

if (Test-Path $srcExport) {
    if (-not (Test-Path $destExport)) {
        Copy-Item -Recurse $srcExport $destExport
        Write-Host "      [OK] Copied datum_export/ -> publish dir" -ForegroundColor Green
    }
    else {
        Write-Host "      [SKIP] datum_export/ already exists, skipping" -ForegroundColor DarkGray
    }
}
else {
    New-Item -ItemType Directory -Path $destExport -Force | Out-Null
    '[]' | Set-Content (Join-Path $destExport "monsters.json")
    '[]' | Set-Content (Join-Path $destExport "skill_info.json")
    '[]' | Set-Content (Join-Path $destExport "skill_blueprints.json")
    '{"weightEHP":0.35,"weightDPS":0.4,"weightControl":0.25,"baselineAtk":1000,"baselineDef":500,"baselineHP":50000,"powerMeanAlpha":1.0}' | Set-Content (Join-Path $destExport "weight_config.json")
    '[]' | Set-Content (Join-Path $destExport "calibration.json")
    Write-Host "      [OK] Created placeholder datum_export/ (replace with real data)" -ForegroundColor Yellow
}

# ---- Summary ----
$Elapsed = (Get-Date) - $StartTime
$ExeName = if ($Runtime -like "win*") { "DatumServer.exe" } else { "DatumServer" }
$ExePath = Join-Path $OutputDir $ExeName
$ExeSize = if (Test-Path $ExePath) { "{0:N1} MB" -f ((Get-Item $ExePath).Length / 1MB) } else { "N/A" }

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "  Time   : $([int]$Elapsed.TotalSeconds)s"
Write-Host "  Output : $ExePath ($ExeSize)" -ForegroundColor White
Write-Host "  Run    : double-click $ExeName, open http://localhost:7000" -ForegroundColor White
Write-Host "  Data   : $ExeName --data ./datum_export  (default)" -ForegroundColor DarkGray
Write-Host "  Switch : $ExeName --data ./other_export  (other project)" -ForegroundColor DarkGray
Write-Host ""
