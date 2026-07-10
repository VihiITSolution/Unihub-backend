const { verifyJwtAndLoadUser } = require("../middleware/auth");

/**
 * Socket.io connection middleware - authenticates via the JWT passed in
 * `socket.handshake.auth.token`, reusing the same verification logic as the
 * REST authMiddleware so both transports enforce identical rules.
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required."));
    }
    socket.user = await verifyJwtAndLoadUser(token);
    next();
  } catch (error) {
    next(new Error("Invalid token."));
  }
};

module.exports = socketAuth;
