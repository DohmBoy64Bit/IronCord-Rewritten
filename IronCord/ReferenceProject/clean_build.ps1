# Clean Build Script for IronCord (Windows/Podman)

Write-Host "Stopping existing Podman containers..."
podman compose down

Write-Host "Removing orphans and volumes..."
podman compose down --volumes --remove-orphans

Write-Host "Rebuilding images (no cache)..."
podman compose build --no-cache --progress=plain

Write-Host "Starting services in detached mode..."
podman compose up -d

Write-Host "Waiting for database to be healthy..."
Start-Sleep -Seconds 10

Write-Host "Deployment complete! Gateway running on port 3000."
