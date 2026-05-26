import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const readEnv = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

export const GOOGLE_WEB_CLIENT_ID = readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
export const GOOGLE_ANDROID_CLIENT_ID = readEnv(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
export const GOOGLE_IOS_CLIENT_ID = readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

export const GOOGLE_CLIENT_ID_PLACEHOLDER =
  'missing-google-client-id.apps.googleusercontent.com';

const GOOGLE_PLATFORM_CLIENT_ID = Platform.select({
  ios: GOOGLE_IOS_CLIENT_ID,
  android: GOOGLE_ANDROID_CLIENT_ID,
  default: GOOGLE_WEB_CLIENT_ID,
});

export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const GOOGLE_CLIENT_ID_FOR_PLATFORM = GOOGLE_PLATFORM_CLIENT_ID;

export const GOOGLE_LOGIN_UNSUPPORTED_REASON =
  IS_EXPO_GO && Platform.OS !== 'web'
    ? 'Google login cannot run reliably inside Expo Go with the current Expo AuthSession version. Please use an Android development build with EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, or an iOS development build with EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.'
    : '';

export const GOOGLE_CLIENT_ID_ENV_NAME = Platform.select({
  ios: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  android: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  default: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
});

export const GOOGLE_AUTH_REQUEST_CONFIG = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  clientId: GOOGLE_CLIENT_ID_FOR_PLATFORM || GOOGLE_CLIENT_ID_PLACEHOLDER,
  scopes: ['openid', 'profile', 'email'],
  selectAccount: true,
};
