const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

// Import routes
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const courseContentRoutes = require("./routes/courseContentRoutes");
const enrollmentRoutes = require("./routes/enrollmentRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const marketplaceRoutes = require("./routes/marketplaceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const profileRoutes = require("./routes/profileRoutes");
const youtubeRoutes = require("./routes/youtubeRoutes");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.CORS_ORIGIN === "*"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
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
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/youtube", youtubeRoutes);

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
