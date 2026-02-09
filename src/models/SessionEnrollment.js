const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const SessionEnrollment = sequelize.define('SessionEnrollment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'session_id',
    references: {
      model: 'live_sessions',
      key: 'id'
    }
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'student_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Payment info
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'amount_paid',
    comment: 'Amount paid by student'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status'
  },
  paymentId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'payment_id',
    comment: 'Payment gateway transaction ID'
  },
  // Attendance tracking
  joinedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'joined_at',
    comment: 'When student joined the live session'
  },
  leftAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'left_at',
    comment: 'When student left the live session'
  },
  attendanceDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'attendance_duration',
    comment: 'Total minutes attended'
  },
  attended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether student actually attended'
  },
  // Invitation
  invitedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'invited_by',
    comment: 'User ID who sent the invitation',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  invitationStatus: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined'),
    defaultValue: 'pending',
    field: 'invitation_status'
  },
  // Notifications
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'reminder_sent',
    comment: 'Whether reminder email was sent'
  },
  reminderSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reminder_sent_at'
  }
}, {
  tableName: 'session_enrollments',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['session_id', 'student_id'],
      name: 'unique_session_enrollment'
    },
    {
      fields: ['session_id']
    },
    {
      fields: ['student_id']
    },
    {
      fields: ['payment_status']
    }
  ]
});

module.exports = SessionEnrollment;
