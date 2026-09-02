const test = require("node:test");
const assert = require("node:assert/strict");
const { conflictsWithBuffer } = require("../src/utils/liveSessionSchedule");
const { publicSession, ownerSession } = require("../src/utils/liveSessionPresentation");

test("15-minute organizer boundary is allowed exactly at the boundary", () => {
  const firstStart = "2026-09-10T08:00:00.000Z";
  const firstEnd = "2026-09-10T09:00:00.000Z";
  assert.equal(conflictsWithBuffer("2026-09-10T09:15:00.000Z", "2026-09-10T10:00:00.000Z", firstStart, firstEnd, 15), false);
  assert.equal(conflictsWithBuffer("2026-09-10T09:14:59.000Z", "2026-09-10T10:00:00.000Z", firstStart, firstEnd, 15), true);
});

test("overlapping and containment schedules conflict", () => {
  assert.equal(conflictsWithBuffer("2026-09-10T08:30:00Z", "2026-09-10T09:30:00Z", "2026-09-10T08:00:00Z", "2026-09-10T10:00:00Z"), true);
  assert.equal(conflictsWithBuffer("2026-09-10T07:00:00Z", "2026-09-10T11:00:00Z", "2026-09-10T08:00:00Z", "2026-09-10T10:00:00Z"), true);
});

test("public Teams session serialization never exposes provider credentials or join metadata", () => {
  const value = publicSession({
    id: 5,
    provider: "teams",
    youtubeBroadcastId: "broadcast",
    youtubeStreamKey: "secret",
    streamUrl: "rtmp://secret",
    approvedBy: 9,
    rejectionReason: "private",
    meeting: { joinUrl: "https://teams.example/join", lastError: "private error" },
    enrollments: [{ studentId: 1 }],
  });
  assert.equal(value.youtubeStreamKey, undefined);
  assert.equal(value.streamUrl, undefined);
  assert.equal(value.meeting, undefined);
  assert.equal(value.enrollments, undefined);
  assert.equal(JSON.stringify(value).includes("teams.example"), false);
});

test("owner Teams serialization exposes state but not the join URL", () => {
  const value = ownerSession({
    provider: "teams",
    meeting: { syncStatus: "ready", joinUrl: "https://teams.example/join", recordingWebUrl: null, lastError: null },
  });
  assert.deepEqual(value.meeting, { syncStatus: "ready", hasJoinUrl: true, hasRecording: false, lastSyncedAt: undefined, lastError: null });
  assert.equal(JSON.stringify(value).includes("teams.example"), false);
});
