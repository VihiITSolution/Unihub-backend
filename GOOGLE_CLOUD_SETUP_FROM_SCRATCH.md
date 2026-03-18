# Google Cloud Console Setup From Scratch for UniHub

This guide explains how to configure Google Cloud for UniHub from zero and move OAuth to Production using your live domain:

- https://unihub.lk

It is focused on the current backend YouTube integration.

## 1. Create or Select a Google Cloud Project

1. Open Google Cloud Console:
   - https://console.cloud.google.com/
2. Create a new project (or select an existing one).
3. Suggested project name:
   - UniHub LMS

## 2. Configure OAuth Consent Screen (Required Before Credentials)

1. Go to:
   - APIs & Services > OAuth consent screen
2. Choose user type:
   - External
3. Fill app information:
   - App name: UniHub
   - User support email: your support email
   - Developer contact email: your email
4. Add app domain links:
   - Homepage: https://unihub.lk
   - Privacy policy: https://unihub.lk/privacy ✅ (created)
   - Terms of service: https://unihub.lk/terms ✅ (created)
5. Add Authorized domains:
   - unihub.lk
   - www.unihub.lk (if used)
   - api.unihub.lk (if your backend callback uses this subdomain)
6. Save and continue.

**Note:** The Privacy Policy and Terms of Service pages have been created and are now:
- Linked from the homepage footer
- Accessible at `/privacy` and `/terms` routes
- Discoverable by Google's verification crawler

## 3. Enable Required Google API Services

Go to APIs & Services > Library and enable:

1. YouTube Data API v3

That is the required API for the current UniHub video upload implementation.

## 4. Create OAuth 2.0 Client ID

1. Go to:
   - APIs & Services > Credentials
2. Click:
   - Create Credentials > OAuth client ID
3. Application type:
   - Web application
4. Name:
   - UniHub Web Client
5. Add Authorized JavaScript origins:
   - https://unihub.lk
   - https://www.unihub.lk (if used)
   - http://localhost:3000 (optional for local frontend)
6. Add Authorized redirect URIs:
   - Production (pick the one you use):
     - https://unihub.lk/api/youtube/oauth2callback
     - OR https://api.unihub.lk/api/youtube/oauth2callback
   - Development:
     - http://localhost:5000/api/youtube/oauth2callback
7. Save.

## 5. Download and Place Credentials

1. Download the OAuth client JSON.
2. Place it at:
   - src/config/youtube-credentials.json
3. Ensure the JSON has:
   - client_id
   - client_secret
   - redirect_uris

## 6. Publish OAuth App to Production

1. Return to:
   - APIs & Services > OAuth consent screen
2. Confirm app details and scopes are complete.
3. Click:
   - Publish App
4. Publishing status should become:
   - In production

Why this matters:
- In Testing mode, refresh tokens can expire quickly (often 7 days).
- In Production mode, refresh tokens are long-lived unless revoked or unused for long periods.

## 7. Authorize UniHub and Generate Refresh Token

From backend project root:

```bash
node authorize-youtube.js
```

Then:
1. Open the generated Google authorization URL.
2. Sign in with the YouTube channel owner account.
3. Approve requested scopes.
4. Verify file is created:
   - src/config/youtube-token.json

## 8. Validate Redirect URI and Token Creation

Before authorizing, confirm:

1. Backend is running and reachable at your configured callback URL.
2. The callback route exists:
   - /api/youtube/oauth2callback
3. The exact same redirect URI is present in Google Console OAuth client settings.

Important:
- Redirect URI must match exactly (scheme, domain, path, and port).
- If your auth URL shows localhost:3000 redirect but backend runs on port 5000, token file will not be created.

## 9. Minimum Production Checklist

- OAuth consent screen is published.
- Authorized domains include unihub.lk.
- Redirect URI includes your live callback URL.
- YouTube Data API v3 is enabled.
- src/config/youtube-credentials.json exists on server.
- src/config/youtube-token.json is generated after authorization.
- Server process has read/write access to src/config/.

## 10. Common Problems and Fixes

### Problem: youtube-token.json not created

Checks:
1. Backend server is running during OAuth flow.
2. Redirect URI in Google Console matches backend callback exactly.
3. Callback route is accessible from browser.
4. OAuth credentials file is from the correct Google project/client.

### Problem: redirect URI mismatch error

Fix:
1. Copy the exact redirect URI from your app.
2. Add the same URI to OAuth client settings in Google Console.
3. Save and retry after a short wait.

### Problem: refresh token expires in 7 days

Fix:
1. Consent screen still in Testing mode.
2. Publish the app to Production.
3. Re-authorize to get a new refresh token.

## 11. Security Notes

1. Never commit youtube-credentials.json or youtube-token.json to git.
2. Restrict server file permissions for config directory.
3. Use HTTPS in production callback URLs.
4. Rotate credentials if leaked.

## 12. Suggested .gitignore Entries

Add these if not already present:

```gitignore
src/config/youtube-credentials.json
src/config/youtube-token.json
src/config/youtube-token.txt
```

---

If you want, this guide can be extended with a deployment section for your exact hosting stack (for example, PM2, Docker, or cPanel Node app) so the token and credentials persist safely across restarts/deployments.
