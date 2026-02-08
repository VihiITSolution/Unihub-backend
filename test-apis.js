const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAPIs() {
  console.log('🧪 Testing Unihub APIs...\n');

  try {
    // Test 1: Get marketplace items (public)
    console.log('1️⃣ Testing marketplace listings...');
    const marketplace = await axios.get(`${API_URL}/marketplace`);
    console.log(`✅ Found ${marketplace.data.data?.length || 0} marketplace items`);
    console.log(`   Response structure:`, Object.keys(marketplace.data));

    // Test 2: Get boarding places (public)
    console.log('\n2️⃣ Testing boarding places...');
    const boarding = await axios.get(`${API_URL}/boarding/places`);
    console.log(`✅ Found ${boarding.data.data?.items?.length || boarding.data.data?.length || 0} boarding places`);
    console.log(`   Response structure:`, Object.keys(boarding.data));

    console.log('\n🎉 All API tests passed!');
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testAPIs();
