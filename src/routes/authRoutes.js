const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
  uploadProfilePhoto,
  switchRole,
} = require("../controllers/authController");
const { authMiddleware } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { uploadProfileImage } = require("../config/cloudinary");
const { isValidPhone, hasLetters, isNameLike } = require("../utils/fieldValidators");

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [student, tutor]
 *               phoneNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post(
  "/register",
  authLimiter,
  [
    body("firstName").trim().notEmpty().withMessage("First name is required"),
    body("lastName").trim().notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .optional()
      .isIn(["student", "tutor"])
      .withMessage("Invalid role"),
    body("phoneNumber")
      .optional({ checkFalsy: true })
      .custom(isValidPhone)
      .withMessage("Enter a valid phone number"),
    body("studentProfile.department")
      .optional({ checkFalsy: true })
      .custom(hasLetters)
      .withMessage("Department must contain letters, not just numbers"),
    body("studentProfile.degreeOrCourse")
      .optional({ checkFalsy: true })
      .custom(hasLetters)
      .withMessage("Degree/Course must contain letters, not just numbers"),
    body("studentProfile.studyingArea")
      .optional({ checkFalsy: true })
      .custom(hasLetters)
      .withMessage("Studying Area must contain letters, not just numbers"),
    body("studentProfile.phoneNumber")
      .optional({ checkFalsy: true })
      .custom(isValidPhone)
      .withMessage("Enter a valid phone number"),
    validate,
  ],
  register,
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
    validate,
  ],
  login,
);

router.post(
  "/forgot-password",
  authLimiter,
  [body("email").isEmail().withMessage("Valid email is required"), validate],
  forgotPassword,
);

router.post(
  "/reset-password",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
    validate,
  ],
  resetPassword,
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 */
router.get("/profile", authMiddleware, getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Authentication]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               bio:
 *                 type: string
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put(
  "/profile",
  authMiddleware,
  [
    body("firstName")
      .trim()
      .notEmpty()
      .withMessage("First name is required")
      .bail()
      .custom(isNameLike)
      .withMessage("First name must be 2-50 letters"),
    body("lastName")
      .trim()
      .notEmpty()
      .withMessage("Last name is required")
      .bail()
      .custom(isNameLike)
      .withMessage("Last name must be 2-50 letters"),
    body("phoneNumber")
      .optional({ checkFalsy: true })
      .custom(isValidPhone)
      .withMessage("Enter a valid phone number"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio must be 500 characters or fewer"),
    validate,
  ],
  updateProfile,
);

router.put(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters"),
    validate,
  ],
  changePassword,
);

/**
 * @swagger
 * /api/auth/profile/photo:
 *   post:
 *     tags: [Authentication]
 *     summary: Upload profile photo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile photo uploaded successfully
 */
router.post(
  "/profile/photo",
  authMiddleware,
  uploadProfileImage,
  uploadProfilePhoto,
);

/**
 * @swagger
 * /api/auth/switch-role:
 *   post:
 *     tags: [Authentication]
 *     summary: Switch user's primary role
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - primaryRole
 *             properties:
 *               primaryRole:
 *                 type: string
 *                 enum: [student, tutor, vendor, admin]
 *                 description: The role to switch to
 *     responses:
 *       200:
 *         description: Role switched successfully
 *       400:
 *         description: Invalid role or user doesn't have this role
 *       401:
 *         description: Unauthorized
 */
router.post("/switch-role", authMiddleware, switchRole);

module.exports = router;
