// Detects attempts to share contact info / move a conversation off-platform.
// Intentionally biased toward over-blocking: rejection is inline and
// immediately editable by the sender, so a false positive costs little,
// while a false negative defeats the whole point of the feature.
// Known limitation: this only scans message text. Contact info embedded as
// pixels/text inside an image or PDF attachment is not detected (OCR-based
// scanning is out of scope).

const DIGIT_WORDS = {
  zero: "0",
  oh: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

const OFFPLATFORM_KEYWORDS = [
  "whatsapp",
  "wa.me",
  "telegram",
  "t.me",
  "viber",
  "imo",
  "signal",
  "line id",
  "wechat",
];

const SOCIAL_CONTEXT_KEYWORDS = [
  "insta",
  "instagram",
  "ig ",
  "snap",
  "snapchat",
  "tiktok",
  "follow me",
  "fb.com",
  "facebook.com",
];

const PHONE_REGEX = /(?:\+?\d[\s.\-]?){7,}\d/;
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const SOCIAL_HANDLE_REGEX = /@[a-z0-9_.]{3,}/i;

// Collapses runs of 4+ spelled-out digit words ("oh seven one two three
// four five six seven") into a plain digit string so the phone regex
// can catch this obfuscation.
function normalizeSpelledDigits(text) {
  const words = Object.keys(DIGIT_WORDS).join("|");
  const runPattern = new RegExp(`\\b(?:(?:${words})\\s+){3,}(?:${words})\\b`, "gi");
  return text.replace(runPattern, (match) =>
    match
      .trim()
      .split(/\s+/)
      .map((w) => DIGIT_WORDS[w.toLowerCase()])
      .join(""),
  );
}

// Rewrites common email obfuscations ("name at gmail dot com", "name[at]gmail[dot]com")
// back into a standard email shape before running the email regex.
function normalizeEmailObfuscation(text) {
  return text
    .replace(/\s*\(\s*at\s*\)\s*|\s*\[\s*at\s*\]\s*|\s+at\s+/gi, "@")
    .replace(/\s*\(\s*dot\s*\)\s*|\s*\[\s*dot\s*\]\s*|\s+dot\s+/gi, ".");
}

/**
 * Scans message text for phone numbers, email addresses, off-platform
 * messaging app references, and social-handle sharing.
 * @param {string} text
 * @returns {{ blocked: boolean, reasons: string[] }}
 */
function checkMessageContent(text) {
  if (!text || typeof text !== "string") {
    return { blocked: false, reasons: [] };
  }

  const reasons = [];
  const lower = text.toLowerCase();

  const digitNormalized = normalizeSpelledDigits(lower);
  if (PHONE_REGEX.test(digitNormalized)) {
    reasons.push("phone_number");
  }

  const emailNormalized = normalizeEmailObfuscation(lower);
  if (EMAIL_REGEX.test(emailNormalized)) {
    reasons.push("email_address");
  }

  if (OFFPLATFORM_KEYWORDS.some((kw) => lower.includes(kw))) {
    reasons.push("offplatform_app");
  }

  if (
    SOCIAL_HANDLE_REGEX.test(lower) &&
    SOCIAL_CONTEXT_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    reasons.push("social_handle");
  }

  return { blocked: reasons.length > 0, reasons };
}

module.exports = { checkMessageContent };
