const { Op } = require("sequelize");
const graph = require("./teamsGraphService");
const { downloadMicrosoftDriveItem } = require("./oneDriveImport.service");
const {
  sequelize, User, TutorProfile, LiveSession, SessionEnrollment, Notification,
  MeetingOrganizerAccount, LiveSessionMeeting, UserMeetingIdentity,
  LiveSessionProviderJob, LiveSessionEvent,
} = require("../models");

const enabled = () => process.env.TEAMS_LIVE_ENABLED === "true";
const sanitize = (error) => (error.safeMessage || error.message || "Provider operation failed").slice(0, 500);
const rolesOf = (user) => new Set([...(Array.isArray(user.roles) ? user.roles : []), user.primaryRole].filter(Boolean));

async function event(sessionId, actorUserId, type, metadata = null, transaction = null) {
  return LiveSessionEvent.create({ sessionId, actorUserId: actorUserId || null, type, metadata }, { transaction });
}

async function ensureIdentity(user, requestedEmail, { resend = false } = {}) {
  const isTutor = rolesOf(user).has("tutor");
  const email = String(isTutor ? requestedEmail : user.email).trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("A valid Microsoft account email is required");
  if (!isTutor && (!user.isVerified || email !== String(user.email).toLowerCase())) {
    throw new Error("Students must use their verified UniHub email for Microsoft Teams");
  }

  let identity = await UserMeetingIdentity.findOne({ where: { userId: user.id, provider: "teams" } });
  if (identity && identity.email !== email) {
    if (isTutor) {
      const activeApprovedSessions = await LiveSession.count({
        where: {
          tutorId: user.id, provider: "teams", approvalStatus: "approved",
          status: { [Op.in]: ["scheduled", "live"] },
        },
      });
      if (activeApprovedSessions > 0) throw new Error("Teams email cannot be changed while you have approved active sessions");
    }
    identity.email = email;
    identity.entraGuestId = null;
    identity.invitationStatus = "not_invited";
  }

  if (identity?.entraGuestId && !resend) {
    try {
      const guest = await graph.getGuest(identity.entraGuestId);
      identity.invitationStatus = guest.externalUserState === "Accepted" ? "accepted" : "pending";
      identity.lastSyncedAt = new Date();
      identity.lastError = null;
      await identity.save();
      return identity;
    } catch (error) {
      if (error.response?.status !== 404) throw error;
      identity.entraGuestId = null;
    }
  }

  const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || email;
  const invitation = await graph.inviteGuest(email, displayName);
  identity = identity || UserMeetingIdentity.build({ userId: user.id, provider: "teams", email });
  identity.email = email;
  identity.entraGuestId = invitation.invitedUser?.id || null;
  identity.invitationRedeemUrl = invitation.inviteRedeemUrl || null;
  identity.invitationStatus = "pending";
  identity.lastSyncedAt = new Date();
  identity.lastError = null;
  await identity.save();

  if (isTutor) await TutorProfile.update({ teamsEmail: email }, { where: { userId: user.id } });
  return identity;
}

async function getIdentityStatus(user) {
  const identity = await UserMeetingIdentity.findOne({ where: { userId: user.id, provider: "teams" } });
  if (!identity) return null;
  if (identity.entraGuestId) {
    try {
      const previousStatus = identity.invitationStatus;
      const guest = await graph.getGuest(identity.entraGuestId);
      const status = guest.externalUserState === "Accepted" ? "accepted" : "pending";
      if (identity.invitationStatus !== status) await identity.update({ invitationStatus: status, lastSyncedAt: new Date(), lastError: null });
      if (previousStatus !== "accepted" && status === "accepted") {
        const enrollments = await SessionEnrollment.findAll({ where: { studentId: user.id }, attributes: ["sessionId"] });
        const sessions = await LiveSession.findAll({
          where: {
            id: { [Op.in]: enrollments.map((item) => item.sessionId) },
            provider: "teams", approvalStatus: "approved",
            status: { [Op.in]: ["scheduled", "live"] },
          },
          attributes: ["id"],
        });
        for (const session of sessions) await enqueue(session.id, "attendee_sync");
      }
    } catch (error) {
      await identity.update({ lastError: sanitize(error), lastSyncedAt: new Date() });
    }
  }
  return identity.reload();
}

