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

test("folder listing wins and a 403 from drive search does not break the lookup", async () => {
  const axios = require("axios");
  const graph = require("../src/services/teamsGraphService");
  process.env.TEAMS_TENANT_ID = "t"; process.env.TEAMS_CLIENT_ID = "c"; process.env.TEAMS_CLIENT_SECRET = "s";
  const originalAdapter = axios.defaults.adapter;
  const calls = [];
  const folder = [video("r28", "[UniHub _28] MADD Theory Discussion 2-20261110_153222UTC-Meeting Recording.mp4")];
  axios.defaults.adapter = async (config) => {
    const reply = (data, status = 200) => ({ data, status, statusText: "", headers: {}, config });
    if (config.url.includes("login.microsoftonline.com")) return reply({ access_token: "tok", expires_in: 3600 });
    calls.push(config.url);
    if (config.url.includes("/search(")) {
      const error = new Error("denied");
      error.response = reply({ error: { code: "accessDenied" } }, 403);
      throw error;
    }
    return reply({ value: folder });
  };
  try {
    const found = await graph.findSessionRecordingCandidates("org", 28);
    assert.equal(pickSessionRecording(found, 28)?.id, "r28");
    assert.equal(calls.some((url) => url.includes("/search(")), false);
    const none = await graph.findSessionRecordingCandidates("org", 31);
    assert.equal(pickSessionRecording(none, 31), null);
    assert.equal(calls.some((url) => url.includes("/search(")), true);
  } finally {
    axios.defaults.adapter = originalAdapter;
  }
});
