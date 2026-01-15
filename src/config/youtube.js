const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

/**
 * YouTube API Configuration
 *
 * Setup Instructions:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable YouTube Data API v3
 * 4. Create OAuth 2.0 credentials (Desktop app)
 * 5. Download the credentials JSON and save as 'youtube-credentials.json' in the config folder
 * 6. Run the authorization flow once to get the refresh token
 *
 * For now, we'll use a placeholder that returns a local file path
 * You can implement the full OAuth flow later
 */

class YouTubeUploader {
  constructor() {
    this.oauth2Client = null;
    this.youtube = null;
    this.initialized = false;
  }

  /**
   * Initialize YouTube API with OAuth2
   */
  async initialize() {
    try {
      const credentialsPath = path.join(__dirname, "youtube-credentials.json");
      const tokenPath = path.join(__dirname, "youtube-token.json");

      // Check if credentials exist
      if (!fs.existsSync(credentialsPath)) {
        console.warn(
          "YouTube credentials not found. Video uploads will be stored locally."
        );
        this.initialized = false;
        return false;
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
      const { client_secret, client_id, redirect_uris } =
        credentials.installed || credentials.web;

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0] || "http://localhost:5000/api/youtube/oauth2callback"
      );

      // Check if token exists
      if (fs.existsSync(tokenPath)) {
        const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        this.oauth2Client.setCredentials(token);
        this.youtube = google.youtube({
          version: "v3",
          auth: this.oauth2Client,
        });
        this.initialized = true;
        console.log("YouTube API initialized successfully");
        return true;
      } else {
        console.warn(
          "YouTube token not found. Please complete OAuth flow first."
        );
        this.initialized = false;
        return false;
      }
    } catch (error) {
      console.error("Failed to initialize YouTube API:", error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Upload video to YouTube as unlisted
   * @param {string} filePath - Path to video file
   * @param {string} title - Video title
   * @param {string} description - Video description
   * @returns {Promise<string>} YouTube video URL
   */
  async uploadVideo(filePath, title, description = "") {
    if (!this.initialized) {
      // Fallback: Return local file path if YouTube API is not configured
      console.log("YouTube API not configured, storing video locally");
      return `/uploads/videos/${path.basename(filePath)}`;
    }

    try {
      const fileSize = fs.statSync(filePath).size;

      const response = await this.youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: title,
            description: description,
            categoryId: "27", // Education category
          },
          status: {
            privacyStatus: "unlisted", // Make video unlisted
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      });

      const videoId = response.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`Video uploaded to YouTube: ${youtubeUrl}`);

      // Delete local file after successful upload
      fs.unlinkSync(filePath);

      return youtubeUrl;
    } catch (error) {
      console.error("YouTube upload failed:", error.message);
      // Return local path as fallback
      return `/uploads/videos/${path.basename(filePath)}`;
    }
  }

  /**
   * Generate OAuth URL for authorization
   * This is needed only once to get the refresh token
   */
  getAuthUrl() {
    const scopes = ["https://www.googleapis.com/auth/youtube.upload"];

    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
    });

    return url;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth flow
   */
  async getTokenFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Save tokens for future use
      const tokenPath = path.join(__dirname, "youtube-token.json");
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));

      this.youtube = google.youtube({ version: "v3", auth: this.oauth2Client });
      this.initialized = true;

      return tokens;
    } catch (error) {
      console.error("Failed to get token:", error.message);
      throw error;
    }
  }
}

// Create singleton instance
const youtubeUploader = new YouTubeUploader();

// Initialize on module load
youtubeUploader.initialize().catch((err) => {
  console.error("YouTube initialization error:", err);
});

module.exports = youtubeUploader;
