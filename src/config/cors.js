// Shared allowed-origins logic, used by both Express's CORS middleware and
// Socket.io's `cors` option so the two allow-lists can't drift apart.
const allowedOrigins = process.env.ALLOWED_FRONTEND_ORIGINS
  ? process.env.ALLOWED_FRONTEND_ORIGINS.split(",").map((origin) => origin.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://unihub-frontend:3000",
    ];

const isOriginAllowed = (origin) => {
  // Allow requests with no origin (mobile apps, Postman, server-to-server)
  if (!origin) return true;

  if (allowedOrigins.indexOf(origin) !== -1) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    const serverHost = process.env.DO_HOST || "";
    if (serverHost && origin.includes(serverHost)) {
      return true;
    }
    // Allow any http/https origin in production (API is protected by JWT anyway)
    return true;
  }

  return false;
};

const corsOriginCallback = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  callback(new Error("Not allowed by CORS"));
};

module.exports = { allowedOrigins, isOriginAllowed, corsOriginCallback };
