import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';

// Import các màn hình
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
  tabBarBg: '#0A0A0A', // Đen nhạt hơn một tí cho thanh tab
};

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.accentOrange,
        tabBarInactiveTintColor: COLORS.neutralLightGrey,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', paddingBottom: 5 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home-filled" size={26} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ color }) => <Ionicons name="search" size={26} color={color} />,
        }}
      />

      {/* NÚT UPLOAD TO NỔI BẬT Ở GIỮA */}
      <Tab.Screen
        name="UploadTab"
        component={UploadScreen}
        options={{
          tabBarLabel: '', // Giấu chữ đi theo đúng Figma
          tabBarIcon: () => (
            <View style={styles.customUploadButton}>
              <MaterialIcons name="add" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="library-music" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: '',
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBarBg,
    borderTopWidth: 0, // Bỏ viền trắng mặc định
    elevation: 0,
    height: 70, // Cho thanh tab cao lên tí
    paddingTop: 10,
  },
  customUploadButton: {
    top: -10, // Đẩy nút chồi lên trên
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    borderRadius: 30,
    backgroundColor: COLORS.accentOrange,
    // Hiệu ứng phát sáng đổ bóng
    shadowColor: COLORS.accentOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
});
