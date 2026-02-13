/**
 * YouTube Authorization Script
 *
 * Run this script ONCE to authorize YouTube API access
 *
 * Steps:
 * 1. Make sure youtube-credentials.json exists in src/config/
 * 2. Start your backend server: npm start
 * 3. Run this script: node authorize-youtube.js
 * 4. Browser will open - sign in with UniHub YouTube account
 * 5. Click "Allow"
 * 6. Done! Token will be saved automatically
 */

async function authorizeYouTube() {
  console.log("\n🎬 YouTube Authorization Setup\n");
  console.log("This will open a browser window for YouTube authorization.");
  console.log("Sign in with your UniHub YouTube account.\n");

  // Load PORT from .env file
  require("dotenv").config();
  const PORT = process.env.PORT || 5000;
  const authUrl = `http://localhost:${PORT}/api/youtube/auth`;

  try {
    // First, get the auth URL from our server
    const fetch = (await import("node-fetch")).default;
    const response = await fetch(authUrl);
    const data = await response.json();

    if (data.success && data.authUrl) {
      console.log("✓ Opening browser for authorization...\n");
      console.log("If browser doesn't open, visit this URL:\n");
      console.log(data.authUrl);
      console.log("\n");

      // Open browser using dynamic import
      const open = (await import("open")).default;
      await open(data.authUrl);

      console.log("📌 After authorization:");
      console.log("   1. Browser will show success message");
      console.log("   2. youtube-token.json will be created automatically");
      console.log("   3. You can then upload videos through the platform\n");
    } else {
      console.error("❌ Failed to get authorization URL");
      console.error("Make sure:");
      console.error("   - Backend server is running (npm start)");
      console.error("   - youtube-credentials.json exists in src/config/");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nMake sure your backend server is running: npm start\n");
  }
}

// Run the authorization
authorizeYouTube();
