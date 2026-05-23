import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotificationPreferences = {
  trackActivity: boolean;
  comments: boolean;
  newTracks: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  trackActivity: true,
  comments: true,
  newTracks: false,
};

const STORAGE_KEY = 'notification_preferences';

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;

    return {
      trackActivity:
        typeof parsed.trackActivity === 'boolean'
          ? parsed.trackActivity
          : DEFAULT_NOTIFICATION_PREFERENCES.trackActivity,
      comments:
        typeof parsed.comments === 'boolean'
          ? parsed.comments
          : DEFAULT_NOTIFICATION_PREFERENCES.comments,
      newTracks:
        typeof parsed.newTracks === 'boolean'
          ? parsed.newTracks
          : DEFAULT_NOTIFICATION_PREFERENCES.newTracks,
    };
  } catch (error) {
    console.log('Error loading notification preferences:', error);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function saveNotificationPreferences(preferences: NotificationPreferences) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function isNotificationEnabled(type: string, preferences: NotificationPreferences) {
  switch (type) {
    case 'LIKE_SONG':
    case 'REPOST_SONG':
    case 'PLAYLIST_ADD':
      return preferences.trackActivity;
    case 'COMMENT_SONG':
      return preferences.comments;
    case 'NEW_TRACK':
      return preferences.newTracks;
    default:
      return true;
  }
}
