const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const affiliate = require("../src/services/affiliate.service");
const approvalEmail = require("../src/services/approvalEmail.service");
const migrate = require("../src/migrations/add-manual-affiliate-activity");

test("manual approval requires a reason, grants one reward, and saves an audit record in the transaction", async (t) => {
  const referral = { id: 5, status: "held", activityType: null, referrerUserId: 8, rewardAmount: 20, save: async () => {} };
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  let awards = 0; let audit = null; let cleared = 0;
  t.mock.method(models.AffiliateReferral, "findByPk", async () => referral);
  t.mock.method(models.sequelize, "transaction", async (fn) => fn(tx));
  t.mock.method(models.AffiliateRiskFlag, "update", async (_values, options) => { assert.equal(options.transaction, tx); cleared += 1; });
  t.mock.method(models.AdminAuditLog, "create", async (values, options) => { assert.equal(options.transaction, tx); audit = values; });
  t.mock.method(affiliate, "approveReferral", async (_id, _adminId, transaction) => { assert.equal(transaction, tx); awards += 1; referral.status = "available"; return referral; });
  t.mock.method(approvalEmail, "notifyApprovalByEmail", async () => true);
  delete require.cache[require.resolve("../src/controllers/adminAffiliateController")];
  const { reviewReferral } = require("../src/controllers/adminAffiliateController");
  const invoke = async (body) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    let caught;
    await reviewReferral({ params: { id: "5" }, body, user: { id: 9 }, get: () => "test", ip: "127.0.0.1" }, res, (error) => { caught = error; });
    return { res, caught };
  };
  assert.equal((await invoke({ action: "approve_manual", reason: " " })).res.statusCode, 400);
  assert.equal(awards, 0);
  assert.equal((await invoke({ action: "approve" })).caught.statusCode, 409);
  assert.equal(cleared, 0);
  referral.activityType = "live_session";
  assert.equal((await invoke({ action: "approve_manual", reason: "Confirmed by support" })).caught.statusCode, 409);
  referral.activityType = null;
  const success = await invoke({ action: "approve_manual", reason: "Confirmed by support" });
  assert.equal(success.res.body.success, true);
  assert.equal(referral.activityType, "manual");
  assert.equal(audit.actorAdminId, 9);
  assert.equal(audit.metadata.reason, "Confirmed by support");
  assert.equal(cleared, 1);
  assert.equal(awards, 1);
  assert.equal((await invoke({ action: "approve_manual", reason: "Confirmed by support" })).caught.statusCode, 409);
  assert.equal(awards, 1);
});

test("manual activity migration preserves existing enum values and is idempotent", async () => {
  for (const [type, shouldAlter] of [["enum('course','live_session')", true], ["enum('course','manual')", false], ["varchar(32)", false]]) {
    const queries = [];
    await migrate({ query: async (sql) => { queries.push(sql); return sql.startsWith("SELECT") ? [[{ COLUMN_TYPE: type }]] : []; } });
    assert.equal(queries.length, shouldAlter ? 2 : 1);
    if (shouldAlter) assert.match(queries[1], /enum\('course','live_session','manual'\)/);
  }
});
