import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  dangerRed: '#ff4444',
  borderColor: '#2A2A2A',
};

const SettingsScreen = () => {
  const navigation = useNavigation<any>();

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out of SoundWave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            DeviceEventEmitter.emit('PLAYER_RESET');
            await SecureStore.deleteItemAsync('userToken');
            DeviceEventEmitter.emit('RELOAD_DATA');

            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch (error) {
            console.log('Logout error:', error);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.settingText}>Edit profile</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.neutralLightGrey} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={styles.settingText}>Change password</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.neutralLightGrey} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options</Text>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Text style={styles.settingText}>Notifications</Text>
            <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.neutralLightGrey} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Feather name="log-out" size={20} color={COLORS.dangerRed} style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.baseBlack },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderColor,
  },
  headerTitle: { color: COLORS.whiteText, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: {
    color: COLORS.neutralLightGrey,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutralDarkGrey,
  },
  settingText: { color: COLORS.whiteText, fontSize: 16 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  logoutText: { color: COLORS.dangerRed, fontSize: 16, fontWeight: 'bold' },
});

export default SettingsScreen;
