const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { User, Notification } = require("../src/models");
const { notifyActiveAdmins } = require("../src/controllers/notificationController");

test("approval requests email every active administrator and preserve in-app alerts", async (t) => {
  t.mock.method(User, "findAll", async (options) => {
    assert.deepEqual(options.where, { isActive: true });
    return [
      { id: 1, firstName: "Ada", email: "ada@example.com", primaryRole: "admin", roles: ["admin"] },
      { id: 2, firstName: "Ben", email: "ben@example.com", primaryRole: "student", roles: ["student", "admin"] },
      { id: 3, email: "student@example.com", primaryRole: "student", roles: ["student"] },
    ];
  });
  const notifications = t.mock.method(Notification, "create", async () => ({}));
  const post = t.mock.method(axios, "post", async () => ({}));
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;
  const originalUrl = process.env.ADMIN_APP_URL;
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "admin@example.com";
  process.env.ADMIN_APP_URL = "https://example.com/admin";
  t.after(() => {
    for (const [key, value] of [["RESEND_API_KEY", originalKey], ["EMAIL_FROM", originalFrom], ["ADMIN_APP_URL", originalUrl]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  assert.equal(await notifyActiveAdmins("Course awaiting review", "A course needs review.", "/courses/pending", { courseId: 1 }, { email: true }), 2);
  assert.equal(notifications.mock.callCount(), 2);
  assert.equal(post.mock.callCount(), 2);
  assert.deepEqual(post.mock.calls.map((call) => call.arguments[1].to[0]).sort(), ["ada@example.com", "ben@example.com"]);
  assert.match(post.mock.calls[0].arguments[1].text, /https:\/\/example\.com\/admin\/courses\/pending/);
});

test("email delivery failure does not prevent other administrators being notified", async (t) => {
  t.mock.method(User, "findAll", async () => [
    { id: 1, email: "one@example.com", primaryRole: "admin" },
    { id: 2, email: "two@example.com", primaryRole: "admin" },
  ]);
  t.mock.method(Notification, "create", async () => ({}));
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "admin@example.com";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previousFrom;
  });
  const post = t.mock.method(axios, "post", async (_url, payload) => {
    if (payload.to[0] === "one@example.com") throw new Error("provider unavailable");
  });
  const log = t.mock.method(console, "error", () => {});
  await notifyActiveAdmins("Tutor application", "Review required", "/tutors/pending", null, { email: true });
  assert.equal(post.mock.callCount(), 2);
  assert.match(log.mock.calls[0].arguments[0], /provider unavailable/);
});
