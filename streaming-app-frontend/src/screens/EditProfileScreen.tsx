import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput, 
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, DeviceEventEmitter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import Constants from 'expo-constants';
import { DEFAULT_USER_AVATAR_URL, resolveUserAvatarUrl } from '../utils/defaultImages';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818', 
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A'
};

const EditProfileScreen = () => {
  const navigation = useNavigation<any>();
  
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_USER_AVATAR_URL);
  
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchCurrentProfile = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        if (!token) return;
        const res = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFullName(res.data.fullName || '');
        setUsername(res.data.username || '');
        setBio(res.data.bio || '');
        setAvatarUrl(resolveUserAvatarUrl(res.data.avatarUrl));
      } catch (error) {
        console.log("Error fetching profile for edit:", error);
      }
    };
    fetchCurrentProfile();
  }, []);

  // Hàm mở thư viện ảnh
  const handleChangeAvatar = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
      setAvatarFile(result.assets[0]);
    }
  };

  // Hàm lưu Profile (Bắn FormData lên server)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('username', username);
      formData.append('bio', bio);

      // Nếu có chọn ảnh mới thì mới nhét vào FormData
      if (avatarFile) {
        const localUri = avatarFile.uri;
        const filename = localUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('avatar', {
          uri: localUri,
          name: filename,
          type
        } as any);
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      };

      // Gọi API Update (M nhớ check xem Backend có route PUT /api/users/me chưa nhé)
      await axios.put(`${API_URL}/api/users/me`, formData, config);

      DeviceEventEmitter.emit('RELOAD_DATA');
      
      navigation.goBack();
    } catch (error) {
      console.log("Error updating profile:", error);
      Alert.alert("Error", "Could not update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <MaterialIcons name="close" size={28} color={COLORS.whiteText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.iconButton}>
            {isSaving ? (
              <ActivityIndicator size="small" color={COLORS.accentOrange} />
            ) : (
              <MaterialIcons name="check" size={28} color={COLORS.accentOrange} />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
          
          {/* AVATAR SECTION */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              <TouchableOpacity style={styles.cameraButton} onPress={handleChangeAvatar}>
                <Feather name="camera" size={18} color={COLORS.whiteText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* FORM SECTION */}
          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.neutralLightGrey}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput 
                style={styles.input}
                placeholder="@username"
                placeholderTextColor={COLORS.neutralLightGrey}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput 
                style={[styles.input, styles.textArea]}
                placeholder="Write something about yourself..."
                placeholderTextColor={COLORS.neutralLightGrey}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  iconButton: { width: 40, alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 30 },
  
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: COLORS.accentOrange },
  cameraButton: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.accentOrange, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.baseBlack },
  
  formSection: { paddingBottom: 50 },
  inputGroup: { marginBottom: 25 },
  label: { color: COLORS.neutralLightGrey, fontSize: 13, marginBottom: 8, textTransform: 'uppercase', fontWeight: 'bold' },
  input: { backgroundColor: COLORS.neutralDarkGrey, color: COLORS.whiteText, fontSize: 16, paddingHorizontal: 15, paddingVertical: 15, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderColor },
  textArea: { height: 100 },
});

export default EditProfileScreen;
