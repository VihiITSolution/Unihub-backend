require("dotenv").config();
const {
  User,
  StudentProfile,
  TutorProfile,
  VendorProfile,
} = require("./src/models");

const updateUserName = async () => {
  try {
    console.log("🔍 Searching for user: Gayan Pathirage...\n");

    // Find user by name
    const users = await User.findAll({
      where: {
        firstName: "Gayan",
        lastName: "Pathirage",
      },
    });

    if (users.length === 0) {
      console.log('❌ No user found with name "Gayan Pathirage"');
      process.exit(0);
    }

    console.log(`✓ Found ${users.length} user(s) named "Gayan Pathirage"\n`);

    // Update each user
    for (const user of users) {
      console.log(`Updating user ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Current Name: ${user.firstName} ${user.lastName}`);

      // Update the User table
      await user.update({
        firstName: "Mithun",
        lastName: "Dissanayake",
      });
      console.log(`  ✓ User name updated\n`);

      // Update StudentProfile if exists
      const studentProfile = await StudentProfile.findOne({
        where: { userId: user.id },
      });
      if (studentProfile) {
        await studentProfile.update({
          firstName: "Mithun",
          lastName: "Dissanayake",
        });
        console.log(`  ✓ Student profile updated\n`);
      }

      // Update TutorProfile if exists
      const tutorProfile = await TutorProfile.findOne({
        where: { userId: user.id },
      });
      if (tutorProfile) {
        await tutorProfile.update({
          firstName: "Mithun",
          lastName: "Dissanayake",
        });
        console.log(`  ✓ Tutor profile updated\n`);
      }

      // Update VendorProfile if exists
      const vendorProfile = await VendorProfile.findOne({
        where: { userId: user.id },
      });
      if (vendorProfile) {
        await vendorProfile.update({
          firstName: "Mithun",
          lastName: "Dissanayake",
        });
        console.log(`  ✓ Vendor profile updated\n`);
      }
    }

    console.log("✅ All updates completed successfully!");
    console.log("\nUpdates made:");
    console.log(`  • User profiles: ${users.length}`);
    console.log(`  • Name changed from: Gayan Pathirage`);
    console.log(`  • Name changed to: Mithun Dissanayake`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating user name:", error);
    process.exit(1);
  }
};

updateUserName();
