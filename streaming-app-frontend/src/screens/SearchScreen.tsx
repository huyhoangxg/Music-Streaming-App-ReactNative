import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ImageBackground, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5, Feather, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { usePlayer } from '../context/PlayerContext'; 
import * as SecureStore from 'expo-secure-store';
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { useUnreadNotif } from '../hooks/useUnreadNotif';
import { resolveUserAvatarUrl } from '../utils/defaultImages';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#1E1E1E',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A'
};


const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const { playTrack } = usePlayer();
  
  const [searchText, setSearchText] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Tab chuyển đổi giữa tìm nhạc và tìm người
  const [searchTab, setSearchTab] = useState<'tracks' | 'users'>('tracks');

  const hasUnread = useUnreadNotif();

  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);

    const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const handleOpenTrackOptions = (track: any) => {
    setSelectedTrack(track);
  };


  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const storedSearches = await SecureStore.getItemAsync('recentSearches');
        if (storedSearches) {
          setRecentSearches(JSON.parse(storedSearches));
        }
        // Dùng Promise.all để gọi 2 API cùng lúc cho nhanh
        const [songsRes, usersRes] = await Promise.all([
          axios.get(`${API_URL}/api/songs/public`),
          axios.get(`${API_URL}/api/users`) // LƯU Ý: Backend m phải có API này nhé!
        ]);
        setAllSongs(songsRes.data);
        setAllUsers(usersRes.data);
      } catch (error) {
        console.log('Lỗi tải data màn Search:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // 1. Bộ lọc bài hát (Lọc theo title)
  const searchSongResults = allSongs.filter((song) =>
    song.title.toLowerCase().includes(searchText.toLowerCase())
  );

  // 2. Bộ lọc người dùng (Lọc theo username độc nhất)
  const searchUserResults = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const removeRecentSearch = async (itemToRemove: string) => {
    const updated = recentSearches.filter((item) => item !== itemToRemove);
    setRecentSearches(updated);
    await SecureStore.setItemAsync('recentSearches', JSON.stringify(updated));
  };

  const handleSearchSubmit = async () => {
    if (!searchText.trim()) return;
    const updated = [searchText, ...recentSearches.filter(s => s !== searchText)].slice(0, 10);
    setRecentSearches(updated);
    await SecureStore.setItemAsync('recentSearches', JSON.stringify(updated));
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="soundcloud" size={24} color={COLORS.accentOrange} />
          <Text style={styles.logoText}>SoundWave</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <MaterialIcons name="notifications-none" size={26} color={COLORS.whiteText} style={{ marginRight: 15 }} />
            {hasUnread && <View style={styles.unreadDotHeader} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <MaterialIcons name="settings" size={26} color={COLORS.whiteText} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.scrollContent}>
        {/* THANH TÌM KIẾM */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color={COLORS.neutralLightGrey} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tracks, users..."
            placeholderTextColor={COLORS.neutralLightGrey}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCapitalize="none"
            onSubmitEditing={handleSearchSubmit}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialIcons name="cancel" size={20} color={COLORS.neutralLightGrey} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 50 }} />
          ) : searchText.length > 0 ? (
            
            // ================= KHI ĐANG GÕ CHỮ =================
            <View style={styles.sectionContainer}>
              
              {/* THANH TABS KẾT QUẢ */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity 
                  style={[styles.tabButton, searchTab === 'tracks' && styles.activeTab]}
                  onPress={() => setSearchTab('tracks')}
                >
                  <Text style={[styles.tabText, searchTab === 'tracks' && styles.activeTabText]}>Tracks</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.tabButton, searchTab === 'users' && styles.activeTab]}
                  onPress={() => setSearchTab('users')}
                >
                  <Text style={[styles.tabText, searchTab === 'users' && styles.activeTabText]}>Profiles</Text>
                </TouchableOpacity>
              </View>

              {/* LIST KẾT QUẢ THEO TAB */}
              {searchTab === 'tracks' ? (
                // 1. HIỂN THỊ BÀI HÁT
                searchSongResults.length > 0 ? (
                  searchSongResults.map((song) => (
                    <TrackItem 
                      key={song.id} 
                      item={song} 
                      queue={searchSongResults}
                      layoutMode="list" 
                      onLongPressOption={(track) => setSelectedTrack(track)}
                    />
                  ))
                ) : (
                  <Text style={styles.emptyText}>No tracks found for "{searchText}"</Text>
                )
              ) : (
                // 2. HIỂN THỊ NGƯỜI DÙNG
                searchUserResults.length > 0 ? (
                  searchUserResults.map((user) => (
                    <TouchableOpacity 
                      key={user.id} 
                      style={styles.userResultItem}
                      onPress={() => navigation.navigate('UserProfile', { userId: user.id })} 
                    >
                      <Image source={{ uri: resolveUserAvatarUrl(user.avatarUrl) }} style={styles.userAvatar} />
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle}>{user.username || user.fullname}</Text>
                        <Text style={styles.resultArtist}>@{user.username}</Text>
                      </View>
                      <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.neutralLightGrey} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No users found for "@{searchText}"</Text>
                )
              )}
            </View>

          ) : (
            // ================= KHI CHƯA GÕ GÌ =================
            <>
              {recentSearches.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Recent searches</Text>
                  {recentSearches.map((item, index) => (
                    <View key={index} style={styles.recentItem}>
                      <TouchableOpacity style={styles.recentItemLeft} onPress={() => setSearchText(item)}>
                        <Ionicons name="search" size={18} color={COLORS.neutralLightGrey} />
                        <Text style={styles.recentItemText}>{item}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeRecentSearch(item)}>
                        <Feather name="x" size={18} color={COLORS.neutralLightGrey} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
      
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
  logoText: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  scrollContent: { flex: 1, paddingHorizontal: 15, marginTop: 10 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralDarkGrey, borderRadius: 8, paddingHorizontal: 15, height: 48, marginBottom: 25 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: COLORS.whiteText, fontSize: 15 },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  recentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.neutralDarkGrey, paddingVertical: 14, paddingHorizontal: 15, borderRadius: 8, marginBottom: 8 },
  recentItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  recentItemText: { color: COLORS.whiteText, fontSize: 14, marginLeft: 10 },
  genresGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  genreCardWrapper: { width: '48%', height: 90, marginBottom: 15, borderRadius: 8, overflow: 'hidden' },
  genreCard: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  genreOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  genreText: { color: COLORS.whiteText, fontSize: 16, fontWeight: 'bold' },
  
  // Tabs cho Search
  tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.borderColor, marginBottom: 15 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.accentOrange },
  tabText: { color: COLORS.neutralLightGrey, fontSize: 15, fontWeight: '600' },
  activeTabText: { color: COLORS.whiteText },

  // Kết quả Nhạc
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralDarkGrey, padding: 10, borderRadius: 8, marginBottom: 10 },
  resultImage: { width: 50, height: 50, borderRadius: 6, marginRight: 15 },
  resultInfo: { flex: 1 },
  resultTitle: { color: COLORS.whiteText, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  resultArtist: { color: COLORS.neutralLightGrey, fontSize: 13 },
  
  // Kết quả Người dùng
  userResultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  userAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },

  emptyText: { color: COLORS.neutralLightGrey, fontSize: 14, textAlign: 'center', marginTop: 20 },
  unreadDotHeader: { position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accentOrange }
});

export default SearchScreen;
