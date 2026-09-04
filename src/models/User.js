const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");
const bcrypt = require("bcryptjs");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "first_name",
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "last_name",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Multi-role support: JSON array of roles
    roles: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ["student"],
      comment: "Array of roles: student, tutor, vendor, admin",
    },
    // Primary role for dashboard routing
    primaryRole: {
      type: DataTypes.ENUM("student", "tutor", "vendor", "admin"),
      allowNull: false,
      defaultValue: "student",
      field: "primary_role",
    },
    phoneNumber: {
      type: DataTypes.STRING(20),
      field: "phone_number",
    },
    verifiedPhoneNumber: {
      type: DataTypes.STRING(16),
      allowNull: true,
      field: "verified_phone_number",
    },
    phoneVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "phone_verified_at",
    },
    bio: {
      type: DataTypes.TEXT,
    },
    profileImage: {
      type: DataTypes.STRING(255),
      field: "profile_image",
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_verified",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    // Profile completion status
    isStudentProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_student_profile_complete",
    },
    isTutorProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_tutor_profile_complete",
    },
    isVendorProfileComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_vendor_profile_complete",
    },
    lastLogin: {
      type: DataTypes.DATE,
      field: "last_login",
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "reset_password_token",
      comment: "Hashed password-reset token, cleared once used or expired",
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reset_password_expires",
    },
    notificationPrefs: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "notification_prefs",
      comment: "User notification preferences as JSON",
    },
    privacyPrefs: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "privacy_prefs",
      comment: "User privacy settings as JSON",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 12);
        }
      },
    },
  },
);

User.prototype.validatePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Check if user has a specific role
User.prototype.hasRole = function (role) {
  return this.roles && this.roles.includes(role);
};

// Add a role to user
User.prototype.addRole = function (role) {
  if (!this.roles.includes(role)) {
    this.roles = [...this.roles, role];
  }
};

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  return values;
};

module.exports = User;
