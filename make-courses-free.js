require("dotenv").config();
const { Course } = require("./src/models");

const makeAllCoursesFree = async () => {
  try {
    console.log("🔍 Searching for all courses with pricing...\n");

    // Get all courses with prices
    const coursesWithPrice = await Course.findAll({
      where: {
        // Only get courses that have a price > 0
      },
      attributes: ["id", "title", "price"],
    });

    if (coursesWithPrice.length === 0) {
      console.log("❌ No courses found");
      process.exit(0);
    }

    console.log(`✓ Found ${coursesWithPrice.length} course(s)\n`);
    console.log("Courses before update:");
    console.log("─".repeat(70));

    let totalRevenueLost = 0;

    for (const course of coursesWithPrice) {
      if (course.price > 0) {
        console.log(`  ID: ${course.id}`);
        console.log(`  Title: ${course.title}`);
        console.log(
          `  Current Price: Rs. ${parseFloat(course.price).toFixed(2)}`,
        );
        totalRevenueLost += parseFloat(course.price);
        console.log("");
      }
    }

    console.log("─".repeat(70));
    console.log(
      `\n⏳ Updating all ${coursesWithPrice.length} courses to FREE...\n`,
    );

    // Update all courses to price 0
    await Course.update(
      { price: 0.0 },
      {
        where: {},
        // No specific condition = update all
      },
    );

    console.log("✅ All courses updated successfully!\n");
    console.log("Updates Summary:");
    console.log(`  • Total courses updated: ${coursesWithPrice.length}`);
    console.log(`  • Price changed to: Free (Rs. 0.00)`);
    console.log(
      `  • Previous total revenue: Rs. ${totalRevenueLost.toFixed(2)}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating courses:", error);
    process.exit(1);
  }
};

makeAllCoursesFree();
