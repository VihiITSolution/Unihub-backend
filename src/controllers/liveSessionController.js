const { Op } = require("sequelize");
const { sequelize, LiveSession, User, Course, TutorProfile, LiveSessionMeeting, MeetingOrganizerAccount } = require("../models");
const youtubeUploader = require("../config/youtube");
const provider = require("../services/liveSessionProviderService");
const { publicSession, ownerSession } = require("../utils/liveSessionPresentation");
const { ensureAffiliateAccount } = require("../services/affiliate.service");

const isAdmin = (user) => user?.primaryRole === "admin" || user?.roles?.includes("admin");
const owns = (session, user) => isAdmin(user) || session.tutorId === user.id;
const includes = [
  { model: User, as: "tutor", attributes: ["id", "firstName", "lastName", "email", "profileImage"] },
  { model: Course, as: "course", attributes: ["id", "title", "thumbnail"] },
];

function schedule(body, existing) {
  const startTime = new Date(body.scheduledStartTime || existing?.scheduledStartTime);
  const endTime = new Date(body.scheduledEndTime || existing?.scheduledEndTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
    const error = new Error("Valid scheduled start and end times are required"); error.statusCode = 400; throw error;
  }
  if (startTime < new Date() && (!existing || startTime.getTime() !== new Date(existing.scheduledStartTime).getTime())) {
    const error = new Error("Scheduled start time must be in the future"); error.statusCode = 400; throw error;
  }
  if (endTime <= startTime) {
    const error = new Error("End time must be after start time"); error.statusCode = 400; throw error;
  }
  if ((endTime.getTime() - startTime.getTime()) > 30 * 60 * 60 * 1000) {
    const error = new Error("A Teams session cannot exceed 30 hours"); error.statusCode = 400; throw error;
  }
  return { startTime, endTime };
}

async function createLiveSession(req, res, next) {
  try {
    if (!provider.enabled()) return res.status(503).json({ success: false, message: "Teams live-session requests are not enabled" });
    if (!req.body.title?.trim()) return res.status(400).json({ success: false, message: "Title is required" });
    if (req.body.isFree === false || Number(req.body.price || 0) > 0) return res.status(400).json({ success: false, message: "Paid live sessions are not available yet" });
    const admin = isAdmin(req.user);
    const tutorId = admin && req.body.tutorId ? Number(req.body.tutorId) : req.user.id;
    const tutor = await User.findByPk(tutorId);
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });
    const profile = await TutorProfile.findOne({ where: { userId: tutorId } });
    if (!profile || (!profile.isApproved && profile.approvalStatus !== "approved")) return res.status(403).json({ success: false, message: "An approved tutor profile is required" });
    if (req.body.courseId) {
      const course = await Course.findByPk(req.body.courseId);
      if (!course || course.tutorId !== tutorId) return res.status(400).json({ success: false, message: "The selected course must belong to the tutor" });
    }
    const maxAttendees = req.body.maxAttendees ? Number(req.body.maxAttendees) : 300;
    if (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 300) return res.status(400).json({ success: false, message: "Maximum attendees must be between 1 and 300" });
    const identity = await provider.ensureIdentity(tutor, req.body.teamsEmail || profile?.teamsEmail);
    const { startTime, endTime } = schedule(req.body);
    if (admin) {
      const health = await provider.checkOrganizerHealth();
      if (!health.healthy) return res.status(409).json({ success: false, message: health.message || "Teams organizer is not healthy" });
      if (identity.invitationStatus !== "accepted") return res.status(409).json({ success: false, message: "Tutor must accept the Microsoft Teams invitation before an admin creates the session" });
    }
    let session;
    await sequelize.transaction(async (transaction) => {
      if (admin) {
        await MeetingOrganizerAccount.findOne({ where: { enabled: true, provider: "teams" }, transaction, lock: transaction.LOCK.UPDATE });
        await provider.assertNoConflict(startTime, endTime, null, transaction);
      }
      session = await LiveSession.create({
        tutorId, courseId: req.body.courseId || null, title: req.body.title.trim(),
        description: req.body.description || null, scheduledStartTime: startTime, scheduledEndTime: endTime,
        isFree: true, price: 0, platformCommissionRate: Number(process.env.PLATFORM_COMMISSION_RATE || 10),
        maxAttendees, allowRecording: req.body.allowRecording !== false,
        enableChat: true, chatModeration: "auto", tags: req.body.tags || [],
        provider: "teams", approvalStatus: admin ? "approved" : "pending",
        providerStatus: "not_provisioned", approvedBy: admin ? req.user.id : null,
        approvedAt: admin ? new Date() : null, status: "scheduled",
      }, { transaction });
      await provider.event(session.id, req.user.id, admin ? "approved.created_by_admin" : "request.submitted", { identityStatus: identity.invitationStatus }, transaction);
    });
    if (admin) await provider.enqueue(session.id, "provision", null, "initial");
    const loaded = await LiveSession.findByPk(session.id, { include: includes });
    res.status(201).json({
      success: true,
      message: admin ? "Session created and queued for Teams provisioning" : "Session request submitted for admin approval",
      data: { session: ownerSession(loaded), identity: { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl } },
    });
  } catch (error) { next(error); }
}

