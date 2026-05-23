import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, DeviceEventEmitter 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { usePlayer } from '../context/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import { useUnreadNotif } from '../hooks/useUnreadNotif';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { resolveUserAvatarUrl } from '../utils/defaultImages';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818', 
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A'
};


const ProfileScreen = () => {
  const { playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState('my_tracks');
  
  const [userData, setUserData] = useState<any>(null);
  const [myTracks, setMyTracks] = useState<any[]>([]);
  const [repostedTracks, setRepostedTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<any>();
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const hasUnread = useUnreadNotif();

  const handleOpenTrackOptions = (track: any) => {
    setSelectedTrack(track);
} ;

  const fetchProfileData = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [userRes, tracksRes, repostsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/users/me`, config),
        axios.get(`${API_URL}/api/songs/my-songs`, config),
        axios.get(`${API_URL}/api/interaction/my-reposts`, config)
      ]);

      if (userRes.status === 'fulfilled') {
        setUserData(userRes.value.data);
      } else {
        console.log('Profile user fetch error:', userRes.reason);
      }

      if (tracksRes.status === 'fulfilled') {
        setMyTracks(tracksRes.value.data);
      } else {
        console.log('Profile tracks fetch error:', tracksRes.reason);
        setMyTracks([]);
      }

      if (repostsRes.status === 'fulfilled') {
        setRepostedTracks(repostsRes.value.data);
      } else {
        console.log('Profile reposts fetch error:', repostsRes.reason);
        setRepostedTracks([]);
      }
    } catch (error) {
      console.log('Error fetching Profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchProfileData();

    const subscription = DeviceEventEmitter.addListener('RELOAD_DATA', () => {
      fetchProfileData();
    });

    return () => {
      subscription.remove();
    };
  }, []); 

  const renderTrackItem = (item: any, queue: any[]) => (
    <TrackItem 
      key={item.id}
      item={item}
      queue={queue}
      layoutMode="list"
      onLongPressOption={(track) => setSelectedTrack(track)}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.accentOrange} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="soundcloud" size={24} color={COLORS.accentOrange} />
          <Text style={styles.headerTitle}>SoundWave</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ marginRight: 15 }}>
            <MaterialIcons name="notifications-none" size={26} color={COLORS.whiteText} />
            {hasUnread && <View style={styles.unreadDotHeader} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <MaterialIcons name="settings" size={26} color={COLORS.whiteText} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        
        <View style={styles.profileHeader}>
          <Image source={{ uri: resolveUserAvatarUrl(userData?.avatarUrl) }} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userData?.fullName || userData?.username || 'User'}</Text>
            <Text style={styles.userHandle}>@{userData?.username || 'user'} - creator</Text>
          </View>
        </View>

        {userData?.bio ? <Text style={styles.bioText}>{userData.bio}</Text> : null}

        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('FollowList', { type: 'followers', userId: userData?.id })}>
            <Text style={styles.statNumber}>{userData?.followerCount || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('FollowList', { type: 'following', userId: userData?.id })}>
            <Text style={styles.statNumber}>{userData?.followingCount || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{myTracks.length}</Text>
            <Text style={styles.statLabel}>Tracks</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProfile')}>
            <Feather name="edit-2" size={16} color={COLORS.baseBlack} style={{ marginRight: 8 }} />
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton}>
            <Feather name="share-2" size={20} color={COLORS.whiteText} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'my_tracks' && styles.activeTab]} onPress={() => setActiveTab('my_tracks')}>
            <Text style={[styles.tabText, activeTab === 'my_tracks' && styles.activeTabText]}>Tracks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'reposts' && styles.activeTab]} onPress={() => setActiveTab('reposts')}>
            <Text style={[styles.tabText, activeTab === 'reposts' && styles.activeTabText]}>Reposts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {activeTab === 'my_tracks' ? (
            myTracks.length > 0 ? (
              myTracks.map(track => renderTrackItem(track, myTracks))
            ) : (
              <Text style={styles.emptyText}>You haven't uploaded any tracks yet.</Text>
            )
          ) : (
            repostedTracks.length > 0 ? (
              repostedTracks.map(track => renderTrackItem(track, repostedTracks))
            ) : (
              <Text style={styles.emptyText}>No reposted tracks yet.</Text>
            )
          )}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
          <TrackOptionsModal 
        visible={selectedTrack !== null}
        track={selectedTrack}
        onClose={() => setSelectedTrack(null)}
      />
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  unreadDotHeader: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accentOrange },
  scrollContent: { paddingHorizontal: 15, marginTop: 10 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: COLORS.neutralDarkGrey, marginRight: 15 },
  profileInfo: { flex: 1, justifyContent: 'center' },
  userName: { color: COLORS.whiteText, fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  userHandle: { color: COLORS.neutralLightGrey, fontSize: 14 },
  bioText: { color: COLORS.whiteText, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  statsRow: { flexDirection: 'row', marginBottom: 25 },
  statBox: { marginRight: 30 },
  statNumber: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { color: COLORS.neutralLightGrey, fontSize: 13 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  editButton: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.accentOrange, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 25, marginRight: 15 },
  editButtonText: { color: COLORS.baseBlack, fontSize: 15, fontWeight: 'bold' },
  shareButton: { width: 45, height: 45, backgroundColor: COLORS.neutralDarkGrey, justifyContent: 'center', alignItems: 'center', borderRadius: 25 },
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.borderColor, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.accentOrange },
  tabText: { color: COLORS.neutralLightGrey, fontSize: 15, fontWeight: '600' },
  activeTabText: { color: COLORS.whiteText },
  listContainer: { paddingBottom: 20 },
  trackItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralDarkGrey, padding: 10, borderRadius: 8, marginBottom: 10 },
  trackImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
  trackInfo: { flex: 1, justifyContent: 'center' },
  trackTitle: { color: COLORS.whiteText, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  trackArtist: { color: COLORS.neutralLightGrey, fontSize: 13, marginBottom: 4 },
  trackStats: { flexDirection: 'row', alignItems: 'center' },
  statText: { color: COLORS.neutralLightGrey, fontSize: 12, marginLeft: 4 },
  trackActions: { flexDirection: 'row', alignItems: 'center', gap: 10 }, // Thêm gap cho khoảng cách nút
  actionButton: { padding: 5 }, // Cho ngón tay dễ bấm trúng
  emptyText: { color: COLORS.neutralLightGrey, textAlign: 'center', marginTop: 20 }
});

export default ProfileScreen;
