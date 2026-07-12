const crypto = require("crypto");
const { Op } = require("sequelize");
const { User, StudentProfile, TutorProfile } = require("../models");
const { generateToken } = require("../utils/token");

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

    const token = generateToken(user.id);

    // Transform user data to match frontend expectations
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

/**
 * Request a password reset. Always returns the same generic message whether
 * or not the email is registered, so this endpoint can't be used to probe
 * which emails have accounts.
 *
 * No email-delivery service (SMTP/nodemailer etc.) is wired up in this
 * codebase yet, so outside production the raw reset token/URL is returned
 * directly in the response - that's the only way to exercise the reset flow
 * end to end until real email delivery is added. In production this would
 * currently be a dead end for the user; wiring up an email service is a
 * separate follow-up.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const genericMessage =
      "If an account with that email exists, a password reset link has been generated.";

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const response = { success: true, message: genericMessage };

    if (process.env.NODE_ENV !== "production") {
      response.data = {
        resetToken: rawToken,
        resetUrl: `/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Complete a password reset using the token issued by forgotPassword.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      where: {
        email,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    user.password = newPassword.trim();
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

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
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
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
    user.profileImage = req.file.path; // Cloudinary URL
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

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePhoto,
  switchRole,
};
