/**
 * Migration: extend-affiliate-signup-deadline
 *
 * Extends the signup_ends_at of the initial "15-Day Student Affiliate Launch"
 * campaign by another three months, from 21 October 2026 to 21 January 2027
 * at 23:59:59 Asia/Colombo. The update is idempotent: it only moves the
 * deadline forward, never backward, and preserves rewards and referrals.
 */
const { CAMPAIGN_NAME, SIGNUP_DEADLINE_UTC } = require("../config/affiliateCampaign");

async function extendAffiliateSignupDeadline(sequelize) {
  const [campaigns] = await sequelize.query(
    "SELECT id, signup_ends_at FROM affiliate_campaigns WHERE name = ? LIMIT 1",
    { replacements: [CAMPAIGN_NAME] },
  );

  if (!campaigns.length) {
    console.log("⏭  Affiliate campaign not found — skipping deadline extension");
    return;
  }

  const campaign = campaigns[0];
  // Raw DATETIME strings from MySQL represent UTC, regardless of the host timezone.
  const value = campaign.signup_ends_at;
  const current = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value);
  const target = new Date(SIGNUP_DEADLINE_UTC);

  if (current >= target) {
    console.log(
      `✅  Affiliate signup deadline is already ${current.toISOString()} — skipping`,
    );
    return;
  }

  await sequelize.query(
    "UPDATE affiliate_campaigns SET signup_ends_at = ?, updated_at = NOW() WHERE id = ? AND signup_ends_at < ?",
    { replacements: [target, campaign.id, target] },
  );

  console.log(
    `✅  Extended affiliate signup deadline to ${SIGNUP_DEADLINE_UTC} (was ${current.toISOString()})`,
  );
}

module.exports = extendAffiliateSignupDeadline;

// Apply only this campaign update without running unrelated schema migrations.
if (require.main === module) {
  const sequelize = require("../config/sequelize");
  (async () => {
    try {
      await sequelize.authenticate();
      await extendAffiliateSignupDeadline(sequelize);
    } catch (error) {
      console.error("Affiliate deadline extension failed:", error.message);
      process.exitCode = 1;
    } finally {
      await sequelize.close();
    }
  })();
}
