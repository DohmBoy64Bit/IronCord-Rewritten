# Clean Build Script for IronCord v2 (Windows/Podman)

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "IronCord v2 Clean Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Stopping existing Podman containers..." -ForegroundColor Yellow
podman compose -f podman-compose.yml down

Write-Host "Removing orphans and volumes..." -ForegroundColor Yellow
podman compose -f podman-compose.yml down --volumes --remove-orphans

Write-Host "Removing old images..." -ForegroundColor Yellow
podman rmi ironcord-unified:latest -f 2>$null

Write-Host "Rebuilding unified image (no cache)..." -ForegroundColor Yellow
podman compose -f podman-compose.yml build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Starting services in detached mode..." -ForegroundColor Yellow
podman compose -f podman-compose.yml up -d

Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 2
    
    $dbHealth = podman inspect ironcord-db --format='{{.State.Health.Status}}' 2>$null
    $appHealth = podman inspect ironcord-app --format='{{.State.Health.Status}}' 2>$null
    
    if ($dbHealth -eq "healthy" -and $appHealth -eq "healthy") {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "Deployment complete!" -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "Gateway:    http://localhost:3000" -ForegroundColor Green
        Write-Host "IRC Server: localhost:6667" -ForegroundColor Green
        Write-Host "Database:   localhost:5432" -ForegroundColor Green
        Write-Host ""
        exit 0
    }
    
    Write-Host "Waiting... ($attempt/$maxAttempts) DB: $dbHealth, App: $appHealth" -ForegroundColor Gray
}

Write-Host "Services did not become healthy in time!" -ForegroundColor Red
podman compose logs
exit 1
