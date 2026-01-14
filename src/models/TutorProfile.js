const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const TutorProfile = sequelize.define('TutorProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Professional Information
  qualifications: {
    type: DataTypes.TEXT,
    comment: 'Academic qualifications and certifications'
  },
  expertiseAreas: {
    type: DataTypes.JSON,
    defaultValue: [],
    field: 'expertise_areas',
    comment: 'Array of subject areas the tutor specializes in'
  },
  bio: {
    type: DataTypes.TEXT,
    comment: 'Tutor biography and teaching approach'
  },
  yearsOfExperience: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'years_of_experience'
  },
  // Approval Workflow
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_approved',
    comment: 'Admin approval status'
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    field: 'approval_status'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    field: 'approved_by',
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'Admin user who approved/rejected'
  },
  approvedAt: {
    type: DataTypes.DATE,
    field: 'approved_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    field: 'rejection_reason'
  },
  // Statistics
  totalCourses: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_courses'
  },
  totalStudents: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_students'
  },
  averageRating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
    field: 'average_rating'
  },
  // Profile Status
  isProfileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_profile_complete'
  }
}, {
  tableName: 'tutor_profiles',
  timestamps: true,
  underscored: true
});

module.exports = TutorProfile;
