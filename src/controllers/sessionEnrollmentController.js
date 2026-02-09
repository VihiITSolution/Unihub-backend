const { SessionEnrollment, LiveSession, User } = require('../models');

/**
 * Enroll student in a live session
 * POST /api/live-sessions/:id/enroll
 */
const enrollInSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const { paymentId } = req.body;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    // Check if session is scheduled
    if (session.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This session has been cancelled'
      });
    }

    if (session.status === 'ended' || session.status === 'recorded') {
      return res.status(400).json({
        success: false,
        message: 'This session has already ended'
      });
    }

    // Check if already enrolled
    const existingEnrollment = await SessionEnrollment.findOne({
      where: { sessionId: id, studentId }
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this session'
      });
    }

    // Check max attendees limit
    if (session.maxAttendees) {
      const enrollmentCount = await SessionEnrollment.count({
        where: { sessionId: id, paymentStatus: 'completed' }
      });

      if (enrollmentCount >= session.maxAttendees) {
        return res.status(400).json({
          success: false,
          message: 'Session is full'
        });
      }
    }

    // Handle payment for paid sessions
    let paymentStatus = 'completed';
    let amountPaid = 0;

    if (!session.isFree) {
      amountPaid = parseFloat(session.price);
      
      // TODO: Integrate with payment gateway
      // For now, mark as pending until payment is verified
      paymentStatus = paymentId ? 'completed' : 'pending';
      
      if (!paymentId && paymentStatus === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Payment required for this session',
          data: {
            price: session.price,
            platformCommissionRate: session.platformCommissionRate
          }
        });
      }
    }

    // Create enrollment
    const enrollment = await SessionEnrollment.create({
      sessionId: id,
      studentId,
      amountPaid,
      paymentStatus,
      paymentId: paymentId || null,
      invitationStatus: 'accepted'
    });

    // Update session revenue
    if (paymentStatus === 'completed' && !session.isFree) {
      const platformCommission = (amountPaid * session.platformCommissionRate) / 100;
      session.totalRevenue += amountPaid;
      session.platformCommission += platformCommission;
      session.totalAttendees += 1;
      await session.save();
    }

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in live session',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite students to a session
 * POST /api/live-sessions/:id/invite
 */
const inviteStudents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tutorId = req.user.id;
    const { studentIds } = req.body; // Array of student IDs

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
        message: 'Not authorized to invite students to this session'
      });
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs array is required'
      });
    }

    const invitations = [];

    for (const studentId of studentIds) {
      // Check if already enrolled or invited
      const existing = await SessionEnrollment.findOne({
        where: { sessionId: id, studentId }
      });

      if (!existing) {
        const invitation = await SessionEnrollment.create({
          sessionId: id,
          studentId,
          invitedBy: tutorId,
          invitationStatus: 'pending',
          amountPaid: 0,
          paymentStatus: session.isFree ? 'completed' : 'pending'
        });
        invitations.push(invitation);

        // TODO: Send invitation email/notification
      }
    }

    res.json({
      success: true,
      message: `Sent ${invitations.length} invitations`,
      data: { invitations }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get student's enrollments
 * GET /api/my-live-sessions
 */
const getMyEnrollments = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const { status, upcoming, past } = req.query;

    const where = { studentId };
    const sessionWhere = {};
    const now = new Date();

    if (upcoming === 'true') {
      sessionWhere.scheduledStartTime = { [require('sequelize').Op.gt]: now };
      sessionWhere.status = { [require('sequelize').Op.in]: ['scheduled', 'live'] };
    }
    if (past === 'true') {
      sessionWhere.scheduledEndTime = { [require('sequelize').Op.lt]: now };
      sessionWhere.status = { [require('sequelize').Op.in]: ['ended', 'recorded'] };
    }

    const enrollments = await SessionEnrollment.findAll({
      where,
      include: [
        {
          model: LiveSession,
          as: 'session',
          where: Object.keys(sessionWhere).length > 0 ? sessionWhere : undefined,
          include: [
            {
              model: User,
              as: 'tutor',
              attributes: ['id', 'firstName', 'lastName', 'profileImage']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: { enrollments }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Join live session (mark attendance)
 * POST /api/live-sessions/:id/join
 */
const joinSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    const session = await LiveSession.findByPk(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Live session not found'
      });
    }

    if (session.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'Session is not live yet'
      });
    }

    const enrollment = await SessionEnrollment.findOne({
      where: { sessionId: id, studentId }
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Not enrolled in this session'
      });
    }

    if (enrollment.paymentStatus !== 'completed') {
      return res.status(403).json({
        success: false,
        message: 'Payment required to join this session'
      });
    }

    // Mark as joined
    if (!enrollment.joinedAt) {
      enrollment.joinedAt = new Date();
      enrollment.attended = true;
      await enrollment.save();
    }

    // Return streaming URLs
    res.json({
      success: true,
      message: 'Joined session successfully',
      data: {
        watchUrl: `https://www.youtube.com/watch?v=${session.youtubeVideoId}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${session.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`,
        chatUrl: session.enableChat ? `https://www.youtube.com/live_chat?v=${session.youtubeVideoId}` : null,
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Leave live session
 * POST /api/live-sessions/:id/leave
 */
const leaveSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    const enrollment = await SessionEnrollment.findOne({
      where: { sessionId: id, studentId }
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    if (enrollment.joinedAt && !enrollment.leftAt) {
      enrollment.leftAt = new Date();
      const duration = Math.floor((enrollment.leftAt - enrollment.joinedAt) / 60000); // minutes
      enrollment.attendanceDuration = duration;
      await enrollment.save();
    }

    res.json({
      success: true,
      message: 'Left session successfully',
      data: { enrollment }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session enrollments (for tutors)
 * GET /api/live-sessions/:id/enrollments
 */
const getSessionEnrollments = async (req, res, next) => {
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

    if (session.tutorId !== tutorId && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view enrollments'
      });
    }

    const enrollments = await SessionEnrollment.findAll({
      where: { sessionId: id },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const stats = {
      total: enrollments.length,
      paid: enrollments.filter(e => e.paymentStatus === 'completed').length,
      attended: enrollments.filter(e => e.attended).length,
      totalRevenue: enrollments.reduce((sum, e) => sum + parseFloat(e.amountPaid), 0)
    };

    res.json({
      success: true,
      data: { enrollments, stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  enrollInSession,
  inviteStudents,
  getMyEnrollments,
  joinSession,
  leaveSession,
  getSessionEnrollments
};
