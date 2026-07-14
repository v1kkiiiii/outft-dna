import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalysisResult, Post } from './data';

export type ScreenKey =
  | 'signin' | 'home' | 'camera' | 'twins' | 'profile' | 'dna' | 'wrapped'
  | 'premium' | 'messages' | 'activity' | 'postDetail' | 'collection'
  | 'chat' | 'comments' | 'otherProfile';

export interface LatestOutfit {
  id: string;
  photoUri: string;
  result: AnalysisResult;
  category: string;
  brand?: string;
  caption?: string;
  capturedAt: string;
}

export interface SentMessage { person: string; text: string; time: string }

interface PersistedState {
  signedIn: boolean;
  guestMode: boolean;
  email: string;
  profileName: string;
  streak: number;
  outfitCount: number; // captures made in-app, added to base 87
  latestOutfit: LatestOutfit | null;
  following: string[];
  isPremium: boolean;
  collections: Record<string, number>; // board name -> seed count from the demo
  savedPosts: Record<string, Post[]>; // board name -> posts the user actually saved
  captures: LatestOutfit[]; // every analyzed outfit, newest first
  sentMessages: SentMessage[];
}

const DEFAULT_STATE: PersistedState = {
  signedIn: false,
  guestMode: false,
  email: '',
  profileName: 'Elena Voss',
  streak: 14,
  outfitCount: 0,
  latestOutfit: null,
  following: [],
  isPremium: false,
  collections: { 'Night out': 12, Work: 8, Gym: 5, Inspo: 24 },
  savedPosts: { 'Night out': [], Work: [], Gym: [], Inspo: [] },
  captures: [],
  sentMessages: [],
};

const STORAGE_KEY = 'outft.app-state.v2';

// Navigation params passed alongside screen changes
export interface NavParams {
  post?: import('./data').Post;
  personKey?: string;
  commentsKey?: string;
  collectionName?: string;
}

interface AppContextValue extends PersistedState {
  screen: ScreenKey;
  params: NavParams;
  navigate: (s: ScreenKey, params?: NavParams) => void;
  goBack: () => void;
  update: (patch: Partial<PersistedState>) => void;
  toggleFollow: (personKey: string) => void;
  savePost: (post: Post, collection: string) => void;
  unsavePost: (post: Post, collection: string) => void;
  isPostSaved: (post: Post) => string | null;
  toast: string | null;
  showToast: (msg: string) => void;
  hydrated: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<ScreenKey>('signin');
  const [params, setParams] = useState<NavParams>({});
  const [history, setHistory] = useState<{ screen: ScreenKey; params: NavParams }[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const loaded = { ...DEFAULT_STATE, ...JSON.parse(raw) } as PersistedState;
          setState(loaded);
          if (loaded.signedIn || loaded.guestMode) setScreen('home');
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  const persist = (next: PersistedState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const value = useMemo<AppContextValue>(() => ({
    ...state,
    screen,
    params,
    hydrated,
    toast,
    navigate: (s, p = {}) => {
      setHistory((h) => [...h, { screen, params }]);
      setScreen(s);
      setParams(p);
    },
    goBack: () => {
      setHistory((h) => {
        if (h.length === 0) { setScreen('home'); setParams({}); return h; }
        const prev = h[h.length - 1];
        setScreen(prev.screen);
        setParams(prev.params);
        return h.slice(0, -1);
      });
    },
    update: (patch) => persist({ ...state, ...patch }),
    toggleFollow: (personKey) => {
      const following = state.following.includes(personKey)
        ? state.following.filter((k) => k !== personKey)
        : [...state.following, personKey];
      persist({ ...state, following });
    },
    savePost: (post, collection) => {
      const board = state.savedPosts[collection] ?? [];
      if (board.some((p) => p.idx === post.idx)) return;
      persist({ ...state, savedPosts: { ...state.savedPosts, [collection]: [post, ...board] } });
    },
    unsavePost: (post, collection) => {
      const board = state.savedPosts[collection] ?? [];
      persist({
        ...state,
        savedPosts: { ...state.savedPosts, [collection]: board.filter((p) => p.idx !== post.idx) },
      });
    },
    isPostSaved: (post) => {
      for (const [name, posts] of Object.entries(state.savedPosts)) {
        if (posts.some((p) => p.idx === post.idx)) return name;
      }
      return null;
    },
    showToast: (msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 1800);
    },
  }), [state, screen, params, history, toast, hydrated]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
