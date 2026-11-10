const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const { recordApprovedActivity } = require("../src/services/affiliate.service");
const migrate = require("../src/migrations/add-live-session-affiliate-activity");

test("confirmed attendance after registration records a held referral without issuing a reward", async (t) => {
  const referral = { id: 4, createdAt: new Date("2026-11-01T00:00:00Z"), status: "registered", activityType: null, save: async () => {} };
  const transaction = { LOCK: { UPDATE: "UPDATE" }, afterCommit() {} };
  t.mock.method(models.sequelize, "transaction", async (callback) => callback(transaction));
  t.mock.method(models.AffiliateReferral, "findOne", async () => referral);
  t.mock.method(models.AffiliateRiskFlag, "count", async () => 1);
  const result = await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-02T00:00:00Z" });
  assert.equal(result.activityType, "live_session");
  assert.equal(result.activityResourceId, 17);
  assert.equal(result.status, "held");
  assert.equal(result.activityAt.toISOString(), "2026-11-02T00:00:00.000Z");
});

test("a manual hold remains held even when no open risk flag exists", async (t) => {
  const referral = { id: 4, createdAt: new Date("2026-11-01T00:00:00Z"), status: "held", activityType: null, save: async () => {} };
  t.mock.method(models.sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" }, afterCommit() {} }));
  t.mock.method(models.AffiliateReferral, "findOne", async () => referral);
  t.mock.method(models.AffiliateRiskFlag, "count", async () => 0);
  const result = await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-02T00:00:00Z" });
  assert.equal(result.status, "held");
  assert.equal(result.activityType, "live_session");
});

test("attendance before referral registration and repeated activity do not replace an existing referral activity", async (t) => {
  const referral = { createdAt: new Date("2026-11-02T00:00:00Z"), activityType: null, save: async () => { throw new Error("must not save"); } };
  t.mock.method(models.sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.AffiliateReferral, "findOne", async () => referral);
  await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-01T00:00:00Z" });
  assert.equal(referral.activityType, null);
  referral.activityType = "marketplace";
  await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-03T00:00:00Z" });
  assert.equal(referral.activityType, "marketplace");
});

test("attendance without risk awards a referral only once", async (t) => {
  const referral = { id: 4, campaignId: 2, referrerUserId: 3, createdAt: new Date("2026-11-01T00:00:00Z"), status: "registered", activityType: null, save: async () => {} };
  const campaign = { id: 2, approvedReferralCount: 0, save: async () => {} };
  let rewards = 0;
  t.mock.method(models.sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.AffiliateReferral, "findOne", async () => referral);
  t.mock.method(models.AffiliateReferral, "findByPk", async () => referral);
  t.mock.method(models.AffiliateRiskFlag, "count", async () => 0);
  t.mock.method(models.AffiliateCampaign, "findByPk", async () => campaign);
  t.mock.method(models.AffiliateLedgerEntry, "create", async () => { rewards += 1; });
  await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-02T00:00:00Z" });
  await recordApprovedActivity(5, "live_session", 17, { occurredAt: "2026-11-02T00:00:00Z" });
  assert.equal(referral.status, "available");
  assert.equal(campaign.approvedReferralCount, 1);
  assert.equal(rewards, 1);
});

test("migration appends the new enum value and is safe to repeat or use with VARCHAR", async () => {
  for (const [type, shouldAlter] of [["enum('course','vendor')", true], ["enum('course','vendor','live_session')", false], ["varchar(32)", false]]) {
    const queries = [];
    const sequelize = { query: async (sql) => { queries.push(sql); return sql.startsWith("SELECT") ? [[{ COLUMN_TYPE: type }]] : []; } };
    await migrate(sequelize);
    assert.equal(queries.length, shouldAlter ? 2 : 1);
    if (shouldAlter) assert.match(queries[1], /enum\('course','vendor','live_session'\)/);
  }
});
