const { User, StudentProfile, TutorProfile } = require("../models");
const { createNotification, notifyActiveAdmins } = require("./notificationController");

/**
 * Get student profile for current user
 */
const getStudentProfile = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update student profile
 */
const upsertStudentProfile = async (req, res, next) => {
  try {
    const {
      universityName,
      department,
      degreeOrCourse,
      studyingArea,
      currentYear,
      currentSemester,
      studentIdNumber,
      currentAddress,
      phoneNumber,
      dateOfBirth,
    } = req.body;

    let profile = await StudentProfile.findOne({
      where: { userId: req.user.id },
    });

    if (profile) {
      // Update existing profile
      await profile.update({
        universityName,
        department,
        degreeOrCourse,
        studyingArea,
        currentYear,
        currentSemester,
        studentIdNumber,
        currentAddress,
        phoneNumber,
        dateOfBirth,
        isProfileComplete: true,
      });
    } else {
      // Create new profile
      profile = await StudentProfile.create({
        userId: req.user.id,
        universityName,
        department,
        degreeOrCourse,
        studyingArea,
        currentYear,
        currentSemester,
        studentIdNumber,
        currentAddress,
        phoneNumber,
        dateOfBirth,
        isProfileComplete: true,
      });
    }

    // Update user's profile completion status
    const user = await User.findByPk(req.user.id);
    user.isStudentProfileComplete = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Student profile saved successfully",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tutor profile for current user
 */
const getTutorProfile = async (req, res, next) => {
  try {
    const profile = await TutorProfile.findOne({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Apply to become a tutor (create tutor profile with pending status)
 */
const applyAsTutor = async (req, res, next) => {
  try {
    const {
      qualifications,
      graduationStatus,
      expertiseAreas,
      coursesSubjects,
      bio,
      yearsOfExperience,
      youtubeLink,
      blogLink,
      linkedinLink,
      remarks,
    } = req.body;

    // Check if user already has a tutor profile
    const existingProfile = await TutorProfile.findOne({
      where: { userId: req.user.id },
    });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Tutor application already exists",
        data: { applicationStatus: existingProfile.approvalStatus },
      });
    }

    // Create tutor profile with pending status
    const profile = await TutorProfile.create({
      userId: req.user.id,
      qualifications,
      graduationStatus,
      expertiseAreas: expertiseAreas || [],
      coursesSubjects: coursesSubjects || [],
      bio,
      yearsOfExperience: yearsOfExperience || 0,
      youtubeLink,
      blogLink,
      linkedinLink,
      remarks,
      isApproved: false,
      approvalStatus: "pending",
      isProfileComplete: true,
    });

    notifyActiveAdmins(
      "Tutor application awaiting review",
      "A new tutor application has been submitted and is ready for review.",
      "/tutors/pending",
      { tutorProfileId: profile.id, applicantUserId: req.user.id },
    ).catch((notificationError) => console.error("Failed to notify admins about tutor application:", notificationError.message));

    res.status(201).json({
      success: true,
      message:
        "Tutor application submitted successfully. Awaiting admin approval.",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update tutor profile
 */
const updateTutorProfile = async (req, res, next) => {
  try {
    const profile = await TutorProfile.findOne({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    const {
      qualifications,
      graduationStatus,
      expertiseAreas,
      coursesSubjects,
      bio,
      yearsOfExperience,
      youtubeLink,
      blogLink,
      linkedinLink,
      remarks,
    } = req.body;

    await profile.update({
      qualifications: qualifications || profile.qualifications,
      graduationStatus: graduationStatus || profile.graduationStatus,
      expertiseAreas: expertiseAreas || profile.expertiseAreas,
      coursesSubjects: coursesSubjects || profile.coursesSubjects,
      bio: bio || profile.bio,
      yearsOfExperience: yearsOfExperience ?? profile.yearsOfExperience,
      youtubeLink:
        youtubeLink !== undefined ? youtubeLink : profile.youtubeLink,
      blogLink: blogLink !== undefined ? blogLink : profile.blogLink,
      linkedinLink:
        linkedinLink !== undefined ? linkedinLink : profile.linkedinLink,
      remarks: remarks !== undefined ? remarks : profile.remarks,
    });

    res.status(200).json({
      success: true,
      message: "Tutor profile updated successfully",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all pending tutor applications
 */
const getPendingTutorApplications = async (req, res, next) => {
  try {
    const applications = await TutorProfile.findAll({
      where: { approvalStatus: "pending" },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "profileImage"],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: { applications },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Approve or reject tutor application
 */
const reviewTutorApplication = async (req, res, next) => {
  try {
    const { tutorProfileId } = req.params;
    const { action, rejectionReason } = req.body;

    const profile = await TutorProfile.findByPk(tutorProfileId, {
      include: [{ model: User, as: "user" }],
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    if (action === "approve") {
      await profile.update({
        isApproved: true,
        approvalStatus: "approved",
        approvedBy: req.user.id,
        approvedAt: new Date(),
      });

      // Add tutor role to user if not already present
      const user = profile.user || (await User.findByPk(profile.userId));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found for tutor profile",
        });
      }

      const currentRoles = Array.isArray(user.roles) ? user.roles : [];
      if (!currentRoles.includes("tutor")) {
        user.roles = [...currentRoles, "tutor"];
      }

      user.isTutorProfileComplete = true;
      if (user.primaryRole !== "tutor") {
        user.primaryRole = "tutor";
      }

      await user.save();

      // Create notification for user (don't let notification failure break the flow)
      try {
        await createNotification(
          user.id,
          "tutor_approved",
          "Tutor Application Approved! 🎉",
          "Congratulations! Your tutor application has been approved by UniHub. You can now start creating courses and sharing your knowledge with students.",
          "/tutor/my-profile",
          { approvedBy: req.user.id },
        );
        console.log("✅ Notification sent to user:", user.id);
      } catch (notifError) {
        console.error("❌ Failed to send notification:", notifError.message);
        // Don't throw - continue with success response
      }

      res.status(200).json({
        success: true,
        message: "Tutor application approved",
        data: { profile },
      });
    } else if (action === "reject") {
      await profile.update({
        isApproved: false,
        approvalStatus: "rejected",
        approvedBy: req.user.id,
        approvedAt: new Date(),
        rejectionReason:
          rejectionReason || "Application did not meet requirements",
      });

      // Create notification for user (don't let notification failure break the flow)
      try {
        await createNotification(
          profile.user.id,
          "tutor_rejected",
          "Tutor Application Update",
          `Unfortunately, your tutor application has been rejected. Reason: ${
            rejectionReason || "Application did not meet requirements"
          }. Please review our requirements and feel free to reapply in the future.`,
          "/student/become-tutor",
          { rejectionReason, rejectedBy: req.user.id },
        );
        console.log("✅ Notification sent to user:", profile.user.id);
      } catch (notifError) {
        console.error("❌ Failed to send notification:", notifError.message);
        // Don't throw - continue with success response
      }

      res.status(200).json({
        success: true,
        message: "Tutor application rejected",
        data: { profile },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject".',
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentProfile,
  upsertStudentProfile,
  getTutorProfile,
  applyAsTutor,
  updateTutorProfile,
  getPendingTutorApplications,
  reviewTutorApplication,
};
