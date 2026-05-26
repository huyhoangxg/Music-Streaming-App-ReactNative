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
import { MaterialIcons, FontAwesome, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  value,
  keyboardType,
  maxLength,
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
      keyboardType={keyboardType}
      maxLength={maxLength}
      value={value}
      onChangeText={onTextChange}
    />
  </View>
);

const RegisterScreen = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const route = useRoute<any>();
  const initialVerificationEmail =
    typeof route.params?.verificationEmail === 'string'
      ? route.params.verificationEmail.trim().toLowerCase()
      : '';
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(initialVerificationEmail);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
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

  const handleRegister = async () => {
    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !normalizedEmail || !password) {
      Alert.alert('Missing info', 'Please fill in username, email, and password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username: trimmedUsername,
        email: normalizedEmail,
        password,
      });

      setPendingVerificationEmail(normalizedEmail);
      setVerificationCode('');
      Alert.alert(
        'Verify your email',
        response.data?.emailDeliveryFailed
          ? response.data?.message || 'Could not send the verification email. Please resend the code.'
          : 'A 6-digit verification code has been sent.',
      );
    } catch (error: any) {
      console.log('Register error:', error.response?.data || error.message);
      Alert.alert(
        'Sign up failed',
        error.response?.data?.message || 'Could not connect to the server.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!pendingVerificationEmail || verificationCode.trim().length < 6) {
      Alert.alert('Verification', 'Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/verify-email`, {
        email: pendingVerificationEmail,
        code: verificationCode.trim(),
      });

      const token = response.data.token;
      if (token) {
        await SecureStore.setItemAsync('userToken', token);
        navigation.replace('Home');
        return;
      }

      Alert.alert('Verified', 'Email verified. Please log in.');
      navigation.goBack();
    } catch (error: any) {
      console.log('Verify email error:', error.response?.data || error.message);
      Alert.alert(
        'Verification failed',
        error.response?.data?.message || 'Could not verify this email right now.',
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!pendingVerificationEmail) {
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/auth/resend-verification`, {
        email: pendingVerificationEmail,
      });
      Alert.alert(
        'Verification',
        response.data?.message || 'A new verification code has been sent.',
      );
    } catch (error: any) {
      console.log('Resend verification error:', error.response?.data || error.message);
      Alert.alert(
        'Verification',
        error.response?.data?.message || 'Could not resend the verification code right now.',
      );
    }
  };

  const isVerifyingEmail = Boolean(pendingVerificationEmail);

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
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back-ios" size={20} color={COLORS.whiteText} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>
              {isVerifyingEmail ? 'Verify your\nemail' : "Let's get\nstarted"}
            </Text>
          </View>

          {isVerifyingEmail ? (
            <>
              <Text style={styles.verificationHint}>
                Enter the 6-digit code sent to {pendingVerificationEmail}.
              </Text>

              <View style={styles.formContainer}>
                <InputItem
                  iconName="verified-user"
                  placeholder="Verification code"
                  value={verificationCode}
                  onTextChange={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleVerifyEmail}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <ActivityIndicator color={COLORS.baseBlack} />
                ) : (
                  <Text style={styles.signUpButtonText}>Verify email</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resendButton} onPress={handleResendCode}>
                <Text style={styles.resendButtonText}>Resend code</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.formContainer}>
                <InputItem
                  IconComponent={Feather}
                  iconName="user"
                  placeholder="Username"
                  value={username}
                  onTextChange={setUsername}
                />
                <InputItem
                  iconName="email"
                  placeholder="Email"
                  value={email}
                  keyboardType="email-address"
                  onTextChange={setEmail}
                />
                <InputItem
                  iconName="lock-outline"
                  placeholder="Password"
                  value={password}
                  secureTextEntry
                  onTextChange={setPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.signUpButton}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.baseBlack} />
                ) : (
                  <Text style={styles.signUpButtonText}>Sign up</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {!isVerifyingEmail ? (
            <>
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
            </>
          ) : null}

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.footerLinkText}>Log in</Text>
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
  verificationHint: {
    color: COLORS.neutralLightGrey,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 6,
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
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendButtonText: {
    color: COLORS.accentOrange,
    fontSize: 14.5,
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

export default RegisterScreen;
