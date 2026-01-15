# YouTube API Setup Guide

## Overview

This application automatically uploads course videos to YouTube as unlisted videos for free storage. Videos are uploaded from the tutor's PC and stored on YouTube, reducing server storage costs.

## Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project" or select existing project
3. Give your project a name (e.g., "UniHub Video Storage")

### 2. Enable YouTube Data API v3

1. In the Cloud Console, go to **APIs & Services** > **Library**
2. Search for "YouTube Data API v3"
3. Click on it and press **Enable**

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in required fields (app name, user support email, developer email)
   - Add scope: `https://www.googleapis.com/auth/youtube.upload`
   - Add test users (your Gmail address)
4. For Application type, choose **Desktop app**
5. Give it a name (e.g., "UniHub Desktop Client")
6. Click **Create**

### 4. Download Credentials

1. After creating the OAuth client, click the **Download** icon
2. Save the JSON file as `youtube-credentials.json`
3. Place it in: `Unihub-backend/src/config/youtube-credentials.json`

### 5. Generate Refresh Token (One-Time Setup)

Create a script to generate the token:

**File:** `Unihub-backend/generate-youtube-token.js`

```javascript
const youtubeUploader = require("./src/config/youtube");

async function generateToken() {
  const authUrl = youtubeUploader.getAuthUrl();
  console.log("\n=== YouTube API Authorization ===\n");
  console.log("1. Visit this URL in your browser:");
  console.log(authUrl);
  console.log("\n2. Authorize the application");
  console.log("3. Copy the authorization code from the URL");
  console.log("4. Run: node generate-youtube-token.js <CODE>");

  if (process.argv[2]) {
    const code = process.argv[2];
    try {
      await youtubeUploader.getTokenFromCode(code);
      console.log("\n✓ Token generated successfully!");
      console.log("Token saved to: src/config/youtube-token.json");
    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

generateToken();
```

Run the script:

```bash
cd Unihub-backend
node generate-youtube-token.js
# Follow the URL, authorize, then run again with the code:
node generate-youtube-token.js YOUR_AUTHORIZATION_CODE
```

### 6. File Structure

After setup, you should have these files:

```
Unihub-backend/
  src/
    config/
      youtube-credentials.json  (OAuth 2.0 credentials from Google)
      youtube-token.json        (Generated refresh token)
      youtube.js                (YouTube uploader class)
```

### 7. Environment Variables (Optional)

You can also set credentials via environment variables:

**.env**

```
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REFRESH_TOKEN=your_refresh_token
```

## How It Works

1. **Tutor uploads video**: Frontend sends video file to backend
2. **Temporary storage**: Video is stored temporarily in `uploads/videos/`
3. **YouTube upload**: Backend uploads video to YouTube as **unlisted**
4. **Get YouTube URL**: YouTube returns the video URL
5. **Save to database**: YouTube URL is saved in `course_contents` table
6. **Cleanup**: Local video file is deleted after successful upload

## Video Privacy Settings

All videos are uploaded as **unlisted** which means:

- ✓ Not searchable on YouTube
- ✓ Not shown in your channel
- ✓ Only accessible via direct link
- ✓ Perfect for course content
- ✓ Free unlimited storage

## Fallback Mode

If YouTube API is not configured:

- Videos will be stored locally in `uploads/videos/`
- URLs will be `/uploads/videos/filename.mp4`
- Works for testing and small-scale deployment
- Requires more server storage

## Quota Limits

YouTube API has daily quota limits:

- Free tier: 10,000 units/day
- Video upload: ~1,600 units per upload
- **~6 videos can be uploaded per day** on free tier

For higher limits, apply for quota increase in Google Cloud Console.

## Troubleshooting

### Error: "YouTube credentials not found"

- Make sure `youtube-credentials.json` exists in `src/config/`
- Check file permissions

### Error: "YouTube token not found"

- Run the token generation script (Step 5)
- Make sure you completed the OAuth flow

### Error: "Invalid grant"

- Token may have expired (shouldn't happen with refresh token)
- Regenerate token using the script

### Error: "Daily limit exceeded"

- You've reached the daily quota (6 videos)
- Wait 24 hours or request quota increase

### Error: "The user has exceeded the number of videos they may upload"

- YouTube account limit reached
- Verify the account used in OAuth

## Security Notes

- **Never commit credentials to Git**
- Add to `.gitignore`:
  ```
  src/config/youtube-credentials.json
  src/config/youtube-token.json
  ```
- Store credentials securely in production
- Use environment variables for sensitive data

## Production Deployment

For production, use a service account instead of OAuth:

1. Create a service account in Google Cloud
2. Enable domain-wide delegation
3. Use service account JSON instead of OAuth flow
4. More suitable for automated uploads

---

## Quick Start (Without YouTube API)

If you want to test without YouTube setup:

1. Skip all YouTube setup steps
2. Videos will be stored locally
3. System will work in fallback mode
4. Good for development and testing

The application will automatically detect if YouTube is configured and adjust accordingly!
