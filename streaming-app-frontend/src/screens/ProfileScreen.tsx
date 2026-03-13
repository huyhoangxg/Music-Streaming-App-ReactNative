import { View, Text } from 'react-native';
export default function ProfileScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff' }}>Profile Screen</Text>
    </View>
  );
}
