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
      password,
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

    const isPasswordValid = await user.validatePassword(password);
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

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (bio) user.bio = bio;
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

    if (!primaryRole) {
      return res.status(400).json({
        success: false,
        message: "Primary role is required",
      });
    }

    const user = await User.findByPk(req.user.id, {
      include: [
        { model: StudentProfile, as: "studentProfile" },
        { model: TutorProfile, as: "tutorProfile" },
      ],
    });

    // Check if user has this role
    if (!user.roles.includes(primaryRole)) {
      return res.status(400).json({
        success: false,
        message: "You don't have this role",
      });
    }

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
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  switchRole,
};
