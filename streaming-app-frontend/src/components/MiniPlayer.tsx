import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useNavigation } from '@react-navigation/native';
import { resolveSongImageUrl } from '../utils/defaultImages';

const COLORS = {
  neutralDarkGrey: '#1E1E1E',
  whiteText: '#FFFFFF',
  neutralLightGrey: '#A0A0A0',
  accentOrange: '#ff6a00',
};

const MiniPlayer = () => {
  const { currentTrack, isPlaying, togglePlayPause, playNext, progress, isFullScreen, toggleLike } = usePlayer();
  const navigation = useNavigation<any>();

  if (!currentTrack || isFullScreen) return null;

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={0.9}
      onPress={() => navigation.navigate('FullScreenPlayer')} 
    >
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        <Image source={{ uri: resolveSongImageUrl(currentTrack.imageUrl) }} style={styles.image} />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.user?.username || currentTrack.user?.fullname || 'Unknown artist'}
          </Text>
        </View>

        <TouchableOpacity style={styles.controlButton} onPress={() => toggleLike(currentTrack.id)}>
          <Ionicons name={currentTrack.isLiked ? "heart" : "heart-outline"} size={24} color={currentTrack.isLiked ? COLORS.accentOrange : COLORS.whiteText} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={togglePlayPause}>
          <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={30} color={COLORS.whiteText} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={playNext}>
          <MaterialIcons name="skip-next" size={30} color={COLORS.whiteText} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 5,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  progressBar: { 
    height: 2, 
    backgroundColor: '#333', 
    width: '100%' 
},
  progressFill: { 
    height: '100%', 
    backgroundColor: COLORS.accentOrange, 
    width: '0%' 
},
  content: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 58,
},
  image: { 
    width: 40, 
    height: 40, 
    borderRadius: 4, 
    marginRight: 10 
},
  textContainer: { 
    flex: 1, 
    justifyContent: 'center' 
},
  title: { 
    color: COLORS.whiteText, 
    fontSize: 14, 
    fontWeight: 'bold' 
},
  artist: { 
    color: COLORS.neutralLightGrey, 
    fontSize: 12 
},
  controlButton: { 
    paddingHorizontal: 10 
},
});

export default MiniPlayer;
