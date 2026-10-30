const { Op } = require("sequelize");
const { sequelize, LiveSession, User, Course, CourseContent, TutorProfile, LiveSessionMeeting, MeetingOrganizerAccount } = require("../models");
const youtubeUploader = require("../config/youtube");
const provider = require("../services/liveSessionProviderService");
const { publicSession, ownerSession } = require("../utils/liveSessionPresentation");
const { ensureAffiliateAccount, validateReferralCode, recordQualifyingVideoActivity } = require("../services/affiliate.service");
const { validateLiveSessionReferralInvite } = require("../services/liveSessionReferral.service");
const { syncCourseDuration } = require("../services/courseDuration.service");
const { notifyAdministrators } = require("../services/adminLiveSessionNotification.service");
const fs = require("fs");

const isAdmin = (user) => user?.primaryRole === "admin" || user?.roles?.includes("admin");
const owns = (session, user) => isAdmin(user) || session.tutorId === user.id;
const includes = [
  { model: User, as: "tutor", attributes: ["id", "firstName", "lastName", "email", "profileImage"] },
  { model: Course, as: "course", attributes: ["id", "title", "thumbnail"] },
];

const recordingEmbedUrl = (videoId) => `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0`;

function recordingTags(value) {
  const rawTags = Array.isArray(value) ? value : String(value || "").split(",");
  const tags = [...new Set(rawTags.map((tag) => String(tag).trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 40)) {
    const error = new Error("Use up to 10 categories, each no longer than 40 characters");
    error.statusCode = 400;
    throw error;
  }
  return tags;
}

function recordingDuration(session) {
  const start = session.actualStartTime || session.scheduledStartTime;
  const end = session.actualEndTime || session.scheduledEndTime;
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function referralInviteSession(session, tutor) {
  return {
    id: session.id,
    tutorId: session.tutorId,
    title: session.title,
    description: session.description,
    scheduledStartTime: session.scheduledStartTime,
    scheduledEndTime: session.scheduledEndTime,
    isFree: session.isFree,
    status: session.status,
    approvalStatus: session.approvalStatus,
    tutorName: [tutor?.firstName, tutor?.lastName].filter(Boolean).join(" ") || "your UniHub tutor",
  };
}

function referralInviteMessage(session, tutor, inviteUrl) {
  const details = referralInviteSession(session, tutor);
  const schedule = new Intl.DateTimeFormat("en-LK", {
    dateStyle: "full", timeStyle: "short", timeZone: "Asia/Colombo",
  }).format(new Date(details.scheduledStartTime));
  const availability = details.approvalStatus === "approved"
    ? "Register through this link to reserve your free place and join the session."
    : "Register through this link to reserve your free place. We’ll let you know once the session is confirmed.";
  return [
    `Join me for “${details.title}” on UniHub!`,
    `Hosted by ${details.tutorName}`,
    `When: ${schedule} (Sri Lanka time)`,
    details.description || null,
    availability,
    inviteUrl,
  ].filter(Boolean).join("\n");
}

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
    if (!admin) {
      notifyAdministrators({
        event: "request_submitted",
        title: "Live session needs approval",
        message: `${session.title} was submitted by ${tutor.firstName} ${tutor.lastName}.`,
        link: "/live-sessions",
        sessionId: session.id,
      }).catch((notificationError) => console.error("Failed to notify administrators about live-session request:", notificationError.message));
    }
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
    const tutor = await User.findByPk(session.tutorId, { attributes: ["firstName", "lastName"] });
    return res.json({
      success: true,
      data: {
        inviteUrl,
        referralCode: account.referralCode,
        sessionId: session.id,
        session: referralInviteSession(session, tutor),
        shareMessage: referralInviteMessage(session, tutor, inviteUrl),
      },
    });
  } catch (error) { next(error); }
}

async function getLiveSessionReferralInvite(req, res, next) {
  try {
    const referral = await validateReferralCode(req.query.ref);
    const session = await validateLiveSessionReferralInvite({
      sessionId: req.params.id,
      referrerUserId: referral.account.userId,
    });
    const tutor = await User.findByPk(session.tutorId, { attributes: ["firstName", "lastName"] });
    res.json({ success: true, data: { session: referralInviteSession(session, tutor) } });
  } catch (error) {
    res.status(404).json({ success: false, message: "This live-session invitation is invalid or no longer available." });
  }
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
    if (wasRejected) {
      notifyAdministrators({
        event: "request_submitted",
        title: "Live session resubmitted",
        message: `${session.title} was updated and resubmitted for approval.`,
        link: "/live-sessions",
        sessionId: session.id,
      }).catch((notificationError) => console.error("Failed to notify administrators about live-session resubmission:", notificationError.message));
    }
    if (session.approvalStatus === "approved" && scheduleChanged) {
      await provider.notifySessionUsers(session.id, "Live session rescheduled", `${session.title} now starts at ${new Date(session.scheduledStartTime).toISOString()}.`);
      notifyAdministrators({
        event: "schedule_changed",
        title: "Live session rescheduled",
        message: `${session.title} has a new schedule.`,
        link: "/live-sessions",
        sessionId: session.id,
      }).catch((notificationError) => console.error("Failed to notify administrators about live-session reschedule:", notificationError.message));
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
    notifyAdministrators({
      event: "cancelled",
      title: "Live session cancelled",
      message: `${session.title} was cancelled.`,
      link: "/live-sessions",
      sessionId: session.id,
    }).catch((notificationError) => console.error("Failed to notify administrators about live-session cancellation:", notificationError.message));
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

async function updateRecording(req, res, next) {
  try {
    const session = await LiveSession.findByPk(req.params.id, { include: includes });
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to manage this recording" });
    if (!session.recordingUrl || !["ended", "recorded"].includes(session.status)) {
      return res.status(409).json({ success: false, message: "The recording is not ready to edit yet" });
    }

    const updates = {};
    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title || title.length > 255) return res.status(400).json({ success: false, message: "A recording title of up to 255 characters is required" });
      updates.title = title;
    }
    if (req.body.description !== undefined) {
      const description = String(req.body.description).trim();
      if (description.length > 10_000) return res.status(400).json({ success: false, message: "Recording description must be 10,000 characters or fewer" });
      updates.description = description || null;
    }
    if (req.body.tags !== undefined) updates.tags = recordingTags(req.body.tags);
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "Provide a title, description, or category" });

    await session.update(updates);
    await provider.event(session.id, req.user.id, "recording.updated", { fields: Object.keys(updates) });
    res.json({ success: true, message: "Recording details updated", data: { session: ownerSession(session) } });
  } catch (error) { next(error); }
}

