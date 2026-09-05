# UniHub Backend API

A comprehensive Node.js/Express backend API for the UniHub E-Learning Platform with integrated marketplace functionality. Built with Sequelize ORM and MySQL database.

## 🚀 Features

### Phase 1: Core E-Learning MVP
- **User Management**
  - Registration and authentication (JWT-based)
  - Role-based access control (Learner, Tutor, Admin)
  - User profile management
  
- **Course Management**
  - Course creation and management (Tutors)
  - Course content upload/retrieval
  - **🎥 YouTube Video Integration** - Automatic upload to YouTube as unlisted
  - Course search and filtering
  - Course categorization and levels
  
- **Video Management** ⭐ NEW
  - **Automatic YouTube Upload** - Videos uploaded as unlisted
  - **Secure Embedding** - Privacy-enhanced player with no branding
  - **Access Control** - Only enrolled students can view
  - **YouTube Storage** - Free unlimited storage and CDN
  
- **Enrollment System**
  - Course enrollment for learners
  - Progress tracking
  - Enrollment management
  - **Video Access Validation** - Enrollment required for video viewing
  
- **Payment Processing**
  - Payment integration for course purchases
  - Payment history tracking
  - Transaction management

### Phase 3: Marketplace Module
- **Marketplace Listings**
  - Create and manage product listings
  - Support for books, notes, equipment, and electronics
  - Search and filter functionality
  - Item condition tracking
  
- **Marketplace Features**
  - Seller contact information
  - View count tracking
  - Location-based listings

### Admin Controls
- **User Management**
  - View all users with filters
  - Activate/deactivate accounts
  - User verification management
  
- **Content Moderation**
  - Course moderation
  - Marketplace item moderation
  
- **Analytics & Reporting**
  - Platform statistics
  - Revenue tracking
  - User analytics

### Security Features
- **Authentication & Authorization**
  - JWT token-based authentication
  - Bcrypt password hashing (12 rounds)
  - Role-based access control
  - Algorithm-specific JWT verification
  
- **Rate Limiting**
  - General API rate limiting (100 requests per 15 minutes)
  - Strict authentication rate limiting (5 attempts per 15 minutes)
  - Resource creation rate limiting (20 requests per 15 minutes)
  
- **Security Headers**
  - Helmet.js for secure HTTP headers
  - CORS configuration
  - Input validation and sanitization
- **Analytics & Reporting**
  - Platform statistics
  - Revenue tracking
  - User analytics

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/VihiITSolution/Unihub-backend.git
   cd Unihub-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=unihub_db
   DB_USER=root
   DB_PASSWORD=your_password
   
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=24h
   # Required before students can save affiliate payout bank details.
   # Use a unique, high-entropy production secret; do not reuse JWT_SECRET.
   AFFILIATE_PAYOUT_ENCRYPTION_KEY=replace_with_a_long_random_secret
   
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Create MySQL database**
   ```sql
   CREATE DATABASE unihub_db;
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

7. **🎥 Setup YouTube Integration (for video uploads)**
   ```bash
   # Run the setup wizard
   node setup-youtube.js
   
   # Follow prompts to:
   # 1. Add YouTube API credentials
   # 2. Generate OAuth token
   
   # Then run the migration
   node src/migrations/add-youtube-video-id.js
   ```
   
   **For detailed YouTube setup**, see:
   - [YouTube Integration Guide](YOUTUBE_INTEGRATION_GUIDE.md) - Complete documentation
   - [YouTube Setup](YOUTUBE_SETUP.md) - Step-by-step API setup
   - [Tutor Guide](TUTOR_VIDEO_GUIDE.md) - Video upload instructions for tutors

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

Once the server is running, access the Swagger API documentation at:
```
http://localhost:3000/api-docs
```

### API Endpoints Overview

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

#### Courses (Phase 1)
- `POST /api/courses` - Create course (Tutor)
- `GET /api/courses` - Get all courses with filters
- `GET /api/courses/:id` - Get course by ID
- `PUT /api/courses/:id` - Update course (Tutor/Admin)
- `DELETE /api/courses/:id` - Delete course (Tutor/Admin)
- `GET /api/courses/my-courses` - Get tutor's courses

#### Enrollments
- `POST /api/enrollments` - Enroll in a course
- `GET /api/enrollments` - Get user enrollments
- `PUT /api/enrollments/:id/progress` - Update progress
- `PUT /api/enrollments/:id/cancel` - Cancel enrollment

#### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments` - Get payment history
- `GET /api/payments/:id` - Get payment by ID

