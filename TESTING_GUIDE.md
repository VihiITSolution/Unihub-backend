# Testing Guide - YouTube Video Integration

## Pre-Testing Setup

### 1. Database Migration
```bash
cd Unihub-backend
node src/migrations/add-youtube-video-id.js
```

**Expected Output**:
```
Adding youtube_video_id column to course_contents table...
✓ Successfully added youtube_video_id column
Migration completed successfully
```

### 2. YouTube API Setup
```bash
node setup-youtube.js
```

**Follow the prompts to**:
1. Set up YouTube credentials
2. Generate OAuth token

### 3. Start Services
```bash
# Terminal 1 - Backend
cd Unihub-backend
npm start

# Terminal 2 - Frontend
cd Unihub-core
npm run dev
```

## Test Cases

### Test 1: Video Upload (Tutor)

**Steps**:
1. Open browser: http://localhost:3000
2. Login as tutor
3. Navigate to "Create Course" or "Edit Course"
4. Add a new video lesson:
   - Title: "Test Video Upload"
   - Type: Video
   - File: Select a small MP4 file (< 50 MB for quick test)
   - Duration: 5 minutes
5. Click "Add Material" or "Upload"
6. Wait for upload completion

**Expected Results**:
- ✅ Upload progress shown
- ✅ Success message displayed
- ✅ Video appears in course materials list
- ✅ Video appears in your YouTube channel as "Unlisted"

**Verify**:
- Check backend console logs for: "Video uploaded to YouTube: https://youtube.com/watch?v=..."
- Check database: `SELECT * FROM course_contents WHERE type='video' ORDER BY id DESC LIMIT 1;`
  - `url` should contain YouTube URL
  - `youtube_video_id` should contain video ID (e.g., "abc123xyz")

### Test 2: Video Access Control (Student - Not Enrolled)

**Steps**:
1. Logout from tutor account
2. Login as a new student (not enrolled)
3. Try to navigate to course learning page directly: `/student/learn/{courseId}`

**Expected Results**:
- ✅ Redirected to login or enrollment page
- ✅ OR error message: "You must enroll in this course to access it"

**Verify**:
- Check browser console for 403 error
- Backend should log access attempt

### Test 3: Course Enrollment

**Steps**:
1. While logged in as student
2. Go to course details page: `/courses/{courseId}`
3. Click "Enroll Now"
4. Proceed through enrollment (payment skipped for now)

**Expected Results**:
- ✅ Enrollment successful
- ✅ Redirected to learning page
- ✅ Course materials visible

**Verify**:
- Check database: `SELECT * FROM enrollments WHERE learner_id={studentId} AND course_id={courseId};`
- Should show new enrollment record

### Test 4: Video Playback (Enrolled Student)

**Steps**:
1. As enrolled student, go to learning page: `/student/learn/{courseId}`
2. Click on the video lesson in sidebar
3. Observe video player

**Expected Results**:
- ✅ Video loads and plays
- ✅ No YouTube branding visible
- ✅ No related videos shown
- ✅ No channel name visible
- ✅ Video player controls work (play, pause, fullscreen)

**Verify**:
- Inspect iframe element in browser DevTools
- Check iframe `src` attribute should contain:
  - `youtube-nocookie.com` (not `youtube.com`)
  - `rel=0` parameter
  - `modestbranding=1` parameter
  - `showinfo=0` parameter

**Example expected src**:
```
https://www.youtube-nocookie.com/embed/abc123xyz?rel=0&modestbranding=1&showinfo=0
```

### Test 5: Privacy Settings

**Steps**:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Play the video
4. Check network requests

**Expected Results**:
- ✅ Requests go to `youtube-nocookie.com` (not `youtube.com`)
- ✅ No tracking cookies from YouTube
- ✅ Video streams properly

**Verify**:
- In DevTools > Application > Cookies
- Should NOT see cookies from `youtube.com`
- May see cookies from `youtube-nocookie.com` (expected for playback)

### Test 6: Multiple Videos

**Steps**:
1. As tutor, add 3 more video lessons to the same course
2. Use different file sizes and formats (MP4, MOV)
3. Wait for all uploads to complete

**Expected Results**:
- ✅ All videos upload successfully
- ✅ Each video has unique YouTube ID
- ✅ Videos appear in correct order in course

**Verify**:
- Check YouTube channel: Should have 4 new unlisted videos
- Check database: `SELECT id, title, youtube_video_id FROM course_contents WHERE course_id={courseId} AND type='video' ORDER BY "order";`

### Test 7: Video Navigation (Student)

**Steps**:
1. As enrolled student, go to learning page
2. Watch first video
3. Click "Next" button
4. Watch second video
5. Click "Previous" button

**Expected Results**:
- ✅ Videos change smoothly
- ✅ Correct video loads each time
- ✅ Progress buttons work correctly
- ✅ First video: "Previous" button disabled
- ✅ Last video: "Next" button disabled

### Test 8: Concurrent Uploads

**Steps**:
1. Open 2 browser tabs as tutor
2. Start uploading 2 different videos simultaneously
3. Monitor both uploads

**Expected Results**:
- ✅ Both uploads proceed independently
- ✅ No conflicts or errors
- ✅ Both videos appear in YouTube channel
- ✅ Both videos appear in course materials

**Verify**:
- Check backend logs for parallel upload processing
- Verify no database conflicts

### Test 9: Error Handling - Large File

**Steps**:
1. As tutor, try to upload video > 500 MB
2. Submit upload

**Expected Results**:
- ✅ Error message: "File too large"
- ✅ Upload rejected before processing
- ✅ User-friendly error displayed

### Test 10: Error Handling - Invalid Format

**Steps**:
1. As tutor, try to upload non-video file (e.g., .txt, .docx)
2. Submit upload

