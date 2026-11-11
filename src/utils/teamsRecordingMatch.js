// Teams names a meeting recording after the meeting subject, which UniHub sets
// to "[UniHub #<sessionId>] <title>". OneDrive does not keep "#" in file names,
// so the saved file is "[UniHub _<sessionId>] <title>-<timestamp>-Meeting
// Recording.mp4". Match either form, and require the closing bracket right after
// the id so session 28 can never pick up the recording for session 280.

function recordingNamePattern(sessionId) {
  const id = String(Number(sessionId));
  return new RegExp(`^\\s*\\[\\s*UniHub\\s*[#_\\s]\\s*${id}\\s*\\]`, "i");
}

function isVideoItem(item) {
  if (!item || item.folder || item.deleted) return false;
  const mime = item.file?.mimeType || "";
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|m4v|mov|webm)$/i.test(item.name || "");
}

// Choose the recording for this session from any mix of drive items. When a
// session was recorded more than once (the tutor rejoined), the newest file
// wins. Returns null when nothing matches; never falls back to an unrelated file.
function pickSessionRecording(items, sessionId) {
  const pattern = recordingNamePattern(sessionId);
  const seen = new Set();
  const matches = [];
  for (const item of items || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    if (isVideoItem(item) && pattern.test(item.name || "")) matches.push(item);
  }
  matches.sort((a, b) => Date.parse(b.createdDateTime || 0) - Date.parse(a.createdDateTime || 0));
  return matches[0] || null;
}

module.exports = { recordingNamePattern, isVideoItem, pickSessionRecording };
