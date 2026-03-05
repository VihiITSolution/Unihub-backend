# Quick fix script for notification system (Windows PowerShell)
# Run: .\fix-notifications.ps1

Write-Host "🔧 Notification System Fix Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if table exists
Write-Host "Step 1: Checking notification setup..." -ForegroundColor Yellow
Set-Location Unihub-backend
node check-notification-setup.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Notifications table is missing!" -ForegroundColor Yellow
    Write-Host "Running migration to create table..." -ForegroundColor Yellow
    Write-Host ""
    
    # Step 2: Run migration
    node src/migrations/create-notifications.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed!" -ForegroundColor Green
        Write-Host ""
        
        # Step 3: Verify again
        Write-Host "Verifying setup..." -ForegroundColor Yellow
        node check-notification-setup.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "🎉 SUCCESS! Notification system is ready!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Next step: Restart backend server" -ForegroundColor Cyan
            Write-Host "  docker-compose restart backend" -ForegroundColor Gray
            Write-Host "  OR" -ForegroundColor Gray
            Write-Host "  pm2 restart backend" -ForegroundColor Gray
        }
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed. Check error above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "✅ Notification system is already set up correctly!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
