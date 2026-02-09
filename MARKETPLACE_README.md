# 🛒 Marketplace Module - Fixed & Enhanced

## 🎯 Overview

The Marketplace Module has been completely refactored to fix critical bugs and implement a robust vendor system. Key improvements include:

- ✅ Fixed authorization bugs
- ✅ Added vendor profile system
- ✅ Implemented stock management
- ✅ Created order tracking system
- ✅ Any user can browse and buy
- ✅ Users can become vendors on demand

## 🚀 Quick Start

### 1. Run Migrations

```bash
cd Unihub-backend
node src/migrations/run-marketplace-migrations.js
```

This will:
- Create `vendor_profiles` table
- Add `stock` and `sold_count` columns to `marketplace_items`
- Create `orders` table
- Add `is_vendor_profile_complete` column to `users`

### 2. Restart Server

```bash
npm run dev
```

### 3. Test the New Features

#### Become a Vendor
```bash
POST /api/profile/vendor
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "shopName": "My Awesome Shop",
  "shopDescription": "We sell amazing products",
  "businessType": "individual",
  "contactEmail": "shop@example.com",
  "contactPhone": "+1234567890",
  "address": "123 Main St",
  "city": "New York",
  "country": "USA",
  "postalCode": "10001"
}
```

#### Create a Listing (Vendors Only)
```bash
POST /api/marketplace
Authorization: Bearer YOUR_VENDOR_TOKEN
Content-Type: application/json

{
  "title": "Programming Laptop Stand",
  "description": "Ergonomic stand for developers",
  "category": "Electronics",
  "itemType": "equipment",
  "condition": "new",
  "price": 49.99,
  "stock": 100,
  "location": "New York, USA",
  "contactInfo": "shop@example.com"
}
```

#### Create an Order (Any User)
```bash
POST /api/marketplace/orders
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "itemId": 1,
  "quantity": 2,
  "shippingAddress": "456 Buyer St, Los Angeles, CA 90001",
  "buyerNotes": "Please handle with care"
}
```

#### Update Order Status (Seller Only)
```bash
PUT /api/marketplace/orders/1
Authorization: Bearer YOUR_VENDOR_TOKEN
Content-Type: application/json

{
  "status": "confirmed",
  "sellerNotes": "Order confirmed, preparing for shipment"
}
```

## 📊 New Database Schema

### vendor_profiles
```sql
CREATE TABLE vendor_profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  shop_name VARCHAR(255) NOT NULL,
  shop_description TEXT,
  business_type ENUM('individual', 'business'),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  tax_id VARCHAR(100),
  is_approved BOOLEAN DEFAULT FALSE,
  approval_status ENUM('pending', 'approved', 'rejected'),
  is_active BOOLEAN DEFAULT TRUE,
  total_sales INT DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0.00,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### orders
```sql
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id VARCHAR(100) NOT NULL UNIQUE,
  buyer_id INT NOT NULL,
  seller_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  status ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'),
  shipping_address TEXT,
  buyer_notes TEXT,
  seller_notes TEXT,
  tracking_number VARCHAR(100),
  payment_id INT,
  confirmed_at TIMESTAMP NULL,
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);
```

### marketplace_items (Updated)
Added columns:
- `stock INT NOT NULL DEFAULT 0` - Available inventory
- `sold_count INT DEFAULT 0` - Total units sold

## 🔧 API Endpoints

### Vendor Profile Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/profile/vendor` | Required | Create vendor profile |
| GET | `/api/profile/vendor` | Required | Get my vendor profile |
| PUT | `/api/profile/vendor` | Required | Update vendor profile |
| GET | `/api/profile/vendor/stats` | Required | Get sales statistics |
| GET | `/api/profile/vendor/:userId` | Public | Get public vendor profile |

### Marketplace Endpoints (Updated)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/marketplace` | Vendor | Create listing |
| GET | `/api/marketplace` | Public | Browse listings |
| GET | `/api/marketplace/:id` | Public | Get listing details |
| PUT | `/api/marketplace/:id` | Owner/Admin | Update listing |
| DELETE | `/api/marketplace/:id` | Owner/Admin | Delete listing |
| GET | `/api/marketplace/my-listings` | Vendor | Get my listings |

### Order Endpoints (NEW)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/marketplace/orders` | Required | Create order |
| GET | `/api/marketplace/orders` | Required | Get my orders (buyer) |
| GET | `/api/marketplace/sales` | Vendor | Get my sales (seller) |
| PUT | `/api/marketplace/orders/:id` | Seller | Update order status |

## 🔐 Authorization Logic

### Before Fix (BROKEN)
```javascript
// ❌ This never worked for admins
if (item.sellerId !== req.user.id && req.user.role !== 'admin')
```