async function seedOrganizer() {
  const email = process.env.TEAMS_ORGANIZER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const [organizer] = await MeetingOrganizerAccount.findOrCreate({
    where: { email },
    defaults: { entraUserId: process.env.TEAMS_ORGANIZER_USER_ID || null, enabled: true },
  });
  return organizer;
}

async function checkOrganizerHealth() {
  const organizer = await seedOrganizer();
  if (!organizer) return { configured: false, enabled: enabled(), healthy: false, message: "TEAMS_ORGANIZER_EMAIL is not configured" };
  try {
    const remote = await graph.getOrganizer(organizer.entraUserId || organizer.email);
    // A mailbox/calendar is required to create a Teams meeting. OneDrive is
    // only required later when we import or share a recording. A new Microsoft
    // user can have a valid mailbox before their personal OneDrive site exists,
    // so do not reject an otherwise valid session approval for that condition.
    let quota = null;
    let storageWarning = null;
    try {
      quota = await graph.getDriveQuota(organizer.entraUserId || organizer.email);
    } catch (error) {
      storageWarning = sanitize(error);
    }
    await organizer.update({ entraUserId: remote.id, healthStatus: "healthy", lastHealthCheckAt: new Date(), healthMessage: null });
    return {
      configured: graph.configured(), enabled: enabled(), healthy: true,
      organizerEmail: organizer.email, quota,
      recordingStorageAvailable: !storageWarning,
      storageWarning,
    };
  } catch (error) {
    const message = sanitize(error);
    await organizer.update({ healthStatus: "unhealthy", lastHealthCheckAt: new Date(), healthMessage: message });
    return { configured: graph.configured(), enabled: enabled(), healthy: false, organizerEmail: organizer.email, message };
  }
}

