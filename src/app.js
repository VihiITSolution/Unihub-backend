const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { corsOriginCallback } = require("./config/cors");
const { blockMaliciousInput } = require("./middleware/inputSecurity");

// Import routes
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const courseContentRoutes = require("./routes/courseContentRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const youtubeRoutes = require("./routes/youtubeRoutes");
const liveSessionRoutes = require("./routes/liveSessionRoutes");
const profileRoutes = require("./routes/profileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const boardingRoutes = require("./routes/boardingRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const universityRoutes = require("./routes/universityRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminChatRoutes = require("./routes/adminChatRoutes");
const supportRoutes = require("./routes/supportRoutes");
const statsRoutes = require("./routes/statsRoutes");
const socialRoutes = require("./routes/socialRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const affiliateRoutes = require("./routes/affiliateRoutes");

const app = express();

// App is behind Nginx reverse proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security middleware. helmet()'s defaults already cover CSP, HSTS,
// X-Content-Type-Options, X-Frame-Options and Referrer-Policy; the options
// below only adjust what it leaves out or sets too loosely for an API.
app.use(
  helmet({
    // Nothing should frame the API. helmet defaults to 'self'.
    frameguard: { action: "deny" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { "frame-ancestors": ["'none'"] },
    },
    // Add preload to the default max-age and includeSubDomains. Only takes
    // effect over HTTPS, which Nginx terminates in production.
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// helmet does not set Permissions-Policy. The API needs none of these.
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  );
  next();
});

// CORS configuration (shared with Socket.io - see config/cors.js)
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body parser middleware.
//
// These limits apply to JSON and form-encoded bodies only. Every upload route
// uses multer, which parses multipart itself and enforces its own per-route
// fileSize, so the previous 5gb ceiling here guarded nothing: it only meant
// any unauthenticated request to any endpoint could make the process buffer
// gigabytes in memory before a handler ever ran.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "2mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.URLENCODED_BODY_LIMIT || "1mb",
  }),
);

// Reject XSS/SQL-injection-style payloads in body/query/params before they
// reach any route handler
app.use(blockMaliciousInput);

// Serves everything under uploads/ (thumbnails, videos, and - written by the
// Unihub-social microservice via a shared volume in production - avatars
// and post images).
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Apply rate limiting to all API routes
app.use("/api", apiLimiter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "UniHub API Server is running",
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date(),
  });
});

// API Documentation. Publishing the full API surface, including request
// shapes for admin and payment routes, is free reconnaissance; it is served
// outside production only. Set ENABLE_API_DOCS=true to expose it deliberately.
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_API_DOCS === "true") {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: "UniHub API Documentation",
    }),
  );
}

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api", courseContentRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/live-sessions", liveSessionRoutes);
app.use("/api/profile", profileRoutes);

app.use("/api/profile/vendor", vendorRoutes);
app.use("/api/boarding", boardingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/faculties", facultyRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/universities", universityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin/chat", adminChatRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/affiliate", affiliateRoutes);

// 404 handler - Express 5.x compatible
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
