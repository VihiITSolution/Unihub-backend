# Update User Name - Gayan Pathirage to Mithun Dissanayake

This script will update the user profile name from "Gayan Pathirage" to "Mithun Dissanayake" across the entire application database.

## What Gets Updated

The script will update the user name in:

- **User** table (firstName & lastName)
- **StudentProfile** table (if exists)
- **TutorProfile** table (if exists)
- **VendorProfile** table (if exists)

## Prerequisites

1. Make sure your database is running
2. Ensure `.env` file is properly configured with database credentials
3. Node.js and npm are installed

## How to Run

### Step 1: Navigate to the backend directory

```bash
cd Unihub-backend
```

### Step 2: Run the update script

```bash
node update-user-name.js
```

## What It Does

The script will:

1. Connect to your MySQL database using the configuration from `src/config/database.js`
2. Search for users with first name "Gayan" and last name "Pathirage"
3. Update the user's name to "Mithun" and "Dissanayake"
4. Update all associated profiles (student, tutor, vendor)
5. Display a success message with details of changes made

## Example Output

```
🔍 Searching for user: Gayan Pathirage...

✓ Found 2 user(s) named "Gayan Pathirage"

Updating user ID: 1
  Email: gayan@example.com
  Current Name: Gayan Pathirage
  ✓ User name updated

  ✓ Tutor profile updated

  ✓ Student profile updated

✅ All updates completed successfully!

Updates made:
  • User profiles: 2
  • Name changed from: Gayan Pathirage
  • Name changed to: Mithun Dissanayake
```

## If You Have Multiple Users Named Gayan Pathirage

If the script finds multiple users with this name, it will update all of them. The script shows:

- User ID
- Email address
- Current name

## Troubleshooting

If the script fails:

1. **Database Connection Error**: Check your `.env` file database credentials
2. **User Not Found**: The user name might be stored differently (different capitalization, spaces, etc.)
3. **Permission Error**: Ensure your database user has UPDATE permissions

## After Running the Script

1. The changes will be reflected immediately in the database
2. Users will see the updated name when they log in
3. All student/tutor dashboards will show the new name
4. Enrolled courses, reviews, and other content will still be associated with the user

## To Undo Changes (if needed)

If you need to undo this, you can manually update back to "Gayan Pathirage" using the database:

```sql
UPDATE Users SET first_name = 'Gayan', last_name = 'Pathirage' WHERE id = [USER_ID];
UPDATE StudentProfiles SET first_name = 'Gayan', last_name = 'Pathirage' WHERE user_id = [USER_ID];
UPDATE TutorProfiles SET first_name = 'Gayan', last_name = 'Pathirage' WHERE user_id = [USER_ID];
UPDATE VendorProfiles SET first_name = 'Gayan', last_name = 'Pathirage' WHERE user_id = [USER_ID];
```
