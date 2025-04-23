// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, Text, StyleSheet, View, PermissionsAndroid, Platform } from 'react-native';
import GlucoseMonitor from './GlucoseMonitor';

// Request necessary permissions for Android
const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    try {
      // Request BLE scanning permission (required for Android 12+)
      const bleGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Bluetooth Scanning Permission',
          message: 'This app needs permission to scan for Bluetooth devices.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      // Request BLE connect permission (required for Android 12+)
      const connectGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Connection Permission',
          message: 'This app needs permission to connect to Bluetooth devices.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      // Request location permission (required for BLE scanning on Android)
      const locationGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location for Bluetooth scanning.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return (
        bleGranted === PermissionsAndroid.RESULTS.GRANTED &&
        connectGranted === PermissionsAndroid.RESULTS.GRANTED &&
        locationGranted === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  // iOS handles permissions through Info.plist
  return true;
};

const App = () => {
  const [permissionsGranted, setPermissionsGranted] = useState(Platform.OS === 'ios');

  useEffect(() => {
    const checkPermissions = async () => {
      const granted = await requestPermissions();
      setPermissionsGranted(granted);
    };

    if (Platform.OS === 'android') {
      checkPermissions();
    }
  }, []);

  if (!permissionsGranted && Platform.OS === 'android') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            This app requires Bluetooth and Location permissions to work.
            Please grant the necessary permissions and restart the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <GlucoseMonitor />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

export default App;