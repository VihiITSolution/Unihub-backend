#!/bin/bash

# Quick fix script for notification system
# This checks and fixes the notification database setup

echo "🔧 Notification System Fix Script"
echo "=================================="
echo ""

# Step 1: Check if table exists
echo "Step 1: Checking notification setup..."
cd Unihub-backend
node check-notification-setup.js

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Notifications table is missing!"
    echo "Running migration to create table..."
    echo ""
    
    # Step 2: Run migration
    node src/migrations/create-notifications.js
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Migration completed!"
        echo ""
        
        # Step 3: Verify again
        echo "Verifying setup..."
        node check-notification-setup.js
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "🎉 SUCCESS! Notification system is ready!"
            echo ""
            echo "Next step: Restart backend server"
            echo "  docker-compose restart backend"
            echo "  OR"
            echo "  pm2 restart backend"
        fi
    else
        echo ""
        echo "❌ Migration failed. Check error above."
        exit 1
    fi
else
    echo ""
    echo "✅ Notification system is already set up correctly!"
fi

echo ""
echo "Done!"
