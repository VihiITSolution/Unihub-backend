const { User, TutorProfile, LiveSession, Review } = require("../models");

/**
 * Public platform stats for the home page (replaces the previously
 * hardcoded "Active Students / Tutors / Sessions / Ratings" numbers).
 */
const getPlatformStats = async (req, res, next) => {
  try {
    const [studentCount, tutorCount, sessionCount, ratingResult] =
      await Promise.all([
        User.count({ where: { primaryRole: "student", isActive: true } }),
        TutorProfile.count({ where: { approvalStatus: "approved" } }),
        LiveSession.count(),
        Review.findOne({
          attributes: [
            [
              Review.sequelize.fn("AVG", Review.sequelize.col("rating")),
              "averageRating",
            ],
            [
              Review.sequelize.fn("COUNT", Review.sequelize.col("rating")),
              "totalReviews",
            ],
          ],
          raw: true,
        }),
      ]);

    const averageRating = ratingResult?.averageRating
      ? Number(ratingResult.averageRating).toFixed(1)
      : null;

    res.status(200).json({
      success: true,
      data: {
        activeStudents: studentCount,
        tutors: tutorCount,
        sessions: sessionCount,
        averageRating,
        totalReviews: Number(ratingResult?.totalReviews || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPlatformStats };
