const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const VendorProfile = sequelize.define('VendorProfile', {
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
  shopName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'shop_name'
  },
  shopDescription: {
    type: DataTypes.TEXT,
    field: 'shop_description'
  },
  businessType: {
    type: DataTypes.ENUM('individual', 'business'),
    defaultValue: 'individual',
    field: 'business_type'
  },
  contactEmail: {
    type: DataTypes.STRING(255),
    field: 'contact_email',
    validate: {
      isEmail: true
    }
  },
  contactPhone: {
    type: DataTypes.STRING(20),
    field: 'contact_phone'
  },
  address: {
    type: DataTypes.TEXT
  },
  city: {
    type: DataTypes.STRING(100)
  },
  country: {
    type: DataTypes.STRING(100)
  },
  postalCode: {
    type: DataTypes.STRING(20),
    field: 'postal_code'
  },
  taxId: {
    type: DataTypes.STRING(100),
    field: 'tax_id',
    comment: 'Business tax identification number (optional)'
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_approved'
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
    field: 'approval_status'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    field: 'rejection_reason'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    field: 'approved_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  totalSales: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_sales'
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
    field: 'total_revenue'
  },
  averageRating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.00,
    field: 'average_rating'
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_reviews'
  },
  isProfileComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_profile_complete'
  }
}, {
  tableName: 'vendor_profiles',
  timestamps: true,
  underscored: true
});

module.exports = VendorProfile;
