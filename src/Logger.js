// Logger.js
// Simple logging utility for the Libre 2 reader implementation

class Logger {
  static LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    NONE: 4
  };

  static currentLevel = Logger.LEVELS.INFO;
  static logHistory = [];
  static maxHistorySize = 100; // Maximum number of log entries to store

  /**
   * Set the current logging level
   * @param {number} level - Logging level from Logger.LEVELS
   */
  static setLevel(level) {
    if (Object.values(Logger.LEVELS).includes(level)) {
      Logger.currentLevel = level;
    }
  }

  /**
   * Log a debug message
   * @param {string} tag - Component or module tag
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  static debug(tag, message, data = null) {
    if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
      const logEntry = Logger._createLogEntry('DEBUG', tag, message, data);
      console.debug(`[${tag}] DEBUG: ${message}`, data ? data : '');
      Logger._storeLogEntry(logEntry);
    }
  }

  /**
   * Log an info message
   * @param {string} tag - Component or module tag
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  static info(tag, message, data = null) {
    if (Logger.currentLevel <= Logger.LEVELS.INFO) {
      const logEntry = Logger._createLogEntry('INFO', tag, message, data);
      console.info(`[${tag}] INFO: ${message}`, data ? data : '');
      Logger._storeLogEntry(logEntry);
    }
  }

  /**
   * Log a warning message
   * @param {string} tag - Component or module tag
   * @param {string} message - Log message
   * @param {any} data - Optional data to log
   */
  static warning(tag, message, data = null) {
    if (Logger.currentLevel <= Logger.LEVELS.WARNING) {
      const logEntry = Logger._createLogEntry('WARNING', tag, message, data);
      console.warn(`[${tag}] WARNING: ${message}`, data ? data : '');
      Logger._storeLogEntry(logEntry);
    }
  }

  /**
   * Log an error message
   * @param {string} tag - Component or module tag
   * @param {string} message - Log message
   * @param {Error|any} error - Error object or data
   */
  static error(tag, message, error = null) {
    if (Logger.currentLevel <= Logger.LEVELS.ERROR) {
      const logEntry = Logger._createLogEntry('ERROR', tag, message, error);
      console.error(`[${tag}] ERROR: ${message}`, error ? error : '');
      Logger._storeLogEntry(logEntry);
    }
  }

  /**
   * Create a log entry object
   */
  static _createLogEntry(level, tag, message, data) {
    return {
      timestamp: new Date(),
      level,
      tag,
      message,
      data: data instanceof Error ?
        { name: data.name, message: data.message, stack: data.stack } :
        data
    };
  }

  /**
   * Store a log entry in history
   */
  static _storeLogEntry(entry) {
    Logger.logHistory.push(entry);

    // Trim history if it exceeds max size
    if (Logger.logHistory.length > Logger.maxHistorySize) {
      Logger.logHistory.shift();
    }
  }

  /**
   * Get log history
   * @param {number} count - Number of entries to retrieve (most recent)
   * @returns {Array} Array of log entries
   */
  static getHistory(count = Logger.maxHistorySize) {
    const start = Math.max(0, Logger.logHistory.length - count);
    return Logger.logHistory.slice(start);
  }

  /**
   * Clear log history
   */
  static clearHistory() {
    Logger.logHistory = [];
  }

  /**
   * Export logs as a string
   * @returns {string} Formatted log string
   */
  static exportLogs() {
    return Logger.logHistory.map(entry => {
      const timestamp = entry.timestamp.toISOString();
      const dataStr = entry.data ?
        `\nData: ${JSON.stringify(entry.data, null, 2)}` : '';

      return `[${timestamp}] ${entry.level} [${entry.tag}]: ${entry.message}${dataStr}`;
    }).join('\n\n');
  }
}

export default Logger;