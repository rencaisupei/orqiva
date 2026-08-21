// oxlint-disable-next-line eslint-plugin-import/no-unassigned-import
import '../global.css';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useEffect } from 'react';
import * as DevClient from 'expo-dev-client';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { Uniwind } from 'uniwind';
import {
  ErrorBoundary as ExpoErrorBoundary,
  type ErrorBoundaryProps,
  SplashScreen,
  Stack,
} from 'expo-router';

import { initPostHog } from '@/lib/posthog';
import { registerServiceWorker } from '@/lib/registerServiceWorker';
import { reportErrorToParent } from '@/lib/reportPreviewError';
import { InstallPrompt } from '@/components/InstallPrompt';
import { SystemGate } from '@/components/SystemGate';
import { BackButton } from '@/components/BackButton';
import { BRAND } from '@/lib/brand';
import { usePushNotifications } from '@/lib/push';
import { useSessionStore } from '@/lib/session';

/**
 * Custom ErrorBoundary that reports React render errors to the parent window (Bilt preview iframe)
 * and then renders the default Expo error UI.
 */
function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    if (Platform.OS === 'web' && error) {
      const message = [error.message, error.stack].filter(Boolean).join('\n');
      reportErrorToParent(message);
    }
  }, [error]);
  return <ExpoErrorBoundary error={error} retry={retry} />;
}

export { ErrorBoundary };

// 極貨網 is a light-only brand experience.
Uniwind.setTheme('light');

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    // Reads are pull-only, so a refetch when the app/tab regains focus is what
    // keeps carts, orders and chats from going stale on a phone that never
    // unmounts its screens. staleTime throttles the burst.
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const init = useSessionStore((s) => s.init);

  useEffect(() => init(), [init]);

  // Registers the device for push and routes notification taps.
  usePushNotifications();

  // Report uncaught JS errors and unhandled promise rejections to parent (Bilt preview iframe)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const handleError = (event: ErrorEvent) => {
      const message = event.error?.stack ?? event.message ?? 'Unknown error';
      reportErrorToParent(message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      const message =
        err instanceof Error ? [err.message, err.stack].filter(Boolean).join('\n') : String(err);
      reportErrorToParent(message);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Inject Google Fonts link tag for web to ensure fonts load through proxy
  useEffect(() => {
    if (Platform.OS === 'web') {
      const existingLink = document.querySelector(
        'link[href*="fonts.googleapis.com/css2?family=Inter"]',
      );

      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    }
  }, []);

  useEffect(() => {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (__DEV__ && Platform.OS !== 'web' && !isExpoGo) {
      const timer = setTimeout(() => {
        DevClient.closeMenu();
        DevClient.hideMenu();
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      initPostHog();
    }
  }, []);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Keeps the window behind the React tree on brand background instead of
  // system black/white, which shows through during rotation and overscroll.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(BRAND.background);
  }, []);

  // React Query's focus detection is browser-only; on iOS/Android the app
  // returning to the foreground is the equivalent signal.
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* eslint-disable-next-line react/style-prop-object -- expo-status-bar's `style` is a string enum ('dark'/'light'), not a RN style object */}
      <StatusBar style="dark" translucent />
      <QueryClientProvider client={queryClient}>
        <HeroUINativeProvider>
          <SystemGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: BRAND.white },
                headerTitleStyle: { color: BRAND.navy, fontWeight: '600' },
                headerTintColor: BRAND.navy,
                headerShadowVisible: false,
                headerLeft: () => <BackButton />,
                contentStyle: { backgroundColor: BRAND.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth/sign-in" options={{ title: '登入 / 註冊' }} />
              <Stack.Screen name="products/index" options={{ title: '商品列表' }} />
              <Stack.Screen name="products/[id]" options={{ title: '商品詳情' }} />
              <Stack.Screen name="store/[id]" options={{ title: '店舖' }} />
              <Stack.Screen name="cart" options={{ title: '購物車' }} />
              <Stack.Screen name="checkout" options={{ title: '結帳' }} />
              <Stack.Screen name="favorites" options={{ title: '我的收藏' }} />
              <Stack.Screen name="orders/index" options={{ title: '我的訂單' }} />
              <Stack.Screen name="orders/[id]" options={{ title: '訂單詳情' }} />
              <Stack.Screen name="review/[productId]" options={{ title: '評價商品' }} />
              <Stack.Screen name="notifications" options={{ title: '通知中心' }} />
              <Stack.Screen name="messages/[id]" options={{ title: '聊天' }} />
              <Stack.Screen name="profile/edit" options={{ title: '編輯個人資料' }} />
              <Stack.Screen name="profile/delete" options={{ title: '刪除帳號' }} />
              <Stack.Screen name="seller/index" options={{ headerShown: false }} />
              <Stack.Screen name="seller/onboarding" options={{ title: '成為極貨網賣家' }} />
              <Stack.Screen name="seller/products" options={{ title: '商品管理' }} />
              <Stack.Screen name="seller/analytics" options={{ title: '銷售分析' }} />
              <Stack.Screen name="seller/new-product" options={{ title: '新增商品' }} />
              <Stack.Screen name="seller/edit/[id]" options={{ title: '編輯商品' }} />
              <Stack.Screen name="seller/orders" options={{ title: '訂單管理' }} />
              <Stack.Screen name="seller/store" options={{ title: '店舖設定' }} />
              <Stack.Screen name="admin/index" options={{ title: '平台管理' }} />
              <Stack.Screen name="admin/logistics" options={{ title: '物流串接設定' }} />
              <Stack.Screen name="legal/privacy" options={{ title: '隱私權政策' }} />
              <Stack.Screen name="legal/terms" options={{ title: '服務條款' }} />
              <Stack.Screen name="support/contact" options={{ title: '聯絡我們' }} />
            </Stack>
          </SystemGate>
          <InstallPrompt />
        </HeroUINativeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
