/**
 * Migration: add-vendor-affiliate-activity
 *
 * Extends the `activity_type` ENUM column in `affiliate_referrals` to include
 * the new `'vendor'` value — triggered when a referred user creates their
 * vendor profile.
 *
 * MySQL ENUM modifications require a full ALTER TABLE to restate all values.
 * The column is nullable so existing rows with NULL remain valid.
 */
async function addVendorAffiliateActivity(sequelize) {
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  const tableExists = tables.map((t) => String(t).toLowerCase()).includes("affiliate_referrals");
  if (!tableExists) {
    console.log("⏭  affiliate_referrals table not found — skipping vendor activity migration");
    return;
  }

  try {
    // Check current column definition to avoid running twice
    const [rows] = await sequelize.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_referrals' AND COLUMN_NAME = 'activity_type'",
    );
    const columnType = rows[0]?.COLUMN_TYPE || "";
    if (columnType.includes("'vendor'")) {
      console.log("✅  activity_type ENUM already includes 'vendor' — skipping");
      return;
    }

    await sequelize.query(
      `ALTER TABLE affiliate_referrals MODIFY COLUMN activity_type ENUM('course','marketplace','boarding','video','social','vendor') DEFAULT NULL`,
    );
    console.log("✅  Extended affiliate_referrals.activity_type ENUM to include 'vendor'");
  } catch (error) {
    console.error("❌  Failed to extend activity_type ENUM:", error.message);
    throw error;
  }
}

module.exports = addVendorAffiliateActivity;
