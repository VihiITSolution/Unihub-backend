const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const LiveSessionMeeting = sequelize.define("LiveSessionMeeting", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sessionId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: "session_id" },
  organizerAccountId: { type: DataTypes.INTEGER, allowNull: false, field: "organizer_account_id" },
  provider: { type: DataTypes.ENUM("teams"), allowNull: false, defaultValue: "teams" },
  outlookEventId: { type: DataTypes.STRING(512), allowNull: true, unique: true, field: "outlook_event_id" },
  teamsMeetingId: { type: DataTypes.STRING(512), allowNull: true, field: "teams_meeting_id" },
  joinUrl: { type: DataTypes.TEXT, allowNull: true, field: "join_url" },
  meetingOptionsUrl: { type: DataTypes.TEXT, allowNull: true, field: "meeting_options_url" },
  recordingId: { type: DataTypes.STRING(512), allowNull: true, field: "recording_id" },
  recordingDriveItemId: { type: DataTypes.STRING(512), allowNull: true, field: "recording_drive_item_id" },
  recordingWebUrl: { type: DataTypes.TEXT, allowNull: true, field: "recording_web_url" },
  syncStatus: { type: DataTypes.ENUM("pending", "syncing", "ready", "failed", "cancelled"), allowNull: false, defaultValue: "pending", field: "sync_status" },
  lastError: { type: DataTypes.STRING(500), allowNull: true, field: "last_error" },
  lastSyncedAt: { type: DataTypes.DATE, allowNull: true, field: "last_synced_at" },
}, { tableName: "live_session_meetings", timestamps: true, underscored: true });

module.exports = LiveSessionMeeting;
