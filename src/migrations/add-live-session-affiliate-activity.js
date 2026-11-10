// Preserve all existing ENUM values when adding the new activity type. Some
// installations use VARCHAR instead, which already accepts the new value.
async function addLiveSessionAffiliateActivity(sequelize) {
  const [rows] = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_referrals' AND COLUMN_NAME = 'activity_type'",
  );
  const type = rows[0]?.COLUMN_TYPE || "";
  if (!type.startsWith("enum(") || type.includes("'live_session'")) return;
  if (!/^enum\('[a-z_]+'(?:,'[a-z_]+')*\)$/.test(type)) throw new Error("Unexpected affiliate activity enum definition");
  const extended = `${type.slice(0, -1)},'live_session')`;
  await sequelize.query(`ALTER TABLE affiliate_referrals MODIFY COLUMN activity_type ${extended} DEFAULT NULL`);
}

module.exports = addLiveSessionAffiliateActivity;
