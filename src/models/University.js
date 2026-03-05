const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const University = sequelize.define('University', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'Official name of the university'
  },
  shortName: {
    type: DataTypes.STRING(100),
    field: 'short_name',
    comment: 'Abbreviated name or common name'
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'City where university is located'
  },
  district: {
    type: DataTypes.STRING(100),
    comment: 'District'
  },
  province: {
    type: DataTypes.STRING(100),
    comment: 'Province'
  },
  address: {
    type: DataTypes.TEXT,
    comment: 'Full address'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    comment: 'Latitude coordinate'
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    comment: 'Longitude coordinate'
  },
  website: {
    type: DataTypes.STRING(255),
    comment: 'Official website URL'
  },
  phone: {
    type: DataTypes.STRING(20),
    comment: 'Contact phone number'
  },
  email: {
    type: DataTypes.STRING(100),
    comment: 'Contact email'
  },
  type: {
    type: DataTypes.ENUM('public', 'private', 'international'),
    defaultValue: 'public',
    comment: 'Type of university'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether university is active in the system'
  }
}, {
  tableName: 'universities',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['city']
    },
    {
      fields: ['latitude', 'longitude']
    },
    {
      fields: ['name']
    }
  ]
});

module.exports = University;
