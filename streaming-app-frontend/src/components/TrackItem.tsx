// src/components/TrackItem.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { resolveSongImageUrl } from '../utils/defaultImages';

const COLORS = {
  whiteText: '#FFFFFF',
  neutralLightGrey: '#A0A0A0',
  neutralDarkGrey: '#181818',
  accentOrange: '#ff6a00'
};

interface TrackItemProps {
  item: any;
  queue?: any[];
  layoutMode?: 'list' | 'grid'; // 'list' là chữ nhật dài, 'grid' là ô vuông
  onLongPressOption: (track: any) => void; // Hàm này gọi khi ấn giữ
}

const TrackItem: React.FC<TrackItemProps> = ({ item, queue, layoutMode = 'list', onLongPressOption }) => {
  const { playTrack } = usePlayer();

  const handlePress = () => {
    playTrack(item, queue);
  };

  const handleLongPress = () => {
    onLongPressOption(item);
  };

  if (layoutMode === 'grid') {
    // --- GIAO DIỆN Ô VUÔNG (Cho Home) ---
    return (
      <TouchableOpacity 
        style={styles.gridContainer} 
        onPress={handlePress}
        onLongPress={handleLongPress} // Bắt sự kiện ấn giữ
        delayLongPress={300} // Cứ ấn 0.3s là hiện menu
      >
        <Image source={{ uri: resolveSongImageUrl(item.imageUrl) }} style={styles.gridImage} />
        <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.gridArtist} numberOfLines={1}>{item.user?.fullName || item.user?.username}</Text>
      </TouchableOpacity>
    );
  }

  // --- GIAO DIỆN CHỮ NHẬT DÀI (Cho Profile, Search) ---
  return (
    <TouchableOpacity 
      style={styles.listContainer} 
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={300}
    >
      <Image source={{ uri: resolveSongImageUrl(item.imageUrl) }} style={styles.listImage} />
      <View style={styles.listInfo}>
        <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.listArtist} numberOfLines={1}>{item.user?.fullName || item.user?.username}</Text>
        
        {/* Vài cái thống kê nhỏ nhỏ */}
        <View style={styles.listStats}>
          <Feather name="play" size={12} color={COLORS.neutralLightGrey} />
          <Text style={styles.statText}>{item.playCount || 0}</Text> 
          <Ionicons name="heart" size={12} color={COLORS.neutralLightGrey} style={{ marginLeft: 10 }} />
          <Text style={styles.statText}>{item.likeCount || 0}</Text>
        </View>
      </View>
      {/* Vứt mẹ cái dấu 3 chấm đi vì mình xài Long Press rồi */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Style cho List (Chữ nhật)
  listContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.neutralDarkGrey, padding: 10, borderRadius: 8, marginBottom: 10 },
  listImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
  listInfo: { flex: 1, justifyContent: 'center' },
  listTitle: { color: COLORS.whiteText, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  listArtist: { color: COLORS.neutralLightGrey, fontSize: 13, marginBottom: 4 },
  listStats: { flexDirection: 'row', alignItems: 'center' },
  statText: { color: COLORS.neutralLightGrey, fontSize: 12, marginLeft: 4 },

  // Style cho Grid (Ô vuông)
  gridContainer: { width: 140, marginRight: 15 },
  gridImage: { width: 140, height: 140, borderRadius: 8, marginBottom: 8 },
  gridTitle: { color: COLORS.whiteText, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  gridArtist: { color: COLORS.neutralLightGrey, fontSize: 12 }
});

export default TrackItem;
