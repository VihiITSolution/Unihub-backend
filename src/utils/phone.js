const SRI_LANKAN_MOBILE = /^(?:\+94|94|0)7\d{8}$/;

function normalizeSriLankanMobile(value) {
  const compact = String(value || "").trim().replace(/[\s\-()]/g, "");
  if (!SRI_LANKAN_MOBILE.test(compact)) return null;
  const local = compact.startsWith("0") ? compact.slice(1) : compact.replace(/^\+?94/, "");
  return `+94${local}`;
}

function smsgoRecipient(e164Number) {
  return e164Number.replace(/^\+/, "");
}

module.exports = { normalizeSriLankanMobile, smsgoRecipient };
