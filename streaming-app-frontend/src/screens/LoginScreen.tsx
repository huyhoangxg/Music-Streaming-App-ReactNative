import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GOOGLE_AUTH_REQUEST_CONFIG,
  GOOGLE_CLIENT_ID_ENV_NAME,
  GOOGLE_CLIENT_ID_FOR_PLATFORM,
  GOOGLE_LOGIN_UNSUPPORTED_REASON,
} from '../config/googleAuth';
import { runGoogleDeviceLogin } from '../utils/googleDeviceLogin';

WebBrowser.maybeCompleteAuthSession();

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const API_URL = `http://${localhost}:5000`;

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const navigation = useNavigation<any>();

  const [, googleResponse, promptGoogleLogin] =
    Google.useAuthRequest(GOOGLE_AUTH_REQUEST_CONFIG);

  useEffect(() => {
    const completeGoogleLogin = async () => {
      if (googleResponse?.type !== 'success') {
        if (googleResponse?.type === 'error') {
          Alert.alert('Google login failed', 'Could not finish Google login.');
          setIsGoogleLoading(false);
        }
        return;
      }

      const accessToken = googleResponse.authentication?.accessToken;
      if (!accessToken) {
        Alert.alert('Google login failed', 'Google did not return an access token.');
        setIsGoogleLoading(false);
        return;
      }

      try {
        const response = await axios.post(`${API_URL}/api/auth/google`, { accessToken });
        const token = response.data.token;

        if (!token) {
          Alert.alert('Google login failed', 'Server did not return a session token.');
          return;
        }

        await SecureStore.setItemAsync('userToken', token);
        navigation.replace('Home');
      } catch (error: any) {
        console.log('Google login error:', error.response?.data || error.message);
        Alert.alert(
          'Google login failed',
          error.response?.data?.message || 'Could not log in with Google right now.',
        );
      } finally {
        setIsGoogleLoading(false);
      }
    };

    void completeGoogleLogin();
  }, [googleResponse, navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      });

      const token = response.data.token;
      if (token) {
        await SecureStore.setItemAsync('userToken', token);
        navigation.replace('Home');
      } else {
        Alert.alert('Login failed', 'Server did not return a session token.');
      }
    } catch (error: any) {
      console.log('Login error:', error.response?.data || error.message);
      if (error.response?.status === 403 && error.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        Alert.alert(
          'Verify your email',
          error.response.data.message || 'Please verify your email before logging in.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Verify',
              onPress: () =>
                navigation.navigate('Register', {
                  verificationEmail: error.response?.data?.email || email.trim().toLowerCase(),
                }),
            },
          ],
        );
        return;
      }

      Alert.alert(
        'Incorrect login',
        error.response?.data?.message || 'Email or password is incorrect.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (GOOGLE_LOGIN_UNSUPPORTED_REASON) {
      setIsGoogleLoading(true);
      try {
        const token = await runGoogleDeviceLogin(API_URL, ({ userCode, verificationUrl }) => {
          Alert.alert(
            'Google verification code',
            `Code: ${userCode}\n\nTap Open Google, enter this code, approve access, then return to SoundWave.`,
            [
              {
                text: 'Copy and open Google',
                onPress: async () => {
                  await Clipboard.setStringAsync(userCode);
                  void WebBrowser.openBrowserAsync(verificationUrl);
                },
              },
              {
                text: 'Open Google',
                onPress: () => {
                  void WebBrowser.openBrowserAsync(verificationUrl);
                },
              },
              { text: 'Cancel', style: 'cancel' },
            ],
          );
        });

        await SecureStore.setItemAsync('userToken', token);
        navigation.replace('Home');
      } catch (error: any) {
        console.log('Google device login error:', error.response?.data || error.message);
        Alert.alert(
          'Google login failed',
          error.response?.data?.message || error.message || 'Could not log in with Google.',
        );
      } finally {
        setIsGoogleLoading(false);
      }
      return;
    }

    if (!GOOGLE_CLIENT_ID_FOR_PLATFORM) {
      Alert.alert(
        'Google login is not configured',
        `Please set ${GOOGLE_CLIENT_ID_ENV_NAME} in streaming-app-frontend/.env, then restart Expo with cache cleared.`,
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      await promptGoogleLogin();
    } catch (error) {
      console.log('Google prompt error:', error);
      setIsGoogleLoading(false);
      Alert.alert('Google login failed', 'Could not open Google login.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
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
            <Text style={styles.titleText}>Welcome{'\n'}back</Text>
          </View>

          <View style={styles.formContainer}>
            <InputItem iconName="email" placeholder="Email" onTextChange={setEmail} />
            <InputItem
              iconName="lock-outline"
              placeholder="Password"
              secureTextEntry
              onTextChange={setPassword}
            />

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
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
            <TouchableOpacity
              style={[styles.socialButton, isGoogleLoading && { opacity: 0.7 }]}
              onPress={handleGoogleLogin}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={COLORS.whiteText} />
              ) : (
                <>
                  <FontAwesome name="google" size={18} color={COLORS.whiteText} />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </>
              )}
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
    minHeight: 50,
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
