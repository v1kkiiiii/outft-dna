import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, View } from 'react-native';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import { Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { colors } from './src/theme';
import { AppProvider, useApp, ScreenKey } from './src/state';
import { BottomNav, Toast } from './src/ui';

import SignInScreen from './src/screens/SignInScreen';
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import TwinsScreen from './src/screens/TwinsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DnaScreen from './src/screens/DnaScreen';
import WrappedScreen from './src/screens/WrappedScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import ChatScreen from './src/screens/ChatScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import CommentsScreen from './src/screens/CommentsScreen';
import OtherProfileScreen from './src/screens/OtherProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const SCREENS: Record<ScreenKey, React.ComponentType> = {
  signin: SignInScreen,
  home: HomeScreen,
  camera: CameraScreen,
  twins: TwinsScreen,
  profile: ProfileScreen,
  dna: DnaScreen,
  wrapped: WrappedScreen,
  premium: PremiumScreen,
  messages: MessagesScreen,
  chat: ChatScreen,
  activity: ActivityScreen,
  postDetail: PostDetailScreen,
  collection: CollectionScreen,
  comments: CommentsScreen,
  otherProfile: OtherProfileScreen,
  settings: SettingsScreen,
};

// Screens rendered on the dark ink background with no bottom nav
const DARK_SCREENS: ScreenKey[] = ['signin', 'wrapped', 'premium'];
const NAV_SCREENS: ScreenKey[] = ['home', 'camera', 'twins', 'profile', 'otherProfile'];

function Root() {
  const { screen, hydrated } = useApp();
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <ActivityIndicator color={colors.paper} />
      </View>
    );
  }
  const Screen = SCREENS[screen];
  const dark = DARK_SCREENS.includes(screen);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: dark ? colors.ink : colors.paper }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        <Screen />
      </View>
      {NAV_SCREENS.includes(screen) && <BottomNav />}
      <Toast />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    Jost_400Regular,
    Jost_500Medium,
  });
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <ActivityIndicator color={colors.paper} />
      </View>
    );
  }
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}
