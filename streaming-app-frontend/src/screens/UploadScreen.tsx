import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';

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
};

const GENRE_OPTIONS = [
  'Pop',
  'Rap/Hip-Hop',
  'R&B',
  'Rock',
  'Indie',
  'EDM',
  'Lo-Fi',
  'Jazz',
  'Acoustic',
  'Bolero',
  'Other',
];

function getUploadErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const serverMessage = error.response?.data?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) {
      return serverMessage;
    }

    if (error.response?.status) {
      return `Upload failed with status ${error.response.status}.`;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not upload the song right now.';
}

const UploadScreen = () => {
  const navigation = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<any>(null);
  const [artwork, setArtwork] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenrePickerVisible, setIsGenrePickerVisible] = useState(false);

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAudioFile(result.assets[0]);
      }
    } catch (error) {
      console.log('Audio picker error:', error);
    }
  };

  const pickArtwork = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setArtwork(result.assets[0]);
      }
    } catch (error) {
      console.log('Artwork picker error:', error);
    }
  };

  const handlePostTrack = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle || !audioFile) {
      Alert.alert('Missing info', 'Please enter a title and select an audio file.');
      return;
    }

    if (!genre) {
      Alert.alert('Missing genre', 'Please choose a genre before uploading.');
      return;
    }

    setIsUploading(true);

    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }

      const formData = new FormData();
      formData.append('title', normalizedTitle);
      formData.append('uploaderGenre', genre);
      formData.append('description', description);
      formData.append('audio', {
        uri: audioFile.uri,
        name: audioFile.name,
        type: audioFile.mimeType || 'audio/mpeg',
      } as any);

      if (artwork) {
        const fileName = artwork.fileName || artwork.uri.split('/').pop() || 'cover.jpg';
        const match = /\.(\w+)$/.exec(fileName);
        const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri: artwork.uri,
          name: fileName,
          type: mimeType,
        } as any);
      }

      await axios.post(`${API_URL}/api/songs/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Alert.alert('Success', 'Your song has been uploaded successfully.');
      setTitle('');
      setGenre('');
      setDescription('');
      setAudioFile(null);
      setArtwork(null);
      DeviceEventEmitter.emit('RELOAD_DATA');
      navigation.navigate('HomeTab');
    } catch (error) {
      const message = getUploadErrorMessage(error);
      console.log('Upload error:', {
        status: axios.isAxiosError(error) ? error.response?.status : undefined,
        data: axios.isAxiosError(error) ? error.response?.data : undefined,
        message,
      });
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <FontAwesome5 name="soundcloud" size={24} color={COLORS.accentOrange} />
          <Text style={styles.logoText}>SoundWave</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Upload your track</Text>
          <Text style={styles.pageSubtitle}>Share your music with the world</Text>
        </View>

        <TouchableOpacity style={styles.uploadBox} onPress={pickAudio}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="music-note" size={30} color={COLORS.accentOrange} />
          </View>
          <Text style={styles.uploadBoxTitle}>
            {audioFile ? audioFile.name : 'Tap to select audio file'}
          </Text>
          <Text style={styles.uploadBoxSub}>MP3, WAV, FLAC up to 100 MB</Text>
        </TouchableOpacity>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Track title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter track title"
            placeholderTextColor={COLORS.neutralLightGrey}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Genre *</Text>
          <TouchableOpacity
            style={styles.genreSelect}
            activeOpacity={0.85}
            onPress={() => setIsGenrePickerVisible((visible) => !visible)}
          >
            <Text style={[styles.genreSelectText, !genre && styles.genrePlaceholder]}>
              {genre || 'Select a genre'}
            </Text>
            <MaterialIcons
              name={isGenrePickerVisible ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color={COLORS.neutralLightGrey}
            />
          </TouchableOpacity>

          {isGenrePickerVisible ? (
            <View style={styles.genreDropdown}>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {GENRE_OPTIONS.map((option) => {
                  const isSelected = genre === option;

                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.genreOptionRow, isSelected && styles.genreOptionRowSelected]}
                      onPress={() => {
                        setGenre(option);
                        setIsGenrePickerVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.genreOptionText,
                          isSelected && styles.genreOptionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color={COLORS.accentOrange} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us about your track..."
            placeholderTextColor={COLORS.neutralLightGrey}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Artwork</Text>
          <TouchableOpacity style={styles.artworkBox} onPress={pickArtwork}>
            <View style={styles.artworkIconBox}>
              {artwork ? (
                <Image source={{ uri: artwork.uri }} style={styles.artworkImagePreview} />
              ) : (
                <MaterialIcons name="image" size={30} color={COLORS.neutralLightGrey} />
              )}
            </View>
            <View>
              <Text style={styles.artworkTitle}>
                {artwork ? 'Image selected' : 'Upload image'}
              </Text>
              <Text style={styles.artworkSub}>JPG or PNG, min 800 x 800 px</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isUploading && { opacity: 0.7 }]}
          onPress={handlePostTrack}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={COLORS.baseBlack} />
          ) : (
            <>
              <Feather
                name="upload"
                size={20}
                color={COLORS.baseBlack}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.submitButtonText}>Post track</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

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
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoText: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 15, marginTop: 10 },
  titleSection: { alignItems: 'center', marginVertical: 20 },
  pageTitle: {
    color: COLORS.whiteText,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pageSubtitle: { color: COLORS.neutralLightGrey, fontSize: 14 },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: COLORS.borderColor,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 35,
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadBoxTitle: {
    color: COLORS.whiteText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  uploadBoxSub: { color: COLORS.neutralLightGrey, fontSize: 13 },
  formGroup: { marginBottom: 20 },
  label: { color: COLORS.whiteText, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 8,
    color: COLORS.whiteText,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
  },
  genreSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  genreSelectText: {
    flex: 1,
    color: COLORS.whiteText,
    paddingVertical: 14,
    fontSize: 15,
  },
  genrePlaceholder: {
    color: COLORS.neutralLightGrey,
  },
  textArea: { minHeight: 100 },
  artworkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 8,
    padding: 15,
  },
  artworkIconBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: COLORS.baseBlack,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  artworkImagePreview: { width: '100%', height: '100%' },
  artworkTitle: {
    color: COLORS.whiteText,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  artworkSub: { color: COLORS.neutralLightGrey, fontSize: 13 },
  submitButton: {
    backgroundColor: COLORS.accentOrange,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 50,
    marginTop: 10,
    shadowColor: COLORS.accentOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: { color: COLORS.baseBlack, fontSize: 16, fontWeight: 'bold' },
  genreDropdown: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 190,
    overflow: 'hidden',
  },
  genreOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderColor,
  },
  genreOptionRowSelected: {
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
  },
  genreOptionText: {
    color: COLORS.whiteText,
    fontSize: 15,
    fontWeight: '500',
  },
  genreOptionTextSelected: {
    color: COLORS.accentOrange,
  },
});

export default UploadScreen;
