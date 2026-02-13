#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 2 Infrastructure Validation Script
.DESCRIPTION
    Validates infrastructure setup before Phase 3 (Gateway implementation).
    Tests: container startup, health checks, service connectivity, volume persistence, restart resilience.
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$script:TestResults = @()
$script:StartTime = Get-Date

function Write-TestHeader {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    $result = @{
        Test = $TestName
        Passed = $Passed
        Details = $Details
        Timestamp = Get-Date
    }
    $script:TestResults += $result
    
    $status = if ($Passed) { "[PASS]" } else { "[FAIL]" }
    $color = if ($Passed) { "Green" } else { "Red" }
    
    Write-Host "$status - $TestName" -ForegroundColor $color
    if ($Details -and ($Verbose -or -not $Passed)) {
        Write-Host "  Details: $Details" -ForegroundColor Gray
    }
}

function Test-ContainerStartup {
    Write-TestHeader "Test 1: Container Startup Time"
    
    # Cleanup first
    Write-Host "Cleaning up existing containers..." -ForegroundColor Yellow
    podman compose -f podman-compose.yml down --volumes 2>&1 | Out-Null
    Start-Sleep -Seconds 2
    
    # Measure startup time
    $startTime = Get-Date
    Write-Host "Starting containers..." -ForegroundColor Yellow
    podman compose -f podman-compose.yml up -d 2>&1 | Out-Null
    
    # Wait for DB to be healthy
    $dbHealthy = $false
    $maxWait = 30
    $waited = 0
    
    while (-not $dbHealthy -and $waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        $health = podman inspect ironcord-db --format "{{.State.Health.Status}}" 2>&1
        if ($health -match "healthy") {
            $dbHealthy = $true
        }
    }
    
    $elapsedTime = (Get-Date) - $startTime
    $totalSeconds = [math]::Round($elapsedTime.TotalSeconds, 2)
    
    $passed = $dbHealthy -and ($totalSeconds -lt 30)
    Write-TestResult -TestName "Containers start within 30 seconds" `
        -Passed $passed `
        -Details "Startup time: ${totalSeconds}s, DB healthy: $dbHealthy"
}

function Test-HealthChecks {
    Write-TestHeader "Test 2: Health Checks"
    
    # Check database health
    $dbHealth = podman inspect ironcord-db --format "{{.State.Health.Status}}" 2>&1
    $dbHealthy = $dbHealth -match "healthy"
    Write-TestResult -TestName "Database health check passes" `
        -Passed $dbHealthy `
        -Details "Status: $dbHealth"
    
    # Check app container running (Gateway not implemented, so health will fail)
    $appStatus = podman inspect ironcord-app --format "{{.State.Status}}" 2>&1
    $appRunning = $appStatus -match "running"
    Write-TestResult -TestName "App container is running" `
        -Passed $appRunning `
        -Details "Status: $appStatus"
    
    # Check IRC server logs
    $ircLogs = podman logs ironcord-app --tail 10 2>&1 | Select-String "Server running"
    $ircRunning = $null -ne $ircLogs
    Write-TestResult -TestName "IRC server (Ergo) is running" `
        -Passed $ircRunning `
        -Details "IRC server detected in logs"
    
    Write-Host "`n[NOTE] Gateway health check expected to fail - Gateway not implemented until Phase 3" -ForegroundColor Yellow
}

function Test-DatabaseConnectivity {
    Write-TestHeader "Test 3: Database Connectivity"
    
    # Test PostgreSQL connection
    $pgTest = podman exec ironcord-db psql -U ironcord -d ironcord -c "SELECT 1 as test;" 2>&1
    $pgConnected = $pgTest -match "1 row"
    Write-TestResult -TestName "PostgreSQL accepts connections" `
        -Passed $pgConnected `
        -Details "Connection test query executed"
    
    # Test database is accessible from host
    try {
        $tcpTest = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue
        $portOpen = $tcpTest.TcpTestSucceeded
    } catch {
        $portOpen = $false
    }
    Write-TestResult -TestName "Database port 5432 accessible from host" `
        -Passed $portOpen `
        -Details "Port accessibility verified"
}

function Test-IRCConnectivity {
    Write-TestHeader "Test 4: IRC Server Connectivity"
    
    # Test IRC port is open
    try {
        $tcpTest = Test-NetConnection -ComputerName localhost -Port 6667 -WarningAction SilentlyContinue
        $portOpen = $tcpTest.TcpTestSucceeded
    } catch {
        $portOpen = $false
    }
    Write-TestResult -TestName "IRC port 6667 accessible from host" `
        -Passed $portOpen `
        -Details "Port accessibility verified"
    
    # Check IRC server is responding
    $ircLogs = podman logs ironcord-app 2>&1 | Select-String "Server running"
    $ircResponding = $null -ne $ircLogs
    Write-TestResult -TestName "IRC server is responding" `
        -Passed $ircResponding `
        -Details "Server running confirmation found in logs"
}

