const jwt = require("jsonwebtoken");
const { User } = require("../models");

/**
 * Verifies a JWT and loads the corresponding active user. Shared by
 * authMiddleware (HTTP) and the Socket.io auth middleware, so both
 * transports enforce identical rules.
 * @returns {Promise<import("../models/User")>} the loaded user
 * @throws if the token is invalid/expired or the user is missing/inactive
 */
const verifyJwtAndLoadUser = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
  const user = await User.findByPk(decoded.id);

  if (!user || !user.isActive) {
    throw new Error("Invalid token or user inactive.");
  }

  return user;
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    req.user = await verifyJwtAndLoadUser(token);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

/**
 * Authorize middleware for multi-role support
 * Checks if user has at least one of the required roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Check if user has at least one of the allowed roles
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const primaryRole = req.user.primaryRole;
    const hasRole = allowedRoles.some(
      (role) => userRoles.includes(role) || primaryRole === role,
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. Insufficient permissions.",
      });
    }

    next();
  };
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    const user = await User.findByPk(decoded.id);

    if (user && user.isActive) {
      req.user = user;
    }
    next();
  } catch (error) {
    // If token is invalid (expired etc), just proceed as guest
    next();
  }
};

/**
 * Check if user has a specific role (for conditional logic)
 */
const hasRole = (user, role) => {
  return user && user.roles && user.roles.includes(role);
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  authorize,
  hasRole,
  verifyJwtAndLoadUser,
};
