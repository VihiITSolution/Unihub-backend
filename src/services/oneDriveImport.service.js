const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");

const importsDir = path.join(__dirname, "../../uploads/onedrive-imports");
const maxImportBytes = Number(process.env.ONEDRIVE_IMPORT_MAX_BYTES) || 5 * 1024 * 1024 * 1024;

if (!fs.existsSync(importsDir)) fs.mkdirSync(importsDir, { recursive: true });

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
    throw new Error("Only public OneDrive or SharePoint sharing links are supported.");
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
  const response = await axios.get(normalizeOneDriveUrl(sharingUrl), {
    responseType: "stream",
    maxRedirects: 5,
    timeout: 30_000,
    maxContentLength: maxImportBytes,
    maxBodyLength: maxImportBytes,
    headers: { "User-Agent": "UniHub course importer" },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    response.data.destroy();
    throw new Error("This OneDrive link did not return a downloadable file. Ask the tutor to share it with download access.");
  }

  const contentLength = Number(response.headers["content-length"] || 0);
  if (contentLength > maxImportBytes) {
    response.data.destroy();
    throw new Error("The OneDrive video exceeds the import size limit.");
  }

  const originalName = filenameFromHeaders(response.headers);
  const extension = path.extname(originalName) || ".mp4";
  const filePath = path.join(importsDir, `onedrive-${Date.now()}-${crypto.randomUUID()}${extension}`);
  let downloadedBytes = 0;
  const sizeGuard = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxImportBytes) {
        callback(new Error("The OneDrive video exceeds the import size limit."));
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

module.exports = { downloadPublicOneDriveVideo };
