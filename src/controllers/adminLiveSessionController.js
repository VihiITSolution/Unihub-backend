const { Op, fn, col } = require("sequelize");
const {
  sequelize, LiveSession, SessionEnrollment, User, TutorProfile,
  MeetingOrganizerAccount, LiveSessionMeeting, UserMeetingIdentity,
  LiveSessionProviderJob, LiveSessionEvent,
} = require("../models");
const provider = require("../services/liveSessionProviderService");
const { notifyApprovalByEmail } = require("../services/approvalEmail.service");

const tutorInclude = { model: User, as: "tutor", attributes: ["id", "firstName", "lastName", "email", "profileImage"], include: [{ model: TutorProfile, as: "tutorProfile", attributes: ["teamsEmail"] }] };

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const where = {};
    for (const key of ["status", "approvalStatus", "providerStatus", "provider"]) if (req.query[key]) where[key] = req.query[key];
    if (req.query.tutorId) where.tutorId = Number(req.query.tutorId);
    if (req.query.search) where[Op.or] = [{ title: { [Op.like]: `%${req.query.search}%` } }, { description: { [Op.like]: `%${req.query.search}%` } }];
    if (req.query.from || req.query.to) where.scheduledStartTime = {
      ...(req.query.from ? { [Op.gte]: new Date(req.query.from) } : {}),
      ...(req.query.to ? { [Op.lte]: new Date(req.query.to) } : {}),
    };
    const { count, rows } = await LiveSession.findAndCountAll({
      where, include: [tutorInclude, { model: LiveSessionMeeting, as: "meeting", attributes: ["syncStatus", "lastError", "lastSyncedAt", "recordingWebUrl"] }],
      order: [["scheduledStartTime", "ASC"]], limit, offset: (page - 1) * limit, distinct: true,
    });
    res.json({ success: true, data: { sessions: rows, pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } } });
  } catch (error) { next(error); }
}

async function calendar(req, res, next) {
  try {
    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return res.status(400).json({ success: false, message: "Valid from and to dates are required" });
    const rows = await LiveSession.findAll({
      where: { scheduledStartTime: { [Op.lt]: to }, scheduledEndTime: { [Op.gt]: from } },
      include: [tutorInclude], order: [["scheduledStartTime", "ASC"]],
    });
    res.json({ success: true, data: { events: rows.map((session) => ({ id: session.id, title: session.title, start: session.scheduledStartTime, end: session.scheduledEndTime, status: session.status, approvalStatus: session.approvalStatus, providerStatus: session.providerStatus, tutor: session.tutor })) } });
  } catch (error) { next(error); }
}

async function statistics(req, res, next) {
  try {
    const grouped = await LiveSession.findAll({ attributes: ["approvalStatus", [fn("COUNT", col("id")), "count"]], group: ["approvalStatus"], raw: true });
    const failed = await LiveSession.count({ where: { providerStatus: "failed" } });
    const upcoming = await LiveSession.count({ where: { scheduledStartTime: { [Op.gt]: new Date() }, status: "scheduled" } });
    res.json({ success: true, data: { byApproval: Object.fromEntries(grouped.map((item) => [item.approvalStatus, Number(item.count)])), failed, upcoming } });
  } catch (error) { next(error); }
}

async function detail(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id, {
      include: [
        tutorInclude,
        { model: LiveSessionMeeting, as: "meeting", include: [{ model: MeetingOrganizerAccount, as: "organizer", attributes: ["id", "email", "healthStatus", "lastHealthCheckAt"] }] },
        { model: SessionEnrollment, as: "enrollments", include: [{ model: User, as: "student", attributes: ["id", "firstName", "lastName", "email", "profileImage"] }] },
        { model: LiveSessionEvent, as: "events", include: [{ model: User, as: "actor", attributes: ["id", "firstName", "lastName"] }] },
        { model: LiveSessionProviderJob, as: "providerJobs", attributes: ["id", "type", "status", "attempts", "runAfter", "lastError", "createdAt"] },
      ],
      order: [[{ model: LiveSessionEvent, as: "events" }, "createdAt", "DESC"]],
    });
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    const identity = await UserMeetingIdentity.findOne({ where: { userId: session.tutorId, provider: "teams" } });
    res.json({ success: true, data: { session, tutorIdentity: identity } });
  } catch (error) { next(error); }
}