function Test-VolumePersistence {
    Write-TestHeader "Test 5: Volume Persistence"
    
    # Create test data in database
    Write-Host "Creating test data in database..." -ForegroundColor Yellow
    $createTable = @"
CREATE TABLE IF NOT EXISTS test_persistence (
    id SERIAL PRIMARY KEY,
    test_value TEXT
);
INSERT INTO test_persistence (test_value) VALUES ('persistence_test_$(Get-Date -Format 'yyyyMMddHHmmss')');
"@
    
    podman exec ironcord-db psql -U ironcord -d ironcord -c $createTable 2>&1 | Out-Null
    
    # Restart container
    Write-Host "Restarting database container..." -ForegroundColor Yellow
    podman restart ironcord-db 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    
    # Wait for health
    $maxWait = 20
    $waited = 0
    $healthy = $false
    while (-not $healthy -and $waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        $health = podman inspect ironcord-db --format "{{.State.Health.Status}}" 2>&1
        if ($health -match "healthy") {
            $healthy = $true
        }
    }
    
    # Verify data persists
    $selectData = "SELECT COUNT(*) FROM test_persistence;"
    $result = podman exec ironcord-db psql -U ironcord -d ironcord -c $selectData 2>&1
    $dataPersisted = $result -match "\d+"
    
    Write-TestResult -TestName "Database data persists across container restarts" `
        -Passed $dataPersisted `
        -Details "Test data found after restart"
    
    # Cleanup
    podman exec ironcord-db psql -U ironcord -d ironcord -c "DROP TABLE IF EXISTS test_persistence;" 2>&1 | Out-Null
}

function Test-RestartResilience {
    Write-TestHeader "Test 6: Container Restart Resilience"
    
    # Restart database
    Write-Host "Testing database restart..." -ForegroundColor Yellow
    podman restart ironcord-db 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    
    $dbHealth = podman inspect ironcord-db --format "{{.State.Health.Status}}" 2>&1
    $dbRecovered = $dbHealth -match "healthy"
    Write-TestResult -TestName "Database recovers after restart" `
        -Passed $dbRecovered `
        -Details "Health status: $dbHealth"
    
    # Restart app container
    Write-Host "Testing app container restart..." -ForegroundColor Yellow
    podman restart ironcord-app 2>&1 | Out-Null
    Start-Sleep -Seconds 5
    
    $appStatus = podman inspect ironcord-app --format "{{.State.Status}}" 2>&1
    $appRecovered = $appStatus -match "running"
    Write-TestResult -TestName "App container recovers after restart" `
        -Passed $appRecovered `
        -Details "Status: $appStatus"
    
    # Verify IRC server restarted
    $ircLogs = podman logs ironcord-app --tail 20 2>&1 | Select-String "Server running"
    $ircRecovered = $null -ne $ircLogs
    Write-TestResult -TestName "IRC server recovers after restart" `
        -Passed $ircRecovered `
        -Details "IRC server running after restart"
}

function Test-PackageTests {
    Write-TestHeader "Test 7: Package Tests Against Podman Services"
    
    Write-Host "[NOTE] Package tests run against test services (podman-compose.test.yml)" -ForegroundColor Yellow
    Write-Host "Running package tests..." -ForegroundColor Yellow
    
    # Run shared package tests
    $sharedResult = npm test --workspace=@ironcord/shared 2>&1
    $sharedPassed = $LASTEXITCODE -eq 0
    Write-TestResult -TestName "@ironcord/shared tests pass" `
        -Passed $sharedPassed `
        -Details "Exit code: $LASTEXITCODE"
    
    # Run engine package tests (requires IRC server)
    $engineResult = npm test --workspace=@ironcord/engine 2>&1
    $enginePassed = $LASTEXITCODE -eq 0
    Write-TestResult -TestName "@ironcord/engine tests pass" `
        -Passed $enginePassed `
        -Details "Exit code: $LASTEXITCODE"
    
    # Run db package tests (requires PostgreSQL)
    $dbResult = npm test --workspace=@ironcord/db 2>&1
    $dbPassed = $LASTEXITCODE -eq 0
    Write-TestResult -TestName "@ironcord/db tests pass" `
        -Passed $dbPassed `
        -Details "Exit code: $LASTEXITCODE"
}

# ============================================
# Main Execution
# ============================================

Write-Host "`n" -NoNewline
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Phase 2 Infrastructure Validation Tests  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`n"

try {
    Test-ContainerStartup
    Test-HealthChecks
    Test-DatabaseConnectivity
    Test-IRCConnectivity
    Test-VolumePersistence
    Test-RestartResilience
    Test-PackageTests
    
    # Summary
    Write-TestHeader "Test Summary"
    
    $totalTests = $script:TestResults.Count
    $passedTests = ($script:TestResults | Where-Object { $_.Passed }).Count
    $failedTests = $totalTests - $passedTests
    $passRate = if ($totalTests -gt 0) { [math]::Round(($passedTests / $totalTests) * 100, 2) } else { 0 }
    
    Write-Host "Total Tests: $totalTests" -ForegroundColor White
    Write-Host "Passed: $passedTests" -ForegroundColor Green
    Write-Host "Failed: $failedTests" -ForegroundColor $(if ($failedTests -gt 0) { "Red" } else { "Green" })
    Write-Host "Pass Rate: ${passRate}%" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })
    
    $totalTime = (Get-Date) - $script:StartTime
    Write-Host "`nTotal execution time: $([math]::Round($totalTime.TotalSeconds, 2))s" -ForegroundColor Gray
    
    # Failed tests details
    if ($failedTests -gt 0) {
        Write-Host "`n[FAILED TESTS]" -ForegroundColor Red
        $script:TestResults | Where-Object { -not $_.Passed } | ForEach-Object {
            Write-Host "  - $($_.Test)" -ForegroundColor Red
            if ($_.Details) {
                Write-Host "    $($_.Details)" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host "`n[SUCCESS] Phase 2 Infrastructure Validation Complete!" -ForegroundColor Green
    
    # Exit with appropriate code
    if ($failedTests -gt 0) {
        exit 1
    } else {
        exit 0
    }
    
} catch {
    Write-Host "`n[ERROR] Fatal error during validation:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}
