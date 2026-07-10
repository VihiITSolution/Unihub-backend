const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const { corsOriginCallback } = require("./config/cors");

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

const app = express();

// App is behind Nginx reverse proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security middleware
app.use(helmet());

// CORS configuration (shared with Socket.io - see config/cors.js)
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body parser middleware
app.use(express.json({ limit: "5gb" }));
app.use(express.urlencoded({ extended: true, limit: "5gb" }));

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

// API Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "UniHub API Documentation",
  }),
);

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