async function approve(req, res, next) {
  try {
    if (!provider.enabled()) return res.status(503).json({ success: false, message: "Teams live-session approvals are disabled by feature flag" });
    const pendingSession = await LiveSession.findByPk(req.params.id);
    if (!pendingSession) return res.status(404).json({ success: false, message: "Live session not found" });
    if (pendingSession.approvalStatus === "approved") return res.status(409).json({ success: false, message: "Live session is already approved" });
    const tutor = await User.findByPk(pendingSession.tutorId);
    const identity = await provider.getIdentityStatus(tutor);
    if (!identity || identity.invitationStatus !== "accepted") return res.status(409).json({ success: false, message: "Tutor must accept the Microsoft Teams invitation before approval" });
    const organizerHealth = await provider.checkOrganizerHealth();
    if (!organizerHealth.healthy) return res.status(409).json({ success: false, message: organizerHealth.message || "Teams organizer is not healthy" });
    const result = await sequelize.transaction(async (transaction) => {
      const organizer = await MeetingOrganizerAccount.findOne({ where: { enabled: true, provider: "teams" }, transaction, lock: transaction.LOCK.UPDATE });
      if (!organizer) { const error = new Error("No enabled Teams organizer account is configured"); error.statusCode = 409; throw error; }
      const session = await LiveSession.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!session) { const error = new Error("Live session not found"); error.statusCode = 404; throw error; }
      if (session.approvalStatus === "approved") { const error = new Error("Live session is already approved"); error.statusCode = 409; throw error; }
      if (session.status === "cancelled") { const error = new Error("Cancelled sessions cannot be approved"); error.statusCode = 400; throw error; }
      await provider.assertNoConflict(session.scheduledStartTime, session.scheduledEndTime, session.id, transaction);
      await session.update({ approvalStatus: "approved", rejectionReason: null, approvedBy: req.user.id, approvedAt: new Date(), providerStatus: "not_provisioned" }, { transaction });
      await provider.event(session.id, req.user.id, "request.approved", null, transaction);
      return session;
    });
    const emailSent = await notifyApprovalByEmail(result.tutorId, "liveSession", result.title);
    await provider.enqueue(result.id, "provision", null, "initial");
    await provider.notifySessionUsers(result.id, "Live session approved", `${result.title} was approved and is being prepared in Microsoft Teams.`);
    res.json({ success: true, message: "Session approved; Teams provisioning queued", data: { session: result, emailSent } });
  } catch (error) { next(error); }
}

async function reject(req, res, next) {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason is required" });
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (session.approvalStatus === "approved" && session.providerStatus === "ready") return res.status(409).json({ success: false, message: "Cancel an already provisioned session instead of rejecting it" });
    await session.update({ approvalStatus: "rejected", rejectionReason: reason, approvedBy: req.user.id, approvedAt: new Date(), providerStatus: "not_provisioned" });
    await provider.event(session.id, req.user.id, "request.rejected", { reason });
    await provider.notifySessionUsers(session.id, "Live session request needs changes", `${session.title}: ${reason}`);
    res.json({ success: true, message: "Session request rejected", data: { session } });
  } catch (error) { next(error); }
}

async function retry(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    const job = await provider.enqueue(session.id, "provision");
    await session.update({ providerStatus: "not_provisioned" });
    res.json({ success: true, message: "Provisioning retry queued", data: { jobId: job.id } });
  } catch (error) { next(error); }
}

async function syncAttendees(req, res, next) {
  try {
    const job = await provider.enqueue(Number(req.params.id), "attendee_sync");
    res.json({ success: true, message: "Attendee sync queued", data: { jobId: job.id } });
  } catch (error) { next(error); }
}

async function syncArtifacts(req, res, next) {
  try {
    const job = await provider.enqueue(Number(req.params.id), "artifact_sync");
    res.json({ success: true, message: "Artifact sync queued", data: { jobId: job.id } });
  } catch (error) { next(error); }
}

async function resendTutorInvitation(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    const tutor = await User.findByPk(session.tutorId);
    const profile = await TutorProfile.findOne({ where: { userId: session.tutorId } });
    const identity = await provider.ensureIdentity(tutor, profile?.teamsEmail, { resend: true });
    res.json({ success: true, message: "Tutor invitation resent", data: { identity } });
  } catch (error) { next(error); }
}

async function removeRecording(req, res, next) {
  try {
    await provider.removeRecording(Number(req.params.id), req.user.id);
    res.json({ success: true, message: "Recording permanently removed from organizer OneDrive" });
  } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });

    // Stop queued provisioning before removing any provider-side resources.
    if (session.provider === "teams") {
      await session.update({ status: "cancelled", providerStatus: "cancelled" });
      const meeting = await LiveSessionMeeting.findOne({ where: { sessionId: session.id } });
      if (meeting?.outlookEventId) await provider.cancelMeeting(session.id);
      if (meeting?.recordingDriveItemId) await provider.removeRecording(session.id, req.user.id);
    }

    await sequelize.transaction(async (transaction) => {
      const lockedSession = await LiveSession.findByPk(session.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lockedSession) return;

      await Promise.all([
        SessionEnrollment.destroy({ where: { sessionId: session.id }, transaction }),
        LiveSessionProviderJob.destroy({ where: { sessionId: session.id }, transaction }),
        LiveSessionEvent.destroy({ where: { sessionId: session.id }, transaction }),
        LiveSessionMeeting.destroy({ where: { sessionId: session.id }, transaction }),
      ]);
      await lockedSession.destroy({ transaction });
    });

    res.json({ success: true, message: "Live session permanently deleted" });
  } catch (error) { next(error); }
}

async function health(req, res, next) {
  try { res.json({ success: true, data: await provider.checkOrganizerHealth() }); }
  catch (error) { next(error); }
}

async function conflict(req, res, next) {
  try {
    const start = new Date(req.query.start);
    const end = new Date(req.query.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return res.status(400).json({ success: false, message: "Valid start and end times are required" });
    try {
      await provider.assertNoConflict(start, end, req.query.excludeId ? Number(req.query.excludeId) : null);
      res.json({ success: true, data: { conflict: false, bufferMinutes: Number(process.env.TEAMS_SESSION_BUFFER_MINUTES || 15) } });
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      res.json({ success: true, data: { conflict: true, conflictSessionId: error.conflictSessionId, message: error.message, bufferMinutes: Number(process.env.TEAMS_SESSION_BUFFER_MINUTES || 15) } });
    }
  } catch (error) { next(error); }
}

module.exports = { list, calendar, statistics, detail, approve, reject, retry, syncAttendees, syncArtifacts, resendTutorInvitation, removeRecording, remove, health, conflict };
