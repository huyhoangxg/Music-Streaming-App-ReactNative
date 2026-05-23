import React, { useCallback, useState } from 'react';
import { 
  Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { usePlayer } from '../context/PlayerContext';
import {
  isNotificationEnabled,
  loadNotificationPreferences,
} from '../utils/notificationPreferences';
import { resolveUserAvatarUrl } from '../utils/defaultImages';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  cardBg: '#121212',
  unreadDot: '#ff6a00'
};

const SONG_NOTIFICATION_TYPES = new Set([
  'LIKE_SONG',
  'COMMENT_SONG',
  'REPOST_SONG',
  'PLAYLIST_ADD',
  'NEW_TRACK',
]);

const getNotificationText = (type: string) => {
  switch (type) {
    case 'FOLLOW': return 'started following you.';
    case 'FOLLOW_REQUEST': return 'requested to follow you.';
    case 'LIKE_SONG': return 'liked your track.';
    case 'COMMENT_SONG': return 'commented on your track.';
    case 'REPOST_SONG': return 'reposted your track.';
    case 'PLAYLIST_ADD': return 'added your track to a playlist.';
    case 'NEW_TRACK': return 'uploaded a new track.';
    default: return 'interacted with your profile.';
  }
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'FOLLOW': return <Ionicons name="person-add" size={16} color="#4DA8DA" />;
    case 'LIKE_SONG': return <Ionicons name="heart" size={16} color={COLORS.accentOrange} />;
    case 'COMMENT_SONG': return <Ionicons name="chatbubble" size={16} color="#4CAF50" />;
    case 'REPOST_SONG': return <Ionicons name="repeat" size={16} color="#9C27B0" />;
    case 'NEW_TRACK': return <Ionicons name="musical-notes" size={16} color="#FFD166" />;
    default: return <Ionicons name="notifications" size={16} color={COLORS.neutralLightGrey} />;
  }
};

const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const { playTrack } = usePlayer();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingNotificationId, setOpeningNotificationId] = useState<number | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const res = await axios.get(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const preferences = await loadNotificationPreferences();
      const visibleNotifications = res.data.filter((notification: any) =>
        isNotificationEnabled(notification.type, preferences),
      );
      setNotifications(visibleNotifications);
    } catch (error) {
      console.log('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const handleMarkAsRead = async (id: number, isRead: boolean) => {
    if (isRead) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.put(`${API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.log('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.put(`${API_URL}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.log('Error marking all as read:', error);
    }
  };

  const fetchReferenceSong = async (songId: string) => {
    const token = await SecureStore.getItemAsync('userToken');
    const response = await axios.get(`${API_URL}/api/songs/${songId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    return response.data;
  };

  const resolveNotificationSong = async (notification: any) => {
    if (notification.referenceSong) {
      return notification.referenceSong;
    }

    if (!notification.referenceId || !SONG_NOTIFICATION_TYPES.has(notification.type)) {
      return null;
    }

    return fetchReferenceSong(notification.referenceId);
  };

  const handleNotificationPress = async (notification: any) => {
    if (openingNotificationId !== null) {
      return;
    }

    setOpeningNotificationId(notification.id);

    try {
      await handleMarkAsRead(notification.id, notification.isRead);

      if (SONG_NOTIFICATION_TYPES.has(notification.type)) {
        const song = await resolveNotificationSong(notification);

        if (!song) {
          Alert.alert('Track unavailable', 'This track may have been deleted.');
          if (notification.actor?.id) {
            navigation.navigate('UserProfile', { userId: notification.actor.id });
          }
          return;
        }

        await playTrack({ ...song, sourceContext: 'notification' }, [song]);
        navigation.navigate('FullScreenPlayer');
        return;
      }

      if (notification.actor?.id) {
        navigation.navigate('UserProfile', { userId: notification.actor.id });
      }
    } catch (error) {
      console.log('Error opening notification:', error);
      Alert.alert('Cannot open notification', 'Please try again later.');
    } finally {
      setOpeningNotificationId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
        disabled={openingNotificationId === item.id}
        activeOpacity={0.75}
      >
        <Image 
          source={{ uri: resolveUserAvatarUrl(item.actor.avatarUrl) }} 
          style={styles.avatar} 
        />
        <View style={styles.iconBadge}>
          {getNotificationIcon(item.type)}
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.notificationText}>
            <Text style={styles.actorName}>{item.actor.fullName || item.actor.username}</Text>
            {' '}{getNotificationText(item.type)}
          </Text>
          {item.referenceSong?.title ? (
            <Text style={styles.referenceText} numberOfLines={1}>
              {item.referenceSong.title}
            </Text>
          ) : null}
          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {openingNotificationId === item.id ? (
          <ActivityIndicator size="small" color={COLORS.accentOrange} style={styles.trailingIcon} />
        ) : !item.isRead ? (
          <View style={styles.unreadDot} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={COLORS.neutralLightGrey} style={styles.trailingIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={{ padding: 10 }}>
          <Ionicons name="checkmark-done" size={24} color={COLORS.accentOrange} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={60} color={COLORS.neutralLightGrey} />
              <Text style={styles.emptyText}>No notifications to show.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.baseBlack },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  notificationItem: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: COLORS.baseBlack, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  unreadItem: { backgroundColor: '#1A1410' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  iconBadge: { position: 'absolute', bottom: 12, left: 45, backgroundColor: '#222', borderRadius: 10, padding: 3, borderWidth: 2, borderColor: COLORS.baseBlack },
  contentContainer: { flex: 1 },
  notificationText: { color: COLORS.whiteText, fontSize: 15, lineHeight: 20 },
  actorName: { fontWeight: 'bold' },
  referenceText: { color: COLORS.accentOrange, fontSize: 13, marginTop: 3 },
  timeText: { color: COLORS.neutralLightGrey, fontSize: 12, marginTop: 5 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.unreadDot, marginLeft: 10 },
  trailingIcon: { marginLeft: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: COLORS.neutralLightGrey, fontSize: 16, marginTop: 15 }
});

export default NotificationsScreen;
