const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize, User, StudentProfile } = require("../models");
const { generateToken } = require("../utils/token");
const { normalizeSriLankanMobile } = require("../utils/phone");
const { sendVerificationSms } = require("../services/smsgo.service");
const { sendStudentEmailVerification } = require("../services/resend.service");
const { createChallenge, resendChallenge, consumeVerifiedChallenge, encryptRegistrationPayload, decryptRegistrationPayload } = require("../services/verification.service");
const { validateReferralCode, createReferralAttribution, ensureAffiliateAccount } = require("../services/affiliate.service");

const responseForChallenge = (challenge) => ({
  challengeId: challenge.id,
  expiresAt: challenge.expiresAt,
  resendAvailableAt: new Date(challenge.lastSentAt.getTime() + 60 * 1000),
});

function registrationError(data) {
  if (!data || !String(data.firstName || "").trim() || !String(data.lastName || "").trim()) return "First name and last name are required";
  if (!/^\S+@\S+\.\S+$/.test(String(data.email || ""))) return "A valid email address is required";
  if (typeof data.password !== "string" || data.password.trim().length < 8) return "Password must be at least 8 characters";
  if (!normalizeSriLankanMobile(data.phoneNumber)) return "Enter a valid Sri Lankan mobile number";
  if (data.studentEmail && !/^\S+@\S+\.\S+$/.test(String(data.studentEmail))) return "Enter a valid student email address";
  if (data.studentProfile) {
    const required = ["universityName", "department", "degreeOrCourse", "currentYear", "currentSemester"];
    if (required.some((field) => !data.studentProfile[field])) return "Complete all required student profile fields";
  }
  return null;
}

async function deliverSms(challenge, code) {
  try {
    await sendVerificationSms(challenge.destination, code);
  } catch (error) {
    // Keep the failed attempt for rate limiting, but never leave a usable
    // code behind when provider delivery is uncertain.
    challenge.consumedAt = new Date();
    await challenge.save();
    throw error;
  }
}

async function findExistingPhoneUser(phoneNumber) {
  const verified = await User.findOne({ where: { verifiedPhoneNumber: phoneNumber } });
  if (verified) return verified;
  // Legacy accounts were grandfathered as verified before their historical
  // free-form phone values could be canonicalised. Compare valid Sri Lankan
  // legacy values too, so a new account cannot claim the same number.
  const legacyUsers = await User.findAll({
    where: { phoneNumber: { [Op.ne]: null } },
    attributes: ["id", "phoneNumber"],
  });
  return legacyUsers.find((user) => normalizeSriLankanMobile(user.phoneNumber) === phoneNumber) || null;
}

const checkRegistrationAvailability = async (req, res, next) => {
  try {
    const data = {};
    const email = String(req.query.email || "").trim().toLowerCase();
    const phoneInput = String(req.query.phoneNumber || "").trim();
    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) data.email = { available: false, message: "Enter a valid email address" };
      else data.email = (await User.findOne({ where: { email } }))
        ? { available: false, message: "An account already exists with this email. Log in or use another email." }
        : { available: true };
    }
    if (phoneInput) {
      const phoneNumber = normalizeSriLankanMobile(phoneInput);
      if (!phoneNumber) data.phoneNumber = { available: false, message: "Enter a valid Sri Lankan mobile number" };
      else data.phoneNumber = (await findExistingPhoneUser(phoneNumber))
        ? { available: false, message: "This mobile number is already in use" }
        : { available: true };
    }
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

