const { CourseNotifyRequest, Course } = require("../models");

// POST /api/courses/:id/notify  — toggle: subscribe if not already, unsubscribe if already subscribed
const toggleNotify = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const userId = req.user.id;

    const course = await Course.findByPk(courseId, { attributes: ["id", "isUpcoming"] });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    if (!course.isUpcoming) {
      return res.status(400).json({ success: false, message: "Course is already available for enrollment" });
    }

    const existing = await CourseNotifyRequest.findOne({ where: { userId, courseId } });

    if (existing) {
      await existing.destroy();
      return res.json({ success: true, subscribed: false, message: "Notification request removed" });
    }

    await CourseNotifyRequest.create({ userId, courseId });
    return res.json({ success: true, subscribed: true, message: "You'll be notified when this course launches" });
  } catch (err) {
    console.error("toggleNotify error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/courses/:id/notify  — check if the current user has subscribed
const getNotifyStatus = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const userId = req.user.id;

    const existing = await CourseNotifyRequest.findOne({ where: { userId, courseId } });
    res.json({ success: true, subscribed: !!existing });
  } catch (err) {
    console.error("getNotifyStatus error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { toggleNotify, getNotifyStatus };
