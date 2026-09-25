const crypto = require("crypto");
const { Op } = require("sequelize");
const {
  sequelize, User, StudentProfile, VendorProfile, Post, PostComment,
  AffiliateCampaign, AffiliateAccount, AffiliateReferral, AffiliateRiskFlag,
  AffiliatePayoutProfile, AffiliatePayoutRequest, AffiliateLedgerEntry,
} = require("../models");

const CAMPAIGN_TIERS = [{ through: 20, amount: 20 }, { through: 100, amount: 30 }, { through: null, amount: 40 }];
const MINIMUM_QUALIFYING_VIDEO_MINUTES = 20;

function payoutSecret() {
  if (!process.env.AFFILIATE_PAYOUT_ENCRYPTION_KEY) throw new Error("Affiliate payouts are not configured");
  return crypto.createHash("sha256").update(process.env.AFFILIATE_PAYOUT_ENCRYPTION_KEY).digest();
}
function encryptDetails(details) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", payoutSecret(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
function decryptDetails(payload) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", payoutSecret(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8"));
}
function accountHash(accountNumber) {
  return crypto.createHmac("sha256", payoutSecret()).update(String(accountNumber).replace(/\s/g, "")).digest("hex");
}
function accountMask(value) { const plain = String(value || ""); return `${"•".repeat(Math.max(0, plain.length - 4))}${plain.slice(-4)}`; }

/**
 * Determine whether a user is eligible to participate in the affiliate programme
 * as a referrer. Both verified students (with a complete student profile) and
 * approved vendors (with a complete vendor profile) qualify.
 */
function isEligible(user) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  // Older accounts completed SMS verification before `verifiedPhoneNumber`
  // was introduced. For those users `phoneVerifiedAt` plus their saved number
  // is the equally valid, durable proof of mobile verification.
  const hasVerifiedMobile = Boolean(
    user.verifiedPhoneNumber || (user.phoneVerifiedAt && user.phoneNumber),
  );
  if (!user.isActive || !hasVerifiedMobile) return false;

  // Student eligibility: verified student with a complete student profile
  const isEligibleStudent = !!(
    roles.includes("student")
    && (user.isStudentProfileComplete || user.studentProfile?.isProfileComplete)
  );

  // Vendor eligibility: approved vendor with a complete vendor profile
  const isEligibleVendor = !!(
    roles.includes("vendor")
    && (user.isVendorProfileComplete || user.vendorProfile?.isProfileComplete)
  );

  return isEligibleStudent || isEligibleVendor;
}

async function activeCampaign({ signupOnly = false, transaction } = {}) {
  const now = new Date();
  return AffiliateCampaign.findOne({
    where: { isActive: true, startsAt: { [Op.lte]: now }, ...(signupOnly ? { signupEndsAt: { [Op.gte]: now } } : {}) },
    order: [["startsAt", "DESC"]], transaction,
  });
}
function newCode() { return `UH${crypto.randomBytes(6).toString("hex").toUpperCase()}`; }
async function ensureAffiliateAccount(userId, transaction) {
  let account = await AffiliateAccount.findOne({ where: { userId }, transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined });
  if (account) return account;
  const user = await User.findByPk(userId, {
    include: [
      { model: StudentProfile, as: "studentProfile" },
      { model: VendorProfile, as: "vendorProfile" },
    ],
    transaction,
  });
  if (!user || !isEligible(user)) return null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { return await AffiliateAccount.create({ userId, referralCode: newCode() }, { transaction }); }
    catch (error) { if (error.name !== "SequelizeUniqueConstraintError") throw error; }
  }
  throw new Error("Unable to create referral code");
}
async function seedEligibleAffiliateAccounts() {
  const users = await User.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { verifiedPhoneNumber: { [Op.ne]: null } },
        { phoneVerifiedAt: { [Op.ne]: null } },
      ],
    },
    attributes: ["id", "roles", "isActive", "phoneNumber", "verifiedPhoneNumber", "phoneVerifiedAt", "isStudentProfileComplete", "isVendorProfileComplete"],
    include: [
      { model: StudentProfile, as: "studentProfile", attributes: ["isProfileComplete"] },
      { model: VendorProfile, as: "vendorProfile", attributes: ["isProfileComplete"] },
    ],
  });
  for (const user of users) if (isEligible(user)) await ensureAffiliateAccount(user.id);
}
async function validateReferralCode(referralCode, transaction) {
  if (!referralCode) return null;
  const campaign = await activeCampaign({ signupOnly: true, transaction });
  if (!campaign) throw new Error("This affiliate campaign is not accepting registrations");
  const account = await AffiliateAccount.findOne({
    where: { referralCode: String(referralCode).trim().toUpperCase(), isActive: true },
    include: [{
      model: User, as: "user",
      include: [
        { model: StudentProfile, as: "studentProfile" },
        { model: VendorProfile, as: "vendorProfile" },
      ],
    }],
    transaction,
  });
  if (!account || !isEligible(account.user)) throw new Error("This referral code is invalid or unavailable");
  return { campaign, account };
}
async function createReferralAttribution({ referralCode, referredUserId, transaction }) {
  if (!referralCode) return null;
  // The account must still be created successfully if its OTP is entered
  // after the campaign signup deadline; it simply receives no attribution.
  if (!await activeCampaign({ signupOnly: true, transaction })) return null;
  const found = await validateReferralCode(referralCode, transaction);
  if (found.account.userId === referredUserId) throw new Error("You cannot use your own referral code");
  const existing = await AffiliateReferral.findOne({ where: { referredUserId }, transaction });
  if (existing) return existing;
  const referral = await AffiliateReferral.create({ campaignId: found.campaign.id, referrerUserId: found.account.userId, referredUserId, referralCode: found.account.referralCode }, { transaction });
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await AffiliateReferral.count({ where: { referrerUserId: found.account.userId, createdAt: { [Op.gte]: oneDayAgo } }, transaction });
  if (count > 10) {
    await AffiliateRiskFlag.create({ referralId: referral.id, type: "referrer_velocity", details: { registrationsLast24Hours: count } }, { transaction });
    referral.status = "held";
    await referral.save({ transaction });
  }
  return referral;
}
function rewardForSequence(campaign, sequence) {
  const rules = campaign.tierRules || CAMPAIGN_TIERS;
  return rules.find((tier) => tier.through === null || sequence <= tier.through)?.amount || 40;
}
async function approveReferral(referralId, adminId = null, transaction = null) {
  const execute = async (tx) => {
    const referral = await AffiliateReferral.findByPk(referralId, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!referral) throw new Error("Referral not found");
    if (["available", "reversed"].includes(referral.status)) return referral;
    if (!referral.activityType) throw new Error("A qualifying activity is required");
    const campaign = await AffiliateCampaign.findByPk(referral.campaignId, { transaction: tx, lock: tx.LOCK.UPDATE });
    const next = campaign.approvedReferralCount + 1;
    const amount = rewardForSequence(campaign, next);
    campaign.approvedReferralCount = next;
    await campaign.save({ transaction: tx });
    referral.status = "available"; referral.tierSequence = next; referral.rewardAmount = amount; referral.approvedAt = new Date(); referral.reviewedBy = adminId;
    await referral.save({ transaction: tx });
    await AffiliateLedgerEntry.create({ userId: referral.referrerUserId, campaignId: campaign.id, referralId: referral.id, type: "reward", amount, metadata: { tierSequence: next, activityType: referral.activityType } }, { transaction: tx });
    return referral;
  };
  return transaction ? execute(transaction) : sequelize.transaction(execute);
}
async function hasOpenRisk(referralId, transaction) { return AffiliateRiskFlag.count({ where: { referralId, status: "open" }, transaction }) > 0; }
async function recordApprovedActivity(userId, activityType, activityResourceId) {
  return sequelize.transaction(async (transaction) => {
    const referral = await AffiliateReferral.findOne({ where: { referredUserId: userId, status: { [Op.in]: ["registered", "activity_detected", "review", "held"] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!referral || referral.activityType) return referral;
    referral.activityType = activityType; referral.activityResourceId = activityResourceId; referral.activityAt = new Date();
    if (await hasOpenRisk(referral.id, transaction)) { referral.status = "held"; await referral.save({ transaction }); return referral; }
    referral.status = "activity_detected"; await referral.save({ transaction });
    return approveReferral(referral.id, null, transaction);
  });
}
function isQualifyingVideoActivity(course, content) {
  return Boolean(
    course
    && content
    && course.approvalStatus === "approved"
    && course.isPublished
    && content.type === "video"
    && Number(content.duration) > MINIMUM_QUALIFYING_VIDEO_MINUTES,
  );
}
async function recordQualifyingVideoActivity(course, content) {
  if (!isQualifyingVideoActivity(course, content)) return null;
  return recordApprovedActivity(course.tutorId, "video", content.id);
}
async function evaluateSocialActivity(userId) {
  return sequelize.transaction(async (transaction) => {
    const referral = await AffiliateReferral.findOne({ where: { referredUserId: userId, status: "registered" }, transaction, lock: transaction.LOCK.UPDATE });
    if (!referral) return null;
    const post = await Post.findOne({ where: { userId, visibility: "public", isDeleted: false, createdAt: { [Op.gte]: referral.createdAt } }, order: [["createdAt", "ASC"]], transaction });
    if (!post) return null;
    const comment = await PostComment.findOne({ where: { userId, isDeleted: false, postId: { [Op.ne]: post.id }, createdAt: { [Op.gte]: referral.createdAt } }, order: [["createdAt", "ASC"]], transaction });
    if (!comment) return null;
    referral.activityType = "social"; referral.activityResourceId = post.id; referral.socialPostId = post.id; referral.socialCommentId = comment.id; referral.activityAt = new Date();
    referral.status = await hasOpenRisk(referral.id, transaction) ? "held" : "review";
    await referral.save({ transaction });
    return referral;
  });
}
async function balances(userId, campaignId) {
  const entries = await AffiliateLedgerEntry.findAll({ where: { userId, campaignId }, attributes: ["type", "amount"], raw: true });
  const available = entries.reduce((sum, row) => sum + Number(row.amount), 0);
  const requests = await AffiliatePayoutRequest.findAll({ where: { userId, campaignId }, attributes: ["status", "amount"], raw: true });
  return { available, reserved: requests.filter((r) => ["pending", "approved"].includes(r.status)).reduce((sum, r) => sum + Number(r.amount), 0), paid: requests.filter((r) => r.status === "paid").reduce((sum, r) => sum + Number(r.amount), 0) };
}
async function savePayoutProfile(userId, details) {
  const required = ["accountHolderName", "bankName", "branch", "accountNumber"];
  if (required.some((key) => !String(details[key] || "").trim())) throw new Error("Complete all bank details");
  const normalized = Object.fromEntries(required.map((key) => [key, String(details[key]).trim()]));
  const profile = await AffiliatePayoutProfile.findOne({ where: { userId } });
  const values = { userId, encryptedDetails: encryptDetails(normalized), accountHash: accountHash(normalized.accountNumber), accountMask: accountMask(normalized.accountNumber) };
  return profile ? profile.update(values) : AffiliatePayoutProfile.create(values);
}
async function createPayoutRequest(userId, amount) {
  return sequelize.transaction(async (transaction) => {
    const campaign = await activeCampaign({ transaction }) || await AffiliateCampaign.findOne({ order: [["startsAt", "DESC"]], transaction });
    if (!campaign) throw new Error("Affiliate campaign not found");
    if (!Number.isInteger(amount) || amount < campaign.minimumRedemption) throw new Error(`Minimum redemption is LKR ${campaign.minimumRedemption}`);
    const total = await balances(userId, campaign.id);
    if (amount > total.available) throw new Error("Requested amount exceeds available balance");
    const profile = await AffiliatePayoutProfile.findOne({ where: { userId }, transaction });
    if (!profile) throw new Error("Save your bank details before requesting a redemption");
    const request = await AffiliatePayoutRequest.create({ userId, campaignId: campaign.id, amount, encryptedBankSnapshot: profile.encryptedDetails, accountMask: profile.accountMask }, { transaction });
    await AffiliateLedgerEntry.create({ userId, campaignId: campaign.id, payoutRequestId: request.id, type: "reservation", amount: -amount }, { transaction });
    const duplicate = await AffiliatePayoutProfile.count({ where: { accountHash: profile.accountHash, userId: { [Op.ne]: userId } }, transaction });
    if (duplicate) await AffiliateRiskFlag.create({ payoutRequestId: request.id, type: "duplicate_payout_account", details: { matchingProfiles: duplicate } }, { transaction });
    return request;
  });
}
module.exports = { CAMPAIGN_TIERS, MINIMUM_QUALIFYING_VIDEO_MINUTES, encryptDetails, decryptDetails, accountMask, isEligible, activeCampaign, ensureAffiliateAccount, seedEligibleAffiliateAccounts, validateReferralCode, createReferralAttribution, recordApprovedActivity, isQualifyingVideoActivity, recordQualifyingVideoActivity, evaluateSocialActivity, approveReferral, balances, savePayoutProfile, createPayoutRequest };
