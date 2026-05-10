# PowerShell script to import all Mainline years (2000-2026)
# This script runs both the import and image download scripts for each year
# Usage: powershell -ExecutionPolicy Bypass -File scripts/import_all_mainline_years.ps1

# Set working directory to script location
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mainline Import Script - All Years (2000-2026)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Working directory: $projectRoot" -ForegroundColor Gray
Write-Host "Starting at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

$years = 2000..2026
$totalYears = $years.Count
$currentYear = 0
$startTime = Get-Date

foreach ($year in $years) {
    $currentYear++
    $yearStartTime = Get-Date
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "[$currentYear/$totalYears] Processing year $year" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    # Step 1: Import data
    Write-Host "[$currentYear/$totalYears] Step 1: Importing data for $year..." -ForegroundColor Magenta
    $importResult = & npx ts-node scripts/import/import_mainline_year.ts $year 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Import failed for year $year (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Error output: $importResult" -ForegroundColor Red
        Write-Host "Continuing with next year..." -ForegroundColor Yellow
        Write-Host ""
        continue
    }
    
    Write-Host $importResult
    Write-Host "✓ Data import completed for $year" -ForegroundColor Green
    Write-Host ""

    # Step 2: Download images
    Write-Host "[$currentYear/$totalYears] Step 2: Downloading images for $year..." -ForegroundColor Magenta
    $downloadResult = & npx ts-node scripts/tools/download_and_sync_images_mainline.ts $year 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Image download failed for year $year (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "Error output: $downloadResult" -ForegroundColor Red
        Write-Host "Continuing with next year..." -ForegroundColor Yellow
        Write-Host ""
        continue
    }
    
    Write-Host $downloadResult
    Write-Host "✓ Image download completed for $year" -ForegroundColor Green
    Write-Host ""

    $yearEndTime = Get-Date
    $yearDuration = $yearEndTime - $yearStartTime
    Write-Host "✓ Year $year completed successfully! (Duration: $($yearDuration.TotalSeconds.ToString('F2')) seconds)" -ForegroundColor Green
    Write-Host ""
    
    # Calculate estimated time remaining
    if ($currentYear -gt 0) {
        $elapsed = (Get-Date) - $startTime
        $avgTimePerYear = $elapsed.TotalSeconds / $currentYear
        $remainingYears = $totalYears - $currentYear
        $estimatedRemaining = [TimeSpan]::FromSeconds($avgTimePerYear * $remainingYears)
        Write-Host "Progress: $currentYear/$totalYears years | Estimated time remaining: $($estimatedRemaining.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
    }
    
    Write-Host "Waiting 2 seconds before next year..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
    Write-Host ""
}

$endTime = Get-Date
$totalDuration = $endTime - $startTime

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All years processed!" -ForegroundColor Green
Write-Host "Total duration: $($totalDuration.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host "Completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan












