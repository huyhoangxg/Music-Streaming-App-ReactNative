import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  NotificationPreferences,
  saveNotificationPreferences,
} from '../utils/notificationPreferences';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A',
};

const NotificationSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadNotificationPreferences()
      .then((savedPreferences) => {
        if (isMounted) {
          setPreferences(savedPreferences);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      saveNotificationPreferences(next).catch((error) => {
        console.log('Error saving notification preferences:', error);
      });
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Push notifications</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={styles.settingLabel}>Likes & reposts</Text>
            <Text style={styles.settingSub}>
              Show alerts when people like, repost, or save your tracks.
            </Text>
          </View>
          <Switch
            value={preferences.trackActivity}
            onValueChange={(value) => updatePreference('trackActivity', value)}
            disabled={isLoading}
            trackColor={{ false: '#333', true: COLORS.accentOrange }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={styles.settingLabel}>Comments</Text>
            <Text style={styles.settingSub}>Show alerts when someone comments on your tracks.</Text>
          </View>
          <Switch
            value={preferences.comments}
            onValueChange={(value) => updatePreference('comments', value)}
            disabled={isLoading}
            trackColor={{ false: '#333', true: COLORS.accentOrange }}
            thumbColor="#FFF"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text style={styles.settingLabel}>New music</Text>
            <Text style={styles.settingSub}>
              Show alerts when artists you follow upload new tracks.
            </Text>
          </View>
          <Switch
            value={preferences.newTracks}
            onValueChange={(value) => updatePreference('newTracks', value)}
            disabled={isLoading}
            trackColor={{ false: '#333', true: COLORS.accentOrange }}
            thumbColor="#FFF"
          />
        </View>
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },
  settingLabel: {
    color: COLORS.whiteText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSub: {
    color: COLORS.neutralLightGrey,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default NotificationSettingsScreen;
