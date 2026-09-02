function publicSession(session) {
  const value = typeof session.toJSON === "function" ? session.toJSON() : { ...session };
  delete value.youtubeBroadcastId;
  delete value.youtubeStreamKey;
  delete value.streamUrl;
  delete value.approvedBy;
  delete value.rejectionReason;
  delete value.providerSyncedAt;
  delete value.meeting;
  delete value.providerJobs;
  delete value.events;
  delete value.enrollments;
  return value;
}

function ownerSession(session) {
  const value = typeof session.toJSON === "function" ? session.toJSON() : { ...session };
  if (value.provider === "teams") {
    delete value.youtubeBroadcastId;
    delete value.youtubeStreamKey;
    delete value.streamUrl;
  }
  if (value.meeting) {
    value.meeting = {
      syncStatus: value.meeting.syncStatus,
      hasJoinUrl: Boolean(value.meeting.joinUrl),
      hasRecording: Boolean(value.meeting.recordingWebUrl),
      lastSyncedAt: value.meeting.lastSyncedAt,
      lastError: value.meeting.lastError,
    };
  }
  return value;
}

module.exports = { publicSession, ownerSession };
