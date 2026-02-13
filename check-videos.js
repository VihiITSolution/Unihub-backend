require("dotenv").config();
const { CourseContent } = require("./src/models");

async function checkVideoContent() {
  try {
    console.log("Checking video content in database...\n");

    const videos = await CourseContent.findAll({
      where: { type: "video" },
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    console.log(`=== Found ${videos.length} Video(s) ===\n`);

    videos.forEach((video, index) => {
      console.log(`Video #${index + 1}:`);
      console.log(`  ID: ${video.id}`);
      console.log(`  Title: ${video.title}`);
      console.log(`  URL: ${video.url}`);
      console.log(`  YouTube Video ID: ${video.youtubeVideoId || "N/A"}`);
      console.log(`  Course ID: ${video.courseId}`);
      console.log(`  Created: ${video.createdAt}`);
      console.log("---\n");
    });

    if (videos.length === 0) {
      console.log("⚠️  No video content found in database.");
      console.log("Try uploading a video as course material first.\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkVideoContent();
