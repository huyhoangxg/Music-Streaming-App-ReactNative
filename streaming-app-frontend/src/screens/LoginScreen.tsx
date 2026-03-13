import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store'; // Két sắt mã hóa của Expo

// NHỚ SỬA IP NÀY GIỐNG BÊN MÀN REGISTER NHÉ
const API_URL = 'http://192.168.52.101:5000';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#2A2A2A',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
};

const InputItem = ({
  iconName,
  placeholder,
  secureTextEntry,
  onTextChange,
  IconComponent = MaterialIcons,
}: any) => (
  <View style={styles.inputWrapper}>
    <IconComponent
      name={iconName}
      size={20}
      color={COLORS.neutralLightGrey}
      style={styles.inputIcon}
    />
    <TextInput
      style={styles.inputField}
      placeholder={placeholder}
      placeholderTextColor={COLORS.neutralLightGrey}
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      onChangeText={onTextChange}
    />
  </View>
);

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<any>();

  // ==========================================
  // 1. ĐĂNG NHẬP THƯỜNG (BẢO MẬT TOKEN)
  // ==========================================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Oop!', 'Nhập thiếu email hoặc mật khẩu rồi kìa!');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });

      // Lấy token từ backend trả về (Giả sử backend trả về response.data.token)
      const token = response.data.token;

      if (token) {
        // Cất token vào két sắt mã hóa của thiết bị
        await SecureStore.setItemAsync('userToken', token);

        // Dùng replace thay vì navigate để user không vuốt ngược lại màn hình Login được
        navigation.replace('Home');
      } else {
        Alert.alert('Lỗi', 'Không lấy được phiên đăng nhập từ máy chủ.');
      }
    } catch (error: any) {
      console.log('Lỗi đăng nhập:', error.response?.data || error.message);
      Alert.alert(
        'Sai thông tin',
        error.response?.data?.message || 'Email hoặc mật khẩu không chính xác!',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. ĐĂNG NHẬP BẰNG GOOGLE (Bộ khung chờ)
  // ==========================================
  const handleGoogleLogin = () => {
    Alert.alert(
      'Sắp ra mắt',
      'Để dùng được tính năng này, anh em mình sẽ cần setup Firebase Auth và lấy API Key từ Google Cloud Console ở các bước sau nhé!',
    );
  };

  // ==========================================
  // 3. ĐĂNG NHẬP BẰNG APPLE (Bộ khung chờ)
  // ==========================================
  const handleAppleLogin = () => {
    Alert.alert(
      'Sắp ra mắt',
      'Cần có tài khoản Apple Developer (khoảng 99$/năm) để mở khóa tính năng này trên iOS!',
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Dùng ScrollView để fix triệt để vụ bàn phím cứng đầu */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton}>
              <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.whiteText} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Welcome{'\n'}Back</Text>
          </View>

          <View style={styles.formContainer}>
            <InputItem iconName="email" placeholder="Email" onTextChange={setEmail} />
            <InputItem
              iconName="lock-outline"
              placeholder="Password"
              secureTextEntry={true}
              onTextChange={setPassword}
            />

            <TouchableOpacity style={styles.forgotPasswordContainer}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.baseBlack} />
            ) : (
              <Text style={styles.loginButtonText}>Log in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialContainer}>
            {/* NÚT APPLE */}
            <TouchableOpacity style={styles.socialButton} onPress={handleAppleLogin}>
              <FontAwesome name="apple" size={20} color={COLORS.whiteText} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>

            {/* NÚT GOOGLE */}
            <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin}>
              <FontAwesome name="google" size={18} color={COLORS.whiteText} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLinkText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.baseBlack,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: COLORS.whiteText,
    fontSize: 14.5,
    marginLeft: 5,
  },
  titleContainer: {
    marginVertical: 25,
  },
  titleText: {
    color: COLORS.whiteText,
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 48,
  },
  formContainer: {
    marginVertical: 15,
    gap: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    color: COLORS.whiteText,
    fontSize: 14.5,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPasswordText: {
    color: COLORS.neutralLightGrey,
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: COLORS.accentOrange,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 18,
  },
  loginButtonText: {
    color: COLORS.baseBlack,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.neutralDarkGrey,
  },
  dividerText: {
    color: COLORS.neutralLightGrey,
    fontSize: 14.5,
  },
  socialContainer: {
    gap: 12,
    marginVertical: 15,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.neutralDarkGrey,
    borderRadius: 50,
    paddingVertical: 15,
    gap: 8,
  },
  socialButtonText: {
    color: COLORS.whiteText,
    fontSize: 14.5,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  footerText: {
    color: COLORS.neutralLightGrey,
    fontSize: 14.5,
  },
  footerLinkText: {
    color: COLORS.accentOrange,
    fontSize: 14.5,
    fontWeight: '700',
  },
});

export default LoginScreen;
