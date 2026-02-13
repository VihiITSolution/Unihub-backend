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
          "YouTube credentials not found. Video uploads will be stored locally.",
        );
        this.initialized = false;
        return false;
      }

      const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
      const { client_secret, client_id, redirect_uris } =
        credentials.installed || credentials.web || {};

      if (!client_id || !client_secret) {
        console.error(
          "Invalid YouTube credentials format. Missing client_id or client_secret.",
        );
        this.initialized = false;
        return false;
      }

      // Use redirect_uris if available, otherwise use default
      const redirectUri =
        (redirect_uris && redirect_uris[0]) ||
        "http://localhost:5000/api/youtube/oauth2callback";

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri,
      );

      // Check if token exists
      if (fs.existsSync(tokenPath)) {
        const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        this.oauth2Client.setCredentials(token);

        // Set up automatic token refresh
        this.oauth2Client.on("tokens", (tokens) => {
          if (tokens.refresh_token) {
            // Store the refresh token
            console.log("Received new refresh token");
          }
          if (tokens.access_token) {
            console.log("Access token refreshed");
            // Update the token file
            const updatedToken = {
              ...token,
              access_token: tokens.access_token,
              expiry_date: tokens.expiry_date,
            };
            fs.writeFileSync(tokenPath, JSON.stringify(updatedToken, null, 2));
          }
        });

        this.youtube = google.youtube({
          version: "v3",
          auth: this.oauth2Client,
        });
        this.initialized = true;
        console.log("YouTube API initialized successfully");

        // Check if token is expired and try to refresh
        if (token.expiry_date && token.expiry_date < Date.now()) {
          console.log("YouTube token expired, attempting to refresh...");
          try {
            await this.oauth2Client.getAccessToken();
            console.log("YouTube token refreshed successfully");
          } catch (error) {
            console.error("Failed to refresh YouTube token:", error.message);
            console.warn("Please re-authorize the application");
          }
        }

        return true;
      } else {
        console.warn(
          "YouTube token not found. Please complete OAuth flow first.",
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
      console.warn("⚠️  YouTube API not configured, storing video locally");
      console.warn("Videos stored locally won't be visible in the UI.");
      console.warn(
        "Please run: node setup-youtube.js to configure YouTube integration",
      );
      return `/uploads/videos/${path.basename(filePath)}`;
    }

    try {
      const fileSize = fs.statSync(filePath).size;
      console.log(
        `Uploading video to YouTube: ${title} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
      );

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
            embeddable: true, // Ensure video can be embedded
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
      });

      const videoId = response.data.id;
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

      console.log(`✅ Video uploaded to YouTube successfully: ${youtubeUrl}`);
      console.log(`   Video ID: ${videoId}`);

      // Delete local file after successful upload
      try {
        fs.unlinkSync(filePath);
        console.log(`   Local file deleted: ${path.basename(filePath)}`);
      } catch (deleteError) {
        console.warn(
          `   Warning: Could not delete local file: ${deleteError.message}`,
        );
      }

      return youtubeUrl;
    } catch (error) {
      console.error("❌ YouTube upload failed:", error.message);
      if (error.code === 401 || error.code === 403) {
        console.error("   Authentication error. Please re-authorize the app.");
        console.error("   Run: node setup-youtube.js");
      }
      console.error(
        "   Falling back to local storage (video won't be visible in UI)",
      );
      // Return local path as fallback
      return `/uploads/videos/${path.basename(filePath)}`;
    }
  }

  /**
   * Generate OAuth URL for authorization
   * This is needed only once to get the refresh token
   */
  getAuthUrl() {
    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ];

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

  /**
   * Create a YouTube Live broadcast
   * @param {Object} broadcastData - Broadcast configuration
   * @returns {Promise<Object>} Broadcast and stream details
   */
  async createLiveBroadcast(broadcastData) {
    if (!this.initialized) {
      throw new Error("YouTube API not initialized");
    }

    const {
      title,
      description,
      scheduledStartTime,
      scheduledEndTime,
      privacyStatus = "unlisted", // unlisted, private, or public
      enableChat = true,
      enableDvr = true,
      enableAutoStart = true,
      enableAutoStop = true,
    } = broadcastData;

    try {
      // Create the broadcast
      const broadcastResponse = await this.youtube.liveBroadcasts.insert({
        part: ["snippet", "contentDetails", "status"],
        requestBody: {
          snippet: {
            title,
            description,
            scheduledStartTime: new Date(scheduledStartTime).toISOString(),
            scheduledEndTime: new Date(scheduledEndTime).toISOString(),
          },
          contentDetails: {
            enableDvr,
            enableAutoStart,
            enableAutoStop,
            enableClosedCaptions: false,
            recordFromStart: true,
            startWithSlate: false,
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
      });

      const broadcast = broadcastResponse.data;

      // Create the live stream
      const streamResponse = await this.youtube.liveStreams.insert({
        part: ["snippet", "cdn", "contentDetails", "status"],
        requestBody: {
          snippet: {
            title: `Stream for: ${title}`,
          },
          cdn: {
            frameRate: "variable",
            ingestionType: "rtmp",
            resolution: "variable",
          },
          contentDetails: {
            isReusable: false,
          },
        },
      });

      const stream = streamResponse.data;

      // Bind broadcast to stream
      await this.youtube.liveBroadcasts.bind({
        part: ["id", "contentDetails"],
        id: broadcast.id,
        streamId: stream.id,
      });

      return {
        broadcastId: broadcast.id,
        videoId: broadcast.id, // YouTube uses broadcast ID as video ID for live
        streamId: stream.id,
        streamKey: stream.cdn.ingestionInfo.streamName,
        streamUrl: stream.cdn.ingestionInfo.ingestionAddress,
        watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${broadcast.id}`,
        chatUrl: `https://www.youtube.com/live_chat?v=${broadcast.id}`,
        status: broadcast.status.lifeCycleStatus,
        privacyStatus: broadcast.status.privacyStatus,
      };
    } catch (error) {
      console.error("Failed to create YouTube Live broadcast:", error.message);
      throw error;
    }
  }

  /**
   * Start a YouTube Live broadcast
   * @param {string} broadcastId - Broadcast ID
   */
  async startBroadcast(broadcastId) {
    if (!this.initialized) {
      throw new Error("YouTube API not initialized");
    }

    try {
      const response = await this.youtube.liveBroadcasts.transition({
        broadcastStatus: "live",
        id: broadcastId,
        part: ["status"],
      });

      return response.data;
    } catch (error) {
      console.error("Failed to start broadcast:", error.message);
      throw error;
    }
  }

  /**
   * End a YouTube Live broadcast
   * @param {string} broadcastId - Broadcast ID
   */
  async endBroadcast(broadcastId) {
    if (!this.initialized) {
      throw new Error("YouTube API not initialized");
    }

    try {
      const response = await this.youtube.liveBroadcasts.transition({
        broadcastStatus: "complete",
        id: broadcastId,
        part: ["status"],
      });

      return response.data;
    } catch (error) {
      console.error("Failed to end broadcast:", error.message);
      throw error;
    }
  }

  /**
   * Get broadcast status
   * @param {string} broadcastId - Broadcast ID
   */
  async getBroadcastStatus(broadcastId) {
    if (!this.initialized) {
      throw new Error("YouTube API not initialized");
    }

    try {
      const response = await this.youtube.liveBroadcasts.list({
        part: ["status", "snippet"],
        id: broadcastId,
      });

      if (response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }

      return null;
    } catch (error) {
      console.error("Failed to get broadcast status:", error.message);
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
