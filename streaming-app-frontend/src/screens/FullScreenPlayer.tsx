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
  id: string | number;
  content: string;
  createdAt: string;
  user: {
    id?: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

type TrackStoryTab = 'likes' | 'comments' | 'reposts';

interface InteractionUserData {
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

const formatCommentTime = (dateString: string) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  
  // Local interaction state keeps the player responsive before the feed refreshes.
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Comment and playlist modal state.
  const [showComments, setShowComments] = useState(false);
  const [showTrackStory, setShowTrackStory] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [trackStoryTab, setTrackStoryTab] = useState<TrackStoryTab>('likes');
  const [canViewTrackInsights, setCanViewTrackInsights] = useState(false);
  const [isLoadingTrackInsights, setIsLoadingTrackInsights] = useState(false);
  const [likedUsers, setLikedUsers] = useState<InteractionUserData[]>([]);
  const [repostedUsers, setRepostedUsers] = useState<InteractionUserData[]>([]);

  useEffect(() => {
    setIsFullScreen(true);
    return () => setIsFullScreen(false);
  }, []);

  // Refresh visible counts and interaction state whenever the track changes.
  useEffect(() => {
    if (currentTrack) {
      setLikeCount(currentTrack.likeCount || 0);
      setRepostCount(currentTrack.repostCount || 0);
      setCommentCount(currentTrack.commentCount || 0);
      setShowTrackStory(false);
      setShowPlaylistModal(false);
      setComments([]);
      setTrackStoryTab('likes');
      setCanViewTrackInsights(false);
      setLikedUsers([]);
      setRepostedUsers([]);
      
      if (showComments) {
        fetchComments();
      }
      
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
      console.log('Failed to fetch comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const fetchTrackInsights = async () => {
    if (!currentTrack) return;

    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setCanViewTrackInsights(false);
        return;
      }

      setIsLoadingTrackInsights(true);
      const headers = { Authorization: `Bearer ${token}` };
      const [likesRes, repostsRes, commentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/interactions/${currentTrack.id}/likes`, { headers }),
        axios.get(`${API_URL}/api/interactions/${currentTrack.id}/reposts`, { headers }),
        axios.get(`${API_URL}/api/interactions/${currentTrack.id}/comment`),
      ]);

      setLikedUsers(Array.isArray(likesRes.data) ? likesRes.data : []);
      setRepostedUsers(Array.isArray(repostsRes.data) ? repostsRes.data : []);
      setComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
      setCanViewTrackInsights(true);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status !== 403 && status !== 404) {
        console.log('Failed to fetch track insights:', error);
      }
      setCanViewTrackInsights(false);
      setTrackStoryTab('likes');
    } finally {
      setIsLoadingTrackInsights(false);
    }
  };

  const openTrackStory = () => {
    setTrackStoryTab('likes');
    setCanViewTrackInsights(false);
    setLikedUsers([]);
    setRepostedUsers([]);
    setShowTrackStory(true);
    void fetchTrackInsights();
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
      console.log('Failed to toggle like:', error);
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
      console.log('Failed to send comment:', error);
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
      console.log('Failed to toggle repost:', error);
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

  const renderCommentItem = ({ item }: { item: CommentData }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ uri: resolveCommentAvatarUrl(item.user.avatarUrl) }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentAuthor}>{item.user.fullName || item.user.username}</Text>
          <Text style={styles.commentTime}>{formatCommentTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
      </View>
    </View>
  );

  const renderCommentsContent = (contentStyle: any) => {
    if (isLoadingComments) {
      return <ActivityIndicator style={{ flex: 1 }} color={COLORS.accentOrange} />;
    }

    if (comments.length === 0) {
      return (
        <View style={styles.commentListEmpty}>
          <Ionicons name="chatbubbles-outline" size={40} color={COLORS.neutralLightGrey} />
          <Text style={styles.emptyCommentText}>Be the first to comment!</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={comments}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={contentStyle}
        renderItem={renderCommentItem}
      />
    );
  };

  const renderCommentComposer = () => (
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
  );

  const renderInteractionUserRow = ({ item }: { item: InteractionUserData }) => (
    <View style={styles.insightUserItem}>
      <Image
        source={{ uri: resolveCommentAvatarUrl(item.user.avatarUrl) }}
        style={styles.insightUserAvatar}
      />
      <View style={styles.insightUserTextBlock}>
        <Text style={styles.insightUserName} numberOfLines={1}>
          {item.user.fullName || item.user.username}
        </Text>
        <Text style={styles.insightUserUsername} numberOfLines={1}>
          @{item.user.username}
        </Text>
      </View>
      <Text style={styles.insightTime}>{formatCommentTime(item.createdAt)}</Text>
    </View>
  );

  const renderInteractionUserList = (
    data: InteractionUserData[],
    emptyText: string,
    iconName: keyof typeof Ionicons.glyphMap,
  ) => {
    if (isLoadingTrackInsights) {
      return <ActivityIndicator style={{ flex: 1 }} color={COLORS.accentOrange} />;
    }

    if (data.length === 0) {
      return (
        <View style={styles.commentListEmpty}>
          <Ionicons name={iconName} size={40} color={COLORS.neutralLightGrey} />
          <Text style={styles.emptyCommentText}>{emptyText}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={data}
        keyExtractor={(item, index) => `${item.user.id}-${item.createdAt}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.trackStoryListBody}
        renderItem={renderInteractionUserRow}
      />
    );
  };

  const renderTrackStoryContent = () => {
    if (!canViewTrackInsights) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.trackStoryBody}>
          <Text style={styles.trackStoryText}>{trackDescription}</Text>
        </ScrollView>
      );
    }

    if (trackStoryTab === 'likes') {
      return renderInteractionUserList(likedUsers, 'No likes yet.', 'heart-outline');
    }

    if (trackStoryTab === 'reposts') {
      return renderInteractionUserList(repostedUsers, 'No reposts yet.', 'repeat-outline');
    }

    return (
      <View style={styles.trackStoryCommentsPanel}>
        <View style={styles.trackStoryCommentsBody}>
          {renderCommentsContent(styles.trackStoryCommentsList)}
        </View>
        {renderCommentComposer()}
      </View>
    );
  };

  const trackStoryTabs: { key: TrackStoryTab; label: string }[] = [
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'reposts', label: 'Reposts' },
  ];

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
            onPress={openTrackStory}
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
            {/* Like */}
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

            {/* Comments */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubble-outline" size={26} color={COLORS.whiteText} />
              <Text style={styles.actionText}>{commentCount}</Text>
            </TouchableOpacity>

            {/* Repost */}
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

            {/* Add to playlist */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowPlaylistModal(true)}>
              <MaterialIcons name="playlist-add" size={30} color={COLORS.whiteText} />
              <Text style={styles.actionText}></Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>

      {/* Comments modal */}
      <Modal visible={showComments} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.commentSheet}>
            
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>{commentCount} comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)} style={{ padding: 5 }}>
                <MaterialIcons name="close" size={24} color={COLORS.whiteText} />
              </TouchableOpacity>
            </View>

            <View style={styles.commentsBody}>
              {renderCommentsContent(styles.commentListBody)}
            </View>

            {renderCommentComposer()}

          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showTrackStory} animationType="slide" transparent={true}>
        <Pressable style={styles.trackStoryOverlay} onPress={() => setShowTrackStory(false)}>
          <Pressable
            style={[styles.trackStorySheet, canViewTrackInsights && styles.trackStorySheetExpanded]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.trackStoryHeader}>
              <View style={styles.trackStoryTitleRow}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.accentOrange} />
                <Text style={styles.trackStoryTitle}>Behind this track</Text>
              </View>
              {isLoadingTrackInsights && !canViewTrackInsights ? (
                <ActivityIndicator size="small" color={COLORS.accentOrange} />
              ) : null}
              <TouchableOpacity onPress={() => setShowTrackStory(false)} style={{ padding: 5 }}>
                <MaterialIcons name="close" size={24} color={COLORS.whiteText} />
              </TouchableOpacity>
            </View>

            {canViewTrackInsights ? (
              <>
                <View style={styles.trackStoryDescriptionBlock}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <Text style={styles.trackStoryText}>{trackDescription}</Text>
                  </ScrollView>
                </View>

                <View style={styles.trackStoryTabs}>
                  {trackStoryTabs.map((tab) => {
                    const isActive = trackStoryTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.trackStoryTab, isActive && styles.trackStoryTabActive]}
                        onPress={() => setTrackStoryTab(tab.key)}
                        activeOpacity={0.86}
                      >
                        <Text style={[styles.trackStoryTabText, isActive && styles.trackStoryTabTextActive]}>
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {renderTrackStoryContent()}
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

  // Comment modal styles
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  commentSheet: { backgroundColor: COLORS.neutralDarkGrey, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', paddingBottom: 20 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  commentTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  commentsBody: { flex: 1 },
  commentListBody: { padding: 15 },
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
  trackStorySheetExpanded: { height: '78%', maxHeight: '78%', paddingBottom: 18 },
  trackStoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  trackStoryTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  trackStoryDescriptionBlock: { maxHeight: 132, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  trackStoryTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  trackStoryTab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, borderRadius: 8, backgroundColor: '#242424', paddingHorizontal: 6 },
  trackStoryTabActive: { backgroundColor: COLORS.accentOrange },
  trackStoryTabText: { color: COLORS.neutralLightGrey, fontSize: 12, fontWeight: '700' },
  trackStoryTabTextActive: { color: COLORS.whiteText },
  trackStoryBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  trackStoryText: { color: COLORS.whiteText, fontSize: 15, lineHeight: 23 },
  trackStoryListBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  insightUserItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  insightUserAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12, backgroundColor: '#333' },
  insightUserTextBlock: { flex: 1, minWidth: 0 },
  insightUserName: { color: COLORS.whiteText, fontSize: 15, fontWeight: '700' },
  insightUserUsername: { color: COLORS.neutralLightGrey, fontSize: 13, marginTop: 2 },
  insightTime: { color: '#888', fontSize: 11, marginLeft: 8, maxWidth: 92, textAlign: 'right' },
  trackStoryCommentsPanel: { flex: 1 },
  trackStoryCommentsBody: { flex: 1 },
  trackStoryCommentsList: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: 8 }
});

export default FullScreenPlayer;
