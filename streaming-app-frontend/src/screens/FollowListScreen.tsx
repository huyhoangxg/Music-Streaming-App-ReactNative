import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { resolveUserAvatarUrl } from '../utils/defaultImages';

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

const FollowListScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const { type, userId } = route.params; 
  const isFollowers = type === 'followers';

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFollowData = async () => {
      setIsLoading(true);
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        // Dò xem đang bấm tab nào để gọi API tương ứng
        const endpoint = isFollowers 
          ? `${API_URL}/api/users/${userId}/followers`
          : `${API_URL}/api/users/${userId}/following`;

        const res = await axios.get(endpoint, config);
        setUsers(res.data);
      } catch (error) {
        console.log(`Lỗi kéo danh sách ${type}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFollowData();
  }, [type, userId]);

  const renderUser = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.userCard}
      // Bấm vào thằng nào trong list thì bay thẳng sang tường nhà thằng đó!
      onPress={() => navigation.push('UserProfile', { userId: item.id })}
    >
      <Image source={{ uri: resolveUserAvatarUrl(item.avatarUrl) }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={styles.fullName}>{item.fullName || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.neutralLightGrey} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isFollowers ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 30 }} /> 
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.accentOrange} style={{ marginTop: 50 }} />
      ) : users.length > 0 ? (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: 15 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={{ color: COLORS.neutralLightGrey, textAlign: 'center', marginTop: 50 }}>
          {isFollowers ? 'No followers yet.' : 'Not following anyone yet.'}
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderColor },
  headerTitle: { color: COLORS.whiteText, fontSize: 18, fontWeight: 'bold' },
  
  userCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'transparent' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  fullName: { color: COLORS.whiteText, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  username: { color: COLORS.neutralLightGrey, fontSize: 14 },
});

export default FollowListScreen;
