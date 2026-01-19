# Live Session Feature - YouTube Live Integration

## Overview
UniHub now supports live streaming sessions using YouTube Live! Tutors can schedule, host, and monetize live classes while students join via privacy-enhanced YouTube embedding.

## Features

### For Tutors
- 📅 **Schedule Live Sessions** - Set date, time, title, description
- 💰 **Flexible Pricing** - Free or paid sessions with platform commission
- 🎥 **YouTube Live Streaming** - Automatic YouTube broadcast creation
- 👥 **Student Invitations** - Invite specific students
- 📊 **Attendance Tracking** - See who joined and for how long
- 💵 **Revenue Management** - Track earnings with automatic commission calculation

### For Students
- 📺 **Privacy-Enhanced Viewing** - youtube-nocookie.com embedding
- 🎓 **Enroll in Sessions** - Free or paid enrollment
- 💬 **Live Chat** - Participate in YouTube Live chat (optional)
- 📹 **Session Recordings** - Access recordings after sessions end

### Platform Benefits
- 💸 **Commission-Based Revenue** - Configurable commission rate (default 10%)
- 📡 **Zero Bandwidth Costs** - YouTube handles all streaming
- 🔒 **Secure & Scalable** - Built on YouTube's infrastructure

## API Endpoints

### Live Session Management

#### Create Live Session
```http
POST /api/live-sessions
Authorization: Bearer {tutor_token}
Content-Type: application/json

{
  "title": "Introduction to React Hooks",
  "description": "Learn useState, useEffect, and custom hooks",
  "courseId": 123,  // Optional - link to a course
  "scheduledStartTime": "2026-01-25T10:00:00Z",
  "scheduledEndTime": "2026-01-25T12:00:00Z",
  "isFree": false,
  "price": 25.00,
  "maxAttendees": 50,  // null for unlimited
  "allowRecording": true,
  "enableChat": true,
  "privacyStatus": "unlisted",  // unlisted, private, or public
  "tags": ["react", "javascript", "web-development"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Live session created successfully",
  "data": {
    "session": {
      "id": 1,
      "title": "Introduction to React Hooks",
      "status": "scheduled",
      "youtubeVideoId": "abc123xyz",
      ...
    },
    "streaming": {
      "watchUrl": "https://www.youtube.com/watch?v=abc123xyz",
      "embedUrl": "https://www.youtube-nocookie.com/embed/abc123xyz",
      "streamUrl": "rtmp://a.rtmp.youtube.com/live2",
      "streamKey": "xxxx-xxxx-xxxx-xxxx"
    }
  }
}
```

#### Get All Sessions
```http
GET /api/live-sessions?upcoming=true&tutorId=5&isFree=false
```

#### Get Session Details
```http
GET /api/live-sessions/:id
```

#### Update Session
```http
PUT /api/live-sessions/:id
Authorization: Bearer {tutor_token}
```

#### Cancel Session
```http
DELETE /api/live-sessions/:id
Authorization: Bearer {tutor_token}
```

### Session Control

#### Start Session (Go Live)
```http
POST /api/live-sessions/:id/start
Authorization: Bearer {tutor_token}
```

#### End Session
```http
POST /api/live-sessions/:id/end
Authorization: Bearer {tutor_token}
```

### Student Enrollment

#### Enroll in Session
```http
POST /api/live-sessions/:id/enroll
Authorization: Bearer {student_token}
Content-Type: application/json

{
  "paymentId": "pay_abc123"  // Required for paid sessions
}
```

#### Invite Students (Tutor)
```http
POST /api/live-sessions/:id/invite
Authorization: Bearer {tutor_token}
Content-Type: application/json

{
  "studentIds": [10, 15, 20, 25]
}
```

#### Get My Enrollments
```http
GET /api/live-sessions/my/enrollments?upcoming=true
Authorization: Bearer {student_token}
```

#### Join Live Session
```http
POST /api/live-sessions/:id/join
Authorization: Bearer {student_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Joined session successfully",
  "data": {
    "embedUrl": "https://www.youtube-nocookie.com/embed/abc123xyz?autoplay=1&rel=0&modestbranding=1",
    "chatUrl": "https://www.youtube.com/live_chat?v=abc123xyz",
    "session": { ... }
  }
}
```

#### Leave Session
```http
POST /api/live-sessions/:id/leave
Authorization: Bearer {student_token}
```

#### Get Session Enrollments (Tutor)
```http
GET /api/live-sessions/:id/enrollments
Authorization: Bearer {tutor_token}
```

## How to Stream

### Option 1: Use Streaming Software (OBS, Streamlabs)

1. **Create a session** via API
2. **Copy stream details** from response:
   - Stream URL: `rtmp://a.rtmp.youtube.com/live2`
   - Stream Key: `xxxx-xxxx-xxxx-xxxx`
