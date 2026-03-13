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
import { MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';


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

const RegisterScreen = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigation = useNavigation<any>();

  // ==========================================
  // HÀM GỌI API ĐĂNG KÝ
  // ==========================================
  const handleRegister = async () => {
    // 1. Kiểm tra không được để trống
    if (!username || !email || !password) {
      Alert.alert('Oop!', 'Vui lòng điền đầy đủ thông tin nhé!');
      return;
    }

    setIsLoading(true);
    try {
      // 2. Bắn data xuống Backend
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        email,
        password,
      });

      // 3. Thành công thì báo và đá sang màn Login
      Alert.alert('Đăng ký thành công!');
      navigation.goBack();
    } catch (error: any) {
      // 4. Lỗi thì báo lỗi
      console.log('Lỗi đăng ký:', error.response?.data || error.message);
      Alert.alert(
        'Lỗi',
        error.response?.data?.message || 'Không thể kết nối đến server!',
      );
    } finally {
      setIsLoading(false); // Tắt vòng xoay loading
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* ĐÃ FIX LẠI SCROLLVIEW: Bao bọc toàn bộ nội dung bên trong */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.whiteText} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>Let's get{'\n'}Started</Text>
          </View>

          <View style={styles.formContainer}>
            <InputItem
              IconComponent={Feather}
              iconName="user"
              placeholder="Username"
              onTextChange={setUsername}
            />
            <InputItem iconName="email" placeholder="Email" onTextChange={setEmail} />
            <InputItem
              iconName="lock-outline"
              placeholder="Password"
              secureTextEntry={true}
              onTextChange={setPassword}
            />
          </View>

          {/* GẮN HÀM XỬ LÝ VÀO NÚT BẤM */}
          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleRegister}
            disabled={isLoading} // Khóa nút khi đang load
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.baseBlack} /> // Hiện vòng xoay
            ) : (
              <Text style={styles.signUpButtonText}>Sign up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialContainer}>
            <TouchableOpacity style={styles.socialButton}>
              <FontAwesome name="apple" size={20} color={COLORS.whiteText} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <FontAwesome name="google" size={18} color={COLORS.whiteText} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLinkText}>Login</Text>
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
  inputIcon: { marginRight: 8 },
  inputField: { flex: 1, color: COLORS.whiteText, fontSize: 14.5 },
  signUpButton: {
    backgroundColor: COLORS.accentOrange,
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    marginVertical: 18,
  },
  signUpButtonText: { color: COLORS.baseBlack, fontSize: 16, fontWeight: '700' },
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

export default RegisterScreen;
