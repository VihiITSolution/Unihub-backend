# API Testing Guide

This document provides instructions for testing the UniHub Backend API endpoints.

## Prerequisites

1. Server must be running: `npm run dev`
2. Database must be migrated: `npm run migrate`
3. (Optional) Seed data loaded: `npm run seed`

## Base URL

```
http://localhost:3000
```

## Testing with cURL

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. User Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "password123",
    "role": "learner"
  }'
```

### 3. User Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Save the token from the response for subsequent requests.

### 4. Get User Profile (Requires Authentication)

```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Get All Courses

```bash
curl -X GET "http://localhost:3000/api/courses?page=1&limit=10"
```

### 6. Create Course (Tutor Only)

```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TUTOR_JWT_TOKEN" \
  -d '{
    "title": "Introduction to Python",
    "description": "Learn Python programming from scratch",
    "category": "Programming",
    "level": "beginner",
    "price": 49.99,
    "duration": 40
  }'
```

### 7. Enroll in Course (Learner Only)

```bash
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LEARNER_JWT_TOKEN" \
  -d '{
    "courseId": 1
  }'
```

### 8. Create Payment

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "enrollmentId": 1,
    "paymentMethod": "credit_card"
  }'
```

### 9. Create Marketplace Listing

```bash
curl -X POST http://localhost:3000/api/marketplace \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Calculus Textbook",
    "description": "Used textbook in good condition",
    "category": "Books",
    "itemType": "book",
    "condition": "good",
    "price": 35.00,
    "location": "Campus Library",
    "contactInfo": "test@example.com"
  }'
```

### 10. Get Marketplace Listings

```bash
curl -X GET "http://localhost:3000/api/marketplace?page=1&limit=10"
```

### 11. Get Platform Statistics (Admin Only)

```bash
curl -X GET http://localhost:3000/api/admin/statistics \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

## Testing with Postman

1. Import the API into Postman using the Swagger documentation
2. Visit: `http://localhost:3000/api-docs`
3. Use the "Try it out" feature in Swagger UI

## Test Accounts (After Seeding)

### Admin
- Email: `admin@unihub.com`
- Password: `admin123`

### Tutors
- Email: `john.smith@unihub.com`, Password: `tutor123`
- Email: `sarah.johnson@unihub.com`, Password: `tutor123`

### Learners
- Email: `mike.davis@unihub.com`, Password: `learner123`
- Email: `emily.brown@unihub.com`, Password: `learner123`

## Expected Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Error details (optional)
  ]
}
```

## Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized (No token or invalid token)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## API Endpoints Summary

### Authentication (`/api/auth`)
- POST `/register` - Register new user
- POST `/login` - Login user
- GET `/profile` - Get current user profile (Auth)
- PUT `/profile` - Update user profile (Auth)

### Courses (`/api/courses`)
- POST `/` - Create course (Tutor/Admin)
- GET `/` - Get all courses (with filters)
- GET `/my-courses` - Get tutor's courses (Tutor/Admin)
- GET `/:id` - Get course by ID
- PUT `/:id` - Update course (Tutor/Admin)
- DELETE `/:id` - Delete course (Tutor/Admin)

### Enrollments (`/api/enrollments`)
- POST `/` - Enroll in course (Learner/Admin)
- GET `/` - Get user enrollments (Learner/Admin)
- PUT `/:id/progress` - Update progress (Learner/Admin)
- PUT `/:id/cancel` - Cancel enrollment (Learner/Admin)

### Payments (`/api/payments`)
- POST `/` - Create payment (Auth)
- GET `/` - Get payment history (Auth)
- GET `/:id` - Get payment by ID (Auth)

### Marketplace (`/api/marketplace`)
- POST `/` - Create listing (Auth)
- GET `/` - Get all listings (with filters)
- GET `/my-listings` - Get user's listings (Auth)
- GET `/:id` - Get listing by ID
- PUT `/:id` - Update listing (Auth)
- DELETE `/:id` - Delete listing (Auth)

### Admin (`/api/admin`)
- GET `/users` - Get all users (Admin)
- PUT `/users/:id/status` - Update user status (Admin)
- DELETE `/users/:id` - Delete user (Admin)
- GET `/statistics` - Get platform statistics (Admin)
- GET `/courses` - Get all courses for moderation (Admin)
- GET `/marketplace` - Get all marketplace items (Admin)

## Notes

- Replace `YOUR_JWT_TOKEN`, `YOUR_TUTOR_JWT_TOKEN`, `YOUR_LEARNER_JWT_TOKEN`, and `YOUR_ADMIN_JWT_TOKEN` with actual tokens obtained from login
- All authenticated endpoints require the `Authorization: Bearer <token>` header
- Some endpoints are role-specific (Learner, Tutor, Admin)
- Query parameters can be used for filtering and pagination
