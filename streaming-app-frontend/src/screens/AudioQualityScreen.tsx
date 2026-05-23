import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';

const COLORS = {
  baseBlack: '#000000',
  accentOrange: '#ff6a00',
  neutralDarkGrey: '#181818',
  neutralLightGrey: '#A0A0A0',
  whiteText: '#FFFFFF',
  borderColor: '#2A2A2A',
};

const options = [
  { id: 'low', title: 'Data saver', sub: 'Use less mobile data with lower quality playback.' },
  { id: 'auto', title: 'Automatic', sub: 'Adjust playback quality based on your connection.' },
  { id: 'high', title: 'High quality', sub: 'Always use the best available playback quality.' },
];

const AudioQualityScreen = () => {
  const navigation = useNavigation<any>();
  const [quality, setQuality] = useState('auto');

  useEffect(() => {
    const loadQuality = async () => {
      const saved = await SecureStore.getItemAsync('audio_quality');
      if (saved) {
        setQuality(saved);
      }
    };

    void loadQuality();
  }, []);

  const handleSelect = async (id: string) => {
    setQuality(id);
    await SecureStore.setItemAsync('audio_quality', id);
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
          <MaterialIcons name="arrow-back-ios" size={24} color={COLORS.whiteText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio quality</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.container}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.qualityRow}
            onPress={() => handleSelect(opt.id)}
          >
            <View style={{ flex: 1, paddingRight: 20 }}>
              <Text style={styles.settingLabel}>{opt.title}</Text>
              <Text style={styles.settingSub}>{opt.sub}</Text>
            </View>

            <Ionicons
              name={quality === opt.id ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={quality === opt.id ? COLORS.accentOrange : COLORS.neutralLightGrey}
            />
          </TouchableOpacity>
        ))}
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
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: COLORS.neutralDarkGrey,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 10,
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

export default AudioQualityScreen;
