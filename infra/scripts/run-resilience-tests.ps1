#!/usr/bin/env pwsh
# IronCord Resilience Test Runner
# Runs comprehensive resilience and reconnection tests

param(
    [string]$TestSuite = "all",
    [switch]$Verbose,
    [switch]$SkipSetup
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IronCord Resilience Test Runner" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$PROJECT_ROOT = Resolve-Path "$PSScriptRoot/../.."
$RESILIENCE_DIR = Join-Path $PROJECT_ROOT "tests\resilience"

if (-not $SkipSetup) {
    Write-Host "[1/4] Starting test services..." -ForegroundColor Yellow
    
    try {
        podman compose -f (Join-Path $PROJECT_ROOT "podman-compose.test.yml") up -d
        
        Write-Host "Waiting for services to be healthy..." -ForegroundColor Gray
        Start-Sleep -Seconds 10
        
        $healthChecks = @{
            "Database" = { podman exec ironcord-test-db pg_isready -U ironcord_test }
            "IRC Server" = { podman exec ironcord-test-irc nc -z localhost 6667 }
        }
        
        foreach ($service in $healthChecks.Keys) {
            $maxAttempts = 10
            $attempt = 0
            $healthy = $false
            
            while ($attempt -lt $maxAttempts -and -not $healthy) {
                try {
                    & $healthChecks[$service] 2>&1 | Out-Null
                    $healthy = $true
                    Write-Host "  ✓ $service is healthy" -ForegroundColor Green
                } catch {
                    $attempt++
                    if ($attempt -lt $maxAttempts) {
                        Write-Host "  ⏳ Waiting for $service... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
                        Start-Sleep -Seconds 2
                    }
                }
            }
            
            if (-not $healthy) {
                Write-Host "  ✗ $service failed to start" -ForegroundColor Red
                exit 1
            }
        }
        
        Write-Host ""
    } catch {
        Write-Host "Failed to start test services: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[2/4] Installing resilience test dependencies..." -ForegroundColor Yellow
Push-Location $RESILIENCE_DIR
try {
    npm install --silent
    Write-Host "  ✓ Dependencies installed`n" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to install dependencies: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "[3/4] Building packages..." -ForegroundColor Yellow
Push-Location $PROJECT_ROOT
try {
    npm run build --silent 2>&1 | Out-Null
    Write-Host "  ✓ Packages built`n" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to build packages: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host "[4/4] Running resilience tests..." -ForegroundColor Yellow
Push-Location $RESILIENCE_DIR

$testCommand = switch ($TestSuite) {
    "irc" { "npm run test:irc" }
    "db" { "npm run test:db" }
    "database" { "npm run test:db" }
    "gateway" { "npm run test:gateway" }
    "system" { "npm run test:system" }
    "all" { "npm test" }
    default {
        Write-Host "Invalid test suite: $TestSuite" -ForegroundColor Red
        Write-Host "Valid options: all, irc, db, gateway, system" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Running: $testCommand`n" -ForegroundColor Gray

try {
    if ($Verbose) {
        Invoke-Expression $testCommand
    } else {
        Invoke-Expression $testCommand 2>&1 | Out-Default
    }
    
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    if ($exitCode -eq 0) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✓ All resilience tests passed!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
    } else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "✗ Some resilience tests failed" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
    }
    
    Pop-Location
    exit $exitCode
} catch {
    Write-Host "Test execution failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
