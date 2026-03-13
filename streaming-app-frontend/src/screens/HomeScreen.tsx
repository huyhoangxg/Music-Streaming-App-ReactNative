import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  cardBg: '#121212', // Màu nền hơi xám nhẹ cho thẻ bài hát
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
};

const API_URL = 'http://192.168.52.101:5000';

// ==========================================
// 1. MOCK DATA (Dữ liệu giả m cung cấp)
// ==========================================
const madeForYouSongs = [
  {
    id: '1',
    title: 'Midnight Dreams',
    artist: 'Luna Eclipse',
    image:
      'https://images.unsplash.com/photo-1629923759854-156b88c433aa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  },
  {
    id: '2',
    title: 'Electric Pulse',
    artist: 'DJ Nova',
    image:
      'https://images.unsplash.com/photo-1692176548571-86138128e36c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  },
  {
    id: '3',
    title: 'Street Poetry',
    artist: 'Urban Flow',
    image:
      'https://images.unsplash.com/photo-1729156574338-d39065184b0c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  },
  {
    id: '4',
    title: 'Indie Waves',
    artist: 'The Wanderers',
    image:
      'https://images.unsplash.com/photo-1767462372393-e6fdecd8314b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  },
];

const trendingSongs = [
  {
    id: '7',
    title: 'Symphony No. 9',
    artist: 'Classical Masters',
    image:
      'https://images.unsplash.com/photo-1719479757967-c61fd530c625?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    rank: 1,
  },
  {
    id: '8',
    title: 'Acoustic Sessions',
    artist: 'The Strings',
    image:
      'https://images.unsplash.com/photo-1684117736387-69935a4ed00d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    rank: 2,
  },
  {
    id: '9',
    title: 'Rave Paradise',
    artist: 'BeatMaster',
    image:
      'https://images.unsplash.com/photo-1714634586893-ddf37ac30303?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    rank: 3,
  },
];

// ==========================================
// 2. COMPONENT: BANNER CHÍNH (HERO SECTION)
// ==========================================
const HeroSection = () => (
  <View style={styles.heroContainer}>
    {/* Đang dùng ảnh tạm, m có thể đổi URL khác */}
    <Image
      source={{
        uri: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
      }}
      style={styles.heroImage}
    />
    <View style={styles.heroOverlay}>
      <View>
        <Text style={styles.heroSubtitle}>DAILY MIX</Text>
        <Text style={styles.heroTitle}>Your Perfect Blend</Text>
        <Text style={styles.heroDesc}>
          A personalized playlist featuring your favorite artists
        </Text>
      </View>
      <TouchableOpacity style={styles.playButtonLarge}>
        <MaterialIcons name="play-arrow" size={32} color={COLORS.whiteText} />
      </TouchableOpacity>
    </View>
  </View>
);

// ==========================================
// 3. COMPONENT: DANH SÁCH BÀI HÁT NGANG (SONG CAROUSEL)
// ==========================================
const SongCarousel = ({ title, subtitle, songs, showRank }: any) => {
  const renderSongCard = ({ item, index }: any) => (
    <TouchableOpacity style={styles.songCard}>
      <View style={styles.imageContainer}>
        {/* Backend trả về imageUrl, nếu không có thì dùng ảnh mặc định */}
        <Image 
          source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400' }} 
          style={styles.songImage} 
        />
        
        {showRank && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>
        )}

        <View style={styles.playButtonSmall}>
          <MaterialIcons name="play-arrow" size={16} color={COLORS.whiteText} />
        </View>
      </View>
      
      {/* Backend trả về title */}
      <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
      {/* Tên nghệ sĩ lấy từ user.fullName hoặc user.username */}
      <Text style={styles.songArtist} numberOfLines={1}>
        {item.user?.fullName || item.user?.username || 'Unknown Artist'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.carouselContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      
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

// ==========================================
// MÀN HÌNH CHÍNH (HOME SCREEN) - TÍCH HỢP API
// ==========================================
const HomeScreen = () => {
  const [songs, setSongs] = useState([]); // Chứa danh sách nhạc thật
  const [loading, setLoading] = useState(true);

  // Gọi API lấy nhạc Public khi vừa vào màn hình
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/songs/public`);
        setSongs(response.data);
      } catch (error) {
        console.log("Lỗi tải nhạc:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="soundcloud" size={24} color={COLORS.accentOrange} />
          <Text style={styles.logoText}>SoundWave</Text>
        </View>
        <View style={styles.headerIcons}>
          <MaterialIcons name="notifications-none" size={26} color={COLORS.whiteText} style={{ marginRight: 15 }} />
          <MaterialIcons name="settings" size={26} color={COLORS.whiteText} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <HeroSection />
        
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* Đổ data thật vào danh sách này */}
            <SongCarousel title="Mới phát hành" songs={songs} />
            
            {/* Tạm thời copy data thật cho mục Trending, sau này m dùng API AI Recommendation thì thay sau */}
            <SongCarousel title="Trending Now" subtitle="SoundWave Charts" songs={songs.slice(0, 5)} showRank={true} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ==========================================
// 5. STYLES
// ==========================================
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.baseBlack,
    paddingTop: Platform.OS === 'android' ? 30 : 0, // Tránh tai thỏ/camera đục lỗ
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
    backgroundColor: 'rgba(0,0,0,0.5)', // Làm tối ảnh để nổi chữ
    padding: 15,
    justifyContent: 'flex-end',
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  heroDesc: { color: COLORS.neutralLightGrey, fontSize: 12, width: '80%' },
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
  songCard: {
    width: 130, // Kích thước thẻ thu gọn theo UI
    marginRight: 15,
  },
  imageContainer: {
    width: 130,
    height: 130,
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
  },
  songImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  playButtonSmall: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accentOrange,
    justifyContent: 'center',
    alignItems: 'center',
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
  rankText: { color: COLORS.accentOrange, fontSize: 10, fontWeight: 'bold' },
  songTitle: { color: COLORS.whiteText, fontSize: 14, fontWeight: '600' },
  songArtist: { color: COLORS.neutralLightGrey, fontSize: 12 },
});

export default HomeScreen;
