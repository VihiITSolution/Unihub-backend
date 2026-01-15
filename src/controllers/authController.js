const { User } = require("../models");
const { generateToken } = require("../utils/token");

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, phoneNumber } =
      req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || "learner",
      phoneNumber,
    });

    const token = generateToken(user.id);

    // Transform user data to match frontend expectations
    const userData = user.toJSON();
    userData.roles = [userData.role === "learner" ? "student" : userData.role];
    userData.primaryRole =
      userData.role === "learner" ? "student" : userData.role;

    res.status(201).json({
      success: true,
      message: "User registered successfully",
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
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
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
    const userData = user.toJSON();
    userData.roles = [userData.role === "learner" ? "student" : userData.role];
    userData.primaryRole =
      userData.role === "learner" ? "student" : userData.role;

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
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Transform user data to match frontend expectations
    const userData = user.toJSON();
    userData.roles = [userData.role === "learner" ? "student" : userData.role];
    userData.primaryRole =
      userData.role === "learner" ? "student" : userData.role;

    res.status(200).json({
      success: true,
      data: { user: userData },
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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
};
