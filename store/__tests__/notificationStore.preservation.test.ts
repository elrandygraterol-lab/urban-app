/**
 * Preservation Property Tests for Notification Store
 *
 * **Validates: Requirements 3.11, 3.12**
 *
 * These tests capture the CURRENT behavior of the notification store
 * on unfixed code for non-buggy inputs. They ensure that the fix does NOT
 * break existing notification state management functionality.
 *
 * IMPORTANT: These tests should PASS on unfixed code.
 * After the fix is implemented, these same tests should still PASS,
 * confirming that existing functionality is preserved.
 *
 * Testing Approach:
 * 1. Observe behavior on UNFIXED code
 * 2. Write property-based tests capturing observed patterns
 * 3. Run tests on UNFIXED code
 * 4. EXPECTED: Tests PASS (confirms baseline to preserve)
 */

import * as fc from 'fast-check';
import { useNotificationStore, NotificationType } from '../notificationStore';

describe('Preservation Properties: Notification Store State Management', () => {
  beforeEach(() => {
    // Clear notification store before each test
    useNotificationStore.getState().clearAllNotifications();
  });

  /**
   * Property 3.11.1: Add Notification Stores in History
   *
   * **Validates: Requirement 3.11**
   *
   * When addNotification is called, the system SHALL store the notification
   * in the history with a unique ID, timestamp, and read status of false.
   */
  it('Property 3.11.1: addNotification stores notification in history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>(
            'ride_request',
            'payment_completed',
            'ride_cancelled',
            'info'
          ),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        async context => {
          const store = useNotificationStore.getState();
          const initialCount = store.notifications.length;

          // Add notification
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
          });

          // PRESERVATION: Notification should be added to history
          const notifications = useNotificationStore.getState().notifications;
          expect(notifications.length).toBe(initialCount + 1);

          const addedNotification = notifications[0]; // Most recent first
          expect(addedNotification.id).toBeTruthy();
          expect(addedNotification.type).toBe(context.type);
          expect(addedNotification.title).toBe(context.title);
          expect(addedNotification.message).toBe(context.message);
          expect(addedNotification.timestamp).toBeInstanceOf(Date);
          expect(addedNotification.read).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.11.2: Add Notification Shows Immediately
   *
   * **Validates: Requirement 3.11**
   *
   * When addNotification is called, the system SHALL set the notification
   * as the currentNotification to display it immediately.
   */
  it('Property 3.11.2: addNotification shows notification immediately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>('success', 'warning', 'error'),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        async context => {
          const store = useNotificationStore.getState();

          // Add notification
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
          });

          // PRESERVATION: Notification should be set as current
          const currentNotification = useNotificationStore.getState().currentNotification;
          expect(currentNotification).not.toBeNull();
          expect(currentNotification!.type).toBe(context.type);
          expect(currentNotification!.title).toBe(context.title);
          expect(currentNotification!.message).toBe(context.message);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.11.3: Notification ID Uniqueness
   *
   * **Validates: Requirement 3.11**
   *
   * When multiple notifications are added, each SHALL have a unique ID
   * to prevent collisions and ensure proper tracking.
   */
  it('Property 3.11.3: Each notification has unique ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom<NotificationType>('info', 'success'),
            title: fc.string({ minLength: 5, maxLength: 50 }),
            message: fc.string({ minLength: 10, maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async notificationInputs => {
          const store = useNotificationStore.getState();

          // Add all notifications
          notificationInputs.forEach(input => {
            store.addNotification(input);
          });

          // PRESERVATION: All IDs should be unique
          const notifications = useNotificationStore.getState().notifications;
          const ids = notifications.map(n => n.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.12.1: Mark as Read Updates Status
   *
   * **Validates: Requirement 3.12**
   *
   * When markAsRead is called with a notification ID, the system SHALL
   * update the read status of that notification to true.
   */
  it('Property 3.12.1: markAsRead updates notification status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>('ride_accepted', 'driver_arrived'),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        async context => {
          const store = useNotificationStore.getState();

          // Add notification
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
          });

          const notifications = useNotificationStore.getState().notifications;
          const notificationId = notifications[0].id;

          // Verify initially unread
          expect(notifications[0].read).toBe(false);

          // Mark as read
          store.markAsRead(notificationId);

          // PRESERVATION: Notification should be marked as read
          const updatedNotifications = useNotificationStore.getState().notifications;
          const updatedNotification = updatedNotifications.find(n => n.id === notificationId);
          expect(updatedNotification).toBeDefined();
          expect(updatedNotification!.read).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.12.2: Mark as Read Preserves Other Notifications
   *
   * **Validates: Requirement 3.12**
   *
   * When markAsRead is called for one notification, other notifications
   * SHALL remain unchanged.
   */
  it('Property 3.12.2: markAsRead only affects target notification', async () => {
    const store = useNotificationStore.getState();

    // Add multiple notifications
    store.addNotification({
      type: 'info',
      title: 'First Notification',
      message: 'First message',
    });

    store.addNotification({
      type: 'success',
      title: 'Second Notification',
      message: 'Second message',
    });

    store.addNotification({
      type: 'warning',
      title: 'Third Notification',
      message: 'Third message',
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications.length).toBe(3);

    // Mark only the second notification as read
    const secondNotificationId = notifications[1].id;
    store.markAsRead(secondNotificationId);

    // PRESERVATION: Only the second notification should be marked as read
    const updatedNotifications = useNotificationStore.getState().notifications;
    expect(updatedNotifications[0].read).toBe(false); // First (most recent)
    expect(updatedNotifications[1].read).toBe(true); // Second (marked)
    expect(updatedNotifications[2].read).toBe(false); // Third (oldest)
  });

  /**
   * Property 3.11.4: Notification History Ordering
   *
   * **Validates: Requirement 3.11**
   *
   * When notifications are added, they SHALL be stored in the history
   * with the most recent notification first (index 0).
   */
  it('Property 3.11.4: Notifications are ordered by recency', async () => {
    const store = useNotificationStore.getState();

    const notification1 = {
      type: 'info' as NotificationType,
      title: 'First',
      message: 'First notification',
    };

    const notification2 = {
      type: 'success' as NotificationType,
      title: 'Second',
      message: 'Second notification',
    };

    const notification3 = {
      type: 'warning' as NotificationType,
      title: 'Third',
      message: 'Third notification',
    };

    // Add notifications in sequence
    store.addNotification(notification1);
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

    store.addNotification(notification2);
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay

    store.addNotification(notification3);

    // PRESERVATION: Most recent should be first
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications[0].title).toBe('Third'); // Most recent
    expect(notifications[1].title).toBe('Second');
    expect(notifications[2].title).toBe('First'); // Oldest
  });

  /**
   * Property 3.11.5: Clear Notification Removes from History
   *
   * **Validates: Requirement 3.11**
   *
   * When clearNotification is called with a notification ID, the system
   * SHALL remove that notification from the history.
   */
  it('Property 3.11.5: clearNotification removes from history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>('ride_completed', 'payment_completed'),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
        }),
        async context => {
          const store = useNotificationStore.getState();

          // Add notification
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
          });

          const notifications = useNotificationStore.getState().notifications;
          const notificationId = notifications[0].id;
          const initialCount = notifications.length;

          // Clear notification
          store.clearNotification(notificationId);

          // PRESERVATION: Notification should be removed from history
          const updatedNotifications = useNotificationStore.getState().notifications;
          expect(updatedNotifications.length).toBe(initialCount - 1);
          expect(updatedNotifications.find(n => n.id === notificationId)).toBeUndefined();
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.11.6: Clear All Notifications
   *
   * **Validates: Requirement 3.11**
   *
   * When clearAllNotifications is called, the system SHALL remove all
   * notifications from the history and clear the current notification.
   */
  it('Property 3.11.6: clearAllNotifications removes all notifications', async () => {
    const store = useNotificationStore.getState();

    // Add multiple notifications
    store.addNotification({
      type: 'info',
      title: 'Notification 1',
      message: 'Message 1',
    });

    store.addNotification({
      type: 'success',
      title: 'Notification 2',
      message: 'Message 2',
    });

    store.addNotification({
      type: 'warning',
      title: 'Notification 3',
      message: 'Message 3',
    });

    // Verify notifications exist
    expect(useNotificationStore.getState().notifications.length).toBeGreaterThan(0);
    expect(useNotificationStore.getState().currentNotification).not.toBeNull();

    // Clear all
    store.clearAllNotifications();

    // PRESERVATION: All notifications should be cleared
    expect(useNotificationStore.getState().notifications.length).toBe(0);
    expect(useNotificationStore.getState().currentNotification).toBeNull();
  });

  /**
   * Property 3.11.7: Notification with Action Data
   *
   * **Validates: Requirement 3.11**
   *
   * When addNotification is called with actionLabel and onAction,
   * the system SHALL store these properties correctly.
   */
  it('Property 3.11.7: Notifications with actions are stored correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>('payment_completed', 'ride_accepted'),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
          actionLabel: fc.string({ minLength: 5, maxLength: 30 }),
        }),
        async context => {
          const store = useNotificationStore.getState();
          const mockOnAction = jest.fn();

          // Add notification with action
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
            actionLabel: context.actionLabel,
            onAction: mockOnAction,
          });

          // PRESERVATION: Action properties should be stored
          const notifications = useNotificationStore.getState().notifications;
          const addedNotification = notifications[0];
          expect(addedNotification.actionLabel).toBe(context.actionLabel);
          expect(addedNotification.onAction).toBe(mockOnAction);

          // Verify action callback works
          addedNotification.onAction!();
          expect(mockOnAction).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.11.8: Notification with Custom Data
   *
   * **Validates: Requirement 3.11**
   *
   * When addNotification is called with custom data, the system SHALL
   * store the data property correctly for later retrieval.
   */
  it('Property 3.11.8: Notifications with custom data are stored correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          type: fc.constantFrom<NotificationType>('ride_request', 'ride_cancelled'),
          title: fc.string({ minLength: 5, maxLength: 50 }),
          message: fc.string({ minLength: 10, maxLength: 200 }),
          data: fc.record({
            rideId: fc.uuid(),
            amount: fc.float({ min: 5, max: 500, noNaN: true }),
            driverId: fc.uuid(),
          }),
        }),
        async context => {
          const store = useNotificationStore.getState();

          // Add notification with custom data
          store.addNotification({
            type: context.type,
            title: context.title,
            message: context.message,
            data: context.data,
          });

          // PRESERVATION: Custom data should be stored
          const notifications = useNotificationStore.getState().notifications;
          const addedNotification = notifications[0];
          expect(addedNotification.data).toEqual(context.data);
          expect(addedNotification.data.rideId).toBe(context.data.rideId);
          expect(addedNotification.data.amount).toBe(context.data.amount);
          expect(addedNotification.data.driverId).toBe(context.data.driverId);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 3.8: Auto-dismiss Timer in Store
   *
   * **Validates: Requirement 3.8**
   *
   * When addNotification is called, the system SHALL set a 5-second timer
   * to automatically dismiss the current notification.
   */
  it('Property 3.8: Store auto-dismisses notification after 5 seconds', async () => {
    jest.useFakeTimers();

    const store = useNotificationStore.getState();

    // Add notification
    store.addNotification({
      type: 'info',
      title: 'Auto-dismiss Test',
      message: 'This should auto-dismiss',
    });

    // Verify notification is current
    expect(useNotificationStore.getState().currentNotification).not.toBeNull();
    expect(useNotificationStore.getState().currentNotification!.title).toBe('Auto-dismiss Test');

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000);

    // PRESERVATION: Notification should be auto-dismissed
    expect(useNotificationStore.getState().currentNotification).toBeNull();

    jest.useRealTimers();
  });

  /**
   * Property 3.11.9: Dismiss Current Notification
   *
   * **Validates: Requirement 3.11**
   *
   * When dismissCurrentNotification is called, the system SHALL clear
   * the currentNotification but keep it in the history.
   */
  it('Property 3.11.9: dismissCurrentNotification clears current but keeps history', async () => {
    const store = useNotificationStore.getState();

    // Add notification
    store.addNotification({
      type: 'success',
      title: 'Test Notification',
      message: 'Test message',
    });

    // Verify notification is current and in history
    expect(useNotificationStore.getState().currentNotification).not.toBeNull();
    expect(useNotificationStore.getState().notifications.length).toBe(1);

    const notificationId = useNotificationStore.getState().currentNotification!.id;

    // Dismiss current
    store.dismissCurrentNotification();

    // PRESERVATION: Current should be null, but notification still in history
    expect(useNotificationStore.getState().currentNotification).toBeNull();
    expect(useNotificationStore.getState().notifications.length).toBe(1);
    expect(useNotificationStore.getState().notifications[0].id).toBe(notificationId);
  });
});
