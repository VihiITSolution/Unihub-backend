const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { User, Notification } = require("../src/models");
const { notifyAdministrators, sendTestEmail } = require("../src/services/adminLiveSessionNotification.service");

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

test("administrator live-session emails are sent only to enabled administrators", async (t) => {
  configureTestEmail(t);
  t.mock.method(User, "findAll", async () => ([
    { id: 1, firstName: "Enabled", email: "enabled@example.com", isActive: true, primaryRole: "admin", roles: ["admin"] },
    { id: 2, firstName: "Disabled", email: "disabled@example.com", isActive: true, primaryRole: "admin", roles: ["admin"], notificationPrefs: { adminLiveSessions: { emailEnabled: false, events: {} } } },
    { id: 3, firstName: "Tutor", email: "tutor@example.com", isActive: true, primaryRole: "tutor", roles: ["tutor"] },
  ]));
  t.mock.method(Notification, "create", async () => ({}));
  const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

  const result = await notifyAdministrators({ event: "request_submitted", title: "Approval needed", message: "A session needs review.", link: "/live-sessions", sessionId: 4 });

  assert.equal(result.emailAttempted, 1);
  assert.equal(result.emailSent, 1);
  assert.equal(result.emailFailed, 0);
  assert.equal(post.mock.callCount(), 1);
  assert.deepEqual(post.mock.calls[0].arguments[1].to, ["enabled@example.com"]);
});

test("administrator email delivery failures are reported in the notification result", async (t) => {
  configureTestEmail(t);
  t.mock.method(User, "findAll", async () => ([
    { id: 1, firstName: "Admin", email: "admin@example.com", isActive: true, primaryRole: "admin", roles: ["admin"] },
  ]));
  t.mock.method(Notification, "create", async () => ({}));
  t.mock.method(axios, "post", async () => { throw new Error("provider unavailable"); });
  t.mock.method(console, "error", () => {});

  const result = await notifyAdministrators({ event: "cancelled", title: "Cancelled", message: "A session was cancelled.", sessionId: 5 });

  assert.equal(result.emailAttempted, 1);
  assert.equal(result.emailSent, 0);
  assert.equal(result.emailFailed, 1);
});

test("administrator notification test email uses the selected administrator's account address", async (t) => {
  configureTestEmail(t);
  const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

  await sendTestEmail({ id: 1, firstName: "Ada", email: "ada@example.com" });

  assert.equal(post.mock.callCount(), 1);
  const payload = post.mock.calls[0].arguments[1];
  assert.deepEqual(payload.to, ["ada@example.com"]);
  assert.match(payload.subject, /notification test/i);
});
