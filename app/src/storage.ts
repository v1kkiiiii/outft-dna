import AsyncStorage from '@react-native-async-storage/async-storage';
import { OutfitRecord } from './mockAnalysis';

const USERNAME_KEY = 'outft.username';
const HISTORY_KEY = 'outft.history';

export async function getUsername(): Promise<string | null> {
  return AsyncStorage.getItem(USERNAME_KEY);
}

export async function saveUsername(name: string): Promise<void> {
  await AsyncStorage.setItem(USERNAME_KEY, name);
}

export async function getHistory(): Promise<OutfitRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? (JSON.parse(raw) as OutfitRecord[]) : [];
}

export async function addToHistory(record: OutfitRecord): Promise<void> {
  const history = await getHistory();
  history.unshift(record);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}
