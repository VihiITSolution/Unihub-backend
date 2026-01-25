# PowerShell test script for marketplace

$API_URL = "http://localhost:3000/api"
Write-Host "🧪 Testing Marketplace API" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1️⃣ Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET
    $health = $response.Content | ConvertFrom-Json
    Write-Host "✅ Server is healthy:" $health.message -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 2: Register Buyer
Write-Host "`n2️⃣ Testing Buyer Registration..." -ForegroundColor Yellow
$buyerData = @{
    email = "testbuyer_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
    password = "Test123!"
    username = "testbuyer_$(Get-Date -Format 'yyyyMMddHHmmss')"
    firstName = "Test"
    lastName = "Buyer"
    primaryRole = "student"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API_URL/auth/register" -Method POST -Body $buyerData -ContentType "application/json"
    $buyer = $response.Content | ConvertFrom-Json
    $buyerToken = $buyer.token
    Write-Host "✅ Buyer registered: $($buyer.user.username)" -ForegroundColor Green
} catch {
    Write-Host "❌ Registration failed:" $_.Exception.Message -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode
    exit 1
}

# Test 3: Register Vendor
Write-Host "`n3️⃣ Testing Vendor Registration..." -ForegroundColor Yellow
$vendorData = @{
    email = "testvendor_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
    password = "Test123!"
    username = "testvendor_$(Get-Date -Format 'yyyyMMddHHmmss')"
    firstName = "Test"
    lastName = "Vendor"
    primaryRole = "student"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$API_URL/auth/register" -Method POST -Body $vendorData -ContentType "application/json"
    $vendor = $response.Content | ConvertFrom-Json
    $vendorToken = $vendor.token
    Write-Host "✅ Vendor registered: $($vendor.user.username)" -ForegroundColor Green
} catch {
    Write-Host "❌ Registration failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 4: Create Vendor Profile
Write-Host "`n4️⃣ Testing Vendor Profile Creation..." -ForegroundColor Yellow
$profileData = @{
    shopName = "Test Shop"
    shopDescription = "A test shop for marketplace items"
    businessType = "individual"
    contactEmail = "vendor@test.com"
    contactPhone = "+1234567890"
    address = "123 Test St"
    city = "Test City"
    country = "Test Country"
    postalCode = "12345"
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $vendorToken"
        "Content-Type" = "application/json"
    }
    $response = Invoke-WebRequest -Uri "$API_URL/profile/vendor" -Method POST -Body $profileData -Headers $headers
    $profile = $response.Content | ConvertFrom-Json
    Write-Host "✅ Vendor profile created: $($profile.shopName)" -ForegroundColor Green
} catch {
    Write-Host "❌ Profile creation failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 5: Create Marketplace Item
Write-Host "`n5️⃣ Testing Create Marketplace Listing..." -ForegroundColor Yellow
$itemData = @{
    title = "Test Laptop"
    description = "A high-performance test laptop"
    price = 999.99
    category = "electronics"
    condition = "new"
    stock = 10
    images = @("https://example.com/laptop.jpg")
} | ConvertTo-Json

try {
    $headers = @{
        "Authorization" = "Bearer $vendorToken"
        "Content-Type" = "application/json"
    }
    $response = Invoke-WebRequest -Uri "$API_URL/marketplace" -Method POST -Body $itemData -Headers $headers
    $item = $response.Content | ConvertFrom-Json
    $itemId = $item.id
    Write-Host "✅ Item created: $($item.title) - Stock: $($item.stock)" -ForegroundColor Green
} catch {
    Write-Host "❌ Item creation failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 6: Browse Marketplace
Write-Host "`n6️⃣ Testing Browse Marketplace..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/marketplace" -Method GET
    $marketplace = $response.Content | ConvertFrom-Json
    Write-Host "✅ Found $($marketplace.items.length) items in marketplace" -ForegroundColor Green
} catch {
    Write-Host "❌ Browse failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Test 7: Get Item Details
Write-Host "`n7️⃣ Testing Get Item Details..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/marketplace/$itemId" -Method GET
    $itemDetails = $response.Content | ConvertFrom-Json
    Write-Host "✅ Item details: $($itemDetails.title) - Price: `$$($itemDetails.price)" -ForegroundColor Green
} catch {
    Write-Host "❌ Get details failed:" $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ ALL TESTS PASSED! 🎉" -ForegroundColor Green
Write-Host "`nBuyer Token: $buyerToken"
Write-Host "Vendor Token: $vendorToken"
Write-Host "Item ID: $itemId"