async function addRecordingToCourse(req, res, next) {
  let importedFilePath = null;
  try {
    const session = await LiveSession.findByPk(req.params.id, { include: includes });
    if (!session) return res.status(404).json({ success: false, message: "Live session not found" });
    if (!owns(session, req.user)) return res.status(403).json({ success: false, message: "Not authorized to use this recording" });
    if (!session.recordingUrl || !["ended", "recorded"].includes(session.status)) {
      return res.status(409).json({ success: false, message: "The recording is not ready to add to a course yet" });
    }

    const courseId = Number(req.body.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: "Choose a course" });
    const course = await Course.findByPk(courseId);
    if (!course || Number(course.tutorId) !== Number(session.tutorId)) {
      return res.status(400).json({ success: false, message: "Choose one of this tutor's courses" });
    }

    const title = String(req.body.title || session.title).trim();
    if (!title || title.length > 255) return res.status(400).json({ success: false, message: "A lesson title of up to 255 characters is required" });
    const order = req.body.order === undefined ? await CourseContent.count({ where: { courseId } }) : Number(req.body.order);
    if (!Number.isInteger(order) || order < 0) return res.status(400).json({ success: false, message: "Lesson order must be zero or a positive whole number" });

    let youtubeVideoId = session.youtubeVideoId || null;
    let url = youtubeVideoId ? recordingEmbedUrl(youtubeVideoId) : null;
    if (!url) {
      const downloaded = await provider.downloadRecording(session.id);
      importedFilePath = downloaded.filePath;
      const youtubeUrl = await youtubeUploader.uploadVideo(
        importedFilePath,
        `${title} - Live session recording #${session.id}`,
        session.description || `Recording of UniHub live session: ${session.title}`,
      );
      youtubeVideoId = youtubeUrl.includes("watch?v=") ? youtubeUrl.split("watch?v=")[1]?.split("&")[0] : youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
      if (!youtubeVideoId) throw new Error("YouTube did not return a video ID for the recording import");
      url = recordingEmbedUrl(youtubeVideoId);
    }

    const content = await CourseContent.create({
      courseId, title, type: "video", url, youtubeVideoId,
      duration: recordingDuration(session), order,
      isPreview: req.body.isPreview === true || req.body.isPreview === "true",
    });
    await recordQualifyingVideoActivity(course, content);
    await syncCourseDuration(course.id);
    await provider.event(session.id, req.user.id, "recording.added_to_course", { courseId, contentId: content.id });
    res.status(201).json({ success: true, message: "Recording uploaded to the course as a video lesson", data: { content } });
  } catch (error) { next(error); }
  finally {
    if (importedFilePath) {
      try { fs.unlinkSync(importedFilePath); } catch {}
    }
  }
}

async function getMeetingIdentity(req, res, next) {
  try {
    const identity = await provider.getIdentityStatus(req.user, { asStudent: req.query.audience === "student" });
    res.json({ success: true, data: { identity: identity ? { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl, lastSyncedAt: identity.lastSyncedAt, lastError: identity.lastError } : null } });
  } catch (error) { next(error); }
}

async function setMeetingIdentity(req, res, next) {
  try {
    const identity = await provider.ensureIdentity(req.user, req.body.teamsEmail, {
      resend: req.body.resend === true,
      asStudent: req.body.audience === "student",
    });
    res.json({ success: true, message: "Microsoft Teams invitation sent", data: { identity: { email: identity.email, invitationStatus: identity.invitationStatus, invitationRedeemUrl: identity.invitationRedeemUrl } } });
  } catch (error) { next(error); }
}

module.exports = { createLiveSession, getLiveSessions, getMyLiveSessions, getLiveSession, getLiveSessionReferralLink, getLiveSessionReferralInvite, updateLiveSession, cancelLiveSession, startLiveSession, endLiveSession, updateRecording, addRecordingToCourse, getMeetingIdentity, setMeetingIdentity };
