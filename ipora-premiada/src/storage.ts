import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}
