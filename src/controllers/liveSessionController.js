const { LiveSession, SessionEnrollment, User, Course } = require('../models');
const youtubeUploader = require('../config/youtube');

/**
 * Create a new live session
 * POST /api/live-sessions
 */
const createLiveSession = async (req, res, next) => {
  try {
    const tutorId = req.user.id;
    const {
      title,
      description,
      courseId,
      scheduledStartTime,
      scheduledEndTime,
      isFree,
      price,
      maxAttendees,
      allowRecording,
      enableChat,
      chatModeration,
      privacyStatus,
      tags
    } = req.body;

    // Validate scheduled times
    const startTime = new Date(scheduledStartTime);
    const endTime = new Date(scheduledEndTime);
    const now = new Date();

    if (startTime < now) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled start time must be in the future'
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    // Validate price
    const sessionPrice = isFree ? 0 : parseFloat(price);
    if (!isFree && sessionPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be greater than 0 for paid sessions'
      });
    }

    // Create YouTube Live broadcast
    let youtubeBroadcast = null;
    try {
      youtubeBroadcast = await youtubeUploader.createLiveBroadcast({
        title,
        description,
        scheduledStartTime,
        scheduledEndTime,
        privacyStatus: privacyStatus || 'unlisted',
        enableChat: enableChat !== false,
        enableDvr: allowRecording !== false,
        enableAutoStart: true,
        enableAutoStop: true
      });
    } catch (error) {
      console.error('YouTube broadcast creation failed:', error.message);
      // Continue without YouTube integration
    }

    // Calculate platform commission (default 10%)
    const platformCommissionRate = process.env.PLATFORM_COMMISSION_RATE || 10;

    // Create live session
    const session = await LiveSession.create({
      tutorId,
      courseId: courseId || null,
      title,
      description,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      isFree,
      price: sessionPrice,
      platformCommissionRate,
      maxAttendees: maxAttendees || null,
      allowRecording: allowRecording !== false,
      enableChat: enableChat !== false,
      chatModeration: chatModeration || 'auto',
      tags: tags || [],
      youtubeVideoId: youtubeBroadcast?.videoId,
      youtubeBroadcastId: youtubeBroadcast?.broadcastId,
      youtubeStreamKey: youtubeBroadcast?.streamKey,
      streamUrl: youtubeBroadcast?.streamUrl,
      status: 'scheduled'
    });

    // Load session with relationships
    const sessionWithDetails = await LiveSession.findByPk(session.id, {
      include: [
        {
          model: User,
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Live session created successfully',
      data: {
        session: sessionWithDetails,
        streaming: youtubeBroadcast ? {
          watchUrl: youtubeBroadcast.watchUrl,
          embedUrl: youtubeBroadcast.embedUrl,
          streamUrl: youtubeBroadcast.streamUrl,
          streamKey: youtubeBroadcast.streamKey
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all live sessions (with filters)
 * GET /api/live-sessions
 */
const getLiveSessions = async (req, res, next) => {
  try {
    const {
      status,
      tutorId,
      courseId,
      isFree,
      upcoming,
      past,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    const now = new Date();

    if (status) where.status = status;
    if (tutorId) where.tutorId = tutorId;
    if (courseId) where.courseId = courseId;
    if (isFree !== undefined) where.isFree = isFree === 'true';

    // Filter by time
    if (upcoming === 'true') {
      where.scheduledStartTime = { [require('sequelize').Op.gt]: now };
      where.status = 'scheduled';
    }
    if (past === 'true') {
      where.scheduledEndTime = { [require('sequelize').Op.lt]: now };
      where.status = { [require('sequelize').Op.in]: ['ended', 'recorded'] };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await LiveSession.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'thumbnail']
        }
      ],
      order: [['scheduledStartTime', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        sessions: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single live session details
 * GET /api/live-sessions/:id
 */
const getLiveSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findByPk(id, {
      include: [
        {
          model: User,
          as: 'tutor',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage', 'bio']
        },
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'description', 'thumbnail']
        },
        {
          model: SessionEnrollment,
          as: 'enrollments',
          include: [
            {
              model: User,
              as: 'student',
              attributes: ['id', 'firstName', 'lastName', 'profileImage']
            }
          ]
        }
      ]
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update live session
 * PUT /api/live-sessions/:id
 */
const updateLiveSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tutorId = req.user.id;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    // Only tutor can update their session
    if (session.tutorId !== tutorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this session'
      });
    }

    // Cannot update live or ended sessions
    if (['live', 'ended', 'recorded'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update session with status: ${session.status}`
      });
    }

    const {
      title,
      description,
      scheduledStartTime,
      scheduledEndTime,
      isFree,
      price,
      maxAttendees,
      tags
    } = req.body;

    if (title) session.title = title;
    if (description) session.description = description;
    if (scheduledStartTime) session.scheduledStartTime = new Date(scheduledStartTime);
    if (scheduledEndTime) session.scheduledEndTime = new Date(scheduledEndTime);
    if (isFree !== undefined) {
      session.isFree = isFree;
      session.price = isFree ? 0 : price || session.price;
    }
    if (price) session.price = isFree ? 0 : parseFloat(price);
    if (maxAttendees) session.maxAttendees = maxAttendees;
    if (tags) session.tags = tags;

    await session.save();

    res.json({
      success: true,
      message: 'Live session updated successfully',
      data: { session }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel live session
 * DELETE /api/live-sessions/:id
 */
const cancelLiveSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tutorId = req.user.id;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    if (session.tutorId !== tutorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this session'
      });
    }

    if (['live', 'ended', 'cancelled'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel session with status: ${session.status}`
      });
    }

    session.status = 'cancelled';
    await session.save();

    // TODO: Send cancellation notifications to enrolled students
    // TODO: Process refunds for paid sessions

    res.json({
      success: true,
      message: 'Live session cancelled successfully',
      data: { session }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start live session (go live)
 * POST /api/live-sessions/:id/start
 */
const startLiveSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tutorId = req.user.id;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    if (session.tutorId !== tutorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start this session'
      });
    }

    if (session.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot start session with status: ${session.status}`
      });
    }

    // Start YouTube broadcast if configured
    if (session.youtubeBroadcastId) {
      try {
        await youtubeUploader.startBroadcast(session.youtubeBroadcastId);
      } catch (error) {
        console.error('Failed to start YouTube broadcast:', error.message);
      }
    }

    session.status = 'live';
    session.actualStartTime = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Live session started successfully',
      data: { session }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End live session
 * POST /api/live-sessions/:id/end
 */
const endLiveSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tutorId = req.user.id;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    if (session.tutorId !== tutorId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to end this session'
      });
    }

    if (session.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: `Cannot end session with status: ${session.status}`
      });
    }

    // End YouTube broadcast
    if (session.youtubeBroadcastId) {
      try {
        await youtubeUploader.endBroadcast(session.youtubeBroadcastId);
      } catch (error) {
        console.error('Failed to end YouTube broadcast:', error.message);
      }
    }

    session.status = session.allowRecording ? 'recorded' : 'ended';
    session.actualEndTime = new Date();
    if (session.allowRecording && session.youtubeVideoId) {
      session.recordingUrl = `https://www.youtube.com/watch?v=${session.youtubeVideoId}`;
    }
    await session.save();

    res.json({
      success: true,
      message: 'Live session ended successfully',
      data: { session }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLiveSession,
  getLiveSessions,
  getLiveSession,
  updateLiveSession,
  cancelLiveSession,
  startLiveSession,
  endLiveSession
};
