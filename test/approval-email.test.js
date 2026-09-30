const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { User } = require("../src/models");
const { notifyApprovalByEmail } = require("../src/services/approvalEmail.service");

function configureTestEmail(t) {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-api-key";
  process.env.EMAIL_FROM = "UniHub <test@example.com>";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
  });
}

test("approval email reaches the request owner's address after approval", async (t) => {
  configureTestEmail(t);
  t.mock.method(User, "findByPk", async () => ({ firstName: "Ada", email: "ada@example.com" }));
  const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

  const sent = await notifyApprovalByEmail(42, "course", "Intro to Biology");

  assert.equal(sent, true);
  assert.equal(post.mock.callCount(), 1);
  const [url, payload] = post.mock.calls[0].arguments;
  assert.equal(url, "https://api.resend.com/emails");
  assert.deepEqual(payload.to, ["ada@example.com"]);
  assert.match(payload.subject, /course was approved/i);
  assert.match(payload.text, /Intro to Biology/);
});

test("approval email is skipped when the owner has no email", async (t) => {
  t.mock.method(User, "findByPk", async () => ({ firstName: "Ada", email: null }));
  const post = t.mock.method(axios, "post", async () => ({ status: 200 }));
  t.mock.method(console, "error", () => {});

  assert.equal(await notifyApprovalByEmail(42, "tutor"), false);
  assert.equal(post.mock.callCount(), 0);
});

test("email delivery failure is reported without throwing after approval", async (t) => {
  configureTestEmail(t);
  t.mock.method(User, "findByPk", async () => ({ firstName: "Ada", email: "ada@example.com" }));
  t.mock.method(axios, "post", async () => { throw new Error("mail provider unavailable"); });
  t.mock.method(console, "error", () => {});

  assert.equal(await notifyApprovalByEmail(42, "affiliatePayout"), false);
});
