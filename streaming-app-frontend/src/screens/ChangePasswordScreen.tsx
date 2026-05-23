import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A',
};

const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const isFormValid = oldPassword.length > 0 && newPassword.length >= 6 && passwordsMatch;

  const handleSubmit = async () => {
    if (!isFormValid) {
      return;
    }

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        { oldPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      Alert.alert('Password updated', 'Your password has been changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(
        'Change password failed',
        error.response?.data?.message || 'Your current password is incorrect.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change password</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={oldPassword}
            onChangeText={setOldPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>New password (minimum 6 characters)</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          {!passwordsMatch && confirmPassword.length > 0 ? (
            <Text style={styles.errorText}>Passwords do not match.</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !isFormValid && { opacity: 0.5 }]}
          disabled={!isFormValid || isLoading}
          onPress={handleSubmit}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
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
  container: {
    padding: 20,
    backgroundColor: COLORS.baseBlack,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.neutralLightGrey,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.neutralDarkGrey,
    color: COLORS.whiteText,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#ff4444',
    marginTop: 5,
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.accentOrange,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: COLORS.baseBlack,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ChangePasswordScreen;
