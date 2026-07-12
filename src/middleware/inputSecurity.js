/**
 * Defense-in-depth guard against script-injection (XSS) and classic SQL
 * injection payloads in request bodies/query/params. Sequelize already
 * parameter-binds query values (see model calls throughout controllers/),
 * so this isn't closing a real SQLi hole - it rejects obviously malicious
 * payloads up front so they're never persisted or reflected at all.
 */

const XSS_PATTERN =
  /<script[\s\S]*?>|<\/script\s*>|<iframe[\s\S]*?>|javascript:|on(load|error|click|mouseover|focus|submit)\s*=|<img[^>]+onerror|<svg[\s\S]*?on\w+\s*=/i;

// Deliberately does NOT flag a bare "--" (common as an em-dash substitute
// in normal prose/descriptions) - only a comment marker directly preceded
// by a quote (classic `'--` / `';--` injection terminator), or paired with
// a tautology/keyword, counts as suspicious.
const SQLI_PATTERN =
  /(\bunion\b\s+\bselect\b)|(\bdrop\b\s+\btable\b)|(\bdelete\b\s+\bfrom\b)|(\binsert\b\s+\binto\b)|(;\s*--)|('\s*--)|(\/\*[\s\S]*?\*\/)|('\s*(or|and)\s*'?\s*\d+\s*=\s*\d+)|(\b(or|and)\b\s+\d+\s*=\s*\d+)/i;

const scanValue = (value) => {
  if (typeof value !== "string") return null;
  if (XSS_PATTERN.test(value)) return "xss";
  if (SQLI_PATTERN.test(value)) return "sql";
  return null;
};

const scanDeep = (input) => {
  if (input == null) return null;
  if (typeof input === "string") return scanValue(input);
  if (typeof input !== "object") return null;

  for (const key of Object.keys(input)) {
    const hit = scanDeep(input[key]);
    if (hit) return hit;
  }
  return null;
};

const blockMaliciousInput = (req, res, next) => {
  const hit = scanDeep(req.body) || scanDeep(req.query) || scanDeep(req.params);

  if (hit) {
    return res.status(400).json({
      success: false,
      message:
        hit === "xss"
          ? "Invalid input: script content is not allowed."
          : "Invalid input: potentially malicious input detected.",
    });
  }

  next();
};

module.exports = { blockMaliciousInput };
