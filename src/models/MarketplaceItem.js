const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const MarketplaceItem = sequelize.define('MarketplaceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'seller_id',
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
    type: DataTypes.STRING(100),
    allowNull: false
  },
  itemType: {
    type: DataTypes.ENUM('book', 'notes', 'equipment', 'electronics', 'other'),
    allowNull: false,
    field: 'item_type'
  },
  condition: {
    type: DataTypes.ENUM('new', 'like_new', 'good', 'fair', 'poor'),
    defaultValue: 'good'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  images: {
    type: DataTypes.JSON,
    comment: 'Array of image URLs'
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    },
    comment: 'Available stock quantity'
  },
  soldCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'sold_count',
    comment: 'Total units sold'
  },
  location: {
    type: DataTypes.STRING(255)
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count'
  },
  contactInfo: {
    type: DataTypes.STRING(255),
    field: 'contact_info'
  }
}, {
  tableName: 'marketplace_items',
  timestamps: true,
  underscored: true
});

module.exports = MarketplaceItem;