async function getLiveSessions(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const where = { approvalStatus: "approved", providerStatus: "ready", status: { [Op.ne]: "cancelled" } };
    if (req.query.status) where.status = req.query.status;
    if (req.query.tutorId) where.tutorId = Number(req.query.tutorId);
    if (req.query.courseId) where.courseId = Number(req.query.courseId);
    if (req.query.isFree !== undefined) where.isFree = req.query.isFree === "true";
    if (req.query.upcoming === "true") { where.scheduledStartTime = { [Op.gt]: new Date() }; where.status = "scheduled"; }
    if (req.query.past === "true") { where.scheduledEndTime = { [Op.lt]: new Date() }; where.status = { [Op.in]: ["ended", "recorded"] }; }
    const { count, rows } = await LiveSession.findAndCountAll({ where, include: includes, order: [["scheduledStartTime", "ASC"]], limit, offset: (page - 1) * limit });
    res.json({ success: true, data: { sessions: rows.map(publicSession), pagination: { total: count, page, limit, pages: Math.ceil(count / limit) } } });
  } catch (error) { next(error); }
}

async function getMyLiveSessions(req, res, next) {
  try {
    const where = { tutorId: req.user.id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.upcoming === "true") where.scheduledEndTime = { [Op.gt]: new Date() };
    const rows = await LiveSession.findAll({ where, include: [...includes, { model: LiveSessionMeeting, as: "meeting" }], order: [["scheduledStartTime", "ASC"]] });
    res.json({ success: true, data: { sessions: rows.map(ownerSession) } });
  } catch (error) { next(error); }
}

async function getLiveSessionReferralLink(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to share this session" });
    if (["cancelled", "ended", "recorded"].includes(session.status)) {
      return res.status(400).json({ success: false, message: "This session can no longer be shared" });
    }

    const account = await ensureAffiliateAccount(session.tutorId);
    if (!account) {
      return res.status(403).json({ success: false, message: "An approved, verified tutor profile is required to create referral invites" });
    }

    const coreAppUrl = (process.env.CORE_APP_URL || "https://unihub.lk").replace(/\/+$/, "");
    const inviteUrl = `${coreAppUrl}/auth/register?ref=${encodeURIComponent(account.referralCode)}&liveSession=${session.id}`;
    return res.json({ success: true, data: { inviteUrl, referralCode: account.referralCode, sessionId: session.id } });
  } catch (error) { next(error); }
}

async function getLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findOne({ where: { id: req.params.id, approvalStatus: "approved", providerStatus: "ready" }, include: includes });
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    res.json({ success: true, data: { session: publicSession(session) } });
  } catch (error) { next(error); }
}

async function updateLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to update this session" });
    if (["live", "ended", "recorded", "cancelled"].includes(session.status)) return res.status(400).json({ success: false, message: `Cannot update session with status: ${session.status}` });
    if (session.provider === "teams" && (req.body.isFree === false || Number(req.body.price || 0) > 0)) return res.status(400).json({ success: false, message: "Paid live sessions are not available yet" });
    const scheduleChanged = new Date(req.body.scheduledStartTime || session.scheduledStartTime).getTime() !== new Date(session.scheduledStartTime).getTime()
      || new Date(req.body.scheduledEndTime || session.scheduledEndTime).getTime() !== new Date(session.scheduledEndTime).getTime();
    const { startTime, endTime } = schedule(req.body, session);
    if (session.provider === "teams" && req.body.maxAttendees !== undefined) {
      const max = Number(req.body.maxAttendees);
      if (!Number.isInteger(max) || max < 1 || max > 300) return res.status(400).json({ success: false, message: "Maximum attendees must be between 1 and 300" });
    }
    const wasRejected = session.approvalStatus === "rejected";
    await sequelize.transaction(async (transaction) => {
      if (session.provider === "teams" && session.approvalStatus === "approved") {
        const organizer = await MeetingOrganizerAccount.findOne({ where: { enabled: true, provider: "teams" }, transaction, lock: transaction.LOCK.UPDATE });
        if (!organizer) { const error = new Error("No enabled Teams organizer account is configured"); error.statusCode = 409; throw error; }
        await provider.assertNoConflict(startTime, endTime, session.id, transaction);
      }
      await session.update({
        title: req.body.title ?? session.title, description: req.body.description ?? session.description,
        scheduledStartTime: startTime, scheduledEndTime: endTime, maxAttendees: req.body.maxAttendees ?? session.maxAttendees,
        allowRecording: req.body.allowRecording ?? session.allowRecording, tags: req.body.tags ?? session.tags,
        isFree: session.provider === "teams" ? true : session.isFree,
        price: session.provider === "teams" ? 0 : session.price,
        ...(wasRejected ? { approvalStatus: "pending", rejectionReason: null, providerStatus: "not_provisioned" } : {}),
      }, { transaction });
      await provider.event(session.id, req.user.id, wasRejected ? "request.resubmitted" : "session.updated", { startTime, endTime }, transaction);
    });
    if (session.provider === "teams" && session.approvalStatus === "approved") await provider.enqueue(session.id, "attendee_sync");
    if (session.approvalStatus === "approved" && scheduleChanged) {
      await provider.notifySessionUsers(session.id, "Live session rescheduled", `${session.title} now starts at ${new Date(session.scheduledStartTime).toISOString()}.`);
    }
    res.json({ success: true, message: wasRejected ? "Session request resubmitted" : "Session updated; provider sync queued when applicable", data: { session: ownerSession(session) } });
  } catch (error) { next(error); }
}

