const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSriLankanMobile, smsgoRecipient } = require("../src/utils/phone");

test("normalizes supported Sri Lankan mobile formats to E.164", () => {
  assert.equal(normalizeSriLankanMobile("077 123 4567"), "+94771234567");
  assert.equal(normalizeSriLankanMobile("94771234567"), "+94771234567");
  assert.equal(normalizeSriLankanMobile("+94 77-123-4567"), "+94771234567");
  assert.equal(smsgoRecipient("+94771234567"), "94771234567");
});

test("rejects non-Sri-Lankan and malformed numbers", () => {
  assert.equal(normalizeSriLankanMobile("+1 202 555 0123"), null);
  assert.equal(normalizeSriLankanMobile("071234567"), null);
  assert.equal(normalizeSriLankanMobile("not a phone"), null);
});
