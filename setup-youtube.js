#!/usr/bin/env node

/**
 * YouTube Integration Setup Script
 * Helps configure YouTube API for automatic video uploads
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setup() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   UniHub LMS - YouTube Integration Setup            ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log("This wizard will help you set up YouTube video uploads.\n");

  // Check if credentials exist
  const credentialsPath = path.join(
    __dirname,
    "src",
    "config",
    "youtube-credentials.json"
  );
  const tokenPath = path.join(__dirname, "src", "config", "youtube-token.json");

  const hasCredentials = fs.existsSync(credentialsPath);
  const hasToken = fs.existsSync(tokenPath);

  console.log("📋 Current Status:");
  console.log(`   YouTube Credentials: ${hasCredentials ? "✅ Found" : "❌ Missing"}`);
  console.log(`   OAuth Token: ${hasToken ? "✅ Found" : "❌ Missing"}\n`);

  if (hasCredentials && hasToken) {
    console.log("✅ Setup is complete! Your LMS is ready to upload videos to YouTube.\n");
    console.log("To test the integration:");
    console.log("1. Start the backend: npm start");
    console.log("2. Login as a tutor");
    console.log("3. Upload a video to a course");
    console.log("4. Check your YouTube channel\n");
    rl.close();
    return;
  }

  if (!hasCredentials) {
    console.log("❌ YouTube credentials are missing.\n");
    console.log("To set up YouTube API credentials:\n");
    console.log("1. Go to: https://console.cloud.google.com/");
    console.log("2. Create a new project");
    console.log("3. Enable 'YouTube Data API v3'");
    console.log("4. Create OAuth 2.0 credentials (Desktop app)");
    console.log("5. Download the JSON file");
    console.log(
      "6. Save it as: src/config/youtube-credentials.json\n"
    );
    console.log("📖 For detailed instructions, see: YOUTUBE_SETUP.md\n");

    const answer = await question(
      "Have you downloaded the credentials file? (yes/no): "
    );

    if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
      const filePath = await question(
        "Enter the path to your credentials file: "
      );

      try {
        const absolutePath = path.resolve(filePath.trim());
        if (fs.existsSync(absolutePath)) {
          fs.copyFileSync(absolutePath, credentialsPath);
          console.log("✅ Credentials file copied successfully!\n");
        } else {
          console.log("❌ File not found. Please check the path.\n");
          rl.close();
          return;
        }
      } catch (error) {
        console.error("❌ Error copying file:", error.message);
        rl.close();
        return;
      }
    } else {
      console.log("\nPlease download the credentials file first.");
      console.log("See YOUTUBE_SETUP.md for instructions.\n");
      rl.close();
      return;
    }
  }

  if (!hasToken) {
    console.log("📝 Next step: Generate OAuth token\n");
    console.log("Run this command:");
    console.log("   node authorize-youtube.js\n");
    console.log("This will:");
    console.log("1. Open your browser to authorize the app");
    console.log("2. Generate a refresh token");
    console.log("3. Save it to src/config/youtube-token.json\n");
    console.log("After that, your setup will be complete!\n");
  }

  rl.close();
}

setup().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
