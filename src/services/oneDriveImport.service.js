const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");

const importsDir = path.join(__dirname, "../../uploads/onedrive-imports");
const maxImportBytes = Number(process.env.ONEDRIVE_IMPORT_MAX_BYTES) || 5 * 1024 * 1024 * 1024;

if (!fs.existsSync(importsDir)) fs.mkdirSync(importsDir, { recursive: true });

const importError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isOneDriveHost = (hostname) => {
  const host = hostname.toLowerCase();
  return (
    host === "1drv.ms" ||
    host === "onedrive.live.com" ||
    host.endsWith(".sharepoint.com") ||
    host.endsWith(".onedrive.com")
  );
};

const normalizeOneDriveUrl = (value) => {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid public OneDrive sharing link.");
  }

  if (url.protocol !== "https:" || !isOneDriveHost(url.hostname)) {
    throw importError("Only public OneDrive or SharePoint sharing links are supported.");
  }

  // A Stream player URL is a web page which uses the tutor's Microsoft browser
  // session. It is not a file-sharing URL, so a server cannot download it.
  if (
    url.hostname.toLowerCase().endsWith(".sharepoint.com") &&
    url.pathname.toLowerCase().includes("/_layouts/15/stream.aspx")
  ) {
    throw importError(
      "This is a SharePoint Stream player link, not a downloadable file link. In OneDrive or SharePoint, select the MP4, choose Share > Copy link, set it to 'Anyone with the link' (with download allowed), then paste that new sharing link.",
    );
  }

  // OneDrive honours this for standard share links. Short 1drv.ms links are
  // deliberately left intact so Microsoft can resolve them before download.
  if (url.hostname.toLowerCase() !== "1drv.ms") url.searchParams.set("download", "1");
  return url.toString();
};

const filenameFromHeaders = (headers) => {
  const disposition = headers["content-disposition"] || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const candidate = utf8Match ? decodeURIComponent(utf8Match[1]) : plainMatch?.[1];
  return candidate ? path.basename(candidate).replace(/[^a-zA-Z0-9._-]/g, "_") : "onedrive-video.mp4";
};

const downloadPublicOneDriveVideo = async (sharingUrl) => {
  let response;
  try {
    response = await axios.get(normalizeOneDriveUrl(sharingUrl), {
      responseType: "stream",
      maxRedirects: 5,
      timeout: 30_000,
      maxContentLength: maxImportBytes,
      maxBodyLength: maxImportBytes,
      headers: { "User-Agent": "UniHub course importer" },
      validateStatus: (status) => status >= 200 && status < 300,
    });
  } catch (error) {
    if (error.statusCode) throw error;
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      throw importError("OneDrive denied access to this file. Use a sharing link that allows anyone with the link to view and download the video.");
    }
    if (status === 404) {
      throw importError("The OneDrive video could not be found. Check that the sharing link is complete and has not expired.");
    }
    if (error.code === "ECONNABORTED") {
      throw importError("The OneDrive download timed out. Try again, or use a smaller video file.", 504);
    }
    throw importError("UniHub could not download this OneDrive file. Check that it is a public, downloadable video sharing link.", 502);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    response.data.destroy();
    throw importError("This OneDrive link opened a web page instead of the video file. Use Share > Copy link for the MP4 and allow downloads.");
  }

  const contentLength = Number(response.headers["content-length"] || 0);
  if (contentLength > maxImportBytes) {
    response.data.destroy();
    throw importError("The OneDrive video exceeds the import size limit.");
  }

  const originalName = filenameFromHeaders(response.headers);
  const extension = path.extname(originalName) || ".mp4";
  const filePath = path.join(importsDir, `onedrive-${Date.now()}-${crypto.randomUUID()}${extension}`);
  let downloadedBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxImportBytes) {
        callback(importError("The OneDrive video exceeds the import size limit."));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(response.data, sizeGuard, fs.createWriteStream(filePath));
    return { filePath, originalName, contentType };
  } catch (error) {
    try { fs.unlinkSync(filePath); } catch {}
    throw error;
  }
};

const shareIdFromUrl = (value) => {
  const url = new URL(String(value || "").trim());
  if (!isOneDriveHost(url.hostname)) throw importError("Only OneDrive or SharePoint links are supported.");
  // Stream player links carry the actual SharePoint file path in `id`.
  // Turn that into the canonical file URL before asking Graph for the item.
  if (url.pathname.toLowerCase().includes("/_layouts/15/stream.aspx")) {
    const filePath = url.searchParams.get("id");
    if (!filePath?.startsWith("/")) throw importError("This Stream link does not contain a file path.");
    url.pathname = filePath;
    url.search = "";
  }
  return `u!${Buffer.from(url.toString()).toString("base64url")}`;
};