const startRegistrationPhoneVerification = async (req, res, next) => {
  try {
    const error = registrationError(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const email = req.body.email.trim().toLowerCase();
    const phoneNumber = normalizeSriLankanMobile(req.body.phoneNumber);
    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ where: { email } }),
      findExistingPhoneUser(phoneNumber),
    ]);
    if (existingEmail) return res.status(400).json({ success: false, message: "Email already registered" });
    if (existingPhone) return res.status(400).json({ success: false, message: "This mobile number is already in use" });
    if (req.body.referralCode) await validateReferralCode(req.body.referralCode);

    const registrationPayload = {
      firstName: req.body.firstName.trim(), lastName: req.body.lastName.trim(), email,
      passwordHash: await bcrypt.hash(req.body.password.trim(), 12), phoneNumber,
      roles: Array.isArray(req.body.roles) && req.body.roles.length ? req.body.roles.filter((role) => ["student", "tutor", "vendor"].includes(role)) : ["student"],
      primaryRole: ["student", "tutor", "vendor"].includes(req.body.primaryRole) ? req.body.primaryRole : "student",
      studentProfile: req.body.studentProfile || null,
      studentEmail: req.body.studentEmail ? req.body.studentEmail.trim().toLowerCase() : null,
      referralCode: req.body.referralCode ? String(req.body.referralCode).trim().toUpperCase() : null,
    };
    if (!registrationPayload.roles.length) registrationPayload.roles = ["student"];
    if (!registrationPayload.roles.includes(registrationPayload.primaryRole)) registrationPayload.primaryRole = registrationPayload.roles[0];

    const { challenge, code } = await createChallenge({
      purpose: "registration_phone", destination: phoneNumber, registrationPayload: encryptRegistrationPayload(registrationPayload), ip: req.ip,
    });
    await deliverSms(challenge, code);
    res.status(202).json({ success: true, message: "Verification code sent", data: responseForChallenge(challenge) });
  } catch (error) {
    if (error.code === "SMSGO_DELIVERY_FAILED") {
      return res.status(502).json({ success: false, message: error.message });
    }
    if (error.message.includes("Too many") || error.message.includes("configured")) return res.status(429).json({ success: false, message: error.message.includes("Too many") ? error.message : "Unable to send verification code. Please try again later." });
    next(error);
  }
};

const resendRegistrationPhoneVerification = async (req, res, next) => {
  try {
    const { challenge, code } = await resendChallenge({ id: req.body.challengeId, purpose: "registration_phone", ip: req.ip });
    await deliverSms(challenge, code);
    res.json({ success: true, message: "Verification code sent", data: responseForChallenge(challenge) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message.includes("Too many") ? error.message : "Unable to send verification code. Please try again later." });
  }
};

const verifyRegistrationPhone = async (req, res, next) => {
  try {
    let user;
    await sequelize.transaction(async (transaction) => {
      const challenge = await consumeVerifiedChallenge({ id: req.body.challengeId, purpose: "registration_phone", code: req.body.code, transaction });
      const pending = decryptRegistrationPayload(challenge.registrationPayload);
      if (!pending) throw new Error("This registration request is invalid or has expired.");
      const duplicate = await User.findOne({ where: { email: pending.email }, transaction, lock: transaction.LOCK.UPDATE });
      const duplicatePhone = await User.findOne({ where: { verifiedPhoneNumber: pending.phoneNumber }, transaction, lock: transaction.LOCK.UPDATE });
      if (duplicate || duplicatePhone) throw new Error("This email or mobile number is already registered.");
      user = await User.create({
        firstName: pending.firstName, lastName: pending.lastName, email: pending.email,
        password: pending.passwordHash, roles: pending.roles, primaryRole: pending.primaryRole,
        phoneNumber: pending.phoneNumber, verifiedPhoneNumber: pending.phoneNumber, phoneVerifiedAt: new Date(),
      }, { transaction, hooks: false });
      if (pending.studentProfile) {
        await StudentProfile.create({
          userId: user.id, ...pending.studentProfile, phoneNumber: pending.phoneNumber,
          studentEmail: pending.studentEmail, isProfileComplete: true,
        }, { transaction });
        user.isStudentProfileComplete = true;
        await user.save({ transaction });
      }
      await ensureAffiliateAccount(user.id, transaction);
      await createReferralAttribution({ referralCode: pending.referralCode, referredUserId: user.id, transaction });
    });
    const userWithProfile = await User.findByPk(user.id, { include: [{ model: StudentProfile, as: "studentProfile" }] });
    res.status(201).json({ success: true, message: "Mobile verified and account created", data: { user: userWithProfile, token: generateToken(user.id) } });
  } catch (error) {
    const known = /invalid|expired|already registered/i.test(error.message);
    if (known) return res.status(400).json({ success: false, message: error.message });
    next(error);
  }
};