#### Marketplace (Phase 3)
- `POST /api/marketplace` - Create listing
- `GET /api/marketplace` - Get all listings with filters
- `GET /api/marketplace/:id` - Get listing by ID
- `PUT /api/marketplace/:id` - Update listing
- `DELETE /api/marketplace/:id` - Delete listing
- `GET /api/marketplace/my-listings` - Get user's listings

#### Admin
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/:id/status` - Update user status
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/statistics` - Get platform statistics
- `GET /api/admin/courses` - Get all courses for moderation
- `GET /api/admin/marketplace` - Get all marketplace items

## 🗄️ Database Schema

### Users
- User authentication and profile information
- Roles: learner, tutor, admin
- Profile images and bio

### Courses
- Course information and content
- Pricing and duration
- Rating and review count
- Publication status

### Enrollments
- Student course enrollments
- Progress tracking (0-100%)
- Status: enrolled, in_progress, completed, cancelled

### Payments
- Payment transactions
- Support for both courses and marketplace items
- Transaction ID tracking
- Payment gateway integration

### MarketplaceItems
- Product listings
- Item types: book, notes, equipment, electronics, other
- Condition tracking
- Seller information

## 🔐 Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 👥 Test Accounts

After running `npm run seed`, the following test accounts are available:

**Admin:**
- Email: admin@unihub.com
- Password: admin123

**Tutors:**
- Email: john.smith@unihub.com, Password: tutor123
- Email: sarah.johnson@unihub.com, Password: tutor123

**Learners:**
- Email: mike.davis@unihub.com, Password: learner123
- Email: emily.brown@unihub.com, Password: learner123

## 🛠️ Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Sequelize
- **Database:** MySQL
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcryptjs (12 rounds)
- **Validation:** express-validator
- **API Documentation:** Swagger (swagger-jsdoc, swagger-ui-express)
- **Security:** Helmet, CORS, express-rate-limit
- **Unique IDs:** UUID
- **Environment Variables:** dotenv

## 📁 Project Structure

```
Unihub-backend/
├── src/
│   ├── config/
│   │   ├── database.js       # Database configuration
│   │   ├── sequelize.js      # Sequelize instance
│   │   └── swagger.js        # Swagger configuration
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   ├── enrollmentController.js
│   │   ├── paymentController.js
│   │   ├── marketplaceController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js           # Authentication & authorization
│   │   ├── errorHandler.js   # Global error handler
│   │   ├── rateLimiter.js    # Rate limiting middleware
│   │   └── validate.js       # Validation middleware
│   ├── migrations/
│   │   ├── migrate.js        # Database migration script
│   │   └── seed.js           # Database seeding script
│   ├── models/
│   │   ├── User.js
│   │   ├── Course.js
│   │   ├── Enrollment.js
│   │   ├── Payment.js
│   │   ├── MarketplaceItem.js
│   │   └── index.js          # Model relationships
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── enrollmentRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── marketplaceRoutes.js
│   │   └── adminRoutes.js
│   ├── utils/
│   │   └── token.js          # JWT utilities
│   ├── app.js                # Express app setup
│   └── server.js             # Server entry point
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

**VihiITSolution**

- GitHub: [@VihiITSolution](https://github.com/VihiITSolution)

## 📞 Support

For support, email support@unihub.com or open an issue in the GitHub repository.
