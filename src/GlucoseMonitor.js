// GlucoseMonitor.js
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import Libre2Reader from './Libre2Reader';

/**
 * Main component for glucose monitoring
 * Connects to Libre 2 sensor and displays data in real-time
 */
const GlucoseMonitor = () => {
  // State for the application
  const [reader, setReader] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sensorInfo, setSensorInfo] = useState(null);
  const [currentGlucose, setCurrentGlucose] = useState(null);
  const [glucoseReadings, setGlucoseReadings] = useState([]);
  const [monitoringInterval, setMonitoringInterval] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Ready to initialize');
  const [error, setError] = useState(null);

  // Screen width for chart
  const screenWidth = Dimensions.get('window').width;

  // Initialize the Libre2Reader on component mount
  useEffect(() => {
    const initializeReader = async () => {
      try {
        setStatusMessage('Initializing...');
        const newReader = new Libre2Reader();
        await newReader.initialize();

        setReader(newReader);
        setIsInitialized(true);
        setStatusMessage('Initialized. Ready to connect.');
      } catch (err) {
        setError(`Initialization error: ${err.message}`);
        setStatusMessage('Failed to initialize');
      }
    };

    initializeReader();

    // Cleanup on component unmount
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
      if (reader) {
        reader.disconnect();
      }
    };
  }, []);

  // Handle NFC scanning to get sensor UID and encryption keys
  const handleNfcScan = async () => {
    if (!reader) return;

    try {
      setStatusMessage('Scanning NFC...');
      const data = await reader.readSensorNfc();
      setSensorInfo(data);
      setCurrentGlucose(data.currentGlucose);

      // Initialize glucose readings with historical data
      const historyWithTimestamps = data.historicalReadings.map(reading => ({
        value: reading.glucoseValue,
        timestamp: reading.timestamp,
        label: formatTime(reading.timestamp)
      })).sort((a, b) => a.timestamp - b.timestamp);

      setGlucoseReadings(historyWithTimestamps);
      setStatusMessage('NFC scan complete. Ready to connect via BLE.');

      // Alert the user to scan successful
      Alert.alert(
        'NFC Scan Complete',
        `Current glucose: ${data.currentGlucose} mg/dL\nSensor age: ${data.sensorAge.formatted}`
      );
    } catch (err) {
      setError(`NFC scan error: ${err.message}`);
      setStatusMessage('NFC scan failed');
    }
  };

  // Connect to the Libre 2 sensor via BLE
  const handleConnect = async () => {
    if (!reader) return;

    try {
      setStatusMessage('Connecting via BLE...');
      const connected = await reader.connectToDevice();

      if (connected) {
        setIsConnected(true);
        setStatusMessage('Connected via BLE. Ready to start monitoring.');
      } else {
        setStatusMessage('Connection failed');
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`);
      setStatusMessage('Connection failed');
    }
  };

  // Start real-time monitoring
  const startMonitoring = async () => {
    if (!reader || !isConnected) return;

    try {
      setStatusMessage('Starting monitoring...');

      // Perform an initial read
      await readGlucoseData();

      // Set up interval for regular readings (every 60 seconds)
      const interval = setInterval(async () => {
        await readGlucoseData();
      }, 60000); // Read every minute

      setMonitoringInterval(interval);
      setIsMonitoring(true);
      setStatusMessage('Monitoring active. Updating every minute.');
    } catch (err) {
      setError(`Monitoring error: ${err.message}`);
      setStatusMessage('Failed to start monitoring');
    }
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
      setIsMonitoring(false);
      setStatusMessage('Monitoring stopped');
    }
  };

  // Read glucose data on demand or via interval
  const readGlucoseData = async () => {
    try {
      const readings = await reader.readGlucoseData();

      if (readings && readings.length > 0) {
        // Update current glucose with most recent reading
        const latestReading = readings[readings.length - 1];
        setCurrentGlucose(latestReading.glucoseValue);

        // Format new readings for the chart
        const formattedReadings = readings.map(reading => ({
          value: reading.glucoseValue,
          timestamp: reading.timestamp,
          label: formatTime(reading.timestamp)
        }));

        // Merge with existing readings, remove duplicates, and sort by timestamp
        const allReadings = [...glucoseReadings, ...formattedReadings];
        const uniqueReadings = removeDuplicateReadings(allReadings);
        const sortedReadings = uniqueReadings.sort((a, b) => a.timestamp - b.timestamp);

        // Keep only the last 24 hours of readings to avoid chart overcrowding
        const cutoffTime = new Date().getTime() - (24 * 60 * 60 * 1000);
        const recentReadings = sortedReadings.filter(reading => reading.timestamp > cutoffTime);

        setGlucoseReadings(recentReadings);
      }
    } catch (err) {
      setError(`Data reading error: ${err.message}`);
      setStatusMessage('Failed to read glucose data');
    }
  };

  // Helper function to remove duplicate readings based on timestamp
  const removeDuplicateReadings = (readings) => {
    const uniqueMap = new Map();
    readings.forEach(reading => {
      const key = reading.timestamp.getTime();
      uniqueMap.set(key, reading);
    });
    return Array.from(uniqueMap.values());
  };

  // Helper function to format timestamps for chart labels
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Format data for the chart
  const chartData = {
    labels: glucoseReadings.slice(-12).map(reading => reading.label), // Last 12 readings
    datasets: [
      {
        data: glucoseReadings.slice(-12).map(reading => reading.value),
        color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ["Glucose mg/dL"]
  };

  // Chart configuration
  const chartConfig = {
    backgroundGradientFrom: "#ffffff",
    backgroundGradientTo: "#ffffff",
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false
  };

  // Disconnect from sensor
  const handleDisconnect = async () => {
    if (reader) {
      stopMonitoring();
      await reader.disconnect();
      setIsConnected(false);
      setStatusMessage('Disconnected');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Libre 2 Glucose Monitor</Text>
        <Text style={styles.status}>Status: {statusMessage}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.controlsContainer}>
        <Button
          title="Scan NFC"
          onPress={handleNfcScan}
          disabled={!isInitialized}
        />
        <Button
          title={isConnected ? "Reconnect" : "Connect BLE"}
          onPress={handleConnect}
          disabled={!isInitialized || !sensorInfo}
        />
        {isConnected && (
          <Button
            title={isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
          />
        )}
        {isConnected && (
          <Button
            title="Disconnect"
            onPress={handleDisconnect}
            color="#ff0000"
          />
        )}
      </View>

      {currentGlucose && (
        <View style={styles.currentGlucoseContainer}>
          <Text style={styles.currentGlucoseLabel}>Current Glucose</Text>
          <Text style={styles.currentGlucoseValue}>{currentGlucose} mg/dL</Text>
        </View>
      )}

      {sensorInfo && (
        <View style={styles.sensorInfoContainer}>
          <Text style={styles.sensorInfoTitle}>Sensor Information</Text>
          <Text>Serial: {sensorInfo.serialNumber}</Text>
          <Text>State: {sensorInfo.sensorState}</Text>
          <Text>Age: {sensorInfo.sensorAge.formatted}</Text>
          <Text>Trend: {sensorInfo.trend}</Text>
        </View>
      )}

      {glucoseReadings.length > 0 && (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Glucose History</Text>
          <LineChart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </View>
      )}

      {glucoseReadings.length > 0 && (
        <View style={styles.readingsContainer}>
          <Text style={styles.readingsTitle}>Recent Readings</Text>
          {glucoseReadings.slice(-5).reverse().map((reading, index) => (
            <View key={index} style={styles.readingItem}>
              <Text style={styles.readingTime}>
                {`${reading.timestamp.toLocaleDateString()} ${reading.timestamp.toLocaleTimeString()}`}
              </Text>
              <Text style={styles.readingValue}>{reading.value} mg/dL</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  error: {
    color: 'red',
    marginTop: 5,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  currentGlucoseContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  currentGlucoseLabel: {
    fontSize: 16,
    color: '#555',
  },
  currentGlucoseValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  sensorInfoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  sensorInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chartContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  readingsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 2,
  },
  readingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  readingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  readingTime: {
    color: '#555',
  },
  readingValue: {
    fontWeight: 'bold',
  },
});

export default GlucoseMonitor;