# Notification Worker

**Purpose:** Dispatch notifications to users via multiple channels.

**Inputs:**
- Notification queue items
- Telegram bot configuration
- User notification preferences

**Outputs:**
- Sent Telegram messages
- In-app notification records
- Delivery status updates

**Flow:**
1. Dequeue pending notifications
2. Check user preferences and rate limits
3. Send via configured channels
4. Mark as delivered or failed

**Future Implementation Phase:** 11
