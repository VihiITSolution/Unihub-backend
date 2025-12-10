const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tutorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'tutor_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100)
  },
  level: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  duration: {
    type: DataTypes.INTEGER,
    comment: 'Duration in hours'
  },
  thumbnail: {
    type: DataTypes.STRING(255)
  },
  videoUrl: {
    type: DataTypes.STRING(500),
    field: 'video_url'
  },
  contentUrl: {
    type: DataTypes.STRING(500),
    field: 'content_url'
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_published'
  },
  enrollmentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'enrollment_count'
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'review_count'
  }
}, {
  tableName: 'courses',
  timestamps: true,
  underscored: true
});

module.exports = Course;
