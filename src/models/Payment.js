const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  enrollmentId: {
    type: DataTypes.INTEGER,
    field: 'enrollment_id',
    references: {
      model: 'enrollments',
      key: 'id'
    }
  },
  marketplaceItemId: {
    type: DataTypes.INTEGER,
    field: 'marketplace_item_id',
    references: {
      model: 'marketplace_items',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    field: 'payment_method'
  },
  transactionId: {
    type: DataTypes.STRING(255),
    unique: true,
    field: 'transaction_id'
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  paymentGateway: {
    type: DataTypes.STRING(50),
    field: 'payment_gateway'
  },
  paidAt: {
    type: DataTypes.DATE,
    field: 'paid_at'
  }
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true
});

module.exports = Payment;
