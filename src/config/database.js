require("dotenv").config();

module.exports = {
  development: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "unihub_db",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    dialect: "mysql",
    logging: false,
    pool: {
      max: 10, // Increased for better concurrency
      min: 2, // Keep minimum connections alive
      acquire: 60000, // Increased to 60s for remote DB
      idle: 20000, // Keep connections alive longer
      evict: 30000, // Remove stale connections after 30s
    },
    dialectOptions: {
      connectTimeout: 30000, // 30s connection timeout
      socketPath: undefined,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: false,
    },
    retry: {
      max: 3, // Retry failed connections 3 times
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ER_NET_READ_INTERRUPTED/,
      ],
    },
  },
  test: {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "unihub_test_db",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    dialect: "mysql",
    logging: false,
  },
  production: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialect: "mysql",
    logging: false,
    pool: {
      max: 20, // Higher for production load
      min: 5, // Maintain minimum pool
      acquire: 60000, // 60s acquire timeout
      idle: 20000, // Keep connections alive
      evict: 30000, // Evict stale connections
    },
    dialectOptions: {
      connectTimeout: 30000,
      socketPath: undefined,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: false,
    },
    retry: {
      max: 5, // More retries in production
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ER_NET_READ_INTERRUPTED/,
      ],
    },
  },
};
