import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
};

const PlaylistDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { playlistId } = route.params;

  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  useEffect(() => {
    const fetchPlaylistDetail = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(`${API_URL}/api/playlists/${playlistId}`, { headers });
        const data = res.data;
        
        let likedSongIds: string[] = [];
        if (token) {
          const likesRes = await axios.get(`${API_URL}/api/interaction/my-likes`, { headers });
          likedSongIds = likesRes.data.map((s: any) => s.id);
        }

        // Mapping lại bài hát từ playlistSongs -> song
        const songs = data.playlistSongs.map((ps: any) => ({
          ...ps.song,
          isLiked: likedSongIds.includes(ps.song.id)
        }));

        setPlaylist({ ...data, songs });
      } catch (error) {
        console.log('Lỗi tải thẻ playlist:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlaylistDetail();
  }, [playlistId]);

  const removeSelectedTrackFromList = () => {
    const selectedTrackId = selectedTrack?.id;
    if (!selectedTrackId) {
      return;
    }

    setPlaylist((previousPlaylist: any) => {
      if (!previousPlaylist) {
        return previousPlaylist;
      }

      return {
        ...previousPlaylist,
        songs: previousPlaylist.songs.filter((song: any) => song.id !== selectedTrackId),
      };
    });
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 10 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{playlist?.title || 'Playlist'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={playlist.songs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackItem 
              item={item} 
              queue={playlist.songs}
              layoutMode="list" 
              onLongPressOption={(track) => setSelectedTrack(track)}
            />
          )}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={60} color={COLORS.neutralLightGrey} />
              <Text style={styles.emptyText}>This playlist has no tracks yet.</Text>
            </View>
          }
        />
      )}

      {selectedTrack && (
        <TrackOptionsModal 
          visible={true}
          track={selectedTrack}
          sourcePlaylistId={playlistId}
          onPlaylistChanged={removeSelectedTrackFromList}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: COLORS.neutralLightGrey, fontSize: 16, marginTop: 15 }
});

export default PlaylistDetailScreen;
