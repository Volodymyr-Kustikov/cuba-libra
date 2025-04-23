// Libre2Reader.js
import { NativeModules, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import Libre2Encryption from './Libre2Encryption';

// Constants based on the Python implementation
const FREESTYLE_LIBRE_2_SERVICE_UUID = '089810cc-ef89-11e9-81b4-2a2ae2dbcce4';
const FREESTYLE_LIBRE_2_CHARACTERISTIC_UUID = '08981338-ef89-11e9-81b4-2a2ae2dbcce4';
const LIBRE_2_HEADER_SIZE = 8;

/**
 * React Native implementation for reading Libre 2 glucose data
 * Based on the glucometerutils Python library
 */
class Libre2Reader {
  constructor() {
    this.bleManager = new BleManager();
    this.isNfcSupported = false;
    this.isConnected = false;
    this.device = null;
    this.encryptionKeys = null;
    this.sensorUid = null;
  }

  /**
   * Initialize the reader
   */
  async initialize() {
    // Initialize BLE
    this._initializeBle();

    // Check if NFC is supported
    try {
      const supported = await NfcManager.isSupported();
      if (supported) {
        await NfcManager.start();
        this.isNfcSupported = true;
        console.log('NFC is supported');
      } else {
        console.log('NFC is not supported on this device');
      }
    } catch (error) {
      console.error('Error initializing NFC:', error);
    }
  }

  /**
   * Initialize Bluetooth Low Energy
   */
  _initializeBle() {
    this.bleManager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        console.log('BLE is powered on');
      }
    }, true);
  }

  /**
   * Connect to a Libre 2 device via BLE
   * @param {string} deviceId - The ID of the device to connect to, optional
   * @returns {Promise<boolean>} - True if connection successful
   */
  async connectToDevice(deviceId = null) {
    try {
      if (deviceId) {
        this.device = await this.bleManager.connectToDevice(deviceId);
      } else {
        // Scan for Libre 2 devices
        console.log('Scanning for Libre 2 devices...');

        return new Promise((resolve, reject) => {
          this.bleManager.startDeviceScan(
            [FREESTYLE_LIBRE_2_SERVICE_UUID],
            null,
            (error, device) => {
              if (error) {
                console.error('BLE scan error:', error);
                this.bleManager.stopDeviceScan();
                reject(error);
                return;
              }

              if (device && device.name && device.name.includes('Libre')) {
                console.log('Found Libre device:', device.name);
                this.bleManager.stopDeviceScan();

                this.bleManager.connectToDevice(device.id)
                  .then(connectedDevice => {
                    console.log('Connected to device');
                    this.device = connectedDevice;
                    return this.device.discoverAllServicesAndCharacteristics();
                  })
                  .then(() => {
                    this.isConnected = true;
                    resolve(true);
                  })
                  .catch(err => {
                    console.error('Connection error:', err);
                    reject(err);
                  });
              }
            }
          );

          // Stop scanning after 10 seconds
          setTimeout(() => {
            this.bleManager.stopDeviceScan();
            if (!this.isConnected) {
              reject(new Error('No Libre 2 device found'));
            }
          }, 10000);
        });
      }

      await this.device.discoverAllServicesAndCharacteristics();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      return false;
    }
  }

  /**
   * Generate encryption keys from sensor UID
   * This must be called after reading the sensor UID via NFC
   * @returns {Object} - The generated encryption keys
   */
  _generateEncryptionKeys() {
    if (!this.sensorUid || this.sensorUid.length !== 8) {
      throw new Error('Valid sensor UID is required to generate encryption keys');
    }

    // Generate encryption keys using the Libre2Encryption module
    this.encryptionKeys = Libre2Encryption.generateKeys(this.sensorUid);
    return this.encryptionKeys;
  }

  /**
   * Read sensor data via NFC
   * Similar to Python's get_sensor_data function
   * @returns {Promise<Object>} - The sensor data
   */
  async readSensorNfc() {
    if (!this.isNfcSupported) {
      throw new Error('NFC is not supported on this device');
    }

    try {
      await NfcManager.requestTechnology(NfcTech.NfcV);

      // Get sensor UID via NFC (equivalent to the get_uid command in Python)
      const uidCommand = new Uint8Array([0x26, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const uidResponse = await NfcManager.transceive(Array.from(uidCommand));
      this.sensorUid = new Uint8Array(uidResponse.slice(2, 10)); // Extract UID from response

      console.log('Sensor UID:', Array.from(this.sensorUid).map(b => b.toString(16).padStart(2, '0')).join(''));

      // Generate encryption keys
      this._generateEncryptionKeys();

      // Read all memory blocks (similar to what the Python driver does)
      const allBlocks = [];
      for (let i = 0; i < 43; i++) {
        const blockCommand = new Uint8Array([0x23, i, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const blockResponse = await NfcManager.transceive(Array.from(blockCommand));
        allBlocks.push(new Uint8Array(blockResponse));
      }

      // Process the data blocks
      const sensorData = this._processSensorData(allBlocks);
      return sensorData;

    } catch (error) {
      console.error('Error reading sensor via NFC:', error);
      throw error;
    } finally {
      // Clean up NFC
      NfcManager.cancelTechnologyRequest();
    }
  }

  /**
   * Read glucose data via BLE
   * @returns {Promise<Array>} - Array of glucose readings
   */
  async readGlucoseData() {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to Libre device');
    }

    if (!this.encryptionKeys) {
      throw new Error('Encryption keys not available. Please read sensor via NFC first.');
    }

    try {
      // Find the correct service and characteristic
      const services = await this.device.services();
      let targetService = null;

      for (const service of services) {
        console.log('Service:', service.uuid);
        if (service.uuid.toLowerCase() === FREESTYLE_LIBRE_2_SERVICE_UUID.toLowerCase()) {
          targetService = service;
          break;
        }
      }

      if (!targetService) {
        throw new Error('Libre 2 service not found');
      }

      const characteristics = await targetService.characteristics();
      let targetCharacteristic = null;

      for (const characteristic of characteristics) {
        console.log('Characteristic:', characteristic.uuid);
        if (characteristic.uuid.toLowerCase() === FREESTYLE_LIBRE_2_CHARACTERISTIC_UUID.toLowerCase()) {
          targetCharacteristic = characteristic;
          break;
        }
      }

      if (!targetCharacteristic) {
        throw new Error('Libre 2 characteristic not found');
      }

      // Read encrypted data
      const encryptedDataResponse = await this.device.readCharacteristicForService(
        targetService.uuid,
        targetCharacteristic.uuid
      );

      // Convert base64 value to Uint8Array
      const encryptedData = this._base64ToArrayBuffer(encryptedDataResponse.value);

      // Decrypt the data using our decryption key
      const decryptedData = Libre2Encryption.decrypt(
        encryptedData,
        this.encryptionKeys.decryptionKey
      );

      // Parse the glucose readings
      return this._parseGlucoseData(decryptedData);

    } catch (error) {
      console.error('Error reading glucose data:', error);
      throw error;
    }
  }

  /**
   * Process sensor data from NFC blocks
   * @param {Array<Uint8Array>} blocks - Data blocks read from sensor
   * @returns {Object} - Processed sensor data
   */
  _processSensorData(blocks) {
    // Combine blocks into a single buffer (excluding response status bytes)
    const buffer = new Uint8Array(blocks.length * 8);
    for (let i = 0; i < blocks.length; i++) {
      // Skip first 2 bytes of each response which are status bytes
      buffer.set(blocks[i].slice(2), i * 8);
    }

    // Parse sensor info from buffer
    const sensorInfo = {
      serialNumber: this._extractSerialNumber(buffer),
      sensorStartTime: this._extractSensorStartTime(buffer),
      currentGlucose: this._extractCurrentGlucose(buffer),
      trend: this._extractTrend(buffer),
      sensorState: this._extractSensorState(buffer),
      sensorAge: this._extractSensorAge(buffer),
      historicalReadings: this._extractHistoricalReadings(buffer),
    };

    return sensorInfo;
  }

  /**
   * Parse glucose data from decrypted buffer
   * @param {Uint8Array} data - Decrypted glucose data
   * @returns {Array<Object>} - Array of glucose readings
   */
  _parseGlucoseData(data) {
    // This implementation is based on reverse engineering of the Libre 2 protocol
    const readings = [];

    // Check for minimum data length
    if (data.length < 16) {
      console.warn('Glucose data buffer too small');
      return readings;
    }

    // Extract header information
    const dataType = new DataView(data.buffer).getUint8(0);
    const numReadings = new DataView(data.buffer).getUint8(2);

    console.log(`Data type: ${dataType}, Number of readings: ${numReadings}`);

    // Validate data type (0x01 for glucose readings in typical Libre 2 protocol)
    if (dataType !== 0x01) {
      console.warn(`Unexpected data type: ${dataType}`);
    }

    // Parse each reading
    const headerSize = 10; // Header size varies based on protocol version
    const readingSize = 6;  // Each reading typically uses 6 bytes

    for (let i = 0; i < numReadings; i++) {
      const offset = headerSize + (i * readingSize);

      // Ensure we have enough data
      if (offset + readingSize > data.length) {
        break;
      }

      const view = new DataView(data.buffer, offset, readingSize);

      // Extract timestamp (4 bytes, little endian)
      const timestamp = view.getUint32(0, true);
      const date = new Date(timestamp * 1000);

      // Extract glucose value (2 bytes, little endian)
      // Glucose is typically stored as mg/dL × 10
      const glucoseRaw = view.getUint16(4, true);
      const glucoseValue = glucoseRaw / 10;

      readings.push({
        timestamp: date,
        glucoseValue: glucoseValue,
        unit: 'mg/dL'
      });
    }

    return readings;
  }

  /**
   * Extract serial number from sensor data
   */
  _extractSerialNumber(buffer) {
    // Serial number is typically stored in a specific location
    // This implementation is based on the Python freestyle-hid module
    const serialBytes = buffer.slice(24, 32);
    return Array.from(serialBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /**
   * Extract sensor start time from sensor data
   */
  _extractSensorStartTime(buffer) {
    // Start time is typically stored as a unix timestamp
    const timestamp = new DataView(buffer.buffer, 317, 4).getUint32(0, true);
    return new Date(timestamp * 1000);
  }

  /**
   * Extract current glucose reading from sensor data
   */
  _extractCurrentGlucose(buffer) {
    // Current glucose is typically stored as mg/dL × 10
    const value = new DataView(buffer.buffer, 26, 2).getUint16(0, true);
    return value / 10;
  }

  /**
   * Extract glucose trend from sensor data
   */
  _extractTrend(buffer) {
    const trend = buffer[28];
    const trendDirections = ['Unknown', 'Rising quickly', 'Rising', 'Stable', 'Falling', 'Falling quickly'];
    return trendDirections[Math.min(trend, 5)];
  }

  /**
   * Extract sensor state from sensor data
   */
  _extractSensorState(buffer) {
    const state = buffer[4];

    // These state codes are based on reverse engineering
    const states = {
      0x01: 'Not activated',
      0x02: 'Activating',
      0x03: 'Active',
      0x04: 'Expired',
      0x05: 'Shutdown',
      0x06: 'Failure'
    };

    return states[state] || 'Unknown';
  }

  /**
   * Extract sensor age in minutes
   */
  _extractSensorAge(buffer) {
    // Sensor age is typically stored in minutes since activation
    const minutes = new DataView(buffer.buffer, 316, 2).getUint16(0, true);

    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    const remainingMinutes = minutes % 60;

    return {
      minutes: minutes,
      formatted: `${days}d ${hours}h ${remainingMinutes}m`
    };
  }

  /**
   * Extract historical glucose readings from sensor data
   */
  _extractHistoricalReadings(buffer) {
    const readings = [];

    // Historical data typically starts at a specific offset
    // Each reading is typically 6 bytes
    const historyStartOffset = 124;
    const readingSize = 6;
    const numReadings = 32; // Libre 2 typically stores 32 historical readings

    for (let i = 0; i < numReadings; i++) {
      const offset = historyStartOffset + (i * readingSize);

      // Ensure we have enough data
      if (offset + readingSize > buffer.length) {
        break;
      }

      const view = new DataView(buffer.buffer, offset, readingSize);

      // Extract timestamp (4 bytes, little endian)
      const timestamp = view.getUint32(0, true);

      // Skip invalid readings (typically 0 or very large values)
      if (timestamp === 0 || timestamp > 4294967295) {
        continue;
      }

      const date = new Date(timestamp * 1000);

      // Extract glucose value (2 bytes, little endian)
      const glucoseRaw = view.getUint16(4, true);

      // Skip invalid glucose values
      if (glucoseRaw === 0) {
        continue;
      }

      const glucoseValue = glucoseRaw / 10;

      readings.push({
        timestamp: date,
        glucoseValue: glucoseValue,
        unit: 'mg/dL'
      });
    }

    return readings;
  }

  /**
   * Utility function to convert Base64 to ArrayBuffer
   */
  _base64ToArrayBuffer(base64) {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Disconnect from the device
   */
  async disconnect() {
    if (this.device) {
      await this.device.cancelConnection();
      this.isConnected = false;
      this.device = null;
    }

    // Clean up BLE
    this.bleManager.destroy();

    // Clean up NFC
    NfcManager.cancelTechnologyRequest();
  }
}

export default Libre2Reader;