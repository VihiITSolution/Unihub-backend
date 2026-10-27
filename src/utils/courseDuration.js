function parseCourseDuration(hoursInput, minutesInput, existing = {}) {
  if (hoursInput === undefined && minutesInput === undefined) return undefined;

  const hours = hoursInput === undefined ? Number(existing.duration || 0) : Number(hoursInput);
  const minutes = minutesInput === undefined ? Number(existing.durationMinutes || 0) : Number(minutesInput);
  if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

module.exports = { parseCourseDuration };
