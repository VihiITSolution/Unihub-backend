// YouTube Data API quota accounting.
//
// The default quota is 10,000 units per day and videos.insert costs 1,600, so
// a project gets roughly six uploads a day. The quota resets at midnight
// Pacific, not UTC, and the boundary moves with US daylight saving.

const QUOTA_TIMEZONE = process.env.YOUTUBE_QUOTA_TIMEZONE || "America/Los_Angeles";

// Reasons YouTube returns when the project is out of quota, or the channel is
// over its own upload ceiling. These are all "come back later", unlike an auth
// failure, which no amount of waiting fixes.
const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
  "uploadLimitExceeded",
]);

function zoneParts(instant, timeZone = QUOTA_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
    .formatToParts(instant)
    .reduce((acc, part) => (acc[part.type] = part.value, acc), {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl can report hour 24 for midnight depending on the locale.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// The UTC instant at which a wall-clock time occurs in the quota timezone.
// Two correction passes are enough to land on the right side of a DST change.
function zonedWallClockToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }) {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = zoneParts(new Date(guess));
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    guess += target - seenAsUtc;
  }
  return new Date(guess);
}

// Midnight tonight in the quota timezone. Adding 24h to "now" is wrong on a
// DST boundary, where the local day is 23 or 25 hours long.
function nextQuotaResetAt(now = new Date()) {
  const local = zoneParts(now);
  const tomorrow = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return zonedWallClockToUtc({
    year: tomorrow.getUTCFullYear(),
    month: tomorrow.getUTCMonth() + 1,
    day: tomorrow.getUTCDate(),
  });
}

function reasonsOf(error) {
  const apiErrors = error?.response?.data?.error?.errors || error?.errors || [];
  return apiErrors.map((item) => String(item?.reason || "")).filter(Boolean);
}

// Distinguishes the three outcomes that matter. The previous code treated
// every 403 as an auth failure, so a quota rejection burned a token refresh
// and a retry before reporting a credentials problem it never had.
function classifyUploadError(error) {
  const status = error?.code ?? error?.response?.status;
  const reasons = reasonsOf(error);
  const text = String(
    error?.response?.data?.error?.message || error?.message || "",
  ).toLowerCase();

  if (reasons.some((reason) => QUOTA_REASONS.has(reason))) return "quota";
  if (status === 403 && (text.includes("quota") || text.includes("exceeded"))) return "quota";
  if (status === 429) return "quota";

  if (
    status === 401 ||
    text.includes("invalid_grant") ||
    text.includes("invalid authentication credentials")
  ) {
    return "auth";
  }
  if (status === 403) return "auth";

  return "other";
}

// Process-local memory of exhaustion, so a burst of uploads after the quota
// runs out is queued immediately instead of each one spending an API call to
// rediscover the same thing. Lost on restart, which is safe: the next upload
// attempt re-learns it.
let exhaustedUntil = null;

function markQuotaExhausted(now = new Date()) {
  exhaustedUntil = nextQuotaResetAt(now);
  return exhaustedUntil;
}

function quotaAvailableAt() {
  if (exhaustedUntil && exhaustedUntil.getTime() > Date.now()) return exhaustedUntil;
  exhaustedUntil = null;
  return null;
}

function isQuotaExhausted() {
  return quotaAvailableAt() !== null;
}

function resetQuotaState() {
  exhaustedUntil = null;
}

module.exports = {
  QUOTA_TIMEZONE,
  classifyUploadError,
  nextQuotaResetAt,
  markQuotaExhausted,
  quotaAvailableAt,
  isQuotaExhausted,
  resetQuotaState,
};
