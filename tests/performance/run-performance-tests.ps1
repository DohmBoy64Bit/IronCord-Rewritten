# Performance Test Runner for IronCord v2
# 
# This script runs comprehensive performance tests against the running system

param(
    [switch]$SkipBuild = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "IronCord v2 Performance Test Suite" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if services are running
Write-Host "Checking if services are running..." -ForegroundColor Yellow
$appRunning = $null
$dbRunning = $null

try {
    $appRunning = podman ps --filter "name=ironcord-app" --filter "status=running" --format "{{.Names}}"
    $dbRunning = podman ps --filter "name=ironcord-db" --filter "status=running" --format "{{.Names}}"
} catch {
    Write-Host "Error checking container status: $_" -ForegroundColor Red
    exit 1
}

if (-not $appRunning) {
    Write-Host "✗ Gateway container (ironcord-app) is not running" -ForegroundColor Red
    Write-Host "  Start services with: podman compose up -d" -ForegroundColor Yellow
    exit 1
}

if (-not $dbRunning) {
    Write-Host "✗ Database container (ironcord-db) is not running" -ForegroundColor Red
    Write-Host "  Start services with: podman compose up -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ All required services are running" -ForegroundColor Green
Write-Host ""

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0

while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Gateway is healthy" -ForegroundColor Green
            break
        }
    } catch {
        # Ignore and retry
    }
    
    Start-Sleep -Seconds 1
    $waited++
    
    if ($waited -eq $maxWait) {
        Write-Host "✗ Gateway failed to become healthy within $maxWait seconds" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Set environment variables
$env:GATEWAY_URL = "http://localhost:3000"
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "ironcord"
$env:DB_USER = "ironcord"
$env:DB_PASSWORD = "ironcord_password"

# Run performance tests
Write-Host "Running performance tests..." -ForegroundColor Yellow
Write-Host ""

try {
    if ($Verbose) {
        tsx tests/performance/performance-tests.ts
    } else {
        tsx tests/performance/performance-tests.ts 2>&1 | Where-Object { $_ -match "^===" -or $_ -match "Test \d" -or $_ -match "Target:" -or $_ -match "Result:" -or $_ -match "PASS|FAIL" }
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "✓ All performance tests passed!" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        exit 0
    } else {
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Red
        Write-Host "✗ Some performance tests failed" -ForegroundColor Red
        Write-Host "=====================================" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error running performance tests: $_" -ForegroundColor Red
    exit 1
}
