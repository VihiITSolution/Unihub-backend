const { Op } = require("sequelize");
const { sequelize, AffiliateReferral, AffiliateRiskFlag, AffiliatePayoutRequest, AffiliateLedgerEntry, User, StudentProfile, VendorProfile } = require("../models");
const { approveReferral, decryptDetails } = require("../services/affiliate.service");
const { notifyApprovalByEmail } = require("../services/approvalEmail.service");

const pageValues = (query) => ({ page: Math.max(Number(query.page) || 1, 1), limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100) });
async function listReferrals(req, res, next) {
  try {
    const { page, limit } = pageValues(req.query); const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.referrerId) where.referrerUserId = Number(req.query.referrerId);
    if (req.query.from || req.query.to) where.createdAt = { ...(req.query.from ? { [Op.gte]: new Date(req.query.from) } : {}), ...(req.query.to ? { [Op.lte]: new Date(req.query.to) } : {}) };
    const referredInclude = {
      model: User, as: "referred", attributes: ["id", "firstName", "lastName", "email"],
      include: [
        { model: StudentProfile, as: "studentProfile", attributes: ["universityName", "department"] },
        { model: VendorProfile, as: "vendorProfile", attributes: ["shopName", "businessType", "approvalStatus"] },
      ]
    };
    if (req.query.university) referredInclude.include[0].where = { universityName: req.query.university };
    const { count, rows } = await AffiliateReferral.findAndCountAll({ where, include: [{ model: User, as: "referrer", attributes: ["id", "firstName", "lastName", "email"] }, referredInclude, { association: "riskFlags" }], order: [["createdAt", "DESC"]], limit, offset: (page - 1) * limit, distinct: true });
    res.json({ success: true, data: { referrals: rows, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } } });
  } catch (error) { next(error); }
}
async function reviewReferral(req, res, next) {
  try {
    const action = req.body.action; const referral = await AffiliateReferral.findByPk(req.params.id);
    if (!referral) return res.status(404).json({ success: false, message: "Referral not found" });
    if (action === "approve") {
      if (["available", "reversed"].includes(referral.status)) return res.status(409).json({ success: false, message: "Referral cannot be approved in its current state" });
      await AffiliateRiskFlag.update({ status: "cleared", resolvedBy: req.user.id, resolvedAt: new Date() }, { where: { referralId: referral.id, status: "open" } });
      const approved = await approveReferral(referral.id, req.user.id);
      const emailSent = await notifyApprovalByEmail(approved.referrerUserId, "affiliateReferral");
      return res.json({ success: true, data: { referral: approved, emailSent } });
    }
    if (action === "hold") { await referral.update({ status: "held", reviewedBy: req.user.id, rejectionReason: req.body.reason || null }); return res.json({ success: true, data: { referral } }); }
    if (action === "reject" || action === "reverse") {
      await sequelize.transaction(async (transaction) => {
        const locked = await AffiliateReferral.findByPk(referral.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (locked.status === "available") await AffiliateLedgerEntry.create({ userId: locked.referrerUserId, campaignId: locked.campaignId, referralId: locked.id, type: "reversal", amount: -locked.rewardAmount, metadata: { reason: req.body.reason || "Admin reversal" } }, { transaction });
        await locked.update({ status: action === "reverse" ? "reversed" : "rejected", reviewedBy: req.user.id, rejectionReason: req.body.reason || null }, { transaction });
      });
      return res.json({ success: true, message: `Referral ${action}d` });
    }
    return res.status(400).json({ success: false, message: "Use approve, reject, hold, or reverse" });
  } catch (error) { next(error); }
}
async function listPayouts(req, res, next) {
  try {
    const { page, limit } = pageValues(req.query); const where = req.query.status ? { status: req.query.status } : {};
    const { count, rows } = await AffiliatePayoutRequest.findAndCountAll({ where, attributes: { exclude: ["encryptedBankSnapshot"] }, include: [{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"] }, { association: "riskFlags" }], order: [["createdAt", "DESC"]], limit, offset: (page - 1) * limit, distinct: true });
    res.json({ success: true, data: { payouts: rows, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } } });
  } catch (error) { next(error); }
}
async function payoutDetail(req, res, next) {
  try {
    const payout = await AffiliatePayoutRequest.findByPk(req.params.id, { include: [{ model: User, as: "user", attributes: ["id", "firstName", "lastName", "email"] }, { association: "riskFlags" }] });
    if (!payout) return res.status(404).json({ success: false, message: "Payout request not found" });
    const data = payout.toJSON();
    delete data.encryptedBankSnapshot;
    res.json({ success: true, data: { payout: { ...data, bankDetails: decryptDetails(payout.encryptedBankSnapshot) } } });
  } catch (error) { next(error); }
}
async function reviewPayout(req, res, next) {
  try {
    const payout = await AffiliatePayoutRequest.findByPk(req.params.id);
    if (!payout || payout.status !== "pending") return res.status(400).json({ success: false, message: "Only pending payouts can be reviewed" });
    if (req.body.action === "approve") {
      await payout.update({ status: "approved", reviewedBy: req.user.id, reviewedAt: new Date() });
      const emailSent = await notifyApprovalByEmail(payout.userId, "affiliatePayout");
      await AffiliateRiskFlag.update({ status: "cleared", resolvedBy: req.user.id, resolvedAt: new Date() }, { where: { payoutRequestId: payout.id, status: "open" } });
      return res.json({ success: true, data: { payout, emailSent } });
    }
    if (req.body.action === "reject") { await sequelize.transaction(async (transaction) => { await payout.update({ status: "rejected", reviewedBy: req.user.id, reviewedAt: new Date(), rejectionReason: req.body.reason || "Rejected by admin" }, { transaction }); await AffiliateLedgerEntry.create({ userId: payout.userId, campaignId: payout.campaignId, payoutRequestId: payout.id, type: "release", amount: payout.amount, metadata: { reason: payout.rejectionReason } }, { transaction }); }); return res.json({ success: true, data: { payout } }); }
    return res.status(400).json({ success: false, message: "Use approve or reject" });
  } catch (error) { next(error); }
}
async function markPayoutPaid(req, res, next) {
  try {
    const payout = await AffiliatePayoutRequest.findByPk(req.params.id);
    if (!payout || payout.status !== "approved") return res.status(400).json({ success: false, message: "Only approved payouts can be marked paid" });
    await sequelize.transaction(async (transaction) => { await payout.update({ status: "paid", paidBy: req.user.id, paidAt: new Date(), transferReference: req.body.transferReference ? String(req.body.transferReference).slice(0, 120) : null }, { transaction }); await AffiliateLedgerEntry.create({ userId: payout.userId, campaignId: payout.campaignId, payoutRequestId: payout.id, type: "paid", amount: 0, metadata: { settledAmount: payout.amount } }, { transaction }); });
    res.json({ success: true, data: { payout } });
  } catch (error) { next(error); }
}
module.exports = { listReferrals, reviewReferral, listPayouts, payoutDetail, reviewPayout, markPayoutPaid };
