import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './ApiService';

class NotificationService {
  static async initialize() {
    try {
      // Configure notification handling
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Set up notification categories (for action buttons)
      await this.setupNotificationCategories();

      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  }

  static async setupNotificationCategories() {
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        textInput: {
          submitButtonTitle: 'Send',
          placeholder: 'Type a message...',
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark as Read',
      },
    ]);

    await Notifications.setNotificationCategoryAsync('call', [
      {
        identifier: 'accept',
        buttonTitle: 'Accept',
      },
      {
        identifier: 'decline',
        buttonTitle: 'Decline',
      },
    ]);
  }

  static async requestPermissions() {
    try {
      if (!Device.isDevice) {
        console.log('Notifications only work on physical devices');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get push token
      const token = await this.getExpoPushToken();
      if (token) {
        // Send token to backend
        await this.registerPushToken(token);
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async getExpoPushToken() {
    try {
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo push token:', token);
      return token;
    } catch (error) {
      console.error('Error getting Expo push token:', error);
      return null;
    }
  }

  static async registerPushToken(token) {
    try {
      await ApiService.post('/notifications/register-token', {
        token,
        platform: Platform.OS,
        deviceInfo: {
          deviceName: Device.deviceName,
          osName: Device.osName,
          osVersion: Device.osVersion,
        },
      });
      
      // Store token locally
      await AsyncStorage.setItem('pushToken', token);
      console.log('Push token registered successfully');
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  }

  static async showLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  static async showMessageNotification(message, sender) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `New message from ${sender.firstName}`,
          body: message.content,
          data: {
            type: 'message',
            conversationId: message.conversationId,
            senderId: sender.id,
          },
          categoryIdentifier: 'message',
          sound: 'message.wav',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing message notification:', error);
    }
  }

  static async showCallNotification(caller, callId, callType) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Incoming ${callType} call`,
          body: `${caller.firstName} is calling you`,
          data: {
            type: 'call',
            callId,
            callerId: caller.id,
            callType,
          },
          categoryIdentifier: 'call',
          sound: 'call.wav',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing call notification:', error);
    }
  }

  static async showMatchNotification(match) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'New Match! 🎉',
          body: `You matched with ${match.firstName}!`,
          data: {
            type: 'match',
            matchId: match.matchId,
            userId: match.userId,
          },
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing match notification:', error);
    }
  }

  static async cancelNotification(identifier) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  static async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  static async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  static addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  static addNotificationResponseReceivedListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  static removeNotificationSubscription(subscription) {
    Notifications.removeNotificationSubscription(subscription);
  }

  // Handle notification actions
  static async handleNotificationResponse(response) {
    const { notification, actionIdentifier, userText } = response;
    const { data } = notification.request.content;

    try {
      switch (data.type) {
        case 'message':
          if (actionIdentifier === 'reply' && userText) {
            await ApiService.post(`/chat/${data.conversationId}/messages`, {
              content: userText,
              type: 'text',
            });
          } else if (actionIdentifier === 'mark_read') {
            await ApiService.patch(`/chat/${data.conversationId}/read`);
          }
          break;

        case 'call':
          if (actionIdentifier === 'accept') {
            // Handle call acceptance
            // This would typically involve navigating to call screen
          } else if (actionIdentifier === 'decline') {
            await ApiService.post(`/calls/${data.callId}/decline`);
          }
          break;

        case 'match':
          // Navigate to match screen or conversation
          break;

        default:
          console.log('Unknown notification type:', data.type);
      }
    } catch (error) {
      console.error('Error handling notification response:', error);
    }
  }

  // Notification settings
  static async updateNotificationSettings(settings) {
    try {
      await ApiService.put('/notifications/settings', settings);
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  static async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      return settings ? JSON.parse(settings) : {
        messages: true,
        calls: true,
        matches: true,
        sound: true,
        vibrate: true,
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return {
        messages: true,
        calls: true,
        matches: true,
        sound: true,
        vibrate: true,
      };
    }
  }

  // Check if notifications are enabled for specific type
  static async isNotificationEnabled(type) {
    const settings = await this.getNotificationSettings();
    return settings[type] !== false;
  }
}

export { NotificationService };