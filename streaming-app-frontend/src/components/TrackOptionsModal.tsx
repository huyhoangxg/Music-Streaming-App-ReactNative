import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { resolveSongImageUrl } from '../utils/defaultImages';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  whiteText: '#FFFFFF',
  neutralLightGrey: '#CCCCCC',
  neutralDarkGrey: '#181818',
  accentOrange: '#ff6a00',
  borderColor: '#2A2A2A',
  overlay: 'rgba(0,0,0,0.6)',
  danger: '#ff5d5d',
};

interface TrackOptionsModalProps {
  visible: boolean;
  track: any;
  onClose: () => void;
  initialMode?: 'options' | 'playlists';
  sourcePlaylistId?: string;
  onPlaylistChanged?: () => void;
}

type ModalMode = 'options' | 'playlists' | 'edit';

const TrackOptionsModal: React.FC<TrackOptionsModalProps> = ({
  visible,
  track,
  onClose,
  initialMode = 'options',
  sourcePlaylistId,
  onPlaylistChanged,
}) => {
  const [modalMode, setModalMode] = useState<ModalMode>(initialMode);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editArtwork, setEditArtwork] = useState<any>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingTrack, setIsDeletingTrack] = useState(false);

  const isOwner = useMemo(() => {
    return Boolean(currentUserId && track?.userId && currentUserId === track.userId);
  }, [currentUserId, track?.userId]);

  useEffect(() => {
    if (visible && !currentUserId) {
      void fetchCurrentUser();
    }
  }, [visible, currentUserId]);

  useEffect(() => {
    if (!visible) {
      setModalMode(initialMode);
      setIsCreatingPlaylist(false);
      setNewPlaylistName('');
      setEditArtwork(null);
      setEditTitle('');
      setEditDescription('');
      setIsSavingEdit(false);
      setIsDeletingTrack(false);
      return;
    }

    setModalMode(initialMode);
    setEditTitle(track?.title || '');
    setEditDescription(track?.description || '');
    setEditArtwork(null);
    setIsDeletingTrack(false);
  }, [visible, initialMode, track]);

  useEffect(() => {
    if (modalMode === 'playlists' && visible) {
      void fetchMyPlaylists();
    }
  }, [modalMode, visible]);

  const fetchCurrentUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        return;
      }

      const res = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUserId(res.data.id);
    } catch (error) {
      console.log('Current user fetch error:', error);
    }
  };

  const fetchMyPlaylists = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        return;
      }

      const res = await axios.get(`${API_URL}/api/playlists/my-playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(res.data);
    } catch (error) {
      console.log('Playlist fetch error:', error);
    }
  };

  const handleAction = async (action: 'like' | 'repost') => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res =
        action === 'like'
          ? track.isLiked
            ? await axios.delete(`${API_URL}/api/interactions/like/${track.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
            : await axios.post(
                `${API_URL}/api/interactions/like`,
                { songId: track.id },
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              )
          : await axios.post(
              `${API_URL}/api/interaction/${track.id}/${action}`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );

      if (action === 'like') {
        DeviceEventEmitter.emit('LIKE_TOGGLED', {
          songId: track.id,
          isLiked: res.data.isLiked,
          likeCount: res.data.likeCount,
        });
      } else {
        DeviceEventEmitter.emit('RELOAD_DATA');
      }

      onClose();
    } catch (error) {
      console.log(`${action} action error:`, error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(
        `${API_URL}/api/playlists`,
        { title: newPlaylistName },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      void fetchMyPlaylists();
    } catch (error) {
      console.log('Create playlist error:', error);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await axios.post(
        `${API_URL}/api/playlists/${playlistId}/songs`,
        { songId: track.id },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const wasAdded = response.data?.added !== false;
      DeviceEventEmitter.emit('RELOAD_DATA');
      onClose();
      Alert.alert(
        'Playlist',
        wasAdded ? 'Added to playlist.' : 'This track is already in that playlist.',
      );
    } catch (error) {
      console.log('Add to playlist error:', error);
      Alert.alert('Playlist', 'Could not add this track to a playlist right now.');
    }
  };

  const handleRemoveFromPlaylist = () => {
    if (!sourcePlaylistId || !track?.id) {
      return;
    }

    Alert.alert('Remove from playlist', `Remove "${track.title || 'this track'}" from this playlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.delete(`${API_URL}/api/playlists/${sourcePlaylistId}/songs/${track.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            DeviceEventEmitter.emit('RELOAD_DATA');
            onPlaylistChanged?.();
            onClose();
            Alert.alert('Playlist', 'Removed from playlist.');
          } catch (error) {
            console.log('Remove from playlist error:', error);
            Alert.alert('Playlist', 'Could not remove this track from the playlist right now.');
          }
        },
      },
    ]);
  };

  const pickArtwork = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets.length > 0) {
        setEditArtwork(result.assets[0]);
      }
    } catch (error) {
      console.log('Edit artwork picker error:', error);
    }
  };

  const handleSaveTrackEdit = async () => {
    if (!track?.id || !editTitle.trim()) {
      Alert.alert('Track title is required.');
      return;
    }

    setIsSavingEdit(true);

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const formData = new FormData();
      formData.append('title', editTitle.trim());
      formData.append('description', editDescription);

      if (editArtwork) {
        const fileName = editArtwork.fileName || editArtwork.uri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri: editArtwork.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      await axios.put(`${API_URL}/api/songs/${track.id}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      DeviceEventEmitter.emit('RELOAD_DATA');
      onClose();
    } catch (error) {
      console.log('Edit track error:', error);
      Alert.alert('Update failed', 'Could not save track changes right now.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteTrack = () => {
    const songId = track?.id;
    const songTitle = track?.title || 'this track';

    if (!songId || isDeletingTrack) {
      return;
    }

    const finishDelete = () => {
      DeviceEventEmitter.emit('TRACK_DELETED', { songId });
      DeviceEventEmitter.emit('RELOAD_DATA');
      onClose();
    };

    Alert.alert('Delete track', `Delete "${songTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeletingTrack(true);
          try {
            const token = await SecureStore.getItemAsync('userToken');
            await axios.delete(`${API_URL}/api/songs/${songId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            finishDelete();
          } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              finishDelete();
              return;
            }
            console.log('Delete track error:', error);
            Alert.alert('Delete failed', 'Could not delete the track right now.');
          } finally {
            setIsDeletingTrack(false);
          }
        },
      },
    ]);
  };

  if (!track) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={styles.sheetContainer}>
            {modalMode === 'options' && (
              <>
                <View style={styles.trackHeader}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {track.user?.fullName || track.user?.username}
                  </Text>
                </View>

                <TouchableOpacity style={styles.optionRow} onPress={() => handleAction('like')}>
                  <Ionicons
                    name={track.isLiked ? 'heart' : 'heart-outline'}
                    size={24}
                    color={track.isLiked ? COLORS.accentOrange : COLORS.whiteText}
                  />
                  <Text style={styles.optionText}>{track.isLiked ? 'Unlike' : 'Like'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionRow} onPress={() => handleAction('repost')}>
                  <Feather name="repeat" size={24} color={COLORS.whiteText} />
                  <Text style={styles.optionText}>Repost</Text>
                </TouchableOpacity>

                {sourcePlaylistId ? (
                  <TouchableOpacity style={styles.optionRow} onPress={handleRemoveFromPlaylist}>
                    <MaterialIcons name="playlist-remove" size={26} color={COLORS.danger} />
                    <Text style={[styles.optionText, { color: COLORS.danger }]}>
                      Remove from playlist
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.optionRow} onPress={() => setModalMode('playlists')}>
                    <MaterialIcons name="playlist-add" size={26} color={COLORS.whiteText} />
                    <Text style={styles.optionText}>Add to playlist</Text>
                  </TouchableOpacity>
                )}

                {isOwner && (
                  <TouchableOpacity style={styles.optionRow} onPress={() => setModalMode('edit')}>
                    <Feather name="edit-2" size={22} color={COLORS.accentOrange} />
                    <Text style={[styles.optionText, { color: COLORS.accentOrange }]}>
                      Edit track
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {modalMode === 'playlists' && (
              <View style={styles.playlistModeContainer}>
                <View style={styles.playlistHeader}>
                  <TouchableOpacity onPress={() => setModalMode('options')}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.whiteText} />
                  </TouchableOpacity>
                  <Text style={styles.playlistTitle}>Save to playlist</Text>
                  <View style={{ width: 24 }} />
                </View>

                {isCreatingPlaylist ? (
                  <View style={styles.createPlaylistForm}>
                    <TextInput
                      style={styles.playlistInput}
                      placeholder="New playlist name..."
                      placeholderTextColor={COLORS.neutralLightGrey}
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.createBtn} onPress={handleCreatePlaylist}>
                      <Text style={styles.createBtnText}>Create</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.newPlaylistBtn}
                    onPress={() => setIsCreatingPlaylist(true)}
                  >
                    <Ionicons name="add" size={24} color={COLORS.accentOrange} />
                    <Text style={styles.newPlaylistText}>Create new playlist</Text>
                  </TouchableOpacity>
                )}

                <FlatList
                  data={playlists}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.playlistItem}
                      onPress={() => handleAddToPlaylist(item.id)}
                    >
                      <Ionicons
                        name="musical-notes"
                        size={24}
                        color={COLORS.neutralLightGrey}
                      />
                      <Text style={styles.playlistItemText}>{item.title}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>You do not have any playlists yet.</Text>
                  }
                />
              </View>
            )}

            {modalMode === 'edit' && (
              <View style={styles.editModeContainer}>
                <View style={styles.playlistHeader}>
                  <TouchableOpacity onPress={() => setModalMode('options')}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.whiteText} />
                  </TouchableOpacity>
                  <Text style={styles.playlistTitle}>Edit track</Text>
                  <View style={{ width: 24 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={styles.artworkPicker} onPress={pickArtwork}>
                    <Image
                      source={{
                        uri: editArtwork?.uri || resolveSongImageUrl(track.imageUrl),
                      }}
                      style={styles.artworkPreview}
                    />
                    <View style={styles.artworkTextBlock}>
                      <Text style={styles.artworkTitle}>Change artwork</Text>
                      <Text style={styles.artworkSubtitle}>
                        Update the cover image for this track
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Track title</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Track title"
                    placeholderTextColor={COLORS.neutralLightGrey}
                  />

                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.descriptionInput]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Tell listeners about this track"
                    placeholderTextColor={COLORS.neutralLightGrey}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[styles.saveButton, isSavingEdit && { opacity: 0.7 }]}
                    onPress={handleSaveTrackEdit}
                    disabled={isSavingEdit}
                  >
                    <Text style={styles.saveButtonText}>
                      {isSavingEdit ? 'Saving...' : 'Save changes'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteButton, isDeletingTrack && { opacity: 0.7 }]}
                    onPress={handleDeleteTrack}
                    disabled={isDeletingTrack}
                  >
                    <Text style={styles.deleteButtonText}>
                      {isDeletingTrack ? 'Deleting...' : 'Delete track'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheetContainer: {
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 18,
    padding: 20,
    maxHeight: '88%',
  },
  trackHeader: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderColor,
    paddingBottom: 15,
    marginBottom: 15,
  },
  trackTitle: {
    color: COLORS.whiteText,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  trackArtist: {
    color: COLORS.neutralLightGrey,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  optionText: {
    color: COLORS.whiteText,
    fontSize: 16,
    marginLeft: 15,
  },
  playlistModeContainer: {
    width: '100%',
  },
  editModeContainer: {
    width: '100%',
  },
  playlistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderColor,
    paddingBottom: 15,
    marginBottom: 15,
  },
  playlistTitle: {
    color: COLORS.whiteText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  newPlaylistText: {
    color: COLORS.accentOrange,
    fontSize: 16,
    marginLeft: 10,
    fontWeight: 'bold',
  },
  createPlaylistForm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  playlistInput: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    color: COLORS.whiteText,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 10,
  },
  createBtn: {
    backgroundColor: COLORS.accentOrange,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createBtnText: {
    color: '#000',
    fontWeight: 'bold',
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  playlistItemText: {
    color: COLORS.whiteText,
    fontSize: 16,
    marginLeft: 15,
  },
  emptyText: {
    color: COLORS.neutralLightGrey,
    textAlign: 'center',
    marginTop: 20,
  },
  artworkPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  artworkPreview: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#2A2A2A',
  },
  artworkTextBlock: {
    flex: 1,
    marginLeft: 14,
  },
  artworkTitle: {
    color: COLORS.whiteText,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  artworkSubtitle: {
    color: COLORS.neutralLightGrey,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: COLORS.whiteText,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: '#222222',
    color: COLORS.whiteText,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  descriptionInput: {
    minHeight: 96,
  },
  saveButton: {
    backgroundColor: COLORS.accentOrange,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default TrackOptionsModal;
