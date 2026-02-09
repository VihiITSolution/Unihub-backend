const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let authToken = '';
let userId = '';
let vendorToken = '';
let vendorUserId = '';
let itemId = '';

// Test user credentials
const testBuyer = {
  email: `buyer_${Date.now()}@test.com`,
  password: 'Test123!',
  username: `buyer_${Date.now()}`,
  firstName: 'Test',
  lastName: 'Buyer',
  primaryRole: 'student'
};

const testVendor = {
  email: `vendor_${Date.now()}@test.com`,
  password: 'Test123!',
  username: `vendor_${Date.now()}`,
  firstName: 'Test',
  lastName: 'Vendor',
  primaryRole: 'student'
};

async function runTests() {
  console.log('🧪 Starting Marketplace API Tests\n');

  try {
    // Test 1: Register Buyer
    console.log('1️⃣  Testing Buyer Registration...');
    const buyerReg = await axios.post(`${API_URL}/auth/register`, testBuyer);
    authToken = buyerReg.data.token;
    userId = buyerReg.data.user.id;
    console.log('✅ Buyer registered:', buyerReg.data.user.username);

    // Test 2: Register Vendor
    console.log('\n2️⃣  Testing Vendor Registration...');
    const vendorReg = await axios.post(`${API_URL}/auth/register`, testVendor);
    vendorToken = vendorReg.data.token;
    vendorUserId = vendorReg.data.user.id;
    console.log('✅ Vendor registered:', vendorReg.data.user.username);

    // Test 3: Create Vendor Profile
    console.log('\n3️⃣  Testing Vendor Profile Creation...');
    const vendorProfile = await axios.post(
      `${API_URL}/profile/vendor`,
      {
        shopName: 'Test Shop',
        shopDescription: 'A test shop for marketplace items',
        businessType: 'individual',
        contactEmail: testVendor.email,
        contactPhone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        postalCode: '12345'
      },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    console.log('✅ Vendor profile created:', vendorProfile.data.shopName);

    // Test 4: Create Marketplace Item
    console.log('\n4️⃣  Testing Create Marketplace Listing...');
    const item = await axios.post(
      `${API_URL}/marketplace`,
      {
        title: 'Test Laptop',
        description: 'A high-performance test laptop',
        price: 999.99,
        category: 'electronics',
        condition: 'new',
        stock: 10,
        images: ['https://example.com/laptop.jpg']
      },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    itemId = item.data.id;
    console.log('✅ Item created:', item.data.title, '- Stock:', item.data.stock);

    // Test 5: Browse Marketplace (Public)
    console.log('\n5️⃣  Testing Browse Marketplace...');
    const items = await axios.get(`${API_URL}/marketplace`);
    console.log('✅ Found', items.data.items.length, 'items in marketplace');

    // Test 6: Get Item Details
    console.log('\n6️⃣  Testing Get Item Details...');
    const itemDetails = await axios.get(`${API_URL}/marketplace/${itemId}`);
    console.log('✅ Item details:', itemDetails.data.title, '- Price: $' + itemDetails.data.price);

    // Test 7: Create Order (Buy Now)
    console.log('\n7️⃣  Testing Create Order (Buy Now)...');
    const order = await axios.post(
      `${API_URL}/marketplace/${itemId}/order`,
      {
        quantity: 2,
        shippingAddress: {
          street: '456 Buyer St',
          city: 'Buyer City',
          state: 'BC',
          country: 'Test Country',
          postalCode: '54321'
        }
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Order created:', order.data.orderNumber, '- Total: $' + order.data.totalAmount);

    // Test 8: Check Stock After Purchase
    console.log('\n8️⃣  Testing Stock After Purchase...');
    const updatedItem = await axios.get(`${API_URL}/marketplace/${itemId}`);
    console.log('✅ Stock after purchase:', updatedItem.data.stock, '(should be 10 initially)');

    // Test 9: Vendor Sales List
    console.log('\n9️⃣  Testing Vendor Sales List...');
    const sales = await axios.get(`${API_URL}/marketplace/sales`, {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    console.log('✅ Vendor has', sales.data.orders.length, 'sale(s)');

    // Test 10: Update Order Status
    console.log('\n🔟 Testing Update Order Status...');
    const updateStatus = await axios.patch(
      `${API_URL}/marketplace/orders/${order.data.id}/status`,
      { status: 'confirmed' },
      { headers: { Authorization: `Bearer ${vendorToken}` } }
    );
    console.log('✅ Order status updated to:', updateStatus.data.status);

    // Test 11: Check Stock After Confirmation
    console.log('\n1️⃣1️⃣  Testing Stock After Confirmation...');
    const confirmedItem = await axios.get(`${API_URL}/marketplace/${itemId}`);
    console.log('✅ Stock after confirmation:', confirmedItem.data.stock, '(should be 8 now - 2 units sold)');

    // Test 12: Vendor Dashboard Stats
    console.log('\n1️⃣2️⃣  Testing Vendor Dashboard Stats...');
    const stats = await axios.get(`${API_URL}/profile/vendor/stats`, {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    console.log('✅ Vendor Stats:');
    console.log('   - Total Sales:', stats.data.totalSales);
    console.log('   - Total Revenue: $' + stats.data.totalRevenue);
    console.log('   - Active Listings:', stats.data.activeListings);
    console.log('   - Pending Orders:', stats.data.pendingOrders);

    console.log('\n✅ ALL TESTS PASSED! 🎉');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.data.message || error.response.data);
      console.error('Full error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runTests();
