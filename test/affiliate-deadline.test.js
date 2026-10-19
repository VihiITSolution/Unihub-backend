const test = require("node:test");
const assert = require("node:assert/strict");
const extendDeadline = require("../src/migrations/extend-affiliate-signup-deadline");
const createProgram = require("../src/migrations/create-affiliate-program");
const { CAMPAIGN_NAME, SIGNUP_DEADLINE_UTC } = require("../src/config/affiliateCampaign");

function campaignDatabase(deadline) {
  let currentDeadline = deadline;
  const updates = [];
  return {
    updates,
    async query(sql, { replacements }) {
      if (sql.startsWith("SELECT")) {
        assert.deepEqual(replacements, [CAMPAIGN_NAME]);
        return [currentDeadline === null ? [] : [{ id: 7, signup_ends_at: currentDeadline }]];
      }
      assert.match(sql, /WHERE id = \? AND signup_ends_at < \?/);
      updates.push({ sql, replacements });
      currentDeadline = replacements[0];
      return [[], { affectedRows: 1 }];
    },
  };
}

test("affiliate deadline ends on 21 January 2027 at 23:59:59 Sri Lanka time", () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(SIGNUP_DEADLINE_UTC));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  assert.equal(`${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`, "2027-01-21 23:59:59");
});

test("extends the existing October campaign without resetting other campaign fields", async () => {
  const db = campaignDatabase(new Date("2026-10-21T18:29:59Z"));
  await extendDeadline(db);
  assert.equal(db.updates.length, 1);
  const { sql, replacements } = db.updates[0];
  assert.match(sql, /SET signup_ends_at = \?, updated_at = NOW\(\)/);
  assert.equal(replacements[0].toISOString(), SIGNUP_DEADLINE_UTC);
  assert.equal(replacements[1], 7);
  assert.equal(replacements[2].toISOString(), SIGNUP_DEADLINE_UTC);
  assert.doesNotMatch(sql, /approved_referral_count|tier_rules|is_active|minimum_redemption/);
});

test("repeated startups do not keep adding months", async () => {
  const db = campaignDatabase(new Date("2026-10-21T18:29:59Z"));
  await extendDeadline(db);
  await extendDeadline(db);
  assert.equal(db.updates.length, 1);
});

test("never shortens a campaign already extended beyond January", async () => {
  const db = campaignDatabase(new Date("2027-03-21T18:29:59Z"));
  await extendDeadline(db);
  assert.equal(db.updates.length, 0);
});

test("leaves a missing campaign alone", async () => {
  const db = campaignDatabase(null);
  await extendDeadline(db);
  assert.equal(db.updates.length, 0);
});

test("treats a MySQL UTC deadline string independently of the server timezone", async () => {
  const db = campaignDatabase("2027-01-21 18:29:59");
  await extendDeadline(db);
  assert.equal(db.updates.length, 0);
});

test("fresh databases use the same extended deadline and retain the existing reward tiers", async () => {
  let inserted;
  const db = {
    getQueryInterface: () => ({ showAllTables: async () => [], createTable: async () => {} }),
    async query(sql, options) {
      if (sql.startsWith("SELECT")) return [[]];
      inserted = options.replacements;
      return [[], {}];
    },
  };
  await createProgram(db);
  assert.equal(inserted[0], CAMPAIGN_NAME);
  assert.equal(inserted[3].toISOString(), SIGNUP_DEADLINE_UTC);
  assert.equal(inserted[4], 2000);
  assert.deepEqual(JSON.parse(inserted[5]), [
    { through: 20, amount: 20 }, { through: 100, amount: 30 }, { through: null, amount: 40 },
  ]);
});
