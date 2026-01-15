const express = require("express");
const router = express.Router();
const youtubeUploader = require("../config/youtube");

/**
 * Get YouTube authorization URL
 */
router.get("/auth", (req, res) => {
  try {
    const authUrl = youtubeUploader.getAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Failed to generate auth URL:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to generate authorization URL",
      });
  }
});

/**
 * OAuth2 callback handler
 */
router.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not provided");
  }

  try {
    await youtubeUploader.getTokenFromCode(code);
    res.send(`
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              text-align: center;
            }
            .success-icon {
              font-size: 60px;
              color: #10b981;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h1>YouTube Authorization Successful!</h1>
            <p>You can close this window and return to your application.</p>
            <p style="font-size: 12px; color: #999;">Videos will now upload to your YouTube channel.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Failed to exchange code for token:", error);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              text-align: center;
            }
            .error-icon {
              font-size: 60px;
              color: #ef4444;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Authorization Failed</h1>
            <p>Error: ${error.message}</p>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;
