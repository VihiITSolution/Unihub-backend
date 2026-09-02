const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const LiveSession = sequelize.define('LiveSession', {
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
  courseId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'course_id',
    comment: 'Optional: link session to a specific course',
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  scheduledStartTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'scheduled_start_time',
    comment: 'When the session is scheduled to start'
  },
  scheduledEndTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'scheduled_end_time',
    comment: 'When the session is scheduled to end'
  },
  actualStartTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'actual_start_time',
    comment: 'When the session actually started'
  },
  actualEndTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'actual_end_time',
    comment: 'When the session actually ended'
  },
  // Pricing
  isFree: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_free'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    comment: 'Price for the session (0 if free)'
  },
  platformCommissionRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 10.00,
    field: 'platform_commission_rate',
    comment: 'Platform commission percentage (e.g., 10.00 for 10%)'
  },
  // YouTube Live Integration
  youtubeVideoId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'youtube_video_id',
    comment: 'YouTube Live broadcast video ID'
  },
  youtubeBroadcastId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'youtube_broadcast_id',
    comment: 'YouTube Live broadcast ID for management'
  },
  youtubeStreamKey: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'youtube_stream_key',
    comment: 'Stream key for OBS/streaming software'
  },
  streamUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'stream_url',
    comment: 'RTMP URL for streaming'
  },
  // Session settings
  maxAttendees: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'max_attendees',
    comment: 'Maximum number of attendees (null = unlimited)'
  },
  allowRecording: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'allow_recording',
    comment: 'Allow session to be recorded'
  },
  recordingUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'recording_url',
    comment: 'YouTube URL of recorded session (after live ends)'
  },
  // Status
  status: {
    type: DataTypes.ENUM(
      'scheduled',    // Session is scheduled for future
      'cancelled',    // Session was cancelled
      'live',         // Session is currently live
      'ended',        // Session has ended
      'recorded'      // Session has ended and recording is available
    ),
    defaultValue: 'scheduled'
  },
  // Chat and interaction
  enableChat: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'enable_chat',
    comment: 'Enable YouTube Live chat'
  },
  chatModeration: {
    type: DataTypes.ENUM('disabled', 'auto', 'manual'),
    defaultValue: 'auto',
    field: 'chat_moderation',
    comment: 'Chat moderation level'
  },
  // Metadata
  thumbnail: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Session thumbnail image URL'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of tags for the session'
  },
  // Analytics
  totalAttendees: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_attendees',
    comment: 'Total number of students who attended'
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'total_revenue',
    comment: 'Total revenue generated from this session'
  },
  platformCommission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
    field: 'platform_commission',
    comment: 'Platform commission amount earned'
  },
  provider: {
    type: DataTypes.ENUM('youtube', 'teams'),
    allowNull: false,
    defaultValue: 'teams',
    comment: 'Meeting provider. Existing rows are backfilled to youtube.'
  },
  approvalStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    field: 'approval_status'
  },
  providerStatus: {
    type: DataTypes.ENUM('not_provisioned', 'provisioning', 'ready', 'syncing', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'not_provisioned',
    field: 'provider_status'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'approved_by',
    references: { model: 'users', key: 'id' }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  providerSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'provider_synced_at'
  }
}, {
  tableName: 'live_sessions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['tutor_id']
    },
    {
      fields: ['course_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['scheduled_start_time']
    },
    {
      fields: ['provider', 'approval_status', 'provider_status']
    }
  ]
});

module.exports = LiveSession;
