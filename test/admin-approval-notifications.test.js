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

  assert.equal(await notifyActiveAdmins("Course awaiting review", "A course needs review.", "/courses/pending", { courseId: 1 }, { emailEvent: "course" }), 2);
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
  await notifyActiveAdmins("Tutor application", "Review required", "/tutors/pending", null, { emailEvent: "tutor" });
  assert.equal(post.mock.callCount(), 2);
  assert.match(log.mock.calls[0].arguments[0], /provider unavailable/);
});

test("approval email preferences are per administrator and do not disable in-app notifications", async (t) => {
  t.mock.method(User, "findAll", async () => [
    { id: 1, email: "all@example.com", primaryRole: "admin" },
    { id: 2, email: "disabled@example.com", primaryRole: "admin", notificationPrefs: { adminApprovals: { emailEnabled: false } } },
    { id: 3, email: "course-off@example.com", primaryRole: "admin", notificationPrefs: { adminApprovals: { emailEnabled: true, events: { course: false, tutor: true } } } },
    { id: 4, email: "course-on@example.com", primaryRole: "admin", notificationPrefs: { adminApprovals: { emailEnabled: true, events: { course: true } } } },
  ]);
  const notifications = t.mock.method(Notification, "create", async () => ({}));
  const previousKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "admin@example.com";
  t.after(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previousKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previousFrom;
  });
  const post = t.mock.method(axios, "post", async () => ({}));
  await notifyActiveAdmins("Course", "Review required", "/courses/pending", null, { emailEvent: "course" });
  assert.equal(notifications.mock.callCount(), 4);
  assert.deepEqual(post.mock.calls.map((call) => call.arguments[1].to[0]).sort(), ["all@example.com", "course-on@example.com"]);
});

test("approval preference updates preserve other settings and validate event values", async (t) => {
  const { update } = require("../src/controllers/adminAdministratorController");
  const { APPROVAL_EVENTS } = require("../src/services/adminApprovalPreferences");
  const user = { id: 1, primaryRole: "admin", roles: ["admin"], notificationPrefs: { other: { enabled: true }, adminLiveSessions: { emailEnabled: false } }, save: async () => {} };
  t.mock.method(User, "findByPk", async () => user);
  const response = { json(value) { this.body = value; return this; }, status(value) { this.statusCode = value; return this; } };
  const settings = { emailEnabled: true, events: Object.fromEntries(APPROVAL_EVENTS.map((event) => [event, event !== "course"])) };
  let error;
  await update({ params: { id: 1 }, user: { id: 1 }, body: { approvalNotifications: settings } }, response, (err) => { error = err; });
  assert.equal(error, undefined);
  assert.deepEqual(user.notificationPrefs.adminApprovals, settings);
  assert.deepEqual(user.notificationPrefs.adminLiveSessions, { emailEnabled: false });
  assert.deepEqual(user.notificationPrefs.other, { enabled: true });

  await update({ params: { id: 1 }, user: { id: 1 }, body: { approvalNotifications: { ...settings, events: { ...settings.events, tutor: "yes" } } } }, response, (err) => { error = err; });
  assert.equal(error.statusCode, 400);
  assert.deepEqual(user.notificationPrefs.adminApprovals, settings);
});
