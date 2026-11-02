const test = require("node:test");
const assert = require("node:assert");

const quota = require("../src/services/youtubeQuota.service");

const inZone = (date) =>
  date.toLocaleString("en-CA", { timeZone: quota.QUOTA_TIMEZONE, hour12: false });

test("a quota rejection is told apart from an auth failure", () => {
  const quotaError = Object.assign(new Error("The request cannot be completed because you have exceeded your quota."), {
    code: 403,
    response: { status: 403, data: { error: { errors: [{ reason: "quotaExceeded" }] } } },
  });
  assert.strictEqual(quota.classifyUploadError(quotaError), "quota");

  const uploadLimit = Object.assign(new Error("upload limit"), {
    code: 400,
    response: { status: 400, data: { error: { errors: [{ reason: "uploadLimitExceeded" }] } } },
  });
  assert.strictEqual(quota.classifyUploadError(uploadLimit), "quota");

  assert.strictEqual(quota.classifyUploadError(Object.assign(new Error("rate"), { code: 429 })), "quota");

  const authError = Object.assign(new Error("invalid_grant"), { code: 401 });
  assert.strictEqual(quota.classifyUploadError(authError), "auth");

  const forbidden = Object.assign(new Error("The caller does not have permission"), {
    code: 403,
    response: { status: 403, data: { error: { errors: [{ reason: "forbidden" }] } } },
  });
  assert.strictEqual(quota.classifyUploadError(forbidden), "auth");

  assert.strictEqual(quota.classifyUploadError(new Error("socket hang up")), "other");
});

test("the reset lands on midnight Pacific, including across DST", () => {
  const cases = [
    "2026-11-02T18:00:00Z",
    "2026-11-02T08:01:00Z",
    "2026-03-08T09:00:00Z", // spring forward: the local day is 23 hours
    "2026-11-01T07:30:00Z", // fall back: the local day is 25 hours
    "2026-12-31T20:00:00Z",
  ];
  for (const iso of cases) {
    const reset = quota.nextQuotaResetAt(new Date(iso));
    assert.ok(
      inZone(reset).includes("00:00:00"),
      `${iso} produced ${inZone(reset)}, expected local midnight`,
    );
    assert.ok(reset.getTime() > new Date(iso).getTime(), `${iso} produced a reset in the past`);
  }
});

test("exhaustion is remembered until the reset, then forgotten", () => {
  quota.resetQuotaState();
  assert.strictEqual(quota.isQuotaExhausted(), false);
  assert.strictEqual(quota.quotaAvailableAt(), null);

  const resetAt = quota.markQuotaExhausted();
  assert.ok(resetAt instanceof Date);
  assert.strictEqual(quota.isQuotaExhausted(), true);
  assert.strictEqual(quota.quotaAvailableAt().getTime(), resetAt.getTime());

  quota.resetQuotaState();
  assert.strictEqual(quota.isQuotaExhausted(), false);
});

test("a reset already in the past does not keep the queue parked", () => {
  quota.resetQuotaState();
  quota.markQuotaExhausted(new Date(Date.now() - 48 * 3600 * 1000));
  assert.strictEqual(quota.isQuotaExhausted(), false, "a stale reset must expire");
  quota.resetQuotaState();
});
