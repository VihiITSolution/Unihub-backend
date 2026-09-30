const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCourseDuration } = require("../src/utils/courseDuration");

test("course duration accepts a short course with zero hours", () => {
  assert.deepEqual(parseCourseDuration("0", "15"), { hours: 0, minutes: 15 });
  assert.deepEqual(parseCourseDuration("1", "30"), { hours: 1, minutes: 30 });
});

test("course duration preserves existing minutes when only hours are updated", () => {
  assert.deepEqual(parseCourseDuration("2", undefined, { duration: 1, durationMinutes: 20 }), { hours: 2, minutes: 20 });
});

test("course duration rejects zero length and invalid minutes", () => {
  assert.equal(parseCourseDuration("0", "0"), null);
  assert.equal(parseCourseDuration("0", "60"), null);
  assert.equal(parseCourseDuration("1.5", "0"), null);
});
