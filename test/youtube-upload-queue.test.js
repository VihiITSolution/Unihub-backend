const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const models = require("../src/models");
const uploader = require("../src/config/youtube");
const quota = require("../src/services/youtubeQuota.service");
const videoUploadQueue = require("../src/services/videoUploadQueue.service");
const affiliate = require("../src/services/affiliate.service");
const durations = require("../src/services/courseDuration.service");

function controller(t, name) {
  const filename = require.resolve(`../src/controllers/${name}`);
  delete require.cache[filename];
  t.after(() => { delete require.cache[filename]; });
  return require(filename);
}

function response() {
  return {
    code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const admin = { id: 1, firstName: "Site", lastName: "Admin", roles: ["admin"] };

const quotaError = () =>
  Object.assign(new Error("The request cannot be completed because you have exceeded your quota."), {
    code: 403,
    response: { status: 403, data: { error: { errors: [{ reason: "quotaExceeded" }] } } },
  });

function stubCommon(t, { onCreate }) {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
  t.mock.method(models.CourseContent, "create", async (values) => {
    onCreate(values);
    return { id: 42, ...values };
  });
  t.mock.method(affiliate, "recordQualifyingVideoActivity", async () => null);
  t.mock.method(durations, "syncCourseDuration", async () => null);
}

test("a quota rejection queues the video instead of discarding it", async (t) => {
  quota.resetQuotaState();
  t.after(() => quota.resetQuotaState());

  // The assembled file must survive: it is what the retry will upload.
  const tmp = path.join(fs.mkdtempSync("/tmp/uhq-"), "video-1.mp4");
  fs.writeFileSync(tmp, "stub");

  let created = null;
  stubCommon(t, { onCreate: (values) => { created = values; } });
  t.mock.method(uploader, "uploadVideo", async () => { throw quotaError(); });

  const enqueued = [];
  t.mock.method(videoUploadQueue, "enqueue", async (job) => { enqueued.push(job); return { id: 1 }; });

  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent(
    {
      user: admin,
      params: { courseId: 5 },
      file: { path: tmp, mimetype: "video/mp4" },
      body: { title: "Lesson", type: "video" },
    },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.code, 201, "the tutor's upload must not fail");
  assert.equal(created.uploadStatus, "queued");
  assert.match(created.url, /^\/uploads\/videos\//, "serve the local file meanwhile");
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].contentId, 42);
  assert.equal(enqueued[0].filePath, tmp);
  assert.ok(fs.existsSync(tmp), "the assembled file must be kept for the retry");
  assert.match(res.body.message, /quota/i);
  assert.ok(res.body.data.quotaResetsAt instanceof Date);

  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
});

test("once quota is known spent, no further upload call is made", async (t) => {
  quota.resetQuotaState();
  quota.markQuotaExhausted();
  t.after(() => quota.resetQuotaState());

  const tmp = path.join(fs.mkdtempSync("/tmp/uhq-"), "video-2.mp4");
  fs.writeFileSync(tmp, "stub");

  let created = null;
  stubCommon(t, { onCreate: (values) => { created = values; } });
  const upload = t.mock.method(uploader, "uploadVideo", async () => {
    throw new Error("must not call YouTube while quota is spent");
  });
  t.mock.method(videoUploadQueue, "enqueue", async () => ({ id: 2 }));

  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent(
    {
      user: admin,
      params: { courseId: 5 },
      file: { path: tmp, mimetype: "video/mp4" },
      body: { title: "Lesson", type: "video" },
    },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.code, 201);
  assert.equal(created.uploadStatus, "queued");
  assert.equal(upload.mock.callCount(), 0, "the API call is skipped entirely");

  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
});

test("a non-quota upload failure still reports an error", async (t) => {
  quota.resetQuotaState();
  t.after(() => quota.resetQuotaState());

  const tmp = path.join(fs.mkdtempSync("/tmp/uhq-"), "video-3.mp4");
  fs.writeFileSync(tmp, "stub");

  stubCommon(t, { onCreate: () => {} });
  t.mock.method(uploader, "uploadVideo", async () => {
    throw Object.assign(new Error("invalid_grant"), { code: 401 });
  });
  const enqueue = t.mock.method(videoUploadQueue, "enqueue", async () => ({ id: 3 }));

  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent(
    {
      user: admin,
      params: { courseId: 5 },
      file: { path: tmp, mimetype: "video/mp4" },
      body: { title: "Lesson", type: "video" },
    },
    res,
    (error) => { throw error; },
  );

  assert.equal(res.code, 500, "an auth failure is not a queueing situation");
  assert.equal(enqueue.mock.callCount(), 0);

  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
});
