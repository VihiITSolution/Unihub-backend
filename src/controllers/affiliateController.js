const { AffiliateCampaign, AffiliateAccount, AffiliateReferral, AffiliatePayoutProfile, AffiliatePayoutRequest, AffiliateRiskFlag, User } = require("../models");
const { ensureAffiliateAccount, activeCampaign, balances, savePayoutProfile, createPayoutRequest } = require("../services/affiliate.service");

async function getAffiliateMe(req, res, next) {
  try {
    const account = await ensureAffiliateAccount(req.user.id);
    const campaign = await activeCampaign() || await AffiliateCampaign.findOne({ order: [["startsAt", "DESC"]] });
    if (!account) return res.status(403).json({ success: false, message: "A verified active student profile is required to use the affiliate programme." });
    const [referrals, profile, payouts, totals] = await Promise.all([
      campaign ? AffiliateReferral.findAll({ where: { campaignId: campaign.id, referrerUserId: req.user.id }, include: [{ model: User, as: "referred", attributes: ["id", "firstName", "lastName", "email"] }, { association: "riskFlags", attributes: ["id", "type", "status"] }], order: [["createdAt", "DESC"]] }) : [],
      AffiliatePayoutProfile.findOne({ where: { userId: req.user.id } }),
      campaign ? AffiliatePayoutRequest.findAll({ where: { userId: req.user.id, campaignId: campaign.id }, attributes: ["id", "amount", "status", "accountMask", "createdAt", "reviewedAt", "paidAt", "rejectionReason"], order: [["createdAt", "DESC"]] }) : [],
      campaign ? balances(req.user.id, campaign.id) : { available: 0, reserved: 0, paid: 0 },
    ]);
    res.json({ success: true, data: { account: { referralCode: account.referralCode, referralLink: `${process.env.CORE_APP_URL || "http://localhost:3001"}/auth/register?ref=${account.referralCode}` }, campaign, balances: totals, payoutProfile: profile ? { accountMask: profile.accountMask } : null, referrals, payouts } });
  } catch (error) { next(error); }
}

async function updatePayoutProfile(req, res, next) {
  try {
    if (!await ensureAffiliateAccount(req.user.id)) return res.status(403).json({ success: false, message: "A verified active student profile is required to use the affiliate programme." });
    const profile = await savePayoutProfile(req.user.id, req.body || {});
    res.json({ success: true, message: "Payout details saved", data: { payoutProfile: { accountMask: profile.accountMask } } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
}

async function requestRedemption(req, res, next) {
  try {
    if (!await ensureAffiliateAccount(req.user.id)) return res.status(403).json({ success: false, message: "A verified active student profile is required to use the affiliate programme." });
    const request = await createPayoutRequest(req.user.id, Number(req.body.amount));
    res.status(201).json({ success: true, message: "Redemption request submitted", data: { request: { id: request.id, amount: request.amount, status: request.status, accountMask: request.accountMask } } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
}
module.exports = { getAffiliateMe, updatePayoutProfile, requestRedemption };
