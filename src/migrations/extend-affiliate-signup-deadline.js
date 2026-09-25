/**
 * Migration: extend-affiliate-signup-deadline
 *
 * Extends the signup_ends_at of the initial "15-Day Student Affiliate Launch"
 * campaign by one month (from 2026-09-21 to 2026-10-21) so that new referral
 * codes are accepted again. The update is idempotent — it only moves the
 * deadline forward, never backward.
 */
async function extendAffiliateSignupDeadline(sequelize) {
  const NEW_DEADLINE = "2026-10-21 18:29:59";
  const CAMPAIGN_NAME = "15-Day Student Affiliate Launch";

  const [campaigns] = await sequelize.query(
    "SELECT id, signup_ends_at FROM affiliate_campaigns WHERE name = ? LIMIT 1",
    { replacements: [CAMPAIGN_NAME] },
  );

  if (!campaigns.length) {
    console.log("⏭  Affiliate campaign not found — skipping deadline extension");
    return;
  }

  const campaign = campaigns[0];
  const current = new Date(campaign.signup_ends_at);
  const target = new Date(NEW_DEADLINE);

  if (current >= target) {
    console.log(
      `✅  Affiliate signup deadline is already ${current.toISOString()} — skipping`,
    );
    return;
  }

  await sequelize.query(
    "UPDATE affiliate_campaigns SET signup_ends_at = ?, updated_at = NOW() WHERE id = ?",
    { replacements: [NEW_DEADLINE, campaign.id] },
  );

  console.log(
    `✅  Extended affiliate signup deadline to ${NEW_DEADLINE} (was ${current.toISOString()})`,
  );
}

module.exports = extendAffiliateSignupDeadline;