**Expected Results**:
- ✅ Error message: "Invalid file format"
- ✅ Upload rejected
- ✅ Suggested formats shown

### Test 11: Access from Different Device

**Steps**:
1. Enroll student from desktop browser
2. Login same student from mobile browser
3. Access course learning page

**Expected Results**:
- ✅ Videos load on mobile
- ✅ Player is responsive
- ✅ Privacy settings maintained
- ✅ Enrollment persists across devices

### Test 12: Tutor Can View Without Enrollment

**Steps**:
1. As tutor who created the course
2. Go to learning page of your own course
3. Try to play videos

**Expected Results**:
- ✅ Tutor can access videos without enrollment
- ✅ All course materials visible
- ✅ Videos play normally

**Verify**:
- Backend should recognize tutor role and skip enrollment check

## Performance Tests

### Test P1: Upload Speed

**Steps**:
1. Upload 50 MB video
2. Note start time and end time

**Expected**:
- Upload time depends on internet speed
- Typically: 2-5 minutes for 50 MB on average connection

### Test P2: Playback Latency

**Steps**:
1. Click on video lesson
2. Measure time until video starts playing

**Expected**:
- Initial load: < 3 seconds
- Buffering: Minimal (YouTube handles this)

### Test P3: Multiple Concurrent Viewers

**Steps**:
1. Have 5+ students access same video simultaneously
2. Monitor playback quality

**Expected**:
- ✅ All students can watch smoothly
- ✅ No degradation in quality
- ✅ YouTube CDN handles load

## Security Tests

### Test S1: Direct YouTube Link

**Steps**:
1. Get YouTube video URL from database
2. Open link in incognito browser (not logged in to LMS)
3. Try to watch video directly on YouTube

**Expected**:
- ✅ Video is "Unlisted" so link works
- ⚠️ Anyone with link can watch on YouTube (this is expected behavior for unlisted videos)
- ✅ Video won't appear in searches or related videos

**Note**: For maximum security, consider making videos "Private" and using YouTube's embed API with signed tokens (advanced feature).

### Test S2: Enrollment Bypass Attempt

**Steps**:
1. As non-enrolled student
2. Try to access video directly via API: `GET /api/content/{contentId}`
3. Check response

**Expected**:
- ✅ 403 Forbidden response
- ✅ Error message: "You must be enrolled in this course to access this content"

**Verify**:
- Check backend logs for blocked access attempt

### Test S3: XSS/Injection

**Steps**:
1. Try to create lesson with title: `<script>alert('XSS')</script>`
2. Submit and view lesson list

**Expected**:
- ✅ Script tags escaped/sanitized
- ✅ No alert popup
- ✅ Title displayed as plain text

## Browser Compatibility

Test in multiple browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

**For each browser**:
1. Test video playback
2. Test enrollment flow
3. Verify privacy settings

## Troubleshooting Common Issues

### Issue: "YouTube upload failed"

**Check**:
```bash
# Verify credentials file exists
ls src/config/youtube-credentials.json

# Verify token file exists
ls src/config/youtube-token.json

# Check backend logs
tail -f logs/backend.log  # or wherever your logs are
```

**Solution**:
1. Re-run `node authorize-youtube.js`
2. Check YouTube API quota in Google Cloud Console
3. Verify OAuth token hasn't expired

### Issue: "Video not playing"

**Check**:
```javascript
// Browser console
console.log(document.querySelector('iframe').src);
// Should output: https://www.youtube-nocookie.com/embed/...
```

**Solution**:
1. Verify video exists on YouTube channel
2. Check video privacy is "Unlisted" (not Private)
3. Clear browser cache

### Issue: "Enrollment check failing"

**Check Database**:
```sql
-- Check enrollment
SELECT * FROM enrollments 
WHERE learner_id = {studentId} 
AND course_id = {courseId};

-- Check course content
SELECT * FROM course_contents 
WHERE id = {contentId};
```

**Solution**:
1. Ensure student is enrolled
2. Verify courseId matches
3. Check JWT token is valid

## Success Criteria

All tests should pass with:
- ✅ 100% video upload success rate
- ✅ < 3 seconds video load time
- ✅ 0 unauthorized access attempts succeed
- ✅ Privacy settings working in all browsers
- ✅ No YouTube branding visible to students
- ✅ Enrollment validation working correctly

## Test Summary Template

```
Test Date: _____________
Tester: _________________

Backend Status:  ☐ Running  ☐ Not Running
Frontend Status: ☐ Running  ☐ Not Running
Database Status: ☐ Connected  ☐ Not Connected

Test Results:
[ ] Test 1: Video Upload
[ ] Test 2: Access Control
[ ] Test 3: Enrollment
[ ] Test 4: Video Playback
[ ] Test 5: Privacy Settings
[ ] Test 6: Multiple Videos
[ ] Test 7: Video Navigation
[ ] Test 8: Concurrent Uploads
[ ] Test 9: Error Handling - Large File
[ ] Test 10: Error Handling - Invalid Format
[ ] Test 11: Cross-Device Access
[ ] Test 12: Tutor Access

Performance Tests:
[ ] Test P1: Upload Speed
[ ] Test P2: Playback Latency
[ ] Test P3: Concurrent Viewers

Security Tests:
[ ] Test S1: Direct YouTube Link
[ ] Test S2: Enrollment Bypass
[ ] Test S3: XSS/Injection

Browser Compatibility:
[ ] Chrome/Edge
[ ] Firefox
[ ] Safari
[ ] Mobile Safari
[ ] Chrome Mobile

Issues Found:
_________________________________
_________________________________
_________________________________

Overall Status: ☐ PASS  ☐ FAIL

Notes:
_________________________________
_________________________________
```

---

**For production deployment**, ensure ALL tests pass before going live!
