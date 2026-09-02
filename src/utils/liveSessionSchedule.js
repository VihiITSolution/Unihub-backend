function conflictsWithBuffer(start, end, otherStart, otherEnd, bufferMinutes = 15) {
  const bufferMs = Number(bufferMinutes) * 60_000;
  const bufferedStart = new Date(start).getTime() - bufferMs;
  const bufferedEnd = new Date(end).getTime() + bufferMs;
  return new Date(otherStart).getTime() < bufferedEnd && new Date(otherEnd).getTime() > bufferedStart;
}

module.exports = { conflictsWithBuffer };
