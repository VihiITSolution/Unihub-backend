#!/usr/bin/env node

/**
 * End-to-end YouTube upload demonstration.
 *
 * Submitted to Google as evidence for the YouTube API Services compliance
 * audit. It performs exactly what UniHub does in production and nothing else:
 * a single videos.insert call that publishes one unlisted video to the
 * channel UniHub owns, then reports the resulting video ID and the
 * privacy-enhanced embed URL that is rendered back inside the platform.
 *
 * It intentionally shares no code with the application so that it can be run
 * standalone by a reviewer, but the request body below is identical to the one
 * src/config/youtube.js sends.
 *
 * Usage:
 *   node youtube-upload-demo.js <path-to-video> ["Video title"]
 *
 * Requires the same environment the application uses:
 *   YOUTUBE_CLIENT_ID
 *   YOUTUBE_CLIENT_SECRET
 *   YOUTUBE_REFRESH_TOKEN
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const QUOTA_COST_VIDEOS_INSERT = 1600;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set it in .env or the environment.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const filePath = process.argv[2];
  const title = process.argv[3] || `UniHub compliance audit upload ${new Date().toISOString()}`;

  if (!filePath) {
    console.error("Usage: node youtube-upload-demo.js <path-to-video> [\"Video title\"]");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`No such file: ${filePath}`);
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    requireEnv("YOUTUBE_CLIENT_ID"),
    requireEnv("YOUTUBE_CLIENT_SECRET"),
    process.env.YOUTUBE_REDIRECT_URI || "http://localhost:5000/api/youtube/callback",
  );
  oauth2Client.setCredentials({ refresh_token: requireEnv("YOUTUBE_REFRESH_TOKEN") });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });
  const sizeBytes = fs.statSync(filePath).size;

  console.log("UniHub - YouTube upload demonstration");
  console.log("-------------------------------------");
  console.log(`File          : ${path.basename(filePath)} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Title         : ${title}`);
  console.log(`Scope         : https://www.googleapis.com/auth/youtube.upload`);
  console.log(`Method        : youtube.videos.insert`);
  console.log(`Privacy       : unlisted`);
  console.log(`Quota cost    : ${QUOTA_COST_VIDEOS_INSERT} units`);
  console.log("");
  console.log("Uploading...");

  try {
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description:
            "Uploaded by UniHub (https://unihub.lk) as part of the YouTube API Services compliance audit. " +
            "In production this is a tutor-recorded lesson, embedded back into the course page via youtube-nocookie.com.",
          // 27 = Education
          categoryId: "27",
        },
        status: {
          privacyStatus: "unlisted",
          embeddable: true,
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: fs.createReadStream(filePath) },
    });

    const videoId = response.data.id;
    console.log("");
    console.log("Upload complete.");
    console.log(`Video ID      : ${videoId}`);
    console.log(`Watch URL     : https://www.youtube.com/watch?v=${videoId}`);
    console.log(`Embed URL     : https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0`);
    console.log(`Privacy       : ${response.data.status?.privacyStatus}`);
    console.log("");
    console.log("The embed URL above is what UniHub renders inside the course page.");
    console.log("No other YouTube API method is called at any point in the product.");
  } catch (error) {
    const apiError = error?.response?.data?.error;
    const reason = apiError?.errors?.[0]?.reason;

    console.error("");
    console.error("Upload failed.");
    console.error(`Status        : ${error.code ?? error?.response?.status ?? "unknown"}`);
    console.error(`Reason        : ${reason || "unknown"}`);
    console.error(`Message       : ${apiError?.message || error.message}`);

    if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") {
      console.error("");
      console.error("This is the condition that prompted the quota increase request:");
      console.error("the daily allocation is spent. In production the video is kept on");
      console.error("disk, served locally to enrolled students, and re-attempted");
      console.error("automatically after the quota resets at midnight Pacific.");
    }
    process.exit(1);
  }
}

main();
