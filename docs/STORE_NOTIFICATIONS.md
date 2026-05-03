# Store Notifications Integration

## Overview

This document describes the integration of store-related push notifications into the existing notification system. The implementation extends the existing Expo Notifications setup to handle store events.

## Notification Types

The following store notification types are supported:

### 1. Store Approved (`store_approved`)
- **Trigger**: When an admin approves a pending store
- **Recipient**: Store owner
- **Data**: `{ type: 'store_approved', storeId: string }`
- **Navigation**: Navigates to store details screen `/(tabs)/stores/[id]`

### 2. Store Rejected (`store_rejected`)
- **Trigger**: When an admin rejects a pending store
- **Recipient**: Store owner
- **Data**: `{ type: 'store_rejected', storeId: string, reason: string }`
- **Navigation**: Navigates to store details screen `/(tabs)/stores/[id]`

### 3. New Review (`new_review`)
- **Trigger**: When a user submits a review for a store
- **Recipient**: Store owner
- **Data**: `{ type: 'new_review', storeId: string, reviewId: string }`
- **Navigation**: Navigates to store details screen where reviews are displayed `/(tabs)/stores/[id]`

## Implementation Details

### Foreground Notifications

When the app is in the foreground, notifications are handled by the `Notifications.setNotificationHandler` configuration:

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,      // Show banner
    shouldPlaySound: true,       // Play sound
    shouldSetBadge: true,        // Update badge count
    shouldShowBanner: true,      // Show banner (iOS)
    shouldShowList: true,        // Add to notification list
  }),
});
```

This ensures that store notifications are displayed as banners even when the app is active.

### Background Notifications

Background notifications are handled automatically by Expo Notifications. When the app is in the background or closed:
1. The notification appears in the system notification tray
2. The badge count is updated automatically
3. Tapping the notification opens the app and triggers navigation

### Notification Tap Handling

When a user taps on a store notification, the `handleNotificationResponse` function in `useNotifications.ts` handles the navigation:

```typescript
case 'store_approved':
case 'store_rejected':
  if (data.storeId) {
    router.push(`/(tabs)/stores/${data.storeId}`);
  } else {
    router.push('/(tabs)/stores/my-stores');
  }
  break;

case 'new_review':
  if (data.storeId) {
    router.push(`/(tabs)/stores/${data.storeId}`);
  }
  break;
```

### Badge Count Management

Badge counts are managed automatically by Expo Notifications:
- `getBadgeCount()`: Get current badge count
- `setBadgeCount(count)`: Set badge count manually
- Badge is updated automatically when notifications are received

## Backend Integration

The backend notification service (implemented in Phase 3, task 9) sends store notifications using the following format:

```typescript
{
  title: string,
  body: string,
  data: {
    type: 'store_approved' | 'store_rejected' | 'new_review',
    storeId: string,
    reviewId?: string,
    reason?: string
  }
}
```

The mobile app receives these notifications through the Expo Push Notification service and handles them according to the type.

## Testing

To test store notifications:

1. **Store Approval**:
   - Create a store as an owner
   - Approve it from the admin panel
   - Verify notification is received and navigation works

2. **Store Rejection**:
   - Create a store as an owner
   - Reject it from the admin panel with a reason
   - Verify notification is received with rejection reason

3. **New Review**:
   - Submit a review for a store
   - Verify the store owner receives a notification
   - Verify tapping navigates to store details

## Files Modified

- `app/hooks/useNotifications.ts`: Added store notification types and navigation handlers
- `app/store/notificationStore.ts`: Added store notification types to the type union
- `app/docs/STORE_NOTIFICATIONS.md`: This documentation file

## Related Requirements

- Requirement 18.1: Send push notification when store status changes to "activa"
- Requirement 18.2: Send push notification when store status changes to "rechazada"
- Requirement 18.3: Send push notification when store receives a new review
- Requirement 18.6: Navigate to relevant store details screen on notification tap

## Notes

- Store notifications use the same Expo Notifications infrastructure as ride notifications
- No additional setup or configuration is required beyond the existing notification system
- The backend handles sending notifications; the mobile app only handles receiving and displaying them
- Badge counts are managed automatically by the OS and Expo Notifications
