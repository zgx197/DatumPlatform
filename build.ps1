# ================================================================
# DatumPlatform 一键构建脚本
# 用途：构建前端 + 后端，输出单文件 exe
# 使用：PowerShell 执行 .\build.ps1
# ================================================================

param(
    [string]$Runtime = "win-x64",
    [string]$OutputDir = ".\publish\$Runtime"
)

$ErrorActionPreference = "Stop"
Write-Host "=== DatumPlatform 构建开始 ===" -ForegroundColor Cyan

# Step 1: 构建前端
Write-Host "[1/4] 构建前端 (React + Vite)..." -ForegroundColor Yellow
Set-Location datum-web
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "前端构建失败"; exit 1 }
Set-Location ..
Write-Host "      ✓ 前端构建完成 → DatumServer/wwwroot/" -ForegroundColor Green

# Step 2: 编译后端（验证）
Write-Host "[2/4] 编译后端 (DatumServer)..." -ForegroundColor Yellow
dotnet build DatumServer -c Release --no-restore -q
if ($LASTEXITCODE -ne 0) { Write-Error "后端编译失败"; exit 1 }
Write-Host "      ✓ 后端编译通过" -ForegroundColor Green

# Step 3: 发布单文件 exe
Write-Host "[3/4] 发布单文件可执行程序 ($Runtime)..." -ForegroundColor Yellow
dotnet publish DatumServer -c Release -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o $OutputDir
if ($LASTEXITCODE -ne 0) { Write-Error "发布失败"; exit 1 }
Write-Host "      ✓ 发布完成 → $OutputDir" -ForegroundColor Green

# Step 4: 创建 datum_export/ 占位目录
Write-Host "[4/4] 创建数据目录占位符..." -ForegroundColor Yellow
$exportDir = Join-Path $OutputDir "datum_export"
if (-not (Test-Path $exportDir)) {
    New-Item -ItemType Directory -Path $exportDir | Out-Null
    "[]" | Out-File (Join-Path $exportDir "monsters.json")
    "[]" | Out-File (Join-Path $exportDir "skill_info.json")
    "[]" | Out-File (Join-Path $exportDir "skill_blueprints.json")
    "{}" | Out-File (Join-Path $exportDir "weight_config.json")
    "[]" | Out-File (Join-Path $exportDir "calibration.json")
}
Write-Host "      ✓ datum_export/ 目录已创建" -ForegroundColor Green

Write-Host ""
Write-Host "=== 构建完成 ===" -ForegroundColor Cyan
Write-Host "  产物路径：$OutputDir\DatumServer.exe" -ForegroundColor White
Write-Host "  运行方式：双击 DatumServer.exe，浏览器访问 http://localhost:7000" -ForegroundColor White
Write-Host "  切换数据：DatumServer.exe --data ./other_project_export" -ForegroundColor White
