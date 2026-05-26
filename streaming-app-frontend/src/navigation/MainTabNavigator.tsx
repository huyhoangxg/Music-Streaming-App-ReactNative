import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import MiniPlayer from '../components/MiniPlayer';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import UploadScreen from '../screens/UploadScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralLightGrey: '#A0A0A0',
  tabBarBg: '#0A0A0A',
};

export default function MainTabNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: COLORS.accentOrange,
          tabBarInactiveTintColor: COLORS.neutralLightGrey,
          tabBarShowLabel: false,
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="home-filled" size={30} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SearchTab"
          component={SearchScreen}
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="search" size={30} color={color} />,
          }}
        />
        <Tab.Screen
          name="UploadTab"
          component={UploadScreen}
          options={{
            tabBarIcon: () => (
              <View style={styles.customUploadButton}>
                <MaterialIcons name="add" size={32} color={COLORS.baseBlack} />
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="library-music" size={29} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            tabBarIcon: ({ color }) => <Feather name="user" size={28} color={color} />,
          }}
        />
      </Tab.Navigator>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBarBg,
    borderTopWidth: 0,
    elevation: 0,
    height: 78,
    paddingTop: 4,
    paddingBottom: 12,
  },
  tabBarItem: {
    minHeight: 60,
    paddingTop: 0,
    paddingBottom: 8,
  },
  customUploadButton: {
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.accentOrange,
    shadowColor: COLORS.accentOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
});
