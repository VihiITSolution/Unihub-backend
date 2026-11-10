const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const provider = require("../src/services/liveSessionProviderService");
const affiliate = require("../src/services/affiliate.service");

test("only eligible Teams join launches record affiliate activity and failures do not block joining", async (t) => {
  const session = { id: 17, status: "live", approvalStatus: "approved", providerStatus: "ready", provider: "teams" };
  const enrollment = { update: async (fields) => { Object.assign(enrollment, fields); } };
  let hasEnrollment = true;
  let hasLink = true;
  let failActivity = false;
  const activityCalls = [];
  t.mock.method(models.LiveSession, "findByPk", async () => session);
  t.mock.method(models.SessionEnrollment, "findOne", async () => hasEnrollment ? enrollment : null);
  t.mock.method(models.LiveSessionMeeting, "findOne", async () => hasLink ? { joinUrl: "https://example.test/meeting" } : null);
  t.mock.method(provider, "getIdentityStatus", async () => null);
  t.mock.method(provider, "enqueue", async () => {});
  t.mock.method(affiliate, "recordApprovedActivity", async (...args) => {
    activityCalls.push(args);
    if (failActivity) throw new Error("unavailable");
  });
  t.mock.method(console, "error", () => {});
  // Load the controller after stubbing its destructured service dependency.
  delete require.cache[require.resolve("../src/controllers/sessionEnrollmentController")];
  const { joinSession } = require("../src/controllers/sessionEnrollmentController");
  const invoke = async () => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await joinSession({ params: { id: "17" }, user: { id: 5 } }, response, (error) => { throw error; });
    return response;
  };

  hasEnrollment = false;
  assert.equal((await invoke()).statusCode, 403);
  hasEnrollment = true; hasLink = false;
  assert.equal((await invoke()).statusCode, 409);
  hasLink = true; session.status = "ended";
  assert.equal((await invoke()).statusCode, 400);
  assert.equal(activityCalls.length, 0);
  session.status = "live";
  const success = await invoke();
  assert.equal(success.statusCode, 200);
  assert.equal(success.body.data.joinUrl, "https://example.test/meeting");
  assert.deepEqual(activityCalls[0].slice(0, 3), [5, "live_session", 17]);
  assert.equal(activityCalls[0][3].occurredAt, enrollment.joinLaunchedAt);
  failActivity = true;
  assert.equal((await invoke()).statusCode, 200);
});
