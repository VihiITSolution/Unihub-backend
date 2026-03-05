/**
 * Quick script to check if notification system is ready
 * Run: node check-notification-setup.js
 */

require("dotenv").config();
const sequelize = require("./src/config/sequelize");
const { Notification, User } = require("./src/models");

async function checkNotificationSetup() {
  console.log("\n🔍 Checking Notification System Setup...\n");

  try {
    // 1. Check database connection
    console.log("1️⃣ Testing database connection...");
    await sequelize.authenticate();
    console.log("   ✅ Database connection successful\n");

    // 2. Check if notifications table exists
    console.log("2️⃣ Checking if notifications table exists...");
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'notifications';");

    if (tables.length === 0) {
      console.log("   ❌ 'notifications' table does NOT exist!");
      console.log(
        "   🔧 FIX: Run migration with: node src/migrations/create-notifications.js\n",
      );
      process.exit(1);
    }
    console.log("   ✅ 'notifications' table exists\n");

    // 3. Check table structure
    console.log("3️⃣ Checking table structure...");
    const [columns] = await sequelize.query("DESC notifications;");
    const requiredColumns = [
      "id",
      "user_id",
      "type",
      "title",
      "message",
      "is_read",
      "link",
      "metadata",
    ];

    let allColumnsExist = true;
    for (const col of requiredColumns) {
      const exists = columns.some((c) => c.Field === col);
      if (exists) {
        console.log(`   ✅ Column '${col}' exists`);
      } else {
        console.log(`   ❌ Column '${col}' is MISSING`);
        allColumnsExist = false;
      }
    }

    if (!allColumnsExist) {
      console.log("\n   🔧 FIX: Drop table and re-run migration\n");
      process.exit(1);
    }

    // 4. Test notification creation
    console.log("\n4️⃣ Testing notification creation...");
    const testUser = await User.findOne();

    if (!testUser) {
      console.log("   ⚠️  No users in database to test with");
      console.log("   ✅ But table structure is correct\n");
    } else {
      // Try to create a test notification
      const testNotif = await Notification.create({
        userId: testUser.id,
        type: "general",
        title: "Test Notification",
        message: "This is a test notification from setup check",
        link: "/test",
        metadata: { test: true },
      });

      console.log(
        `   ✅ Successfully created test notification (ID: ${testNotif.id})`,
      );

      // Clean up test notification
      await testNotif.destroy();
      console.log("   ✅ Test notification cleaned up\n");
    }

    // 5. Check if Notification model is properly exported
    console.log("5️⃣ Checking model exports...");
    const {
      createNotification,
    } = require("./src/controllers/notificationController");
    if (typeof createNotification === "function") {
      console.log("   ✅ createNotification helper is properly exported\n");
    } else {
      console.log("   ❌ createNotification helper is NOT exported\n");
      process.exit(1);
    }

    // Success!
    console.log("═══════════════════════════════════════");
    console.log("🎉 NOTIFICATION SYSTEM IS FULLY SET UP!");
    console.log("═══════════════════════════════════════\n");
    console.log("Next steps:");
    console.log("1. Restart your backend server");
    console.log("2. Clear browser cache");
    console.log("3. Test tutor approval flow");
    console.log("4. Check for notification in bell icon\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error("\nFull error:", error);

    if (error.message.includes("doesn't exist")) {
      console.log("\n🔧 FIX: Run the migration:");
      console.log("   node src/migrations/create-notifications.js\n");
    }

    process.exit(1);
  }
}

checkNotificationSetup();
