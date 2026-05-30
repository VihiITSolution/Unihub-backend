require("dotenv").config();
const { sequelize, Course, Review } = require("./src/models");

const COURSES_TO_KEEP = [
  "Mathematics for Computing",
  "Introduction to Containerization",
  "Introduction to World of CICD",
  "CN(Computer Networking)",
];

async function manageUpcomingCourses() {
  try {
    await sequelize.authenticate();
    console.log("✓ Database connection established");

    // 1. Find the courses to keep
    const coursesToKeep = await Course.findAll({
      where: {
        title: COURSES_TO_KEEP,
      },
    });

    console.log(`\n📚 Found ${coursesToKeep.length} courses to keep:`);
    coursesToKeep.forEach((course) => {
      console.log(`  - ${course.title} (ID: ${course.id})`);
    });

    const keepIds = coursesToKeep.map((c) => c.id);

    // 2. Find and delete all reviews for courses NOT in the keep list
    const reviewsToDelete = await Review.findAll({
      include: [
        {
          model: Course,
          as: "course",
          where: {
            id: {
              [sequelize.Sequelize.Op.notIn]: keepIds,
            },
          },
          attributes: ["id", "title"],
        },
      ],
    });

    console.log(
      `\n🗑️  Deleting ${reviewsToDelete.length} reviews from courses not being kept...`,
    );
    if (reviewsToDelete.length > 0) {
      await Review.destroy({
        where: {
          courseId: {
            [sequelize.Sequelize.Op.notIn]: keepIds,
          },
        },
      });
      console.log("✓ All reviews deleted");
    }

    // 3. Delete all courses NOT in the keep list
    const coursesToDelete = await Course.findAll({
      where: {
        id: {
          [sequelize.Sequelize.Op.notIn]: keepIds,
        },
      },
    });

    console.log(`\n🗑️  Deleting ${coursesToDelete.length} courses...`);
    coursesToDelete.forEach((course) => {
      console.log(`  - Deleting: ${course.title} (ID: ${course.id})`);
    });

    if (coursesToDelete.length > 0) {
      await Course.destroy({
        where: {
          id: {
            [sequelize.Sequelize.Op.notIn]: keepIds,
          },
        },
      });
      console.log("✓ All unwanted courses deleted");
    }

    // 4. Update the 4 courses to mark as upcoming and reset reviews/ratings
    console.log(
      `\n⬆️  Updating ${coursesToKeep.length} courses as UPCOMING...`,
    );

    for (const course of coursesToKeep) {
      await course.update({
        isUpcoming: true,
        price: 0.0, // Ensure they're free
        rating: 0,
        reviewCount: 0,
      });
      console.log(`  ✓ ${course.title} - marked as upcoming (FREE)`);
    }

    // 5. Summary
    const finalCourses = await Course.findAll();
    console.log(`\n✅ FINAL STATUS:`);
    console.log(`   Total courses in database: ${finalCourses.length}`);
    console.log(
      `   Upcoming courses: ${finalCourses.filter((c) => c.isUpcoming).length}`,
    );

    console.log(`\n✅ All updates completed successfully!`);
    console.log(`\n📋 Upcoming Courses Available for Enrollment:`);
    finalCourses.forEach((course) => {
      console.log(
        `   • ${course.title} (ID: ${course.id}) - Price: FREE - Status: UPCOMING`,
      );
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

manageUpcomingCourses();
