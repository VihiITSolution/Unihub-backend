const test = require("node:test");
const assert = require("node:assert/strict");
const { pickSessionRecording, recordingNamePattern } = require("../src/utils/teamsRecordingMatch");

const video = (id, name, createdDateTime = "2026-11-11T05:00:00Z") => ({ id, name, createdDateTime, file: { mimeType: "video/mp4" } });

test("matches the name OneDrive actually saves, with # replaced by _", () => {
  const item = video("a", "[UniHub _28] MADD Theory Discussion 2-20261110_153222UTC-Meeting Recording.mp4");
  assert.equal(pickSessionRecording([item], 28)?.id, "a");
});

test("still matches the original # form", () => {
  assert.equal(recordingNamePattern(30).test("[UniHub #30] MADD - Kotlin Programming"), true);
});

test("never picks another session's recording", () => {
  const items = [
    video("s29", "[UniHub _29] MADD Theory Discussion 3-20261111_050041UTC-Meeting Recording.mp4"),
    video("s280", "[UniHub _280] Other.mp4"),
    video("s2", "[UniHub _2] Other.mp4"),
  ];
  assert.equal(pickSessionRecording(items, 28), null);
  assert.equal(pickSessionRecording(items, 29)?.id, "s29");
});

test("ignores non-video files such as transcripts and folders", () => {
  const items = [
    { id: "t", name: "[UniHub _30] Kotlin transcript.vtt", file: { mimeType: "text/vtt" } },
    { id: "f", name: "[UniHub _30] folder", folder: { childCount: 1 } },
  ];
  assert.equal(pickSessionRecording(items, 30), null);
});

test("prefers the newest recording and de-duplicates folder + search results", () => {
  const older = video("old", "[UniHub _30] Kotlin-1.mp4", "2026-11-11T05:00:00Z");
  const newer = video("new", "[UniHub _30] Kotlin-2.mp4", "2026-11-11T06:00:00Z");
  assert.equal(pickSessionRecording([older, newer, older], 30)?.id, "new");
});
