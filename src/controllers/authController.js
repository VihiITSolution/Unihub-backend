const { User, StudentProfile, TutorProfile } = require('../models');
const { generateToken } = require('../utils/token');

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
      studentProfile
    } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Determine roles - default to student if not provided
    const userRoles = roles && roles.length > 0 ? roles : ['student'];
    const userPrimaryRole = primaryRole || userRoles[0];

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      roles: userRoles,
      primaryRole: userPrimaryRole,
      phoneNumber
    });

    // If registering as student with profile data, create student profile
    if (userRoles.includes('student') && studentProfile) {
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
        isProfileComplete: true
      });
      user.isStudentProfileComplete = true;
      await user.save();
    }

    const token = generateToken(user.id);

    // Reload user with profile
    const userWithProfile = await User.findByPk(user.id, {
      include: [
        { model: StudentProfile, as: 'studentProfile' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userWithProfile,
        token
      }
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
        { model: StudentProfile, as: 'studentProfile' },
        { model: TutorProfile, as: 'tutorProfile' }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
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
        { model: StudentProfile, as: 'studentProfile' },
        { model: TutorProfile, as: 'tutorProfile' }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: { user }
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
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};

