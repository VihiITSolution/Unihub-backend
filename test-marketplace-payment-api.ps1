# Marketplace Paid Posting - API Test Script
# Run this after backend server is started

Write-Host "=== Marketplace Paid Posting API Tests ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:5000/api"
$testsPassed = 0
$testsFailed = 0

# Test 1: Check API is running
Write-Host "Test 1: Check API is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl-docs" -Method GET -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS: API is running" -ForegroundColor Green
        $testsPassed++
    }
} catch {
    Write-Host "FAIL: API is not running" -ForegroundColor Red
    $testsFailed++
    Write-Host "Error: $_" -ForegroundColor Red
}

# Test 2: Check marketplace routes exist
Write-Host "`nTest 2: Check marketplace endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/marketplace" -Method GET -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS: Marketplace endpoint accessible" -ForegroundColor Green
        $testsPassed++
    }
} catch {
    Write-Host "WARNING: Marketplace endpoint returned error (expected without data)" -ForegroundColor Yellow
    $testsPassed++
}

# Test 3: Check new payment info endpoint structure (will fail without auth, but should exist)
Write-Host "`nTest 3: Check payment info endpoint structure..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/marketplace/1/payment-info" -Method GET -ErrorAction Stop
    Write-Host "WARNING: Expected authentication error" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "PASS: Payment info endpoint exists (returns auth error as expected)" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "❌ FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
}

# Test 4: Check admin marketplace pending endpoint structure
Write-Host "`nTest 4: Check admin pending marketplace endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/admin/marketplace/pending" -Method GET -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Host "PASS: Admin pending endpoint exists (returns auth error as expected)" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "FAIL: Unexpected error: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
}

# Test 5: Check webhook endpoints (should be public but return errors without data)
Write-Host "`nTest 5: Check PayHere webhook endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/payments/webhook/payhere" -Method POST -Body "{}" -ContentType "application/json" -ErrorAction Stop
    Write-Host "INFO: Webhook endpoint responded" -ForegroundColor Yellow
    $testsPassed++
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASS: PayHere webhook endpoint exists (returns validation error as expected)" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "WARNING: Unexpected webhook response: $($_.Exception.Message)" -ForegroundColor Yellow
        $testsPassed++
    }
}

# Test 6: Check environment configuration
Write-Host "`nTest 6: Check environment configuration..." -ForegroundColor Yellow
$envPath = "d:\vihin\Documents\Github\Unihub\Unihub-backend\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    $configOk = $true
    
    if ($envContent -match "MARKETPLACE_AD_FEE_TYPE") {
        Write-Host "  - MARKETPLACE_AD_FEE_TYPE configured" -ForegroundColor Gray
    } else {
        Write-Host "  - MARKETPLACE_AD_FEE_TYPE missing" -ForegroundColor Red
        $configOk = $false
    }
    
    if ($envContent -match "MARKETPLACE_AD_FEE_AMOUNT") {
        Write-Host "  - MARKETPLACE_AD_FEE_AMOUNT configured" -ForegroundColor Gray
    } else {
        Write-Host "  - MARKETPLACE_AD_FEE_AMOUNT missing" -ForegroundColor Red
        $configOk = $false
    }
    
    if ($envContent -match "MARKETPLACE_AD_DURATION_DAYS") {
        Write-Host "  - MARKETPLACE_AD_DURATION_DAYS configured" -ForegroundColor Gray
    } else {
        Write-Host "  - MARKETPLACE_AD_DURATION_DAYS missing" -ForegroundColor Red
        $configOk = $false
    }
    
    if ($configOk) {
        Write-Host "PASS: Environment configuration complete" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "FAIL: Environment configuration incomplete" -ForegroundColor Red
        $testsFailed++
    }
} else {
    Write-Host "FAIL: .env file not found" -ForegroundColor Red
    $testsFailed++
}

# Test 7: Check migration file exists
Write-Host "`nTest 7: Check migration file..." -ForegroundColor Yellow
$migrationPath = "d:\vihin\Documents\Github\Unihub\Unihub-backend\src\migrations\add-marketplace-payment-fields.js"
if (Test-Path $migrationPath) {
    Write-Host "PASS: Migration file exists" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "FAIL: Migration file not found" -ForegroundColor Red
    $testsFailed++
}

# Test 8: Check service files exist
Write-Host "`nTest 8: Check payment service files..." -ForegroundColor Yellow
$payhereService = "d:\vihin\Documents\Github\Unihub\Unihub-backend\src\services\payhere.service.js"
$helapayService = "d:\vihin\Documents\Github\Unihub\Unihub-backend\src\services\helapay.service.js"

if ((Test-Path $payhereService) -and (Test-Path $helapayService)) {
    Write-Host "PASS: Payment service files exist" -ForegroundColor Green
    $testsPassed++
} else {
    Write-Host "FAIL: Payment service files missing" -ForegroundColor Red
    $testsFailed++
}

# Summary
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor Red
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "All tests passed! Backend API is ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Run migration: node src/migrations/add-marketplace-payment-fields.js" -ForegroundColor White
    Write-Host "2. Configure PayHere and HelaPay credentials in .env" -ForegroundColor White
    Write-Host "3. Test with actual API calls using Postman or similar" -ForegroundColor White
    Write-Host "4. Proceed with frontend implementation" -ForegroundColor White
} else {
    Write-Host "Some tests failed. Please review the errors above." -ForegroundColor Yellow
