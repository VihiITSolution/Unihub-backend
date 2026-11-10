async function addManualAffiliateActivity(sequelize) {
  const [rows] = await sequelize.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_referrals' AND COLUMN_NAME = 'activity_type'");
  const type = rows[0]?.COLUMN_TYPE || "";
  if (!type.startsWith("enum(") || type.includes("'manual'")) return;
  if (!/^enum\('[a-z_]+'(?:,'[a-z_]+')*\)$/.test(type)) throw new Error("Unexpected affiliate activity enum definition");
  await sequelize.query(`ALTER TABLE affiliate_referrals MODIFY COLUMN activity_type ${type.slice(0, -1)},'manual') DEFAULT NULL`);
}

module.exports = addManualAffiliateActivity;
