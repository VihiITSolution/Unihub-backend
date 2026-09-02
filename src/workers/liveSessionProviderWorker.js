const provider = require("../services/liveSessionProviderService");

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await provider.finalizeOverdueSessions();
    let processed = 0;
    while (processed < 10 && await provider.processOneJob()) processed += 1;
  } catch (error) {
    console.error("Live-session provider worker error:", error.message);
  } finally {
    running = false;
  }
}

function startLiveSessionProviderWorker() {
  if (process.env.TEAMS_LIVE_WORKER_ENABLED !== "true") return;
  const intervalMs = Math.max(5_000, Number(process.env.TEAMS_LIVE_WORKER_INTERVAL_MS || 15_000));
  timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  console.log("✓ Teams live-session provider worker started.");
}

function stopLiveSessionProviderWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startLiveSessionProviderWorker, stopLiveSessionProviderWorker, tick };