async function cancelLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to cancel this session" });
    if (["ended", "recorded", "cancelled"].includes(session.status)) return res.status(400).json({ success: false, message: `Cannot cancel session with status: ${session.status}` });
    await session.update({ status: "cancelled", providerStatus: session.provider === "teams" ? "cancelled" : session.providerStatus });
    await provider.event(session.id, req.user.id, "session.cancelled", { reason: req.body?.reason || null });
    if (session.provider === "teams") await provider.enqueue(session.id, "cancel");
    await provider.notifySessionUsers(session.id, "Live session cancelled", `${session.title} has been cancelled.`);
    res.json({ success: true, message: "Live session cancelled", data: { session: ownerSession(session) } });
  } catch (error) { next(error); }
}

async function startLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to start this session" });
    if (session.status !== "scheduled" || session.approvalStatus !== "approved" || session.providerStatus !== "ready") return res.status(400).json({ success: false, message: "Session must be approved and provider-ready before it can start" });
    let launchUrl = null;
    if (session.provider === "teams") {
      const meeting = await LiveSessionMeeting.findOne({ where: { sessionId: session.id } });
      launchUrl = meeting?.joinUrl || null;
      if (!launchUrl) return res.status(409).json({ success: false, message: "Teams join link is unavailable" });
    } else if (session.youtubeBroadcastId) {
      await youtubeUploader.startBroadcast(session.youtubeBroadcastId);
      launchUrl = session.youtubeVideoId ? `https://www.youtube.com/watch?v=${session.youtubeVideoId}` : null;
    }
    await session.update({ status: "live", actualStartTime: new Date() });
    await provider.event(session.id, req.user.id, "session.started");
    res.json({ success: true, message: session.provider === "teams" ? "Session marked live; open Teams to begin" : "Live session started", data: { session: ownerSession(session), provider: session.provider, launchMode: "external", joinUrl: launchUrl } });
  } catch (error) { next(error); }
}

async function endLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to end this session" });
    if (session.status !== "live") return res.status(400).json({ success: false, message: `Cannot end session with status: ${session.status}` });
    if (session.provider === "youtube" && session.youtubeBroadcastId) await youtubeUploader.endBroadcast(session.youtubeBroadcastId);
    await session.update({ status: "ended", actualEndTime: new Date() });
    await provider.event(session.id, req.user.id, "session.ended");
    if (session.provider === "teams") await provider.enqueue(session.id, "artifact_sync");
    else if (session.allowRecording && session.youtubeVideoId) await session.update({ status: "recorded", recordingUrl: `https://www.youtube.com/watch?v=${session.youtubeVideoId}` });
    res.json({ success: true, message: session.provider === "teams" ? "Session ended; attendance and recording import queued" : "Live session ended", data: { session: ownerSession(session) } });
  } catch (error) { next(error); }
}

async function getMeetingIdentity(req, res, next) {
  try {
    const identity = await provider.getIdentityStatus(req.user);
    res.json({ success: true, data: { identity: identity ? { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl, lastSyncedAt: identity.lastSyncedAt, lastError: identity.lastError } : null } });
  } catch (error) { next(error); }
}

async function setMeetingIdentity(req, res, next) {
  try {
    const identity = await provider.ensureIdentity(req.user, req.body.teamsEmail, { resend: req.body.resend === true });
    res.json({ success: true, message: "Microsoft Teams invitation sent", data: { identity: { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl } } });
  } catch (error) { next(error); }
}

module.exports = { createLiveSession, getLiveSessions, getMyLiveSessions, getLiveSession, getLiveSessionReferralLink, updateLiveSession, cancelLiveSession, startLiveSession, endLiveSession, getMeetingIdentity, setMeetingIdentity };
