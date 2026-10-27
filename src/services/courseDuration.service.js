const { Course, CourseContent } = require("../models");

// Course duration is derived from lesson metadata so tutors do not have to
// maintain a second, manual total. Links/PDFs do not contribute a duration.
async function syncCourseDuration(courseId) {
  const lessons = await CourseContent.findAll({
    where: { courseId, type: "video", isPublished: true },
    attributes: ["duration"],
  });

  const totalMinutes = lessons.reduce((total, lesson) => {
    const minutes = Number(lesson.duration);
    return total + (Number.isInteger(minutes) && minutes > 0 ? minutes : 0);
  }, 0);

  await Course.update(
    {
      duration: totalMinutes ? Math.floor(totalMinutes / 60) : null,
      durationMinutes: totalMinutes % 60,
    },
    { where: { id: courseId } },
  );
}

module.exports = { syncCourseDuration };
