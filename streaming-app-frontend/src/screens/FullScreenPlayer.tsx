import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ImageBackground, TouchableOpacity, 
  Pressable, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, DeviceEventEmitter, ScrollView, Image, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePlayer } from '../context/PlayerContext';
import TrackOptionsModal from '../components/TrackOptionsModal';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { resolveSongImageUrl, resolveUserAvatarUrl } from '../utils/defaultImages';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  whiteText: '#FFFFFF',
  neutralLightGrey: '#CCCCCC',
  neutralDarkGrey: '#181818',
  accentOrange: '#ff6a00',
  borderColor: '#2A2A2A'
};

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: {
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  return `${years}y`;
};

const resolveCommentAvatarUrl = (avatarUrl?: string) => {
  if (!avatarUrl) {
    return resolveUserAvatarUrl(null);
  }

  return avatarUrl.startsWith('http') ? resolveUserAvatarUrl(avatarUrl) : `${API_URL}${avatarUrl}`;
};

const FullScreenPlayer = () => {
  const navigation = useNavigation<any>();
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrevious,
    progress,
    setIsFullScreen,
  } = usePlayer();
  
  // States quản lý UI số liệu (Cho nó mượt, không cần đợi load lại data)
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // State cho Modal Comment
  const [showComments, setShowComments] = useState(false);
  const [showTrackStory, setShowTrackStory] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  useEffect(() => {
    setIsFullScreen(true);
    return () => setIsFullScreen(false);
  }, []);

  // Mỗi khi đổi bài hát, cập nhật lại số liệu hiển thị + fetch trạng thái like/repost
  useEffect(() => {
    if (currentTrack) {
      setLikeCount(currentTrack.likeCount || 0);
      setRepostCount(currentTrack.repostCount || 0);
      setCommentCount(currentTrack.commentCount || 0);
      setShowTrackStory(false);
      setShowPlaylistModal(false);
      setComments([]);
      
      if (showComments) {
        fetchComments();
      }
      
      // Fetch trạng thái like/repost thực tế từ server
      fetchInteractionStatus(currentTrack.id);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (showComments && currentTrack) {
      fetchComments();
    }
  }, [showComments]);

  const fetchInteractionStatus = async (trackId: string) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return;
      const res = await axios.get(
        `${API_URL}/api/interactions/${trackId}/my-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsLiked(res.data.isLiked);
      setIsReposted(res.data.isReposted);
    } catch (error) {
      setIsLiked(false);
      setIsReposted(false);
    }
  };

  const fetchComments = async () => {
    if (!currentTrack) return;
    try {
      setIsLoadingComments(true);
      const res = await axios.get(`${API_URL}/api/interactions/${currentTrack.id}/comment`);
      setComments(res.data);
    } catch (error) {
      console.log('Lỗi fetch comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleLike = async () => {
    if (!currentTrack) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/api/interactions/${currentTrack.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsLiked(res.data.isLiked);
      if (res.data.likeCount !== undefined) {
        setLikeCount(res.data.likeCount);
      } else {
        setLikeCount(prev => res.data.isLiked ? prev + 1 : prev - 1);
      }
      
      DeviceEventEmitter.emit('RELOAD_DATA');
    } catch (error) {
      console.log('Lỗi thả tim:', error);
    }
  };

  const handleSendComment = async () => {
    if (!currentTrack || newComment.trim() === '') return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(
        `${API_URL}/api/interactions/${currentTrack.id}/comment`,
        { content: newComment.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNewComment('');
      setCommentCount(res.data.commentCount);
      setComments(prev => [res.data.comment, ...prev]);
      DeviceEventEmitter.emit('RELOAD_DATA');
    } catch (error) {
      console.log('Lỗi gửi comment:', error);
    }
  };

  const handleRepost = async () => {
    if (!currentTrack) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const res = await axios.post(`${API_URL}/api/interactions/${currentTrack.id}/repost`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsReposted(res.data.isReposted);
      if (res.data.repostCount !== undefined) {
        setRepostCount(res.data.repostCount);
      } else {
        setRepostCount(prev => res.data.isReposted ? prev + 1 : prev - 1);
      }
      
      DeviceEventEmitter.emit('RELOAD_DATA');
    } catch (error) {
      console.log('Lỗi đăng lại:', error);
    }
  };

  if (!currentTrack) {
    return (
      <SafeAreaView style={styles.fallbackContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{color: 'white'}}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const trackDescription =
    typeof currentTrack.description === 'string' && currentTrack.description.trim()
      ? currentTrack.description.trim()
      : 'No description provided.';

  return (
    <ImageBackground 
      source={{ uri: resolveSongImageUrl(currentTrack.imageUrl) }} 
      style={styles.backgroundImage}
      blurRadius={isPlaying ? 0 : 15} 
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.container}>
        
        {/* === HEADER === */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="keyboard-arrow-left" size={32} color={COLORS.whiteText} />
          </TouchableOpacity>
          <Text style={styles.songTitle} numberOfLines={2}>{currentTrack.title}</Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentTrack.user?.fullName || currentTrack.user?.username || 'Unknown artist'}
          </Text>
          <TouchableOpacity
            style={styles.trackStoryTrigger}
            activeOpacity={0.8}
            onPress={() => setShowTrackStory(true)}
          >
            <Text style={styles.trackStoryTriggerText}>Behind this track</Text>
          </TouchableOpacity>
        </View>

        {/* === VÙNG CHẠM PAUSE/PLAY === */}
        <Pressable style={styles.tapArea} onPress={togglePlayPause} />

        {/* === FOOTER === */}
        <View style={styles.footer}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.playbackControlsRow}>
            <TouchableOpacity style={styles.skipButton} onPress={playPrevious} activeOpacity={0.8}>
              <Ionicons name="play-skip-back" size={30} color={COLORS.whiteText} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.mainPlayButton} onPress={togglePlayPause} activeOpacity={0.86}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={34}
                color={COLORS.neutralDarkGrey}
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={playNext} activeOpacity={0.8}>
              <Ionicons name="play-skip-forward" size={30} color={COLORS.whiteText} />
            </TouchableOpacity>
          </View>

          <View style={styles.actionsRow}>
            {/* NÚT TIM */}
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color={isLiked ? COLORS.accentOrange : COLORS.whiteText} 
              />
              <Text style={[styles.actionText, isLiked && { color: COLORS.accentOrange }]}>
                {likeCount}
              </Text>
            </TouchableOpacity>

            {/* NÚT COMMENT MỞ MODAL */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble-outline" size={26} color={COLORS.whiteText} />
              <Text style={styles.actionText}>{commentCount}</Text>
            </TouchableOpacity>

            {/* NÚT REPOST */}
            <TouchableOpacity style={styles.actionBtn} onPress={handleRepost}>
              <Feather 
                name="repeat" 
                size={26} 
                color={isReposted ? COLORS.accentOrange : COLORS.whiteText} 
              />
              <Text style={[styles.actionText, isReposted && { color: COLORS.accentOrange }]}>
                {repostCount}
              </Text>
            </TouchableOpacity>

            {/* NÚT THÊM PLAYLIST */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPlaylistModal(true)}>
              <MaterialIcons name="playlist-add" size={30} color={COLORS.whiteText} />
              <Text style={styles.actionText}></Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>

      {/* ================= MODAL COMMENT ================= */}
      <Modal visible={showComments} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.commentSheet}>
            
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>{commentCount} comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)} style={{ padding: 5 }}>
                <MaterialIcons name="close" size={24} color={COLORS.whiteText} />
              </TouchableOpacity>
            </View>

            {isLoadingComments ? (
              <ActivityIndicator style={{ flex: 1 }} color={COLORS.accentOrange} />
            ) : comments.length === 0 ? (
              <View style={styles.commentListEmpty}>
                <Ionicons name="chatbubbles-outline" size={40} color={COLORS.neutralLightGrey} />
                <Text style={styles.emptyCommentText}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 15 }}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image
                      source={{ uri: resolveCommentAvatarUrl(item.user.avatarUrl) }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeaderRow}>
                        <Text style={styles.commentAuthor}>{item.user.fullName || item.user.username}</Text>
                        <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
              />
            )}

            <View style={styles.commentInputRow}>
              <TextInput 
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={COLORS.neutralLightGrey}
                value={newComment}
                onChangeText={setNewComment}
              />
              <TouchableOpacity style={styles.sendButton} disabled={newComment.trim().length === 0} onPress={handleSendComment}>
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={newComment.trim().length > 0 ? COLORS.accentOrange : COLORS.neutralLightGrey} 
                />
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showTrackStory} animationType="slide" transparent={true}>
        <Pressable style={styles.trackStoryOverlay} onPress={() => setShowTrackStory(false)}>
          <Pressable style={styles.trackStorySheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.trackStoryHeader}>
              <View style={styles.trackStoryTitleRow}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.accentOrange} />
                <Text style={styles.trackStoryTitle}>Behind this track</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrackStory(false)} style={{ padding: 5 }}>
                <MaterialIcons name="close" size={24} color={COLORS.whiteText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.trackStoryBody}>
              <Text style={styles.trackStoryText}>{trackDescription}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <TrackOptionsModal
        visible={showPlaylistModal}
        track={currentTrack}
        initialMode="playlists"
        onClose={() => setShowPlaylistModal(false)}
      />

    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  container: { flex: 1, justifyContent: 'space-between' },
  fallbackContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  
  header: { paddingHorizontal: 20, paddingTop: 10, zIndex: 10 },
  backButton: { marginLeft: -10, marginBottom: 15 },
  songTitle: { alignSelf: 'flex-start', backgroundColor: 'rgb(0, 0, 0)', color: COLORS.whiteText, fontSize: 20, fontWeight: '800', marginBottom: -4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, overflow: 'hidden' },
  artistName: { alignSelf: 'flex-start', backgroundColor: 'rgb(0, 0, 0)', color: COLORS.neutralLightGrey, fontSize: 16, fontWeight: '500', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  trackStoryTrigger: { alignSelf: 'flex-start', backgroundColor: 'rgb(0, 0, 0)', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  trackStoryTriggerText: { color: COLORS.whiteText, fontSize: 13, fontWeight: '700' },

  tapArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  footer: { paddingHorizontal: 20, paddingBottom: 30, zIndex: 10 },
  trackStoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressContainer: { marginBottom: 24 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 2 },
  progressBarFill: { height: '100%', backgroundColor: COLORS.accentOrange, borderRadius: 2 },
  playbackControlsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28, marginBottom: 28 },
  skipButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.38)' },
  mainPlayButton: { width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.whiteText },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  actionBtn: { alignItems: 'center', minWidth: 50 },
  actionText: { color: COLORS.whiteText, fontSize: 13, marginTop: 4, fontWeight: '600' },

  // Styles cho Modal Comment
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  commentSheet: { backgroundColor: COLORS.neutralDarkGrey, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', paddingBottom: 20 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  commentTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  commentListEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCommentText: { color: COLORS.neutralLightGrey, marginTop: 10, fontSize: 15 },
  commentItem: { flexDirection: 'row', marginBottom: 20 },
  commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#333' },
  commentContent: { flex: 1 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { color: COLORS.neutralLightGrey, fontSize: 14, fontWeight: '600', marginRight: 8 },
  commentTime: { color: '#888', fontSize: 12 },
  commentText: { color: COLORS.whiteText, fontSize: 15, lineHeight: 20 },
  
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 10 },
  commentInput: { flex: 1, backgroundColor: '#2A2A2A', color: COLORS.whiteText, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15 },
  sendButton: { padding: 10, marginLeft: 5 },

  trackStoryOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  trackStorySheet: { backgroundColor: COLORS.neutralDarkGrey, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '58%', paddingBottom: 26 },
  trackStoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  trackStoryTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  trackStoryBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  trackStoryText: { color: COLORS.whiteText, fontSize: 15, lineHeight: 23 }
});

export default FullScreenPlayer;