const startPhoneChange = async (req, res, next) => {
  try {
    const phoneNumber = normalizeSriLankanMobile(req.body.phoneNumber);
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Enter a valid Sri Lankan mobile number" });
    const existing = await findExistingPhoneUser(phoneNumber);
    if (existing && existing.id !== req.user.id) return res.status(400).json({ success: false, message: "This mobile number is already in use" });
    const { challenge, code } = await createChallenge({ purpose: "phone_change", destination: phoneNumber, userId: req.user.id, ip: req.ip });
    await deliverSms(challenge, code);
    res.status(202).json({ success: true, message: "Verification code sent", data: responseForChallenge(challenge) });
  } catch (error) { res.status(400).json({ success: false, message: error.message.includes("Too many") ? error.message : "Unable to send verification code. Please try again later." }); }
};

const verifyPhoneChange = async (req, res, next) => {
  try {
    let user;
    await sequelize.transaction(async (transaction) => {
      const challenge = await consumeVerifiedChallenge({ id: req.body.challengeId, purpose: "phone_change", code: req.body.code, userId: req.user.id, transaction });
      user = await User.findByPk(req.user.id, { transaction, lock: transaction.LOCK.UPDATE });
      const existing = await User.findOne({ where: { verifiedPhoneNumber: challenge.destination }, transaction, lock: transaction.LOCK.UPDATE });
      if (existing && existing.id !== user.id) throw new Error("This mobile number is already in use");
      user.phoneNumber = challenge.destination;
      user.verifiedPhoneNumber = challenge.destination;
      user.phoneVerifiedAt = new Date();
      await user.save({ transaction });
    });
    res.json({ success: true, message: "Mobile number verified", data: { user } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

const startStudentEmailVerification = async (req, res, next) => {
  try {
    const studentEmail = String(req.body.studentEmail || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(studentEmail)) return res.status(400).json({ success: false, message: "Enter a valid student email address" });
    const profile = await StudentProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) return res.status(400).json({ success: false, message: "Complete a student profile before verifying a student email" });
    const { challenge, code } = await createChallenge({ purpose: "student_email", destination: studentEmail, userId: req.user.id, ip: req.ip });
    try { await sendStudentEmailVerification(studentEmail, code); } catch (error) { challenge.consumedAt = new Date(); await challenge.save(); throw error; }
    res.status(202).json({ success: true, message: "Verification code sent", data: responseForChallenge(challenge) });
  } catch (error) { res.status(400).json({ success: false, message: error.message.includes("Too many") ? error.message : "Unable to send verification code. Please try again later." }); }
};

const verifyStudentEmail = async (req, res, next) => {
  try {
    await sequelize.transaction(async (transaction) => {
      const challenge = await consumeVerifiedChallenge({ id: req.body.challengeId, purpose: "student_email", code: req.body.code, userId: req.user.id, transaction });
      const profile = await StudentProfile.findOne({ where: { userId: req.user.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!profile) throw new Error("Student profile not found");
      profile.studentEmail = challenge.destination;
      profile.studentEmailVerifiedAt = new Date();
      await profile.save({ transaction });
    });
    const user = await User.findByPk(req.user.id, { include: [{ model: StudentProfile, as: "studentProfile" }] });
    res.json({ success: true, message: "Student email confirmed", data: { user } });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

module.exports = { checkRegistrationAvailability, startRegistrationPhoneVerification, resendRegistrationPhoneVerification, verifyRegistrationPhone, startPhoneChange, verifyPhoneChange, startStudentEmailVerification, verifyStudentEmail };
