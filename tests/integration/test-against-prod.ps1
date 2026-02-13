# Test against production unified container
$env:DB_HOST = "localhost"
$env:DB_PORT = "5432"
$env:DB_NAME = "ironcord"
$env:DB_USER = "ironcord"
$env:DB_PASSWORD = "ironcord_password"
$env:IRC_HOST = "localhost"
$env:IRC_PORT = "6667"

Write-Host "Running database tests against unified container (port 5432)..." -ForegroundColor Cyan
npm test --workspace=@ironcord/db

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDatabase tests passed!" -ForegroundColor Green
} else {
    Write-Host "`nDatabase tests failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nRunning engine tests against unified container (port 6667)..." -ForegroundColor Cyan
npm test --workspace=@ironcord/engine

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nEngine tests passed!" -ForegroundColor Green
} else {
    Write-Host "`nEngine tests failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nAll tests passed against unified container!" -ForegroundColor Green