async function assertNoConflict(startTime, endTime, excludeSessionId, transaction) {
  const bufferMinutes = Number(process.env.TEAMS_SESSION_BUFFER_MINUTES || 15);
  const bufferedStart = new Date(new Date(startTime).getTime() - bufferMinutes * 60_000);
  const bufferedEnd = new Date(new Date(endTime).getTime() + bufferMinutes * 60_000);
  const conflict = await LiveSession.findOne({
    where: {
      id: excludeSessionId ? { [Op.ne]: excludeSessionId } : { [Op.ne]: 0 },
      provider: "teams",
      approvalStatus: "approved",
      status: { [Op.notIn]: ["cancelled", "ended", "recorded"] },
      scheduledStartTime: { [Op.lt]: bufferedEnd },
      scheduledEndTime: { [Op.gt]: bufferedStart },
    },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (conflict) {
    const error = new Error(`Organizer conflict with session #${conflict.id}; a ${bufferMinutes}-minute buffer is required`);
    error.statusCode = 409;
    error.conflictSessionId = conflict.id;
    throw error;
  }
  return null;
}

async function attendeesFor(session) {
  const tutor = await User.findByPk(session.tutorId);
  const tutorIdentity = await UserMeetingIdentity.findOne({ where: { userId: session.tutorId, provider: "teams" } });
  if (!tutorIdentity || tutorIdentity.invitationStatus !== "accepted") throw new Error("Tutor must accept the Microsoft Teams invitation before approval");
  const enrollments = await SessionEnrollment.findAll({
    where: { sessionId: session.id, paymentStatus: "completed" },
    include: [{ model: User, as: "student", attributes: ["id", "firstName", "lastName", "email"] }],
  });
  const identities = await UserMeetingIdentity.findAll({ where: { userId: { [Op.in]: enrollments.map((e) => e.studentId) }, provider: "teams", invitationStatus: "accepted" } });
  const identityMap = new Map(identities.map((item) => [item.userId, item]));
  const attendees = [{ email: tutorIdentity.email, name: `${tutor.firstName} ${tutor.lastName}`, presenter: true }];
  for (const enrollment of enrollments) {
    const identity = identityMap.get(enrollment.studentId);
    if (identity) attendees.push({ email: identity.email, name: `${enrollment.student.firstName} ${enrollment.student.lastName}` });
  }
  return { attendees, tutorIdentity: { ...tutorIdentity.get(), name: `${tutor.firstName} ${tutor.lastName}` } };
}

async function provision(sessionId) {
  const session = await LiveSession.findByPk(sessionId);
  if (
    !session ||
    session.provider !== "teams" ||
    session.approvalStatus !== "approved" ||
    session.status !== "scheduled"
  ) return;
  if (!enabled()) throw new Error("Teams live sessions are disabled");
  const organizer = await seedOrganizer();
  if (!organizer?.enabled) throw new Error("No enabled Teams organizer account is configured");
  await session.update({ providerStatus: "provisioning" });
  let meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  meeting = meeting || await LiveSessionMeeting.create({ sessionId, organizerAccountId: organizer.id, syncStatus: "syncing" });
  try {
    const { attendees, tutorIdentity } = await attendeesFor(session);
    const organizerRef = organizer.entraUserId || organizer.email;

    // The Teams meeting is created first and owns the join URL. The calendar
    // event is then built around it, so a tenant policy that blocks implicit
    // meeting creation on events can no longer leave a session without a link.
    let onlineMeeting = meeting.teamsMeetingId
      ? await graph.getOnlineMeeting(organizerRef, meeting.teamsMeetingId)
      : await graph.createOnlineMeeting(organizerRef, session);
    if (!onlineMeeting?.id || !onlineMeeting.joinWebUrl) {
      throw new Error("Teams did not return a join URL for the online meeting");
    }
    await meeting.update({ teamsMeetingId: onlineMeeting.id, joinUrl: onlineMeeting.joinWebUrl });

    onlineMeeting = await graph.configureOnlineMeeting(organizerRef, onlineMeeting.id, tutorIdentity, session.allowRecording);
    const joinUrl = onlineMeeting.joinWebUrl || meeting.joinUrl;

    if (meeting.outlookEventId) {
      await graph.updateCalendarMeeting(organizerRef, meeting.outlookEventId, session, attendees, joinUrl);
    } else {
      const remoteEvent = await graph.createCalendarMeeting(organizerRef, session, attendees, joinUrl);
      await meeting.update({ outlookEventId: remoteEvent.id });
    }

    await meeting.update({
      meetingOptionsUrl: onlineMeeting.joinInformation?.contentUrl || null,
      joinUrl,
      syncStatus: "ready", lastError: null, lastSyncedAt: new Date(),
    });
    await session.update({ providerStatus: "ready", providerSyncedAt: new Date() });
    await event(session.id, null, "provider.ready");
  } catch (error) {
    await meeting.update({ syncStatus: "failed", lastError: sanitize(error), lastSyncedAt: new Date() });
    await session.update({ providerStatus: "failed" });
    await event(session.id, null, "provider.failed", { message: sanitize(error) });
    throw error;
  }
}

async function syncAttendees(sessionId) {
  const session = await LiveSession.findByPk(sessionId);
  const meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  if (!session || !meeting?.outlookEventId) return;
  const organizer = await MeetingOrganizerAccount.findByPk(meeting.organizerAccountId);
  const { attendees } = await attendeesFor(session);
  await graph.updateCalendarMeeting(organizer.entraUserId || organizer.email, meeting.outlookEventId, session, attendees, meeting.joinUrl);
  await meeting.update({ syncStatus: "ready", lastError: null, lastSyncedAt: new Date() });
  await session.update({ providerStatus: "ready", providerSyncedAt: new Date() });
  await event(session.id, null, "provider.attendees_synced", { count: attendees.length });
}

async function cancelMeeting(sessionId) {
  const meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  if (!meeting?.outlookEventId || meeting.syncStatus === "cancelled") return;
  const organizer = await MeetingOrganizerAccount.findByPk(meeting.organizerAccountId);
  try { await graph.cancelCalendarMeeting(organizer.entraUserId || organizer.email, meeting.outlookEventId); }
  catch (error) { if (error.response?.status !== 404) throw error; }
  await meeting.update({ syncStatus: "cancelled", lastSyncedAt: new Date(), lastError: null });
}

function attendanceEmail(record) {
  return String(record.emailAddress || record.identity?.user?.email || record.identity?.user?.displayName || "").trim().toLowerCase();
}

async function syncArtifacts(sessionId) {
  const session = await LiveSession.findByPk(sessionId);
  const meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  if (!session || !meeting?.teamsMeetingId) throw new Error("Teams meeting metadata is unavailable");
  const organizer = await MeetingOrganizerAccount.findByPk(meeting.organizerAccountId);
  const organizerRef = organizer.entraUserId || organizer.email;
  const records = await graph.listAttendanceReports(organizerRef, meeting.teamsMeetingId);
  const identities = await UserMeetingIdentity.findAll({ where: { provider: "teams" } });
  const byEmail = new Map(identities.map((identity) => [identity.email.toLowerCase(), identity]));
  let attendedCount = 0;
  for (const record of records) {
    const identity = byEmail.get(attendanceEmail(record));
    if (!identity) continue;
    const enrollment = await SessionEnrollment.findOne({ where: { sessionId, studentId: identity.userId } });
    if (!enrollment) continue;
    const intervals = (record.attendanceIntervals || []).map((item) => ({ joinDateTime: item.joinDateTime, leaveDateTime: item.leaveDateTime, durationInSeconds: item.durationInSeconds }));
    const seconds = intervals.reduce((sum, item) => sum + Number(item.durationInSeconds || 0), 0);
    await enrollment.update({
      providerAttendeeId: record.id || null, attendanceIntervals: intervals,
      joinedAt: intervals[0]?.joinDateTime || enrollment.joinedAt,
      leftAt: intervals.at(-1)?.leaveDateTime || enrollment.leftAt,
      attendanceDuration: Math.ceil(seconds / 60), attended: seconds > 0,
      attendanceSource: "teams", attendanceSyncStatus: "synced",
    });
    if (seconds > 0) attendedCount += 1;
  }
  await session.update({ totalAttendees: attendedCount });

  const recordings = session.allowRecording ? await graph.listRecordings(organizerRef, meeting.teamsMeetingId) : [];
  if (recordings.length) {
    const driveItems = await graph.searchOrganizerDrive(organizerRef, `UniHub #${session.id}`);
    const item = driveItems.find((candidate) => candidate.file?.mimeType?.startsWith("video/")) || driveItems[0];
    if (item) {
      const enrollments = await SessionEnrollment.findAll({ where: { sessionId, paymentStatus: "completed" } });
      const enrolledIdentities = await UserMeetingIdentity.findAll({ where: { userId: { [Op.in]: enrollments.map((e) => e.studentId) }, invitationStatus: "accepted" } });
      await graph.shareDriveItem(organizerRef, item.id, enrolledIdentities.map((identity) => identity.email));
      await meeting.update({ recordingId: recordings[0].id, recordingDriveItemId: item.id, recordingWebUrl: item.webUrl, lastSyncedAt: new Date() });
      await session.update({ recordingUrl: item.webUrl, status: "recorded" });
    } else throw new Error("Teams recording exists but is not available in organizer OneDrive yet");
  } else if (session.allowRecording) {
    throw new Error("Teams recording is not available yet");
  }
  await event(session.id, null, "provider.artifacts_synced", { attendedCount, recordingFound: Boolean(meeting.recordingDriveItemId) });
}

async function removeRecording(sessionId, actorUserId) {
  const meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  if (!meeting?.recordingDriveItemId) throw new Error("No recording is available");
  const organizer = await MeetingOrganizerAccount.findByPk(meeting.organizerAccountId);
  try {
    await graph.deleteDriveItem(organizer.entraUserId || organizer.email, meeting.recordingDriveItemId);
  } catch (error) {
    if (error.response?.status !== 404) throw error;
  }
  await meeting.update({ recordingId: null, recordingDriveItemId: null, recordingWebUrl: null });
  await LiveSession.update({ recordingUrl: null, status: "ended" }, { where: { id: sessionId } });
  await event(sessionId, actorUserId, "recording.deleted");
}

async function downloadRecording(sessionId) {
  const meeting = await LiveSessionMeeting.findOne({ where: { sessionId } });
  if (!meeting?.recordingDriveItemId) {
    const error = new Error("The recording is not ready to import yet");
    error.statusCode = 409;
    throw error;
  }
  const organizer = await MeetingOrganizerAccount.findByPk(meeting.organizerAccountId);
  if (!organizer) {
    const error = new Error("The Teams organizer for this recording is unavailable");
    error.statusCode = 409;
    throw error;
  }
  return downloadMicrosoftDriveItem(
    organizer.entraUserId || organizer.email,
    meeting.recordingDriveItemId,
    await graph.getAccessToken(),
  );
}

async function enqueue(sessionId, type, payload = null, uniqueSuffix = Date.now()) {
  const idempotencyKey = `${type}:${sessionId}:${uniqueSuffix}`;
  const [job] = await LiveSessionProviderJob.findOrCreate({ where: { idempotencyKey }, defaults: { sessionId, type, payload, runAfter: new Date() } });
  return job;
}

async function processOneJob() {
  await LiveSessionProviderJob.update(
    { status: "failed", lockedAt: null, runAfter: new Date() },
    { where: { status: "processing", lockedAt: { [Op.lt]: new Date(Date.now() - 10 * 60_000) } } },
  );
  const job = await sequelize.transaction(async (transaction) => {
    const candidate = await LiveSessionProviderJob.findOne({
      where: { status: { [Op.in]: ["pending", "failed"] }, runAfter: { [Op.lte]: new Date() }, attempts: { [Op.lt]: 8 } },
      order: [["runAfter", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true,
    });
    if (!candidate) return null;
    await candidate.update({ status: "processing", lockedAt: new Date(), attempts: candidate.attempts + 1 }, { transaction });
    return candidate;
  });
  if (!job) return false;
  try {
    if (job.type === "provision") await provision(job.sessionId);
    else if (job.type === "attendee_sync") await syncAttendees(job.sessionId);
    else if (job.type === "artifact_sync") await syncArtifacts(job.sessionId);
    else if (job.type === "cancel") await cancelMeeting(job.sessionId);
    await job.update({ status: "completed", lastError: null, lockedAt: null });
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
    await job.update({ status: "failed", lastError: sanitize(error), lockedAt: null, runAfter: new Date(Date.now() + delayMinutes * 60_000) });
  }
  return true;
}

async function finalizeOverdueSessions() {
  const sessions = await LiveSession.findAll({
    where: {
      provider: "teams", status: "live",
      scheduledEndTime: { [Op.lt]: new Date(Date.now() - 30 * 60_000) },
    },
    limit: 20,
  });
  for (const session of sessions) {
    await session.update({ status: "ended", actualEndTime: session.actualEndTime || new Date() });
    await event(session.id, null, "session.auto_finalized");
    await enqueue(session.id, "artifact_sync");
  }
  return sessions.length;
}

async function notifySessionUsers(sessionId, title, message) {
  const session = await LiveSession.findByPk(sessionId);
  const enrollments = await SessionEnrollment.findAll({ where: { sessionId }, attributes: ["studentId"] });
  const userIds = [...new Set([session?.tutorId, ...enrollments.map((item) => item.studentId)].filter(Boolean))];
  await Promise.all(userIds.map((userId) => Notification.create({ userId, type: "general", title, message, link: `/student/my-sessions`, metadata: { liveSessionId: sessionId } })));
}

module.exports = {
  enabled, ensureIdentity, getIdentityStatus, checkOrganizerHealth, assertNoConflict,
  event, enqueue, provision, syncAttendees, syncArtifacts, cancelMeeting, removeRecording, downloadRecording,
  processOneJob, finalizeOverdueSessions, notifySessionUsers,
};
