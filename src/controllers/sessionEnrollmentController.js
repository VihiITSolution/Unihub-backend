const { Op } = require("sequelize");
const { sequelize, SessionEnrollment, LiveSession, LiveSessionMeeting, User } = require("../models");
const provider = require("../services/liveSessionProviderService");
const { publicSession } = require("../utils/liveSessionPresentation");
const { validateReferralCode } = require("../services/affiliate.service");
const { validateLiveSessionReferralInvite, enrollReferralStudentInLiveSession } = require("../services/liveSessionReferral.service");

const isAdmin = (user) => user?.primaryRole === "admin" || user?.roles?.includes("admin");

async function enrollInSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!session.isFree) return res.status(403).json({ success: false, message: "Paid live-session enrollment is disabled until verified payments are implemented" });
    if (session.approvalStatus !== "approved" || session.providerStatus !== "ready" || ["cancelled", "ended", "recorded"].includes(session.status)) return res.status(400).json({ success: false, message: "This session is not open for enrollment" });
    const identity = session.provider === "teams" ? await provider.ensureIdentity(req.user, req.user.email) : null;
    const enrollment = await sequelize.transaction(async (transaction) => {
      const lockedSession = await LiveSession.findByPk(session.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (lockedSession.approvalStatus !== "approved" || lockedSession.providerStatus !== "ready" || ["cancelled", "ended", "recorded"].includes(lockedSession.status)) {
        const error = new Error("This session is not open for enrollment"); error.statusCode = 409; throw error;
      }
      if (await SessionEnrollment.findOne({ where: { sessionId: session.id, studentId: req.user.id }, transaction })) {
        const error = new Error("Already enrolled in this session"); error.statusCode = 409; throw error;
      }
      if (lockedSession.maxAttendees) {
        const count = await SessionEnrollment.count({ where: { sessionId: session.id, paymentStatus: "completed" }, transaction });
        if (count >= lockedSession.maxAttendees) { const error = new Error("Session is full"); error.statusCode = 409; throw error; }
      }
      return SessionEnrollment.create({
        sessionId: session.id, studentId: req.user.id, amountPaid: 0,
        paymentStatus: "completed", invitationStatus: "accepted", attendanceSyncStatus: "pending",
      }, { transaction });
    });
    if (session.provider === "teams") await provider.enqueue(session.id, "attendee_sync");
    res.status(201).json({
      success: true,
      message: identity?.invitationStatus === "accepted" ? "Enrolled successfully" : "Enrolled. Accept the Microsoft invitation before joining.",
      data: { enrollment, identity: identity ? { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl } : null },
    });
  } catch (error) { next(error); }
}

async function enrollFromReferralInvite(req, res, next) {
  try {
    const referral = await validateReferralCode(req.query.ref);
    if (referral.account.userId === req.user.id) return res.status(400).json({ success: false, message: "You cannot use your own live-session referral invitation" });
    const session = await validateLiveSessionReferralInvite({
      sessionId: req.params.id,
      referrerUserId: referral.account.userId,
    });
    const identity = session.provider === "teams" ? await provider.ensureIdentity(req.user, req.user.email) : null;
    const result = await sequelize.transaction((transaction) => enrollReferralStudentInLiveSession({
      sessionId: session.id,
      referrerUserId: referral.account.userId,
      studentId: req.user.id,
      transaction,
    }));
    if (result.session.provider === "teams" && result.session.providerStatus === "ready") {
      await provider.enqueue(result.session.id, "attendee_sync");
    }
    res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created ? "You are enrolled in this live session" : "You are already enrolled in this live session",
      data: {
        enrollment: result.enrollment,
        session: publicSession(result.session),
        identity: identity ? { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl } : null,
      },
    });
  } catch (error) { next(error); }
}

async function inviteStudents(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!isAdmin(req.user) && session.tutorId !== req.user.id) return res.status(403).json({ success: false, message: "Not authorized to invite students" });
    if (!session.isFree) return res.status(403).json({ success: false, message: "Invitations for paid live sessions are disabled" });
    if (!Array.isArray(req.body.studentIds) || !req.body.studentIds.length) return res.status(400).json({ success: false, message: "studentIds must be a non-empty array" });
    const students = await User.findAll({ where: { id: { [Op.in]: req.body.studentIds } } });
    let invited = 0;
    const failed = [];
    for (const student of students) {
      try {
        if (session.provider === "teams") await provider.ensureIdentity(student, student.email);
        const [, created] = await SessionEnrollment.findOrCreate({
          where: { sessionId: session.id, studentId: student.id },
          defaults: { invitedBy: req.user.id, invitationStatus: "pending", amountPaid: 0, paymentStatus: "completed" },
        });
        if (created) invited += 1;
      } catch (error) { failed.push({ studentId: student.id, message: error.message }); }
    }
    if (session.provider === "teams") await provider.enqueue(session.id, "attendee_sync");
    res.json({ success: true, message: `Sent ${invited} invitations`, data: { invited, failed } });
  } catch (error) { next(error); }
}

