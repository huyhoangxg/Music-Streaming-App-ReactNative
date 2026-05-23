import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, 
  ActivityIndicator, Modal, TextInput, DeviceEventEmitter, Alert, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5, Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { useUnreadNotif } from '../hooks/useUnreadNotif';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#333333',
  cardBg: '#121212',
  overlay: 'rgba(0,0,0,0.6)'
};

const filterTabs = [
  { id: 'playlists', label: 'Playlists', icon: 'music-note' },
  { id: 'liked', label: 'Liked songs', icon: 'favorite-border' },
];

const LibraryScreen = () => {
  const [activeTab, setActiveTab] = useState('playlists');
  const navigation = useNavigation<any>();
  const hasUnread = useUnreadNotif();

  // State quản lý Playlist thật
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [likedSongs, setLikedSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State cho Modal tạo Playlist
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // State action
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  const fetchLikedSongs = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      
      const res = await axios.get(`${API_URL}/api/interaction/my-likes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Set to all liked tracks
      const tracks = res.data.map((t: any) => ({ ...t, isLiked: true }));
      setLikedSongs(tracks);
    } catch(e) { console.log('Lỗi tải liked:', e) }
  };

  const fetchPlaylists = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;

      const res = await axios.get(`${API_URL}/api/playlists/my-playlists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylists(res.data);
    } catch (error) {
      console.log('Lỗi tải playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
    fetchLikedSongs();

    // Lắng nghe sự kiện (Ví dụ m tạo playlist ở TrackOptionsModal thì bên này tự update)
    const subscription = DeviceEventEmitter.addListener('RELOAD_DATA', () => {
      fetchPlaylists();
      fetchLikedSongs();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (selectedPlaylist && showCreateModal && selectedPlaylist.id) {
        // Edit playlist
        await axios.put(`${API_URL}/api/playlists/${selectedPlaylist.id}`, { title: newPlaylistName }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedPlaylist(null);
      } else {
        // Create
        await axios.post(`${API_URL}/api/playlists`, { title: newPlaylistName }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setNewPlaylistName('');
      setShowCreateModal(false);
      fetchPlaylists(); 
      DeviceEventEmitter.emit('RELOAD_DATA'); 
    } catch (error) {
      console.log('Lỗi thao tác playlist:', error);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;
    Alert.alert('Delete playlist', `Delete "${selectedPlaylist.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const token = await SecureStore.getItemAsync('userToken');
          await axios.delete(`${API_URL}/api/playlists/${selectedPlaylist.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setShowOptionsModal(false);
          setSelectedPlaylist(null);
          fetchPlaylists();
        } catch(e) { console.log('Delete playlist error:', e); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      {/* HEADER */}
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

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        <Text style={styles.pageTitle}>Your library</Text>

        {/* THANH LỌC (TABS) */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabsWrapper}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity 
                key={tab.id}
                style={[styles.tabChip, isActive && styles.activeTabChip]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MaterialIcons 
                  name={tab.icon as any} 
                  size={18} 
                  color={isActive ? COLORS.baseBlack : COLORS.whiteText} 
                  style={{ marginRight: 6 }} 
                />
                <Text style={[styles.tabChipText, isActive && styles.activeTabChipText]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* NỘI DUNG */}
        {activeTab === 'playlists' ? (
          <View>
            <TouchableOpacity style={styles.createPlaylistCard} onPress={() => setShowCreateModal(true)}>
              <View style={styles.createIconBox}>
                <Feather name="plus" size={28} color={COLORS.accentOrange} />
              </View>
              <View>
                <Text style={styles.createTitle}>Create new playlist</Text>
                <Text style={styles.createSub}>Build your perfect mix</Text>
              </View>
            </TouchableOpacity>

            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 20 }} />
            ) : playlists.length > 0 ? (
              playlists.map((playlist) => (
                <View key={playlist.id} style={styles.playlistItemWrapper}>
                  <TouchableOpacity 
                    style={styles.playlistItem} 
                    onPress={() => navigation.navigate('PlaylistDetail', { playlistId: playlist.id })}
                  >
                    <View style={[styles.playlistImage, { backgroundColor: COLORS.neutralDarkGrey, justifyContent: 'center', alignItems: 'center' }]}>
                       <Ionicons name="musical-notes" size={24} color={COLORS.neutralLightGrey} />
                    </View>
                    
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistTitle}>{playlist.title}</Text>
                      <Text style={styles.playlistSub}>{playlist._count?.playlistSongs || 0} tracks</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.optionsBtn}
                    onPress={() => {
                      setSelectedPlaylist(playlist);
                      setShowOptionsModal(true);
                    }}
                  >
                    <Feather name="more-vertical" size={20} color={COLORS.neutralLightGrey} />
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={{ color: COLORS.neutralLightGrey, textAlign: 'center', marginTop: 20 }}>
                You do not have any playlists yet.
              </Text>
            )}
          </View>
        ) : activeTab === 'liked' ? (
          <View style={{ marginTop: 10 }}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.accentOrange} />
            ) : likedSongs.length > 0 ? (
              likedSongs.map((song) => (
                <TrackItem 
                  key={song.id} 
                  item={song} 
                  layoutMode="list" 
                  onLongPressOption={(track) => setSelectedTrack(track)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-dislike-outline" size={60} color={COLORS.neutralLightGrey} />
                <Text style={styles.emptyStateText}>You have not liked any tracks yet.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={60} color={COLORS.neutralLightGrey} />
            <Text style={styles.emptyStateText}>No items here yet.</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* MODAL TẠO/SỬA PLAYLIST TRONG NÀY */}
      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedPlaylist ? 'Rename playlist' : 'New playlist'}</Text>
            
            <TextInput 
              style={styles.modalInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreateModal(false); setNewPlaylistName(''); setSelectedPlaylist(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmBtn, !newPlaylistName.trim() && { opacity: 0.5 }]} 
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
              >
                <Text style={styles.confirmBtnText}>{selectedPlaylist ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL LỰA CHỌN PLAYLIST */}
      <Modal visible={showOptionsModal} transparent animationType="slide">
        <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>{selectedPlaylist?.title}</Text>
            
            <TouchableOpacity style={styles.sheetOption} onPress={() => {
              setShowOptionsModal(false);
              setNewPlaylistName(selectedPlaylist?.title || '');
              setShowCreateModal(true);
            }}>
              <Feather name="edit-2" size={20} color={COLORS.whiteText} style={{ marginRight: 15 }} />
              <Text style={styles.sheetOptionText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handleDeletePlaylist}>
              <Feather name="trash-2" size={20} color={COLORS.accentOrange} style={{ marginRight: 15 }} />
              <Text style={[styles.sheetOptionText, { color: COLORS.accentOrange }]}>Delete playlist</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {selectedTrack && (
        <TrackOptionsModal 
          visible={true}
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  scrollContent: { paddingHorizontal: 15, marginTop: 10 },
  pageTitle: { color: COLORS.whiteText, fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  tabsWrapper: { marginBottom: 25 },
  tabChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralDarkGrey, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: COLORS.borderColor },
  activeTabChip: { backgroundColor: COLORS.accentOrange, borderColor: COLORS.accentOrange },
  tabChipText: { color: COLORS.whiteText, fontSize: 14, fontWeight: '600' },
  activeTabChipText: { color: COLORS.baseBlack },
  createPlaylistCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 106, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 106, 0, 0.3)', borderRadius: 12, padding: 15, marginBottom: 20 },
  createIconBox: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(255, 106, 0, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  createTitle: { color: COLORS.whiteText, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  createSub: { color: COLORS.neutralLightGrey, fontSize: 13 },
  playlistItemWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 12 },
  playlistItem: { flexDirection: 'row', alignItems: 'center', flex: 1, padding: 12 },
  playlistImage: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  playlistInfo: { flex: 1, justifyContent: 'center' },
  playlistTitle: { color: COLORS.whiteText, fontSize: 16, fontWeight: '600', marginBottom: 5 },
  playlistSub: { color: COLORS.neutralLightGrey, fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyStateText: { color: COLORS.neutralLightGrey, fontSize: 16, marginTop: 15 },
  optionsBtn: { padding: 15 },

  // Styles cho Modal Tạo Playlist
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: COLORS.neutralDarkGrey, borderRadius: 15, padding: 20 },
  modalTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#2A2A2A', color: COLORS.whiteText, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  cancelBtnText: { color: COLORS.neutralLightGrey, fontSize: 16, fontWeight: '600' },
  confirmBtn: { backgroundColor: COLORS.accentOrange, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },

  // Bottom Sheet
  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: COLORS.neutralDarkGrey, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  sheetTitle: { color: COLORS.neutralLightGrey, fontSize: 14, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  sheetOptionText: { color: COLORS.whiteText, fontSize: 16, fontWeight: '500' },
  unreadDotHeader: { position: 'absolute', top: 0, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accentOrange }
});

export default LibraryScreen;
