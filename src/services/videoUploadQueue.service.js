const { Op } = require("sequelize");
const path = require("path");
const fs = require("fs");
const { sequelize, CourseContent, VideoUploadJob } = require("../models");
const youtubeUploader = require("../config/youtube");
const quota = require("./youtubeQuota.service");
const { getYouTubeVideoId, buildPrivacyEmbedUrl } = require("../utils/youtubeUrl");

const MAX_ATTEMPTS = Number(process.env.YOUTUBE_QUEUE_MAX_ATTEMPTS || 10);

const localUrlFor = (filePath) => `/uploads/videos/${path.basename(filePath)}`;

// Park a video until quota is available. The CourseContent row keeps serving
// the local file in the meantime, so the lesson is watchable; only the move to
// YouTube is deferred.
async function enqueue({ contentId, filePath, title, description = "" }, transaction = null) {
  const runAfter = quota.quotaAvailableAt() || quota.nextQuotaResetAt();

  const existing = await VideoUploadJob.findOne({
    where: { contentId, status: { [Op.in]: ["pending", "processing"] } },
    transaction,
  });
  if (existing) {
    await existing.update({ filePath, title, description, runAfter }, { transaction });
    return existing;
  }

  const job = await VideoUploadJob.create(
    { contentId, filePath, title, description, runAfter, status: "pending" },
    { transaction },
  );
  await CourseContent.update(
    { uploadStatus: "queued" },
    { where: { id: contentId }, transaction },
  );
  return job;
}

// Claims one due job. The UPDATE..WHERE status='pending' is the lock, so two
// workers cannot take the same row.
async function claimNextJob() {
  return sequelize.transaction(async (transaction) => {
    const job = await VideoUploadJob.findOne({
      where: { status: "pending", runAfter: { [Op.lte]: new Date() } },
      order: [["runAfter", "ASC"], ["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    });
    if (!job) return null;
    await job.update(
      { status: "processing", lockedAt: new Date(), attempts: job.attempts + 1 },
      { transaction },
    );
    return job;
  });
}

async function requeueForQuota(job, resetAt) {
  await job.update({
    status: "pending",
    lockedAt: null,
    runAfter: resetAt,
    lastError: "Waiting for the YouTube daily quota to reset.",
  });
  await CourseContent.update(
    { uploadStatus: "queued" },
    { where: { id: job.contentId } },
  );
}

async function failJob(job, message) {
  await job.update({ status: "failed", lockedAt: null, lastError: String(message).slice(0, 500) });
  await CourseContent.update(
    { uploadStatus: "failed" },
    { where: { id: job.contentId } },
  );
}

// Returns true when a job was picked up, so a caller can drain the queue.
async function processOneJob() {
  const waitingUntil = quota.quotaAvailableAt();
  if (waitingUntil) return false;

  const job = await claimNextJob();
  if (!job) return false;

  if (!fs.existsSync(job.filePath)) {
    await failJob(job, "The assembled video file is no longer on disk.");
    return true;
  }

  try {
    const url = await youtubeUploader.uploadVideo(job.filePath, job.title, job.description || "");

    // A local path back means the uploader fell through to local storage
    // rather than reaching YouTube; leave the job pending rather than
    // recording a success that did not happen.
    if (!url || url.startsWith("/uploads/")) {
      await requeueForQuota(job, quota.nextQuotaResetAt());
      return true;
    }

    // Store the same shape the immediate upload path stores: the privacy
    // embed URL, with the raw watch URL only as a fallback.
    const videoId = getYouTubeVideoId(url);
    await CourseContent.update(
      {
        url: buildPrivacyEmbedUrl(videoId) || url,
        uploadStatus: "ready",
        ...(videoId ? { youtubeVideoId: videoId } : {}),
      },
      { where: { id: job.contentId } },
    );
    await job.update({ status: "completed", lockedAt: null, lastError: null });

    fs.promises.unlink(job.filePath).catch(() => {});
    return true;
  } catch (error) {
    const kind = quota.classifyUploadError(error);

    if (kind === "quota") {
      const resetAt = quota.markQuotaExhausted();
      await requeueForQuota(job, resetAt);
      return true;
    }

    if (job.attempts >= MAX_ATTEMPTS) {
      await failJob(job, error.message || "YouTube upload failed");
      return true;
    }

    // Auth and unknown errors: back off, but stay in the queue. An operator
    // re-running the OAuth setup should not mean re-uploading by hand.
    const backoffMinutes = Math.min(60, 5 * job.attempts);
    await job.update({
      status: "pending",
      lockedAt: null,
      runAfter: new Date(Date.now() + backoffMinutes * 60_000),
      lastError: String(error.message || "YouTube upload failed").slice(0, 500),
    });
    return true;
  }
}

// Releases rows left in "processing" by a crash or a deploy mid-upload.
async function releaseStaleLocks(olderThanMinutes = 30) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const [count] = await VideoUploadJob.update(
    { status: "pending", lockedAt: null },
    { where: { status: "processing", lockedAt: { [Op.lt]: cutoff } } },
  );
  return count;
}

async function queueSummary() {
  const [pending, failed] = await Promise.all([
    VideoUploadJob.count({ where: { status: { [Op.in]: ["pending", "processing"] } } }),
    VideoUploadJob.count({ where: { status: "failed" } }),
  ]);
  const waitingUntil = quota.quotaAvailableAt();
  return {
    pending,
    failed,
    quotaExhausted: Boolean(waitingUntil),
    quotaResetsAt: waitingUntil,
  };
}

module.exports = {
  enqueue,
  processOneJob,
  releaseStaleLocks,
  queueSummary,
  localUrlFor,
  MAX_ATTEMPTS,
};
