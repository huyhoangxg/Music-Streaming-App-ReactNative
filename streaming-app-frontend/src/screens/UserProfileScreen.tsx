import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { usePlayer } from '../context/PlayerContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';
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
  borderColor: '#2A2A2A'
};

const UserProfileScreen = () => {
  const { playTrack } = usePlayer();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [selectedTrack, setSelectedTrack] = useState<any>(null);
const handleOpenTrackOptions = (track: any) => {
    setSelectedTrack(track);
};

    const { userId } = route.params;

  const [activeTab, setActiveTab] = useState('tracks');
  const [userData, setUserData] = useState<any>(null);
  const [userTracks, setUserTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State quản lý việc Follow
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    const fetchTargetUserProfile = async () => {
      setIsLoading(true);
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 1. Kéo thông tin của thằng User này về
        const userRes = await axios.get(`${API_URL}/api/users/${userId}`, config);
        setUserData(userRes.data);
        
        // Giả lập logic check xem mình đã follow nó chưa (Backend m phải trả về field này nhé)
        setIsFollowing(userRes.data.isFollowedByMe || false);

        // 2. Kéo danh sách nhạc CỦA THẰNG USER NÀY về (Lưu ý m phải code API này dưới Backend)
        const tracksRes = await axios.get(`${API_URL}/api/songs/user/${userId}`, config);
        setUserTracks(tracksRes.data);

      } catch (error) {
        console.log('Error fetching user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargetUserProfile();
  }, [userId]); 

  // Nút bấm Follow/Unfollow chính
  const toggleFollow = async () => {
    // Nếu đang load thì không cho bấm liên tục spam API
    if (isLoading) return; 

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // Gọi API POST xuống Backend
      const res = await axios.post(`${API_URL}/api/users/${userId}/follow`, {}, config);

      // Cập nhật lại màu sắc của nút (Cam -> Đen hoặc ngược lại)
      const newFollowState = res.data.isFollowing;
      setIsFollowing(newFollowState);

      // CẬP NHẬT LUÔN CON SỐ FOLLOWERS TRÊN GIAO DIỆN (Cực mượt)
      setUserData((prevData: any) => {
        if (!prevData) return prevData;
        return {
          ...prevData,
          followersCount: newFollowState 
            ? (prevData.followersCount || 0) + 1 
            : (prevData.followersCount || 0) - 1
        };
      });

    } catch (error) {
      console.log('Lỗi follow user:', error);
      Alert.alert('Follow failed', 'Could not follow this user right now.');
    }
  };

  // Nút 3 chấm "..."
  const handleMoreOptions = () => {
    Alert.alert(
      'Options',
      `What do you want to do with @${userData?.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share profile', onPress: () => console.log('Share pressed') },
        ...(isFollowing ? [{
          text: 'Unfollow',
          style: 'destructive' as const,
          onPress: () => setIsFollowing(false),
        }] : []),
      ],
    );
  };

const renderTrackItem = (item: any, isRepost: boolean) => (
    <TrackItem 
      key={item.id}
      item={item}
      layoutMode="list" // Gọi giao diện hình chữ nhật
      onLongPressOption={(track) => setSelectedTrack(track)} // Ấn giữ thì ném data vào state
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
      {/* HEADER: Có nút Back để quay về Search */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userData?.username}</Text>
        <View style={{ width: 30 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        
        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: resolveUserAvatarUrl(userData?.avatarUrl) }} 
            style={styles.avatar} 
          />
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userData?.username || userData?.fullname || 'User'}</Text>
            <Text style={styles.userHandle}>@{userData?.username || 'user'}</Text>
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
            <Text style={styles.statNumber}>{userTracks.length}</Text>
            <Text style={styles.statLabel}>Tracks</Text>
          </View>
        </View>

        {/* NÚT FOLLOW & NÚT "..." NẰM Ở ĐÂY */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.followButton, isFollowing && styles.followingButton]} 
            onPress={toggleFollow}
          >
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.moreButton} onPress={handleMoreOptions}>
            <Feather name="more-horizontal" size={24} color={COLORS.whiteText} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'tracks' && styles.activeTab]} onPress={() => setActiveTab('tracks')}>
            <Text style={[styles.tabText, activeTab === 'tracks' && styles.activeTabText]}>Tracks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'reposts' && styles.activeTab]} onPress={() => setActiveTab('reposts')}>
            <Text style={[styles.tabText, activeTab === 'reposts' && styles.activeTabText]}>Reposts</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {activeTab === 'tracks' ? (
            userTracks.length > 0 ? (
              userTracks.map(track => renderTrackItem(track, false))
            ) : (
              <Text style={styles.emptyText}>This user hasn't uploaded any tracks yet.</Text>
            )
          ) : (
            <Text style={styles.emptyText}>No reposted tracks yet.</Text>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 15, paddingTop: 15 },
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
  
  // Style cho cụm nút Follow & More
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, gap: 10 },
  followButton: { flex: 1, backgroundColor: COLORS.accentOrange, justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 25 },
  followingButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.neutralLightGrey },
  followButtonText: { color: COLORS.baseBlack, fontSize: 15, fontWeight: 'bold' },
  followingButtonText: { color: COLORS.whiteText },
  moreButton: { width: 45, height: 45, backgroundColor: COLORS.neutralDarkGrey, justifyContent: 'center', alignItems: 'center', borderRadius: 25 },
  
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
  trackActions: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { color: COLORS.neutralLightGrey, textAlign: 'center', marginTop: 20 }
});

export default UserProfileScreen;
