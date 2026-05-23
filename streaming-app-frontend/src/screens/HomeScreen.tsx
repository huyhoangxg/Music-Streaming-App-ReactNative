import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useUnreadNotif } from '../hooks/useUnreadNotif';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import TrackItem from '../components/TrackItem';
import TrackOptionsModal from '../components/TrackOptionsModal';
import { usePlayer } from '../context/PlayerContext';
import { resolveSongImageUrl } from '../utils/defaultImages';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  cardBg: '#121212',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
};

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;
const HOME_SECTION_LIMIT = 20;
const TRENDING_SECTION_LIMIT = 5;

const HeroSection = ({
  featuredTrack,
  onPlay,
}: {
  featuredTrack?: any;
  onPlay: () => void;
}) => (
  <View style={styles.heroContainer}>
    <Image
      source={{
        uri:
          resolveSongImageUrl(featuredTrack?.imageUrl),
      }}
      style={styles.heroImage}
    />
    <View style={styles.heroOverlay}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroSubtitle}>Personalized feed</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {featuredTrack?.title ? featuredTrack.title : 'Your perfect blend'}
        </Text>
        <Text style={styles.heroDesc} numberOfLines={2}>
          {featuredTrack?.user?.fullName || featuredTrack?.user?.username
            ? `Fresh picks from ${featuredTrack.user.fullName || featuredTrack.user.username}`
            : 'A recommendation mix based on genre, popularity, and recent listening'}
        </Text>
      </View>
      <TouchableOpacity style={styles.playButtonLarge} onPress={onPlay}>
        <MaterialIcons name="play-arrow" size={32} color={COLORS.whiteText} />
      </TouchableOpacity>
    </View>
  </View>
);

const SongCarousel = ({
  title,
  subtitle,
  songs,
  showRank,
  onLongPressOption,
}: any) => {
  const renderSongCard = ({ item, index }: any) => (
    <View style={{ position: 'relative' }}>
      <TrackItem item={item} queue={songs} layoutMode="grid" onLongPressOption={onLongPressOption} />
      {showRank && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.carouselContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}

      <FlatList
        data={songs}
        renderItem={renderSongCard}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
      />
    </View>
  );
};

function applyLikeFlags(list: any[], likedSongIds: Set<string>, sourceContext: string) {
  return list.map((song: any) => ({
    ...song,
    sourceContext: song.sourceContext || sourceContext,
    isLiked: likedSongIds.has(song.id),
  }));
}

function resolveGreeting(date: Date) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }

  if (hour >= 17 && hour < 22) {
    return 'Good evening';
  }

  return 'Good night';
}

