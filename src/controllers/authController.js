const { sequelize, User, StudentProfile, TutorProfile, AdminAuditLog } = require("../models");
const { generateToken } = require("../utils/token");
const { sendPasswordResetCode } = require("../services/resend.service");
const { createChallenge, consumeVerifiedChallengeForDestination } = require("../services/verification.service");

/**
 * Register a new user with optional student profile
 */
const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      roles,
      primaryRole,
      phoneNumber,
      // Student profile fields
      studentProfile,
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Determine roles - default to student if not provided
    const userRoles = roles && roles.length > 0 ? roles : ["student"];
    const userPrimaryRole = primaryRole || userRoles[0];

    const user = await User.create({
      firstName,
      lastName,
      email,
      // Trim accidental leading/trailing whitespace (autofill/copy-paste)
      // so it never becomes part of the hashed password - kept consistent
      // with the same trim applied on login.
      password: password.trim(),
      roles: userRoles,
      primaryRole: userPrimaryRole,
      phoneNumber,
    });

    // If registering as student with profile data, create student profile
    if (userRoles.includes("student") && studentProfile) {
      await StudentProfile.create({
        userId: user.id,
        universityName: studentProfile.universityName,
        facultyId: studentProfile.facultyId || null,
        customUniversity: studentProfile.customUniversity || null,
        customFaculty: studentProfile.customFaculty || null,
        customDepartment: studentProfile.customDepartment || null,
        department: studentProfile.department,
        degreeOrCourse: studentProfile.degreeOrCourse,
        studyingArea: studentProfile.studyingArea,
        currentYear: studentProfile.currentYear,
        currentSemester: studentProfile.currentSemester,
        studentIdNumber: studentProfile.studentIdNumber,
        currentAddress: studentProfile.currentAddress,
        phoneNumber: studentProfile.phoneNumber || phoneNumber,
        dateOfBirth: studentProfile.dateOfBirth,
        isProfileComplete: true,
      });
      user.isStudentProfileComplete = true;
      await user.save();
    }

    const token = generateToken(user.id);

    // Reload user with profile
    const userWithProfile = await User.findByPk(user.id, {
      include: [{ model: StudentProfile, as: "studentProfile" }],
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: userWithProfile,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [
        { model: StudentProfile, as: "studentProfile" },
        { model: TutorProfile, as: "tutorProfile" },
      ],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Trim accidental leading/trailing whitespace - same trim applied at
    // registration, so a password typed with stray spaces (autofill/copy-paste)
    // doesn't fail to match.
    const isPasswordValid = await user.validatePassword(password.trim());
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (user.primaryRole === "admin" || roles.includes("admin")) {
      try {
        await AdminAuditLog.create({
          actorAdminId: user.id,
          action: "admin.login",
          targetType: "session",
          targetId: String(user.id),
          summary: "Administrator signed in",
          metadata: { method: req.method, path: req.originalUrl, statusCode: 200 },
          ipAddress: req.ip || null,
          userAgent: String(req.get("user-agent") || "").slice(0, 500) || null,
        });
      } catch (auditError) {
        console.error("Failed to write administrator login audit event:", auditError.message);
      }
    }

    const token = generateToken(user.id);

    // Transform user data to match frontend expectations
    const userData = user.toJSON();
    // Ensure roles are available
    if (!userData.roles) {
      userData.roles = ["student"];
    }
    if (!userData.primaryRole) {
      userData.primaryRole = userData.roles[0];
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// JWT authentication is stateless, so there is no server-side session to
// destroy. This endpoint gives the client a successful, authenticated logout
// response before it clears its locally stored token and profile.
const logout = async (_req, res, next) => {
  try {
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Request a password reset code. The same success message is returned for
 * registered and unregistered email addresses to prevent account discovery.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const genericMessage =
      "If an account with that email exists, a password reset code has been sent.";

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const { challenge, code } = await createChallenge({
      purpose: "password_reset_email",
      destination: email,
      userId: user.id,
      ip: req.ip,
    });
    try {
      await sendPasswordResetCode(email, code);
    } catch (error) {
      // A code whose delivery failed must never remain usable.
      challenge.consumedAt = new Date();
      await challenge.save();
      throw error;
    }

    res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    const message = error.message || "";
    if (message.includes("Too many")) {
      return res.status(429).json({ success: false, message: "Unable to send a reset code. Please try again later." });
    }
    if (message.includes("configured") || error.isAxiosError) {
      return res.status(502).json({ success: false, message: "Unable to send a reset code. Please try again later." });
    }
    next(error);
  }
};

/**
 * Complete a password reset using the code emailed by forgotPassword.
 */
const resetPassword = async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { code, newPassword } = req.body;
    const reset = await sequelize.transaction(async (transaction) => {
      const user = await User.findOne({ where: { email }, transaction, lock: transaction.LOCK.UPDATE });
      if (!user) return false;
      const challenge = await consumeVerifiedChallengeForDestination({
        destination: email,
        purpose: "password_reset_email",
        code,
        userId: user.id,
        transaction,
      });
      if (!challenge) return false;
      user.password = newPassword.trim();
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save({ transaction });
      return true;
    });
    if (!reset) {
      return res.status(400).json({ success: false, message: "This reset code is invalid or has expired. Please request a new one." });
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile with all role-specific profiles
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: StudentProfile, as: "studentProfile" },
        { model: TutorProfile, as: "tutorProfile" },
      ],
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phoneNumber, bio, profileImage } = req.body;
    const user = await User.findByPk(req.user.id);

    // firstName/lastName are validated as required above, so always set them.
    // phoneNumber/bio are optional and clearable, so "" must overwrite the
    // previous value instead of being ignored (previously used a truthy
    // check, so clearing the field back to empty silently no-opted).
    user.firstName = firstName;
    user.lastName = lastName;
    if (phoneNumber !== undefined && phoneNumber !== (user.phoneNumber || "")) {
      return res.status(400).json({
        success: false,
        message: "Verify a new mobile number before changing it.",
      });
    }
    if (bio !== undefined) user.bio = bio;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password for the logged-in user (requires the current password).
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    const isCurrentPasswordValid = await user.validatePassword(
      currentPassword.trim(),
    );
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword.trim();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile image
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const user = await User.findByPk(req.user.id);
    user.profileImage = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        profileImage: user.profileImage,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Switch user's primary role
 */
const switchRole = async (req, res, next) => {
  try {
    const { primaryRole } = req.body;
    const userId = req.user.id;

    if (!primaryRole) {
      return res.status(400).json({
        success: false,
        message: "Primary role is required",
      });
    }

    // Get user with profiles
    const user = await User.findByPk(userId, {
      include: [
        { model: StudentProfile, as: "studentProfile" },
        { model: TutorProfile, as: "tutorProfile" },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has the requested role
    if (!user.roles || !user.roles.includes(primaryRole)) {
      return res.status(400).json({
        success: false,
        message: "You don't have access to this role",
      });
    }

    // Update primary role
    user.primaryRole = primaryRole;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Role switched successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required to confirm account deletion." });
    }

    const user = await User.findByPk(req.user.id);
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Incorrect password." });
    }

    // Soft-delete: deactivate the account and anonymise PII
    user.isActive = false;
    user.firstName = "Deleted";
    user.lastName = "User";
    user.email = `deleted_${user.id}@deleted.unihub.lk`;
    user.phoneNumber = null;
    user.bio = null;
    user.profileImage = null;
    await user.save();

    res.json({ success: true, message: "Account deleted successfully." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePhoto,
  switchRole,
  deleteAccount,
};
