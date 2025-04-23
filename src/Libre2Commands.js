// Libre2Commands.js

/**
 * Implements Libre 2 NFC commands based on the freestyle-hid Python module
 */
class Libre2Commands {
  /**
   * Create a command to read the sensor's unique identifier (UID)
   * @returns {Uint8Array} - Command bytes
   */
  static getUidCommand() {
    // Command 0x26 is used to get the UID in the Libre protocol
    return new Uint8Array([0x26, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  /**
   * Create a command to read a specific memory block
   * @param {number} blockNumber - The block number to read (0-255)
   * @returns {Uint8Array} - Command bytes
   */
  static getReadBlockCommand(blockNumber) {
    // Command 0x23 reads a single block
    // The second byte is the block number
    return new Uint8Array([0x23, blockNumber, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  /**
   * Create a command to read multiple blocks at once
   * @param {number} startBlock - The first block to read
   * @param {number} numBlocks - Number of blocks to read (must be <= 3 for Libre)
   * @returns {Uint8Array} - Command bytes
   */
  static getReadMultipleBlocksCommand(startBlock, numBlocks) {
    // Command 0x23 with additional parameter for block count
    // Libre typically supports reading up to 3 blocks at once
    if (numBlocks > 3) {
      console.warn('Libre sensors typically support reading up to 3 blocks at once');
      numBlocks = 3;
    }

    return new Uint8Array([0x23, startBlock, numBlocks - 1, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  /**
   * Create a command to activate the sensor
   * This puts the sensor into reading mode
   * @returns {Uint8Array} - Command bytes
   */
  static getActivateCommand() {
    // Command to activate the sensor
    // This is typically a vendor-specific command
    return new Uint8Array([0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
  
  /**
   * Create a command to read sensor information
   * @returns {Uint8Array} - Command bytes
   */
  static getSensorInfoCommand() {
    // Command to get sensor information (serial number, type, etc.)
    return new Uint8Array([0xA1, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
  
  /**
   * Create a command to read current glucose reading
   * @returns {Uint8Array} - Command bytes
   */
  static getCurrentGlucoseCommand() {
    // Command to get current glucose reading
    return new Uint8Array([0xA2, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }
}

export default Libre2Commands;