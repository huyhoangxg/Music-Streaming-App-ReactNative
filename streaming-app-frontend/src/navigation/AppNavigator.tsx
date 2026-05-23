import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FollowListScreen from '../screens/FollowListScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MainTabNavigator from './MainTabNavigator';
import FullScreenPlayer from '../screens/FullScreenPlayer';
import { PlayerProvider } from '../context/PlayerContext';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AudioQualityScreen from '../screens/AudioQualityScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <PlayerProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Home" component={MainTabNavigator} />
          <Stack.Screen name="Library" component={LibraryScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen 
              name="FullScreenPlayer" 
              component={FullScreenPlayer} 
              options={{ animation: 'slide_from_bottom' }} 
          />

          <Stack.Screen name="Settings" 
              component={SettingsScreen} 
              options={{ animation: 'slide_from_right' }} 
          />

          <Stack.Screen 
              name="EditProfile" 
              component={EditProfileScreen} 
          />

          <Stack.Screen 
              name="FollowList" 
              component={FollowListScreen} 
              options={{ animation: 'default' }} 
          />

          <Stack.Screen 
              name="UserProfile" 
              component={UserProfileScreen} 
              options={{ animation: 'none' }} 
          />
          <Stack.Screen 
              name="PlaylistDetail" 
              component={PlaylistDetailScreen} 
              options={{ animation: 'slide_from_right' }} 
          />
          <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen} 
              options={{ animation: 'slide_from_right' }} 
          />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="AudioQuality" component={AudioQualityScreen} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: 'slide_from_right' }} />
        </Stack.Navigator>

      </NavigationContainer>
    </PlayerProvider>
  );
}
