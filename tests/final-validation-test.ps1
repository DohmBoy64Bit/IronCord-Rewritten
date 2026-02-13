# Final Validation Test Suite
# Runs all package tests 10 consecutive times to validate stability

param(
    [int]$Iterations = 10
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IronCord v2 - Final Validation Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test packages in order
$packages = @(
    "@ironcord/shared",
    "@ironcord/engine",
    "@ironcord/db",
    "@ironcord/gateway"
)

# Track results
$results = @{}
foreach ($pkg in $packages) {
    $results[$pkg] = @{
        Passed = 0
        Failed = 0
        Runs = @()
    }
}

Write-Host "Running $Iterations consecutive test runs..." -ForegroundColor Yellow
Write-Host ""

for ($i = 1; $i -le $Iterations; $i++) {
    Write-Host "=== Run $i/$Iterations ===" -ForegroundColor Cyan
    
    foreach ($pkg in $packages) {
        Write-Host "Testing $pkg..." -ForegroundColor White
        
        $startTime = Get-Date
        
        try {
            $output = npm test --workspace=$pkg 2>&1
            $exitCode = $LASTEXITCODE
            
            $duration = (Get-Date) - $startTime
            
            if ($exitCode -eq 0) {
                $results[$pkg].Passed++
                Write-Host "  [PASS] ($('{0:N2}' -f $duration.TotalSeconds)s)" -ForegroundColor Green
                $results[$pkg].Runs += @{
                    Run = $i
                    Status = "PASS"
                    Duration = $duration.TotalSeconds
                }
            } else {
                $results[$pkg].Failed++
                Write-Host "  [FAIL] ($('{0:N2}' -f $duration.TotalSeconds)s)" -ForegroundColor Red
                $results[$pkg].Runs += @{
                    Run = $i
                    Status = "FAIL"
                    Duration = $duration.TotalSeconds
                    Output = $output
                }
            }
        } catch {
            $duration = (Get-Date) - $startTime
            $results[$pkg].Failed++
            Write-Host "  [ERROR] ($('{0:N2}' -f $duration.TotalSeconds)s)" -ForegroundColor Red
            $results[$pkg].Runs += @{
                Run = $i
                Status = "ERROR"
                Duration = $duration.TotalSeconds
                Error = $_.Exception.Message
            }
        }
    }
    
    Write-Host ""
}

# Generate summary report
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FINAL VALIDATION RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true
$totalTests = 0
$totalPassed = 0

foreach ($pkg in $packages) {
    $passed = $results[$pkg].Passed
    $failed = $results[$pkg].Failed
    $total = $passed + $failed
    $successRate = if ($total -gt 0) { ($passed / $total) * 100 } else { 0 }
    
    $totalTests += $total
    $totalPassed += $passed
    
    Write-Host "$pkg" -ForegroundColor White
    Write-Host "  Passed: $passed/$total ($('{0:N1}' -f $successRate)%)" -ForegroundColor $(if ($successRate -eq 100) { "Green" } else { "Red" })
    
    if ($successRate -lt 100) {
        $allPassed = $false
        Write-Host "  FAILED RUNS:" -ForegroundColor Red
        foreach ($run in $results[$pkg].Runs) {
            if ($run.Status -ne "PASS") {
                Write-Host "    Run $($run.Run): $($run.Status)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
}

# Overall summary
$overallSuccessRate = if ($totalTests -gt 0) { ($totalPassed / $totalTests) * 100 } else { 0 }

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "OVERALL: $totalPassed/$totalTests ($('{0:N1}' -f $overallSuccessRate)%)" -ForegroundColor $(if ($allPassed) { "Green" } else { "Red" })
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Save detailed report
$reportPath = "tests/final-validation-report.md"
$report = @"
# Final Validation Test Report

**Date**: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Iterations**: $Iterations
**Overall Success Rate**: $('{0:N1}' -f $overallSuccessRate)%

## Summary

| Package | Passed | Failed | Success Rate |
|---------|--------|--------|--------------|
"@

foreach ($pkg in $packages) {
    $passed = $results[$pkg].Passed
    $failed = $results[$pkg].Failed
    $total = $passed + $failed
    $successRate = if ($total -gt 0) { ($passed / $total) * 100 } else { 0 }
    
    $report += "| $pkg | $passed | $failed | $('{0:N1}' -f $successRate)% |`n"
}

$report += @"

## Overall Result

**Total Test Runs**: $totalTests
**Total Passed**: $totalPassed
**Total Failed**: $($totalTests - $totalPassed)
**Success Rate**: $('{0:N1}' -f $overallSuccessRate)%

**Status**: $(if ($allPassed) { "[PASS] ALL TESTS PASSED" } else { "[FAIL] SOME TESTS FAILED" })

## Detailed Results

"@

foreach ($pkg in $packages) {
    $report += "### $pkg`n`n"
    
    foreach ($run in $results[$pkg].Runs) {
        $status = if ($run.Status -eq "PASS") { "[PASS]" } else { "[FAIL]" }
        $report += "- Run $($run.Run): $status $($run.Status) ($('{0:N2}' -f $run.Duration)s)`n"
        
        if ($run.Status -ne "PASS" -and $run.Output) {
            $report += "``````n$($run.Output)``````n`n"
        }
    }
    
    $report += "`n"
}

$report += @"
## Validation Criteria

- [$(if ($allPassed) { "x" } else { " " })] All tests pass 10 consecutive full runs (100% success rate)
- [$(if ($allPassed) { "x" } else { " " })] Zero flaky tests

## Conclusion

$(if ($allPassed) {
    "[SUCCESS] **VALIDATION PASSED**: All tests passed 10 consecutive runs with 100% success rate. System is stable and ready for production."
} else {
    "[FAILURE] **VALIDATION FAILED**: Some tests failed during the validation runs. Please review the detailed results above and fix any issues before proceeding to production."
})
"@

Set-Content -Path $reportPath -Value $report -Encoding UTF8

Write-Host "Detailed report saved to: $reportPath" -ForegroundColor Cyan
Write-Host ""

if ($allPassed) {
    Write-Host "[SUCCESS] VALIDATION PASSED - All tests stable!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAILURE] VALIDATION FAILED - Some tests failed!" -ForegroundColor Red
    exit 1
}
