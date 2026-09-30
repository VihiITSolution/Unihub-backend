const crypto = require("crypto");
const { Op } = require("sequelize");
const VerificationChallenge = require("../models/VerificationChallenge");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function secret() {
  if (!process.env.AUTH_OTP_PEPPER) throw new Error("OTP verification is not configured");
  return process.env.AUTH_OTP_PEPPER;
}

function hash(value) {
  return crypto.createHmac("sha256", secret()).update(String(value)).digest("hex");
}

function encryptRegistrationPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret()).digest(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

function decryptRegistrationPayload(payload) {
  if (!payload?.iv || !payload?.tag || !payload?.ciphertext) throw new Error("This registration request is invalid or has expired.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.createHash("sha256").update(secret()).digest(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8"));
}

function newCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function assertSendBudget(destination, ipHash) {
  const now = Date.now();
  const rows = await VerificationChallenge.findAll({
    where: { destination, createdAt: { [Op.gt]: new Date(now - 24 * 60 * 60 * 1000) } },
    attributes: ["createdAt", "sendCount"],
  });
  const daily = rows.reduce((sum, row) => sum + row.sendCount, 0);
  const recent = rows.filter((row) => row.createdAt.getTime() > now - 15 * 60 * 1000)
    .reduce((sum, row) => sum + row.sendCount, 0);
  if (daily >= 5 || recent >= 3) throw new Error("Too many verification codes requested. Please try again later.");

  if (ipHash) {
    const ipRows = await VerificationChallenge.findAll({
      where: { ipHash, createdAt: { [Op.gt]: new Date(now - 15 * 60 * 1000) } },
      attributes: ["sendCount"],
    });
    if (ipRows.reduce((sum, row) => sum + row.sendCount, 0) >= 20) {
      throw new Error("Too many verification codes requested. Please try again later.");
    }
  }
}

async function createChallenge({ purpose, destination, registrationPayload = null, userId = null, ip }) {
  const ipHash = ip ? hash(`ip:${ip}`) : null;
  await assertSendBudget(destination, ipHash);
  await VerificationChallenge.update(
    { consumedAt: new Date() },
    { where: { purpose, destination, userId, consumedAt: null } },
  );
  const code = newCode();
  const now = new Date();
  const challenge = await VerificationChallenge.create({
    purpose,
    destination,
    codeHash: hash(`code:${code}`),
    registrationPayload,
    userId,
    expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    lastSentAt: now,
    ipHash,
  });
  return { challenge, code };
}

async function resendChallenge({ id, purpose, userId = null, ip }) {
  const challenge = await VerificationChallenge.findOne({ where: { id, purpose, userId, consumedAt: null } });
  if (!challenge || challenge.expiresAt <= new Date()) throw new Error("This verification request has expired. Start again.");
  if (challenge.attemptCount >= MAX_ATTEMPTS) throw new Error("This verification request is no longer valid.");
  if (challenge.lastSentAt.getTime() + RESEND_WAIT_MS > Date.now()) throw new Error("Please wait before requesting another code.");
  await assertSendBudget(challenge.destination, ip ? hash(`ip:${ip}`) : null);
  const code = newCode();
  challenge.codeHash = hash(`code:${code}`);
  challenge.lastSentAt = new Date();
  challenge.sendCount += 1;
  await challenge.save();
  return { challenge, code };
}

async function consumeVerifiedChallenge({ id, purpose, code, userId = null, transaction }) {
  const challenge = await VerificationChallenge.findOne({
    where: { id, purpose, userId, consumedAt: null }, transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attemptCount >= MAX_ATTEMPTS) {
    throw new Error("This verification code is invalid or has expired.");
  }
  if (!/^[0-9]{6}$/.test(String(code)) || !crypto.timingSafeEqual(Buffer.from(challenge.codeHash), Buffer.from(hash(`code:${code}`)))) {
    challenge.attemptCount += 1;
    if (challenge.attemptCount >= MAX_ATTEMPTS) challenge.consumedAt = new Date();
    await challenge.save({ transaction });
    throw new Error("This verification code is invalid or has expired.");
  }
  challenge.consumedAt = new Date();
  await challenge.save({ transaction });
  return challenge;
}

async function consumeVerifiedChallengeForDestination({ destination, purpose, code, userId = null, transaction }) {
  const challenge = await VerificationChallenge.findOne({
    where: { purpose, destination, userId, consumedAt: null },
    order: [["createdAt", "DESC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attemptCount >= MAX_ATTEMPTS) {
    return null;
  }
  if (!/^[0-9]{6}$/.test(String(code)) || !crypto.timingSafeEqual(Buffer.from(challenge.codeHash), Buffer.from(hash(`code:${code}`)))) {
    challenge.attemptCount += 1;
    if (challenge.attemptCount >= MAX_ATTEMPTS) challenge.consumedAt = new Date();
    await challenge.save({ transaction });
    // Let the caller commit the transaction so the failed attempt is retained.
    return null;
  }
  challenge.consumedAt = new Date();
  await challenge.save({ transaction });
  return challenge;
}

async function deleteExpiredChallenges() {
  await VerificationChallenge.destroy({ where: { expiresAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}

module.exports = { createChallenge, resendChallenge, consumeVerifiedChallenge, consumeVerifiedChallengeForDestination, deleteExpiredChallenges, encryptRegistrationPayload, decryptRegistrationPayload };