3. **Configure OBS:**
   - Settings → Stream
   - Service: Custom
   - Server: {stream URL}
   - Stream Key: {stream key}
4. **Start streaming** in OBS
5. **Go live** via API: `POST /api/live-sessions/:id/start`

### Option 2: Use YouTube Studio (Web/Mobile)

1. **Create a session** via API
2. **Open YouTube Studio** → Go Live
3. **Select the scheduled broadcast** created by the API
4. **Start streaming**

## Revenue & Commission

### Commission Calculation
```javascript
// Default: 10% platform commission
sessionPrice = 25.00
platformCommission = 25.00 * 10 / 100 = 2.50
tutorEarnings = 25.00 - 2.50 = 22.50
```

### Configure Commission Rate
Set in `.env`:
```env
PLATFORM_COMMISSION_RATE=10
```

Or per-session in request body:
```json
{
  "platformCommissionRate": 15.00
}
```

## Privacy & Security

### Privacy Features
- ✅ **Unlisted by default** - Videos not searchable on YouTube
- ✅ **youtube-nocookie.com** - No tracking cookies
- ✅ **Enrollment validation** - Only enrolled students can join
- ✅ **URL parameters** - `rel=0&modestbranding=1` (no related videos/branding)

### Access Control
```
flowchart TD
    A[Student tries to join] --> B{Enrolled?}
    B -->|No| C[403 Forbidden]
    B -->|Yes| D{Payment OK?}
    D -->|No| E[Payment required]
    D -->|Yes| F{Session live?}
    F -->|No| G[Not live yet]
    F -->|Yes| H[Show video player]
```

## Database Schema

### live_sessions
```sql
CREATE TABLE live_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tutor_id INT NOT NULL,
  course_id INT NULL,
  title VARCHAR(255) NOT NULL,
  scheduled_start_time DATETIME NOT NULL,
  is_free TINYINT(1) DEFAULT 1,
  price DECIMAL(10, 2) DEFAULT 0.00,
  platform_commission_rate DECIMAL(5, 2) DEFAULT 10.00,
  youtube_video_id VARCHAR(50),
  status ENUM('scheduled', 'cancelled', 'live', 'ended', 'recorded'),
  total_revenue DECIMAL(10, 2) DEFAULT 0.00,
  ...
)
```

### session_enrollments
```sql
CREATE TABLE session_enrollments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0.00,
  payment_status ENUM('pending', 'completed', 'failed', 'refunded'),
  joined_at DATETIME,
  attendance_duration INT DEFAULT 0,
  ...
  UNIQUE KEY (session_id, student_id)
)
```

## Cost Savings

### Comparison with Self-Hosted
| Aspect | Self-Hosted | YouTube Live |
|--------|-------------|--------------|
| Streaming infra | ~$200/mo | $0 |
| Bandwidth | ~$100-300/mo | $0 |
| Storage (recordings) | ~$50/mo | $0 |
| CDN | ~$100/mo | $0 |
| **Total** | **~$450-650/mo** | **$0** |

### YouTube API Quota
- **Daily quota**: 10,000 units
- **Create broadcast**: ~1,600 units
- **~6 sessions/day** within free quota

## Next Steps

### Frontend Implementation
1. Create tutor dashboard page: "Schedule Live Session"
2. Create student page: "Upcoming Live Sessions"
3. Create live session player component
4. Add payment integration for paid sessions

### Future Enhancements
- Email/SMS notifications for session reminders
- Automated recording uploads
- Session analytics dashboard
- Q&A feature integration
- Polls and quizzes during live sessions
- Multi-tutor panel discussions

## Testing

### Quick Test
```bash
# 1. Create a session as tutor
curl -X POST http://localhost:3000/api/live-sessions \
  -H "Authorization: Bearer {tutor_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Session",
    "scheduledStartTime": "2026-01-25T10:00:00Z",
    "scheduledEndTime": "2026-01-25T11:00:00Z",
    "isFree": true
  }'

# 2. Enroll as student
curl -X POST http://localhost:3000/api/live-sessions/1/enroll \
  -H "Authorization: Bearer {student_token}"

# 3. Start session (tutor)
curl -X POST http://localhost:3000/api/live-sessions/1/start \
  -H "Authorization: Bearer {tutor_token}"

# 4. Join session (student)
curl -X POST http://localhost:3000/api/live-sessions/1/join \
  -H "Authorization: Bearer {student_token}"
```

## Support

For questions or issues:
- Check API documentation: http://localhost:3000/api-docs
- Review YouTube setup guide: YOUTUBE_SETUP.md
- Contact: dev@unihub.com
