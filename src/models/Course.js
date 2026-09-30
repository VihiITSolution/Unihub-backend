// ...existing code...
const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Course = sequelize.define(
  "Course",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "tutor_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    shortDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "short_description",
      comment: "Brief summary for course listings",
    },
    aboutCourse: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "about_course",
      comment: "Detailed course information (syllabus, learning points, etc.)",
    },
    category: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "category",
      references: {
        model: "categories",
        key: "id",
      },
    },
    facultyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "faculty_id",
      references: {
        model: "faculties",
        key: "id",
      },
    },
    departmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "department_id",
      references: {
        model: "departments",
        key: "id",
      },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 4,
      },
      comment: "Academic year (1-4)",
    },
    // Legacy fields (kept for backward compatibility)
    category: {
      type: DataTypes.STRING(100),
    },
    level: {
      type: DataTypes.ENUM("beginner", "intermediate", "advanced"),
      defaultValue: "beginner",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    duration: {
      type: DataTypes.INTEGER,
      comment: "Whole hours in the total course duration",
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "duration_minutes",
      validate: { min: 0, max: 59 },
      comment: "Remaining minutes in the total course duration",
    },
    thumbnail: {
      type: DataTypes.STRING(255),
    },
    videoUrl: {
      type: DataTypes.STRING(500),
      field: "video_url",
    },
    contentUrl: {
      type: DataTypes.STRING(500),
      field: "content_url",
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_published",
    },
    enrollmentCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "enrollment_count",
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.0,
    },
    reviewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "review_count",
    },
    // Approval fields
    approvalStatus: {
      type: DataTypes.ENUM("draft", "pending", "approved", "rejected"),
      defaultValue: "draft",
      field: "approval_status",
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      field: "approved_by",
      references: {
        model: "users",
        key: "id",
      },
    },
    approvedAt: {
      type: DataTypes.DATE,
      field: "approved_at",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      field: "rejection_reason",
    },
    submittedForReviewAt: {
      type: DataTypes.DATE,
      field: "submitted_for_review_at",
    },
    isUpcoming: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_upcoming",
      comment:
        "Mark course as upcoming - students can enroll but cannot access content",
    },
  },
  {
    tableName: "courses",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Course;
