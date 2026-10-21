const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const uploader = require("../src/config/youtube");
const emails = require("../src/services/approvalEmail.service");
const affiliate = require("../src/services/affiliate.service");

function controller(t, name) {
  const filename = require.resolve(`../src/controllers/${name}`);
  delete require.cache[filename];
  t.after(() => { delete require.cache[filename]; });
  return require(filename);
}

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

const unexpected = (error) => { throw error; };
const user = { id: 7, firstName: "Test", lastName: "Tutor", roles: ["tutor"] };
const signed = { id: 11, userId: 7, signatoryName: "Test Tutor", acceptedAt: new Date(), agreementVersion: "test", agreementText: "Retained text" };

test("unsigned tutor's first direct video upload requires the one-time declaration", async (t) => {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => null);
  const upload = t.mock.method(uploader, "uploadVideo", async () => { throw new Error("must not upload"); });
  const create = t.mock.method(models.CourseContent, "create", async () => { throw new Error("must not save"); });
  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent({ user, params: { courseId: 5 }, body: { title: "Lesson", type: "video" }, file: { path: "not-a-real-file" } }, res, unexpected);
  assert.equal(res.code, 428);
  assert.equal(res.body.code, "YOUTUBE_RIGHTS_DECLARATION_REQUIRED");
  assert.equal(upload.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});

test("signed tutor can directly upload without repeating per-video YouTube confirmation", async (t) => {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => signed);
  t.mock.method(uploader, "uploadVideo", async () => "https://youtu.be/abcdefghijk");
  t.mock.method(models.CourseContent, "create", async (value) => ({ id: 9, ...value }));
  t.mock.method(affiliate, "recordQualifyingVideoActivity", async () => null);
  t.mock.method(console, "log", () => {});
  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent({ user, params: { courseId: 5 }, body: { title: "Lesson", type: "video" }, file: { path: "not-a-real-file" } }, res, unexpected);
  assert.equal(res.code, 201);
  // Do not misclassify a direct upload as an external YouTube link during review.
  assert.equal(res.body.data.content.youtubeRightsDeclarationId, null);
});

for (const hasDeclaration of [false, true]) {
  test(`external YouTube links ${hasDeclaration ? "reuse a saved declaration" : "require a signed declaration"}`, async (t) => {
    t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
    t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => hasDeclaration ? signed : null);
    t.mock.method(models.CourseContent, "create", async (value) => ({ id: 9, ...value }));
    t.mock.method(affiliate, "recordQualifyingVideoActivity", async () => null);
    const { addCourseContent } = controller(t, "courseContentController");
    const res = response();
    await addCourseContent({ user, params: { courseId: 5 }, body: { title: "Lesson", type: "video", url: "https://youtu.be/abcdefghijk", youtubeRightsConfirmed: true } }, res, unexpected);
    assert.equal(res.code, hasDeclaration ? 201 : 428);
    if (hasDeclaration) assert.equal(res.body.data.content.youtubeRightsDeclarationId, signed.id);
  });
}

test("PDF materials do not require a video declaration", async (t) => {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => { throw new Error("PDF must not check declaration"); });
  t.mock.method(models.CourseContent, "create", async (value) => ({ id: 9, ...value }));
  t.mock.method(affiliate, "recordQualifyingVideoActivity", async () => null);
  const { addCourseContent } = controller(t, "courseContentController");
  const res = response();
  await addCourseContent({ user, params: { courseId: 5 }, body: { title: "Notes", type: "pdf", url: "https://example.com/notes.pdf" } }, res, unexpected);
  assert.equal(res.code, 201);
});

test("chunk completion cannot bypass the first-video declaration", async (t) => {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 7 }));
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => null);
  const upload = t.mock.method(uploader, "uploadVideo", async () => { throw new Error("must not upload"); });
  const { completeChunkedUpload } = controller(t, "chunkUploadController");
  const res = response();
  await completeChunkedUpload({ user, params: { courseId: 5 }, body: { uploadId: "test-only", totalChunks: 1, fileName: "video.mp4", title: "Lesson", type: "video" } }, res, unexpected);
  assert.equal(res.code, 428);
  assert.equal(upload.mock.callCount(), 0);
});