async function getMyEnrollments(req, res, next) {
  try {
    const sessionWhere = {};
    if (req.query.upcoming === "true") { sessionWhere.scheduledEndTime = { [Op.gt]: new Date() }; sessionWhere.status = { [Op.in]: ["scheduled", "live"] }; }
    if (req.query.past === "true") { sessionWhere.scheduledEndTime = { [Op.lt]: new Date() }; sessionWhere.status = { [Op.in]: ["ended", "recorded"] }; }
    const enrollments = await SessionEnrollment.findAll({
      where: { studentId: req.user.id },
      include: [{ model: LiveSession, as: "session", where: Object.keys(sessionWhere).length ? sessionWhere : undefined, include: [{ model: User, as: "tutor", attributes: ["id", "firstName", "lastName", "profileImage"] }] }],
      order: [["createdAt", "DESC"]],
    });
    res.json({ success: true, data: { enrollments: enrollments.map((item) => ({ ...item.toJSON(), session: publicSession(item.session) })) } });
  } catch (error) { next(error); }
}

async function joinSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (session.status !== "live" || session.approvalStatus !== "approved" || session.providerStatus !== "ready") return res.status(400).json({ success: false, message: "Session is not live and ready" });
    const enrollment = await SessionEnrollment.findOne({ where: { sessionId: session.id, studentId: req.user.id, paymentStatus: "completed" } });
    if (!enrollment) return res.status(403).json({ success: false, message: "A completed enrollment is required" });
    if (session.provider === "teams") {
      const identity = await provider.getIdentityStatus(req.user);
      const expectedEmail = await provider.expectedTeamsEmail(req.user);
      if (!expectedEmail || !identity || identity.invitationStatus !== "accepted" || identity.email.toLowerCase() !== expectedEmail) {
        return res.status(403).json({ success: false, message: "Accept the Microsoft invitation and sign in with your verified UniHub email before joining", data: { identityStatus: identity?.invitationStatus || "not_invited", invitationRedeemUrl: identity?.invitationRedeemUrl || null } });
      }
      const meeting = await LiveSessionMeeting.findOne({ where: { sessionId: session.id } });
      if (!meeting?.joinUrl) return res.status(409).json({ success: false, message: "Teams join link is unavailable" });
      await enrollment.update({ joinLaunchedAt: new Date() });
      await provider.enqueue(session.id, "attendee_sync");
      return res.json({ success: true, message: "Open Microsoft Teams to join", data: { provider: "teams", launchMode: "external", joinUrl: meeting.joinUrl, session: publicSession(session) } });
    }
    await enrollment.update({ joinedAt: enrollment.joinedAt || new Date(), attended: true });
    res.json({
      success: true, message: "Joined live session",
      data: { provider: "youtube", launchMode: "embed", embedUrl: session.youtubeVideoId ? `https://www.youtube.com/embed/${session.youtubeVideoId}?autoplay=1` : null, chatUrl: session.enableChat && session.youtubeVideoId ? `https://www.youtube.com/live_chat?v=${session.youtubeVideoId}&embed_domain=${req.hostname}` : null, session: publicSession(session) },
    });
  } catch (error) { next(error); }
}

async function leaveSession(req, res, next) {
  try {
    const enrollment = await SessionEnrollment.findOne({ where: { sessionId: req.params.id, studentId: req.user.id } });
    if (!enrollment) return res.status(404).json({ success: false, message: "Enrollment not found" });
    const session = await LiveSession.findByPk(req.params.id);
    if (session?.provider === "youtube" && enrollment.joinedAt) {
      const leftAt = new Date();
      await enrollment.update({ leftAt, attendanceDuration: Math.max(0, Math.round((leftAt - enrollment.joinedAt) / 60_000)) });
    }
    res.json({ success: true, message: session?.provider === "teams" ? "Teams attendance will be imported after the meeting" : "Left live session", data: { enrollment } });
  } catch (error) { next(error); }
}

async function getSessionEnrollments(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!isAdmin(req.user) && session.tutorId !== req.user.id) return res.status(403).json({ success: false, message: "Not authorized to view enrollments" });
    const enrollments = await SessionEnrollment.findAll({
      where: { sessionId: session.id },
      include: [{ model: User, as: "student", attributes: ["id", "firstName", "lastName", "email", "profileImage"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json({ success: true, data: { enrollments } });
  } catch (error) { next(error); }
}

module.exports = { enrollInSession, enrollFromReferralInvite, inviteStudents, getMyEnrollments, joinSession, leaveSession, getSessionEnrollments };
