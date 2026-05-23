import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {
  isNotificationEnabled,
  loadNotificationPreferences,
} from '../utils/notificationPreferences';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

export const useUnreadNotif = () => {
  const [hasUnread, setHasUnread] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const checkUnread = async () => {
        try {
          const token = await SecureStore.getItemAsync('userToken');
          if (!token) return;
          const res = await axios.get(`${API_URL}/api/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const preferences = await loadNotificationPreferences();
          const unread = res.data.some(
            (n: any) => !n.isRead && isNotificationEnabled(n.type, preferences),
          );
          setHasUnread(unread);
        } catch (error) {
          console.log('Error checking notifs:', error);
        }
      };
      
      checkUnread();
    }, [])
  );

  return hasUnread;
};