### After Fix (WORKING)
```javascript
// ✅ Checks both primaryRole and roles array
const isAdmin = req.user.primaryRole === 'admin' || 
                (req.user.roles && req.user.roles.includes('admin'));
if (item.sellerId !== req.user.id && !isAdmin)
```

## 📦 Stock Management

### Automatic Stock Handling

**When order is CONFIRMED:**
```javascript
- item.stock decreases by order.quantity
- item.soldCount increases by order.quantity
```

**When order is CANCELLED:**
```javascript
- item.stock increases by order.quantity (if was confirmed)
- item.soldCount decreases by order.quantity (if was confirmed)
```

**Before order creation:**
```javascript
- Validates stock >= quantity
- Prevents overselling
- Returns error if insufficient stock
```

## 🎭 User Roles & Profiles

### Role Hierarchy
```
All users start as: Student
Can extend to:
  ├─> Tutor (create courses)
  ├─> Vendor (sell items)
  └─> Admin (manage platform)
```

### Vendor Profile Requirements
To create listings, users must:
1. ✅ Have completed vendor profile
2. ✅ Profile must be active (`isActive = true`)
3. ✅ Profile completion sets `isVendorProfileComplete = true`

## 🧪 Testing Guide

### Test Scenarios

**1. User becomes vendor**
```bash
# Create vendor profile
curl -X POST http://localhost:3001/api/profile/vendor \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shopName": "Test Shop", "city": "NYC", "country": "USA"}'

# Verify vendor flag set
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer TOKEN"
# Should show: isVendorProfileComplete: true
```

**2. Create listing with stock**
```bash
curl -X POST http://localhost:3001/api/marketplace \
  -H "Authorization: Bearer VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Item",
    "description": "Test",
    "category": "Electronics",
    "itemType": "equipment",
    "condition": "new",
    "price": 99.99,
    "stock": 50
  }'
```

**3. Create order and verify stock decrease**
```bash
# Before order
curl http://localhost:3001/api/marketplace/1
# Note the stock value

# Create order
curl -X POST http://localhost:3001/api/marketplace/orders \
  -H "Authorization: Bearer BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": 1,
    "quantity": 3,
    "shippingAddress": "123 Test St"
  }'

# Get order ID from response, then confirm it
curl -X PUT http://localhost:3001/api/marketplace/orders/1 \
  -H "Authorization: Bearer SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "confirmed"}'

# Check stock again
curl http://localhost:3001/api/marketplace/1
# Stock should be decreased by 3
```

**4. Cancel order and verify stock restoration**
```bash
curl -X PUT http://localhost:3001/api/marketplace/orders/1 \
  -H "Authorization: Bearer SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelled"}'

# Check stock
curl http://localhost:3001/api/marketplace/1
# Stock should be restored
```

## 🐛 Bugs Fixed

| Issue | Status | Description |
|-------|--------|-------------|
| Authorization bug | ✅ Fixed | Admin authorization now works correctly |
| Race condition | ✅ Fixed | View count uses atomic increment |
| No stock tracking | ✅ Fixed | Full stock management implemented |
| No vendor system | ✅ Fixed | Complete vendor profile system |
| No order system | ✅ Fixed | Full order lifecycle management |
| Type mismatches | ⚠️ Partial | Backend fixed, frontend needs update |

## 📋 Frontend Tasks Remaining

1. **Update types** - Add VendorProfile, Order, update MarketplaceItem
2. **Create vendor service** - API client for vendor endpoints
3. **Update marketplace service** - Align with new backend routes
4. **Create vendor pages** - Dashboard, shop, listings, sales
5. **Update marketplace pages** - Show stock, add buy functionality
6. **Add vendor registration** - Form to create vendor profile
7. **Simplify signup** - Remove role selection, default to student

## 📚 Documentation

- **API Docs**: http://localhost:3001/api-docs
- **Implementation Plan**: [MARKETPLACE_FIX_PLAN.md](../MARKETPLACE_FIX_PLAN.md)
- **Implementation Summary**: [MARKETPLACE_IMPLEMENTATION.md](../MARKETPLACE_IMPLEMENTATION.md)

## 🆘 Troubleshooting

### Migration fails
```bash
# Check database connection
mysql -u root -p

# Verify database exists
SHOW DATABASES;

# Check if tables exist
USE unihub_db;
SHOW TABLES;

# If tables exist, drop and recreate
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS vendor_profiles;
# Then run migrations again
```

### Cannot create listing
- Ensure user has vendor profile: `GET /api/profile/vendor`
- Check vendor profile is active
- Verify authentication token is valid

### Stock not decreasing
- Order must be in 'confirmed' status
- Only confirmed orders decrement stock
- Check order status in database

## 🎉 Success Metrics

✅ Backend fully functional  
✅ All migrations working  
✅ Authorization bugs fixed  
✅ Stock management operational  
✅ Order system complete  
⏳ Frontend integration pending  

---

**Next Step:** Update frontend to integrate with new backend endpoints
