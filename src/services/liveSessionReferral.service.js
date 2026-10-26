const { SessionEnrollment, LiveSession } = require("../models");

const unavailableStatuses = ["cancelled", "ended", "recorded"];

const parseSessionId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("This live-session invitation is invalid.");
  return id;
};

async function getEligibleReferralSession({ sessionId, referrerUserId, transaction, lock = false }) {
  const session = await LiveSession.findByPk(parseSessionId(sessionId), {
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!session || session.tutorId !== Number(referrerUserId)) {
    throw new Error("This live-session invitation is invalid.");
  }
  if (!session.isFree || unavailableStatuses.includes(session.status)) {
    throw new Error("This live session is no longer available for registration.");
  }
  return session;
}

async function validateLiveSessionReferralInvite({ sessionId, referrerUserId, transaction }) {
  const session = await getEligibleReferralSession({ sessionId, referrerUserId, transaction });
  if (session.maxAttendees) {
    const enrolled = await SessionEnrollment.count({
      where: { sessionId: session.id, paymentStatus: "completed" },
      transaction,
    });
    if (enrolled >= session.maxAttendees) throw new Error("This live session is full.");
  }
  return session;
}

async function enrollReferralStudentInLiveSession({ sessionId, referrerUserId, studentId, transaction }) {
  const session = await getEligibleReferralSession({ sessionId, referrerUserId, transaction, lock: true });
  const existing = await SessionEnrollment.findOne({
    where: { sessionId: session.id, studentId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (existing) return { enrollment: existing, session, created: false };

  if (session.maxAttendees) {
    const enrolled = await SessionEnrollment.count({
      where: { sessionId: session.id, paymentStatus: "completed" },
      transaction,
    });
    if (enrolled >= session.maxAttendees) throw new Error("This live session is full.");
  }

  const enrollment = await SessionEnrollment.create({
    sessionId: session.id,
    studentId,
    invitedBy: session.tutorId,
    amountPaid: 0,
    paymentStatus: "completed",
    invitationStatus: "pending",
    attendanceSyncStatus: "pending",
  }, { transaction });
  return { enrollment, session, created: true };
}

module.exports = {
  parseSessionId,
  validateLiveSessionReferralInvite,
  enrollReferralStudentInLiveSession,
};