function formatCurrentTime(date: Date) {
  return new Intl.DateTimeFormat([], {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const hasUnread = useUnreadNotif();
  const { playTrack } = usePlayer();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState(resolveGreeting(new Date()));
  const [currentTimeLabel, setCurrentTimeLabel] = useState(formatCurrentTime(new Date()));
  const [forYouSongs, setForYouSongs] = useState<any[]>([]);
  const [historySongs, setHistorySongs] = useState<any[]>([]);
  const [trendingSongs, setTrendingSongs] = useState<any[]>([]);
  const [freshSongs, setFreshSongs] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);

  const handleOpenTrackOptions = (track: any) => {
    setSelectedTrack(track);
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setGreeting(resolveGreeting(now));
      setCurrentTimeLabel(formatCurrentTime(now));
    };

    updateClock();
    const intervalId = setInterval(updateClock, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchHomeData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');

      const [publicRes, trendingRes] = await Promise.all([
        axios.get(`${API_URL}/api/songs/public`),
        axios.get(`${API_URL}/api/songs/trending?limit=${TRENDING_SECTION_LIMIT}`),
      ]);

      let forYouData = publicRes.data;
      let trendingData = trendingRes.data;
      let historyData: any[] = [];
      const freshData = Array.isArray(publicRes.data)
        ? publicRes.data.slice(0, HOME_SECTION_LIMIT)
        : [];
      let likedSongIds = new Set<string>();

      if (token) {
        try {
          const [likesRes, recommendationsRes, historyRes] = await Promise.all([
            axios.get(`${API_URL}/api/interaction/my-likes`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/api/recommendations/for-you?limit=${HOME_SECTION_LIMIT}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${API_URL}/api/songs/listening-history?limit=${HOME_SECTION_LIMIT}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          likedSongIds = new Set(likesRes.data.map((song: any) => song.id));
          if (Array.isArray(recommendationsRes.data) && recommendationsRes.data.length > 0) {
            forYouData = recommendationsRes.data;
          }
          if (Array.isArray(historyRes.data)) {
            historyData = historyRes.data;
          }
        } catch (error) {
          console.log('Recommendation fallback to public songs:', error);
        }
      }

      setForYouSongs(
        applyLikeFlags(forYouData, likedSongIds, 'home').slice(0, HOME_SECTION_LIMIT),
      );
      setHistorySongs(
        applyLikeFlags(historyData, likedSongIds, 'history').slice(0, HOME_SECTION_LIMIT),
      );
      setTrendingSongs(
        applyLikeFlags(trendingData, likedSongIds, 'trending').slice(0, TRENDING_SECTION_LIMIT),
      );
      setFreshSongs(applyLikeFlags(freshData, likedSongIds, 'fresh'));
    } catch (error) {
      console.log('Home feed error:', error);
    }
  }, []);

  useEffect(() => {
    void fetchHomeData().finally(() => setLoading(false));

    const reloadSubscription = DeviceEventEmitter.addListener('RELOAD_DATA', () => {
      setTimeout(() => {
        void fetchHomeData();
      }, 500);
    });

    const likeSubscription = DeviceEventEmitter.addListener(
      'LIKE_TOGGLED',
      ({ songId, isLiked, likeCount }) => {
        const updateList = (list: any[]) =>
          list.map((song) => {
            if (song.id !== songId) {
              return song;
            }

            return {
              ...song,
              isLiked,
              likeCount:
                typeof likeCount === 'number'
                  ? likeCount
                  : isLiked
                    ? (song.likeCount || 0) + 1
                    : Math.max(0, (song.likeCount || 0) - 1),
            };
          });

        setForYouSongs((previous) => updateList(previous));
        setHistorySongs((previous) => updateList(previous));
        setTrendingSongs((previous) => updateList(previous));
        setFreshSongs((previous) => updateList(previous));
      },
    );

    return () => {
      reloadSubscription.remove();
      likeSubscription.remove();
    };
  }, [fetchHomeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHomeData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchHomeData]);

  const featuredTrack = forYouSongs[0];

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="soundcloud" size={24} color={COLORS.accentOrange} />
          <Text style={styles.logoText}>SoundWave</Text>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <MaterialIcons
              name="notifications-none"
              size={26}
              color={COLORS.whiteText}
              style={{ marginRight: 15 }}
            />
            {hasUnread ? <View style={styles.unreadDotHeader} /> : null}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <MaterialIcons name="settings" size={26} color={COLORS.whiteText} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accentOrange}
          />
        }
      >
        <View style={{ paddingHorizontal: 15, paddingBottom: 5 }}>
          <Text style={{ color: COLORS.whiteText, fontSize: 24, fontWeight: 'bold' }}>
            {greeting}
          </Text>
          <Text style={{ color: COLORS.neutralLightGrey, fontSize: 14, marginTop: 3 }}>
            Let&apos;s dive into some music!
          </Text>
        </View>

        <HeroSection
          featuredTrack={featuredTrack}
          onPlay={() => {
            if (featuredTrack) {
              playTrack(featuredTrack, forYouSongs);
            }
          }}
        />

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.accentOrange}
            style={{ marginTop: 50 }}
          />
        ) : (
          <>
            <SongCarousel
              title="For you"
              subtitle="Genre-aware picks from your recent listening"
              songs={forYouSongs}
              onLongPressOption={handleOpenTrackOptions}
            />

            {historySongs.length > 0 ? (
              <SongCarousel
                title="Listening history"
                subtitle="Jump back into tracks you played recently"
                songs={historySongs}
                onLongPressOption={handleOpenTrackOptions}
              />
            ) : null}

            <SongCarousel
              title="Trending now"
              subtitle="SoundWave charts"
              songs={trendingSongs}
              showRank={true}
              onLongPressOption={handleOpenTrackOptions}
            />

            <SongCarousel
              title="Fresh uploads"
              subtitle="Newly uploaded tracks across the app"
              songs={freshSongs}
              onLongPressOption={handleOpenTrackOptions}
            />
          </>
        )}
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
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.baseBlack,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: COLORS.whiteText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
  },
  timeText: {
    color: COLORS.accentOrange,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  unreadDotHeader: {
    position: 'absolute',
    top: -2,
    right: 13,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accentOrange,
  },
  heroContainer: {
    margin: 15,
    height: 180,
    borderRadius: 15,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    justifyContent: 'flex-end',
  },
  heroCopy: {
    paddingRight: 78,
  },
  heroSubtitle: {
    color: COLORS.accentOrange,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroTitle: {
    color: COLORS.whiteText,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroDesc: {
    color: COLORS.neutralLightGrey,
    fontSize: 12,
  },
  playButtonLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accentOrange,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 15,
    right: 15,
  },
  carouselContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.whiteText,
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 15,
  },
  sectionSubtitle: {
    color: COLORS.neutralLightGrey,
    fontSize: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  flatListContent: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.accentOrange,
  },
  rankText: {
    color: COLORS.accentOrange,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
