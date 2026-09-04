const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const StudentProfile = sequelize.define('StudentProfile', {
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
  // University Information
  universityName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'university_name'
  },
  facultyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'faculty_id',
  },
  customUniversity: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'custom_university',
  },
  customFaculty: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'custom_faculty',
  },
  customDepartment: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'custom_department',
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  degreeOrCourse: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'degree_or_course',
    comment: 'e.g., BSc Computer Science, BEng Civil Engineering'
  },
  studyingArea: {
    type: DataTypes.STRING(255),
    field: 'studying_area',
    comment: 'Major or specialization'
  },
  // Academic Progress
  currentYear: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'current_year',
    validate: {
      min: 1,
      max: 6
    }
  },
  currentSemester: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'current_semester',
    validate: {
      min: 1,
      max: 2
    }
  },
  // Student Identification
  studentIdNumber: {
    type: DataTypes.STRING(50),
    field: 'student_id_number',
    comment: 'University student ID/registration number'
  },
  // Contact Information
  currentAddress: {
    type: DataTypes.TEXT,
    field: 'current_address'
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    field: 'phone_number'
  },
  studentEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'student_email',
    validate: { isEmail: true },
  },
  studentEmailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'student_email_verified_at',
  },
  // Additional Info
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    field: 'date_of_birth'
  },
  // Profile Status
  isProfileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_profile_complete'
  }
}, {
  tableName: 'student_profiles',
  timestamps: true,
  underscored: true
});

module.exports = StudentProfile;
