# =================================================================
# DatumPlatform Dev Launcher
# Usage:
#   .\dev.ps1                         - default: use datum_export/
#   .\dev.ps1 -Data "D:\path\export"  - custom data dir
#   .\dev.ps1 -SkipBuild              - skip backend build
#   .\dev.ps1 -BackendOnly            - backend only
#   .\dev.ps1 -FrontendOnly           - frontend only
# =================================================================

param(
    [string]$Data         = "",
    [switch]$SkipBuild,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # suppress Invoke-WebRequest progress bar
$ScriptRoot = $PSScriptRoot

# Resolve data directory
if (-not $Data) { $Data = Join-Path $ScriptRoot "datum_export" }
$resolved = Resolve-Path $Data -ErrorAction SilentlyContinue
if ($resolved) { $Data = $resolved.Path }

$BackendPort  = 7000
$FrontendPort = 5173
$BackendUrl   = "http://localhost:$BackendPort"
$FrontendUrl  = "http://localhost:$FrontendPort"
$PidFile      = Join-Path $ScriptRoot ".datum-dev-pids"

Write-Host ""
Write-Host "=== DatumPlatform Dev Launcher ===" -ForegroundColor Cyan
Write-Host "  Data   : $Data"
Write-Host "  Backend: $BackendUrl"
Write-Host "  Web    : $FrontendUrl"
Write-Host ""

# Kill any process using a given port
function Stop-PortProcess {
    param([int]$Port)
    $lines = netstat -ano 2>$null | Select-String ":$Port "
    foreach ($line in $lines) {
        $parts = ($line.ToString().Trim() -split '\s+')
        $procId = $parts[-1]
        if ($procId -match '^\d+$') {
            Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        }
    }
}

# Kill process by saved PID (handles orphaned cmd/terminal windows)
function Stop-SavedPid {
    param([string]$Key)
    if (Test-Path $PidFile) {
        $pids = Get-Content $PidFile | ConvertFrom-StringData -ErrorAction SilentlyContinue
        if ($pids -and $pids[$Key]) {
            $savedPid = [int]$pids[$Key]
            Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
        }
    }
}

# Save PIDs to file for cleanup on next run
function Save-Pids {
    param([int]$BackendPid, [int]$FrontendPid)
    "BackendPid=$BackendPid`nFrontendPid=$FrontendPid" | Set-Content $PidFile
}

# Clean up old processes (PID file first, then port fallback)
if (-not $FrontendOnly) {
    Write-Host "[clean] Stopping old backend..." -ForegroundColor DarkGray
    Stop-SavedPid -Key "BackendPid"
    Stop-PortProcess -Port $BackendPort
}
if (-not $BackendOnly) {
    Write-Host "[clean] Stopping old frontend (cmd window + port)..." -ForegroundColor DarkGray
    Stop-SavedPid -Key "FrontendPid"   # kills the cmd.exe window itself
    Stop-PortProcess -Port $FrontendPort
    Start-Sleep -Milliseconds 300       # give time for port release
}

# Step 1: Build backend
if (-not $FrontendOnly) {
    if (-not $SkipBuild) {
        Write-Host ""
        Write-Host "[1/3] Building backend..." -ForegroundColor Yellow
        $slnPath = Join-Path $ScriptRoot "DatumPlatform.sln"
        dotnet build $slnPath --no-restore -c Debug
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Backend build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "[1/3] Build OK" -ForegroundColor Green
    } else {
        Write-Host "[1/3] Skipping build (-SkipBuild)" -ForegroundColor DarkGray
    }
}

# Sync docs to frontend public directory
$docsSource = Join-Path $ScriptRoot "docs\Datum_Formula_Reference.md"
$docsDest   = Join-Path $ScriptRoot "datum-web\public\docs"
if (Test-Path $docsSource) {
    if (-not (Test-Path $docsDest)) { New-Item -ItemType Directory -Path $docsDest -Force | Out-Null }
    Copy-Item $docsSource $docsDest -Force
    Write-Host "[docs] Synced Datum_Formula_Reference.md -> datum-web/public/docs/" -ForegroundColor DarkGray
}

# Step 2: Start backend in a new window
$backendProc = $null
if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "[2/3] Starting backend..." -ForegroundColor Yellow
    $backendArgs = "run --project `"$ScriptRoot\DatumServer`" --no-build -- --data `"$Data`""
    $backendProc = Start-Process -FilePath "dotnet" `
        -ArgumentList $backendArgs `
        -WorkingDirectory $ScriptRoot `
        -PassThru -WindowStyle Minimized

    # Wait up to 20s for backend to respond
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest -Uri "$BackendUrl/api/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
    }
    if ($ready) {
        Write-Host "[2/3] Backend ready: $BackendUrl" -ForegroundColor Green
    } else {
        Write-Host "[2/3] Backend not responding after 20s, continuing..." -ForegroundColor Yellow
    }
}

# Step 3: Start frontend dev server in a new window
$frontendProc = $null
if (-not $BackendOnly) {
    Write-Host ""
    Write-Host "[3/3] Starting frontend..." -ForegroundColor Yellow
    $frontendDir = Join-Path $ScriptRoot "datum-web"

    # Install node_modules if missing
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Host "[3/3] npm install..." -ForegroundColor Yellow
        Push-Location $frontendDir
        npm install --silent
        Pop-Location
    }

    $frontendProc = Start-Process -FilePath "cmd" `
        -ArgumentList "/k npm run dev" `
        -WorkingDirectory $frontendDir `
        -PassThru -WindowStyle Minimized

    # Wait up to 15s for frontend
    Start-Sleep -Seconds 3
    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $r = Invoke-WebRequest -Uri $FrontendUrl -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) { break }
        } catch { }
    }
    Write-Host "[3/3] Frontend ready: $FrontendUrl" -ForegroundColor Green
}

# Save PIDs for cleanup on next run
Save-Pids `
    -BackendPid  (if ($backendProc)  { $backendProc.Id  } else { 0 }) `
    -FrontendPid (if ($frontendProc) { $frontendProc.Id } else { 0 })

# Open browser
if (-not $BackendOnly) {
    Start-Sleep -Milliseconds 500
    Write-Host ""
    Write-Host "[open] Opening browser -> $FrontendUrl/levels" -ForegroundColor Cyan
    Start-Process "$FrontendUrl/levels"
}

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Services started!" -ForegroundColor Green
Write-Host "  Web    : $FrontendUrl/levels" -ForegroundColor White
Write-Host "  API    : $BackendUrl" -ForegroundColor White
Write-Host "  Data   : $Data" -ForegroundColor Gray
Write-Host ""
Write-Host "  Backend PID : $(if ($backendProc) { $backendProc.Id } else { 'N/A' })"
Write-Host "  Frontend PID: $(if ($frontendProc) { $frontendProc.Id } else { 'N/A' })"
Write-Host ""
Write-Host "  To stop: re-run dev.ps1 (auto-cleans on next start), or run:" -ForegroundColor DarkYellow
Write-Host "    Stop-Process -Id $(if ($backendProc) { $backendProc.Id } else { '<id>' }) $(if ($frontendProc) { $frontendProc.Id } else { '' })" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