const downloadMicrosoftDriveVideo = async (sharingUrl, accessToken) => {
  let response;
  try {
    const shareId = shareIdFromUrl(sharingUrl);
    const graphResponse = await axios.get(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`, {
      responseType: "stream",
      maxRedirects: 0,
      timeout: 30_000,
      maxContentLength: maxImportBytes,
      maxBodyLength: maxImportBytes,
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "UniHub course importer" },
      validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
    });
    if (graphResponse.status >= 300 && graphResponse.status < 400) {
      graphResponse.data.destroy();
      const downloadUrl = graphResponse.headers.location;
      const host = new URL(downloadUrl).hostname.toLowerCase();
      if (!downloadUrl?.startsWith("https://") || (!host.endsWith(".1drv.com") && !host.endsWith(".sharepoint.com") && !host.endsWith(".onedrive.com"))) {
        throw importError("Microsoft returned an unsafe download address.", 502);
      }
      // The short-lived address is pre-authorized; never forward the Microsoft
      // bearer token to a different host.
      response = await axios.get(downloadUrl, {
        responseType: "stream", maxRedirects: 3, timeout: 30_000,
        maxContentLength: maxImportBytes, maxBodyLength: maxImportBytes,
        headers: { "User-Agent": "UniHub course importer" },
        validateStatus: (status) => status >= 200 && status < 300,
      });
    } else {
      response = graphResponse;
    }
  } catch (error) {
    if (error.statusCode) throw error;
    const status = error.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      throw importError("The connected Microsoft account cannot access this file. Sign in with the SLIIT account that can open the recording.");
    }
    throw importError("Microsoft Graph could not download this file. Reconnect the Microsoft account and try again.", 502);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    response.data.destroy();
    throw importError("Microsoft returned a web page instead of the video file. Check that the account can download this recording.");
  }
  const originalName = filenameFromHeaders(response.headers);
  const extension = path.extname(originalName) || ".mp4";
  const filePath = path.join(importsDir, `microsoft-${Date.now()}-${crypto.randomUUID()}${extension}`);
  let downloadedBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxImportBytes) return callback(importError("The OneDrive video exceeds the import size limit."));
      callback(null, chunk);
    },
  });
  try {
    await pipeline(response.data, sizeGuard, fs.createWriteStream(filePath));
    return { filePath, originalName, contentType };
  } catch (error) {
    try { fs.unlinkSync(filePath); } catch {}
    throw error;
  }
};

/**
 * Download a recording already owned by UniHub's Teams organizer.  Unlike a
 * user-supplied share link, this uses the organizer drive item saved when the
 * recording was synced, so tutors never need access to the organizer account.
 */
const downloadMicrosoftDriveItem = async (organizer, itemId, accessToken) => {
  let response;
  try {
    const graphResponse = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(organizer)}/drive/items/${encodeURIComponent(itemId)}/content`,
      {
        responseType: "stream",
        maxRedirects: 0,
        timeout: 30_000,
        maxContentLength: maxImportBytes,
        maxBodyLength: maxImportBytes,
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "UniHub recording importer" },
        validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
      },
    );
    if (graphResponse.status >= 300 && graphResponse.status < 400) {
      graphResponse.data?.destroy?.();
      const downloadUrl = graphResponse.headers.location;
      const host = new URL(downloadUrl).hostname.toLowerCase();
      if (!downloadUrl?.startsWith("https://") || (!host.endsWith(".1drv.com") && !host.endsWith(".sharepoint.com") && !host.endsWith(".onedrive.com"))) {
        throw importError("Microsoft returned an unsafe recording download address.", 502);
      }
      response = await axios.get(downloadUrl, {
        responseType: "stream", maxRedirects: 3, timeout: 30_000,
        maxContentLength: maxImportBytes, maxBodyLength: maxImportBytes,
        headers: { "User-Agent": "UniHub recording importer" },
        validateStatus: (status) => status >= 200 && status < 300,
      });
    } else {
      response = graphResponse;
    }
  } catch (error) {
    if (error.statusCode) throw error;
    const status = error.response?.status;
    if (status === 401 || status === 403 || status === 404) {
      throw importError("The Teams organizer cannot access this recording. Sync the session artifacts again and retry.", 409);
    }
    throw importError("UniHub could not download the Teams recording. Please retry in a few minutes.", 502);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    response.data.destroy();
    throw importError("Microsoft returned a web page instead of the recording file.");
  }
  const originalName = filenameFromHeaders(response.headers);
  const extension = path.extname(originalName) || ".mp4";
  const filePath = path.join(importsDir, `teams-recording-${Date.now()}-${crypto.randomUUID()}${extension}`);
  let downloadedBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxImportBytes) return callback(importError("The recording exceeds the import size limit."));
      callback(null, chunk);
    },
  });
  try {
    await pipeline(response.data, sizeGuard, fs.createWriteStream(filePath));
    return { filePath, originalName, contentType };
  } catch (error) {
    try { fs.unlinkSync(filePath); } catch {}
    throw error;
  }
};

module.exports = { downloadPublicOneDriveVideo, downloadMicrosoftDriveVideo, downloadMicrosoftDriveItem };
