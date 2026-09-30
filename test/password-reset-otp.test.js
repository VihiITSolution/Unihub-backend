const test = require("node:test");
const assert = require("node:assert/strict");
const VerificationChallenge = require("../src/models/VerificationChallenge");
const { consumeVerifiedChallengeForDestination } = require("../src/services/verification.service");

test("a wrong reset code records the final failed attempt before the transaction commits", async (t) => {
  const previousPepper = process.env.AUTH_OTP_PEPPER;
  process.env.AUTH_OTP_PEPPER = "test-pepper";
  t.after(() => {
    if (previousPepper === undefined) delete process.env.AUTH_OTP_PEPPER;
    else process.env.AUTH_OTP_PEPPER = previousPepper;
  });

  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const challenge = {
    codeHash: "0".repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
    attemptCount: 4,
    consumedAt: null,
    save: t.mock.fn(async () => {}),
  };
  t.mock.method(VerificationChallenge, "findOne", async () => challenge);

  const result = await consumeVerifiedChallengeForDestination({
    purpose: "password_reset_email",
    destination: "ada@example.com",
    userId: 42,
    code: "123456",
    transaction,
  });

  assert.equal(result, null);
  assert.equal(challenge.attemptCount, 5);
  assert.ok(challenge.consumedAt instanceof Date);
  assert.deepEqual(challenge.save.mock.calls[0].arguments[0], { transaction });
});
