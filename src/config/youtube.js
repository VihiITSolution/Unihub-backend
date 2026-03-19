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
    this.allowLocalFallback = process.env.YOUTUBE_ALLOW_LOCAL_FALLBACK === "true";
  }

  /**
   * Ensure OAuth2 client is initialized from env or credentials file.
   * This is used by auth URL generation and callback exchange paths.
   */
  ensureOAuthClient() {
    if (this.oauth2Client) {
      return true;
    }

    // 1) Prefer env-based secrets for production deployments.
    let client_id = process.env.YOUTUBE_CLIENT_ID;
    let client_secret = process.env.YOUTUBE_CLIENT_SECRET;
    let redirect_uris = [];

    const preferredEnvRedirectUri =
      process.env.NODE_ENV === "production"
        ? process.env.YOUTUBE_REDIRECT_URI
        : process.env.YOUTUBE_REDIRECT_URI_LOCAL ||
          process.env.YOUTUBE_REDIRECT_URI;

    if (preferredEnvRedirectUri) {
      redirect_uris.push(preferredEnvRedirectUri);
    }

    // 2) Fallback to credentials file if any env values are missing.
    if (!client_id || !client_secret || redirect_uris.length === 0) {
      const credentialsPath = path.join(__dirname, "youtube-credentials.json");

      if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
        const jsonConfig = credentials.installed || credentials.web || {};

        client_id = client_id || jsonConfig.client_id;
        client_secret = client_secret || jsonConfig.client_secret;
        if (redirect_uris.length === 0 && Array.isArray(jsonConfig.redirect_uris)) {
          redirect_uris = jsonConfig.redirect_uris;
        }
      }
    }

    if (!client_id || !client_secret) {
      throw new Error(
        "Missing YouTube OAuth client_id or client_secret. Set YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET or provide youtube-credentials.json.",
      );
    }

    const redirectUri =
      (redirect_uris && redirect_uris[0]) ||
      process.env.YOUTUBE_REDIRECT_URI_LOCAL ||
      "http://unihub-backend:3000/api/youtube/oauth2callback";

    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri,
    );

    return true;
  }

  /**
   * Initialize YouTube API with OAuth2
   */
  async initialize() {
    try {
      const tokenPath = path.join(__dirname, "youtube-token.json");
      let token = null;

      try {
        this.ensureOAuthClient();
      } catch (clientError) {
        console.warn(
          "YouTube credentials not found/invalid. Video uploads will be stored locally.",
        );
        console.warn(clientError.message);
        this.initialized = false;
        return false;
      }

      // Prefer refresh token from environment in production/container deployments.
      if (process.env.YOUTUBE_REFRESH_TOKEN) {
        token = {
          refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
        };

        if (process.env.YOUTUBE_TOKEN_EXPIRY_DATE) {
          token.expiry_date = Number(process.env.YOUTUBE_TOKEN_EXPIRY_DATE);
        }

        if (process.env.YOUTUBE_TOKEN_SCOPE) {
          token.scope = process.env.YOUTUBE_TOKEN_SCOPE;
        }

        if (process.env.YOUTUBE_TOKEN_TYPE) {
          token.token_type = process.env.YOUTUBE_TOKEN_TYPE;
        }
      } else if (fs.existsSync(tokenPath)) {
        token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      }

      // Check if token exists
      if (token) {
        this.oauth2Client.setCredentials(token);

        // Set up automatic token refresh
        this.oauth2Client.on("tokens", (tokens) => {
          if (tokens.refresh_token) {
            // Store the refresh token
            console.log("Received new refresh token");
          }
          if (tokens.access_token) {
            console.log("Access token refreshed");
            // Update the token file when available for local/dev setups.
            const updatedToken = {
              ...token,
              access_token: tokens.access_token,
              expiry_date: tokens.expiry_date,
            };
            if (fs.existsSync(tokenPath)) {
              fs.writeFileSync(tokenPath, JSON.stringify(updatedToken, null, 2));
            }
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
          "YouTube token not found. Set YOUTUBE_REFRESH_TOKEN or complete OAuth flow first.",
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
      // Try to recover from a stale startup state (e.g., env/token became available after boot).
      await this.initialize();
    }

    if (!this.initialized) {
      const notReadyMessage =
        "YouTube API not initialized. Check credentials/token and complete OAuth authorization.";

      if (this.allowLocalFallback) {
        console.warn("⚠️  YouTube API not configured, storing video locally");
        console.warn("Videos stored locally won't be visible in the UI.");
        console.warn(notReadyMessage);
        return `/uploads/videos/${path.basename(filePath)}`;
      }

      throw new Error(notReadyMessage);
    }

    try {
      const fileSize = fs.statSync(filePath).size;
      console.log(
        `Uploading video to YouTube: ${title} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
      );

      // Always refresh access token from refresh token before upload to avoid stale/invalid credentials.
      if (this.oauth2Client?.credentials?.refresh_token) {
        this.oauth2Client.setCredentials({
          refresh_token: this.oauth2Client.credentials.refresh_token,
        });
        await this.oauth2Client.getAccessToken();
      }

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
      const apiError = error?.response?.data?.error;
      const detailedMessage =
        apiError?.message ||
        apiError?.errors?.[0]?.message ||
        error.message ||
        "Unknown YouTube upload error";

      console.error("❌ YouTube upload failed:", detailedMessage);

      const authFailed =
        error.code === 401 ||
        error.code === 403 ||
        detailedMessage.toLowerCase().includes("invalid_grant") ||
        detailedMessage.toLowerCase().includes("auth") ||
        detailedMessage.toLowerCase().includes("invalid authentication credentials");

      // Retry once after forcing token refresh for recoverable auth failures.
      if (authFailed && this.oauth2Client?.credentials?.refresh_token) {
        try {
          this.oauth2Client.setCredentials({
            refresh_token: this.oauth2Client.credentials.refresh_token,
          });
          await this.oauth2Client.getAccessToken();

          const retryResponse = await this.youtube.videos.insert({
            part: ["snippet", "status"],
            requestBody: {
              snippet: {
                title: title,
                description: description,
                categoryId: "27",
              },
              status: {
                privacyStatus: "unlisted",
                embeddable: true,
              },
            },
            media: {
              body: fs.createReadStream(filePath),
            },
          });

          const retryVideoId = retryResponse.data.id;
          const retryYoutubeUrl = `https://www.youtube.com/watch?v=${retryVideoId}`;
          console.log(`✅ Video uploaded to YouTube successfully after token refresh: ${retryYoutubeUrl}`);

          try {
            fs.unlinkSync(filePath);
          } catch (deleteError) {
            console.warn(`Warning: Could not delete local file: ${deleteError.message}`);
          }

          return retryYoutubeUrl;
        } catch (retryError) {
          const retryMessage =
            retryError?.response?.data?.error?.message || retryError.message || detailedMessage;
          console.error("Retry after token refresh failed:", retryMessage);
        }
      }

      if (authFailed) {
        console.error("   Authentication error. Please re-authorize the app.");
        console.error("   Run: node setup-youtube.js");
      }

      if (this.allowLocalFallback) {
        console.error(
          "   Falling back to local storage (video won't be visible in UI)",
        );
        return `/uploads/videos/${path.basename(filePath)}`;
      }

      throw new Error(`YouTube upload failed: ${detailedMessage}`);
    }
  }

  /**
   * Generate OAuth URL for authorization
   * This is needed only once to get the refresh token
   */
  getAuthUrl() {
    this.ensureOAuthClient();

    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ];

    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      include_granted_scopes: true,
    });

    return url;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth flow
   */
  async getTokenFromCode(code) {
    try {
      this.ensureOAuthClient();

      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Save tokens for future use
      const tokenPath = path.join(__dirname, "youtube-token.json");
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

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