test("chunk completion rejects a tutor uploading to someone else's course", async (t) => {
  t.mock.method(models.Course, "findByPk", async () => ({ id: 5, tutorId: 99 }));
  const { completeChunkedUpload } = controller(t, "chunkUploadController");
  const res = response();
  await completeChunkedUpload({ user, params: { courseId: 5 }, body: { uploadId: "test-only", totalChunks: 1, fileName: "video.mp4", title: "Lesson", type: "video" } }, res, unexpected);
  assert.equal(res.code, 403);
});

test("existing direct-upload courses remain approvable without a declaration", async (t) => {
  const course = { id: 5, tutorId: 7, title: "Networks", approvalStatus: "pending", async save() {} };
  t.mock.method(models.Course, "findByPk", async () => course);
  t.mock.method(models.CourseContent, "findOne", async () => null);
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => { throw new Error("approval must not require declaration"); });
  t.mock.method(emails, "notifyApprovalByEmail", async () => false);
  t.mock.method(affiliate, "recordQualifyingVideoActivity", async () => null);
  const { approveCourse } = controller(t, "adminController");
  const res = response();
  await approveCourse({ user: { id: 1 }, params: { id: 5 } }, res, unexpected);
  assert.equal(res.code, 200);
  assert.equal(course.approvalStatus, "approved");
  assert.equal(course.isPublished, true);
});

for (const declaration of [null, signed]) {
  test(`profile declaration status distinguishes ${declaration ? "completed" : "not completed"}`, async (t) => {
    t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => declaration);
    const { getMyYouTubeRightsDeclaration } = controller(t, "youtubeRightsDeclarationController");
    const res = response();
    await getMyYouTubeRightsDeclaration({ user }, res, unexpected);
    assert.equal(res.body.data.hasDeclaration, Boolean(declaration));
    assert.equal(res.body.data.declaration?.signatoryName ?? null, declaration?.signatoryName ?? null);
  });
}

test("an existing signature is reused rather than signed again", async (t) => {
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => signed);
  const create = t.mock.method(models.YouTubeRightsDeclaration, "create", async () => { throw new Error("must not duplicate signature"); });
  const { signYouTubeRightsDeclaration } = controller(t, "youtubeRightsDeclarationController");
  const res = response();
  await signYouTubeRightsDeclaration({ user, body: {} }, res, unexpected);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.declaration.id, signed.id);
  assert.equal(create.mock.callCount(), 0);
});

test("first signature requires explicit consent and the account holder's name", async (t) => {
  t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => null);
  const create = t.mock.method(models.YouTubeRightsDeclaration, "create", async (value) => ({ id: 11, ...value }));
  const { signYouTubeRightsDeclaration } = controller(t, "youtubeRightsDeclarationController");
  for (const body of [{ signatoryName: "Test Tutor", accepted: false }, { signatoryName: "Someone Else", accepted: true }]) {
    const res = response();
    await signYouTubeRightsDeclaration({ user, body }, res, unexpected);
    assert.equal(res.code, 400);
  }
  assert.equal(create.mock.callCount(), 0);
  const res = response();
  await signYouTubeRightsDeclaration({ user, body: { signatoryName: "Test Tutor", accepted: true }, ip: "127.0.0.1", get: () => "test-browser" }, res, unexpected);
  assert.equal(res.code, 201);
  const record = create.mock.calls[0].arguments[0];
  assert.equal(record.userId, user.id);
  assert.equal(record.acceptedIp, "127.0.0.1");
  assert.equal(record.acceptedUserAgent, "test-browser");
  assert.ok(record.acceptedAt instanceof Date);
});

for (const declaration of [null, signed]) {
  test(`admin tutor profile shows declaration ${declaration ? "completed" : "not completed"}`, async (t) => {
    t.mock.method(models.TutorProfile, "findByPk", async () => ({ userId: 7, toJSON: () => ({ id: 3, userId: 7 }) }));
    const lookup = t.mock.method(models.YouTubeRightsDeclaration, "findOne", async () => declaration);
    const { getTutorProfileDetails } = controller(t, "adminController");
    const res = response();
    await getTutorProfileDetails({ params: { id: 3 } }, res, unexpected);
    assert.equal(res.code, 200);
    assert.equal(Boolean(res.body.data.youtubeRightsDeclaration), Boolean(declaration));
    assert.deepEqual(lookup.mock.calls[0].arguments[0], {
      where: { userId: 7 }, attributes: ["id", "signatoryName", "acceptedAt", "agreementVersion"],
    });
  });
}
