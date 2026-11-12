import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalysisResult, Post } from './data';
import { getSession, signOutSupabase } from './lib/authApi';
import { track } from './lib/track';

export type AuthMode = 'supabase' | 'guest' | 'demo';

export type ScreenKey =
  | 'signin' | 'home' | 'camera' | 'twins' | 'profile' | 'dna' | 'wrapped'
  | 'premium' | 'messages' | 'activity' | 'postDetail' | 'collection'
  | 'chat' | 'comments' | 'otherProfile' | 'settings' | 'echoes'
  | 'terms' | 'onboardUpload' | 'onboardReveal' | 'onboardShare' | 'paywall';

export interface LatestOutfit {
  id: string;
  photoUri: string;
  result: AnalysisResult;
  category: string;
  brand?: string;
  caption?: string;
  capturedAt: string;
}

interface PersistedState {
  signedIn: boolean;
  guestMode: boolean;
  userId: string | null;
  authMode: AuthMode;
  email: string;
  profileName: string;
  avatarUri: string | null;
  coverUri: string | null;
  streak: number;
  outfitCount: number; // captures made in-app
  latestOutfit: LatestOutfit | null;
  following: string[];
  isPremium: boolean;
  savedPosts: Record<string, Post[]>; // user-created collection name -> saved posts
  captures: LatestOutfit[]; // every analyzed outfit, newest first
  remindersEnabled: boolean; // daily trace reminder notifications
  termsVersion: string | null; // legal version accepted during onboarding
  termsAcceptedAt: string | null;
  onboardingDone: boolean;
  onboardingResult: AnalysisResult | null; // the first combined Style DNA read
  analysisLog: string[]; // ISO times of real analyses, for the free-tier count
  notifyWrapped: boolean;
  notifyTwins: boolean;
}

const DEFAULT_STATE: PersistedState = {
  signedIn: false,
  guestMode: false,
  userId: null,
  authMode: 'demo',
  email: '',
  profileName: 'Elena Voss',
  avatarUri: null,
  coverUri: null,
  streak: 0,
  outfitCount: 0,
  latestOutfit: null,
  following: [],
  isPremium: false,
  savedPosts: {},
  captures: [],
  remindersEnabled: false,
  termsVersion: null,
  termsAcceptedAt: null,
  onboardingDone: false,
  onboardingResult: null,
  analysisLog: [],
  notifyWrapped: false,
  notifyTwins: false,
};

const STORAGE_KEY = 'outft.app-state.v2';

// Navigation params passed alongside screen changes
export interface NavParams {
  post?: import('./data').Post;
  personKey?: string;
  commentsKey?: string;
  collectionName?: string;
  from?: string; // where a navigation came from, for experiment attribution
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
  signOut: () => void;
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
      let loaded = DEFAULT_STATE;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          loaded = { ...DEFAULT_STATE, ...JSON.parse(raw) } as PersistedState;
          setState(loaded);
          if (loaded.signedIn || loaded.guestMode) setScreen('home');
        }
      } catch {}
      // Restore a persisted Supabase session, if any (spec: session survives restarts).
      try {
        const session = await getSession();
        if (session?.user?.id) {
          const next: PersistedState = {
            ...loaded,
            signedIn: true,
            guestMode: false,
            userId: session.user.id,
            authMode: 'supabase',
          };
          setState(next);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
          setScreen('home');
        }
      } catch {}
      setHydrated(true);
      track('session_start').catch(() => {});
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
    // Functional so several updates in a row (or after an await) never drop
    // each other's fields by spreading a stale snapshot.
    update: (patch) => setState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    }),
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
    signOut: () => {
      signOutSupabase().catch(() => {});
      // Clear identity, keep local captures cache and other content intact.
      persist({
        ...state,
        signedIn: false,
        guestMode: false,
        userId: null,
        authMode: 'demo',
        email: '',
      });
      setHistory([]);
      setScreen('signin');
      setParams({});
    },
  }), [state, screen, params, history, toast, hydrated]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
