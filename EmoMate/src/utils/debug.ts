import Constants from 'expo-constants';

/**
 * Debug utilities for EmoMate application
 * Controls debug mode behavior throughout the app
 */

/**
 * Check if debug mode is enabled
 * Debug mode is enabled when:
 * - SHOW_TEST_COMPONENTS environment variable is set to 'true'
 */
export const isDebugMode = (): boolean => {
  const showTestComponents = Constants.expoConfig?.extra?.showTestComponents;
  return showTestComponents === true;
};

/**
 * Debug logging utility
 * Only logs when debug mode is enabled
 */
export const debugLog = (component: string, message: string, data?: any) => {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${component}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

/**
 * Debug error logging utility
 * Only logs when debug mode is enabled
 */
export const debugError = (component: string, message: string, error?: any) => {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${component}] ERROR: ${message}`;

  if (error) {
    console.error(logMessage, error);
  } else {
    console.error(logMessage);
  }
};

/**
 * Debug warning logging utility
 * Only logs when debug mode is enabled
 */
export const debugWarn = (component: string, message: string, data?: any) => {
  if (!isDebugMode()) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${component}] WARNING: ${message}`;

  if (data) {
    console.warn(logMessage, data);
  } else {
    console.warn(logMessage);
  }
};

/**
 * Performance timing utility for debug mode
 */
export class DebugTimer {
  private startTime: number;
  private component: string;
  private label: string;

  constructor(component: string, label: string) {
    this.component = component;
    this.label = label;
    this.startTime = Date.now();

    if (isDebugMode()) {
      debugLog(this.component, `Timer started: ${this.label}`);
    }
  }

  end(): number {
    const duration = Date.now() - this.startTime;

    if (isDebugMode()) {
      debugLog(this.component, `Timer ended: ${this.label} (${duration}ms)`);
    }

    return duration;
  }
}

/**
 * Debug-only component wrapper
 * Only renders children when debug mode is enabled
 */
export const DebugOnly: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!isDebugMode()) return null;
  return children;
};

/**
 * Get current debug configuration
 */
export const getDebugConfig = () => {
  return {
    isDebugMode: isDebugMode(),
    showTestComponents: Constants.expoConfig?.extra?.showTestComponents,
    isDev: __DEV__,
    environment: __DEV__ ? 'development' : 'production',
  };
};
