const queue = require("../services/videoUploadQueue.service");

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await queue.releaseStaleLocks();
    let processed = 0;
    // One upload at a time, and a small batch per tick: a video upload is slow
    // and quota is scarce, so there is nothing to gain from draining hard.
    while (processed < 3 && (await queue.processOneJob())) processed += 1;
  } catch (error) {
    console.error("Video upload worker error:", error.message);
  } finally {
    running = false;
  }
}

function startVideoUploadWorker() {
  if (process.env.YOUTUBE_QUEUE_WORKER_ENABLED === "false") return;
  // Quota resets once a day, so a slow poll is enough; the default is five
  // minutes rather than the live-session worker's fifteen seconds.
  const intervalMs = Math.max(30_000, Number(process.env.YOUTUBE_QUEUE_INTERVAL_MS || 300_000));
  timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  console.log("✓ YouTube upload queue worker started.");
}

function stopVideoUploadWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startVideoUploadWorker, stopVideoUploadWorker, tick };
