const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UniHub E-Learning Platform API',
      version: '1.0.0',
      description: 'API documentation for UniHub E-Learning Platform - A comprehensive platform for online learning and marketplace',
      contact: {
        name: 'VihiITSolution',
        url: 'https://github.com/VihiITSolution/Unihub-backend'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and profile management'
      },
      {
        name: 'Courses',
        description: 'Course management (Phase 1 - Core E-Learning MVP)'
      },
      {
        name: 'Enrollments',
        description: 'Course enrollment and progress tracking'
      },
      {
        name: 'Payments',
        description: 'Payment processing for courses and marketplace items'
      },
      {
        name: 'Marketplace',
        description: 'Marketplace listing management (Phase 3)'
      },
      {
        name: 'Admin',
        description: 'Admin control panel and moderation'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
