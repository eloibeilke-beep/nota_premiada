import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PHYSICAL_DEVICE_URL = 'http://192.168.3.51:8000';
const DEFAULT_ANDROID_EMULATOR_URL = 'http://10.0.2.2:8000';
const DEFAULT_IOS_SIMULATOR_URL = 'http://localhost:8000';
const DEFAULT_WEB_URL = 'http://localhost:8000';

const configuredUrl =
  typeof Constants === 'object' && Constants?.expoConfig?.extra?.API_BASE_URL
    ? String(Constants.expoConfig.extra.API_BASE_URL)
    : null;

const defaultUrl = (() => {
  if (Platform.OS === 'web') return DEFAULT_WEB_URL;
  if (Platform.OS === 'android' && !Constants.isDevice) return DEFAULT_ANDROID_EMULATOR_URL;
  if (Platform.OS === 'ios' && !Constants.isDevice) return DEFAULT_IOS_SIMULATOR_URL;
  return DEFAULT_PHYSICAL_DEVICE_URL;
})();

export const API_BASE_URL = configuredUrl || defaultUrl;

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}
