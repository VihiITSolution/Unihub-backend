const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'order_id',
    comment: 'Human-readable order ID (e.g., ORD-UUID)'
  },
  buyerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'buyer_id',
    references: {
      model: 'users',
      key: 'id'
    }
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
  itemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'item_id',
    references: {
      model: 'marketplace_items',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_price',
    comment: 'Price per unit at time of purchase'
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_price',
    comment: 'Total order amount (quantity * unitPrice)'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'),
    defaultValue: 'pending',
    allowNull: false
  },
  shippingAddress: {
    type: DataTypes.TEXT,
    field: 'shipping_address'
  },
  buyerNotes: {
    type: DataTypes.TEXT,
    field: 'buyer_notes',
    comment: 'Special instructions from buyer'
  },
  sellerNotes: {
    type: DataTypes.TEXT,
    field: 'seller_notes',
    comment: 'Internal notes from seller'
  },
  trackingNumber: {
    type: DataTypes.STRING(100),
    field: 'tracking_number'
  },
  paymentId: {
    type: DataTypes.INTEGER,
    field: 'payment_id',
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  confirmedAt: {
    type: DataTypes.DATE,
    field: 'confirmed_at'
  },
  shippedAt: {
    type: DataTypes.DATE,
    field: 'shipped_at'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    field: 'delivered_at'
  },
  cancelledAt: {
    type: DataTypes.DATE,
    field: 'cancelled_at'
  },
  cancellationReason: {
    type: DataTypes.TEXT,
    field: 'cancellation_reason'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  underscored: true
});

module.exports = Order;
