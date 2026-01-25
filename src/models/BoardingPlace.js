const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const BoardingPlace = sequelize.define('BoardingPlace', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'vendor_id',
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [3, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  nearestUniversity: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'nearest_university',
    comment: 'Name of the nearest university'
  },
  distanceToUniversity: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    field: 'distance_to_university',
    comment: 'Distance in kilometers'
  },
  roomType: {
    type: DataTypes.ENUM('single', 'shared', 'apartment', 'annex'),
    allowNull: false,
    defaultValue: 'single',
    field: 'room_type'
  },
  genderPreference: {
    type: DataTypes.ENUM('male', 'female', 'any'),
    allowNull: false,
    defaultValue: 'any',
    field: 'gender_preference'
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    },
    comment: 'Total number of students that can be accommodated'
  },
  availableSlots: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'available_slots',
    comment: 'Currently available slots'
  },
  monthlyRent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'monthly_rent',
    validate: {
      min: 0
    }
  },
  securityDeposit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'security_deposit',
    defaultValue: 0
  },
  amenities: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of amenities like wifi, parking, meals, etc.'
  },
  rules: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'House rules and regulations'
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: 'Array of image URLs'
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'contact_phone'
  },
  contactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'contact_email'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether the listing is currently active'
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_paid',
    comment: 'Whether the vendor has paid for this listing'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'paid_at'
  },
  adFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'ad_fee',
    defaultValue: 0,
    comment: 'Fee paid to UniHub for this listing'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
    comment: 'When the paid listing expires'
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count'
  },
  inquiryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'inquiry_count'
  },
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
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  }
}, {
  tableName: 'boarding_places',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['vendor_id'] },
    { fields: ['city'] },
    { fields: ['room_type'] },
    { fields: ['is_active'] },
    { fields: ['is_paid'] },
    { fields: ['approval_status'] }
  ]
});

module.exports = BoardingPlace;
