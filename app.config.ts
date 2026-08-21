import type { ConfigContext, ExpoConfig } from '@expo/config';

type ExpoPlugins = NonNullable<ExpoConfig['plugins']>;

export default ({ config }: ConfigContext): ExpoConfig => {
  const nativePlugins: ExpoPlugins =
    process.env.EXPO_PLATFORM === 'native'
      ? [['expo-dev-client', { launchMode: 'most-recent' }], 'react-native-maps']
      : [];

  return {
    ...config,
    name: '極貨網',
    slug: 'jihuowang',
    newArchEnabled: true,
    version: process.env.BILT_APP_VERSION ?? '1.0.0',
    orientation: 'portrait',
    // The brand is light-only (Uniwind.setTheme('light')), so native chrome —
    // keyboards, action sheets, splash — must not follow the system dark mode.
    userInterfaceStyle: 'light',
    scheme: 'jihuowang',
    icon: './assets/icon.png',
    runtimeVersion: {
      policy: 'appVersion',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Product photos are picked from the library (never the camera).
        NSPhotoLibraryUsageDescription: '極貨網需要讀取你的照片，讓你為商品挑選並上傳照片。',
        // Lets order / message / logistics pushes arrive while the app is backgrounded.
        UIBackgroundModes: ['remote-notification'],
      },
      // Apple requires a reason for the required-reason APIs used by
      // AsyncStorage / expo-file-system style storage.
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
        ],
      },
      supportsTablet: true,
      bundleIdentifier: process.env.BILT_IOS_BUNDLE_ID ?? 'com.yourcompany.yourapp',
    },
    android: {
      package: process.env.BILT_ANDROID_PACKAGE ?? 'com.yourcompany.yourapp',
      // The icon artwork already carries the white brand background, so the
      // adaptive-icon backdrop matches it instead of the navy from the old mark.
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#FFFFFF',
      },
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.INTERNET',
        // Android 13+ push permission prompt (expo-notifications).
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        // Android 13+ replacement for READ_EXTERNAL_STORAGE (photo picker).
        'android.permission.READ_MEDIA_IMAGES',
      ],
      // Dependencies declare these, but the app never opens the camera, records
      // audio or reads a location — blocking them keeps the store listing clean.
      blockedPermissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      bundler: 'metro',
      // 'single' = SPA export: one index.html + client routing, so edge serving
      // needs only a single 404→index.html fallback rule.
      output: 'single',
      favicon: './assets/icon.png',
    },
    extra: {
      appStoreAppId: process.env.BILT_APP_STORE_APP_ID,
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      [
        'expo-splash-screen',
        {
          image: './assets/icon.png',
          imageWidth: 176,
          resizeMode: 'contain',
          backgroundColor: '#FFFFFF',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: '極貨網需要讀取你的照片，讓你為商品挑選並上傳照片。',
          // No camera flow in the app, so the usage string is dropped entirely.
          cameraPermission: false,
        },
      ],
      [
        'expo-notifications',
        {
          // Android status-bar icon: must be a white silhouette on transparency,
          // Android tints it with `color` and discards every non-alpha pixel.
          icon: './assets/notification-icon.png',
          // Push notifications for new messages, order status and moderation results.
          color: '#006BFF',
          // Matches the channel created in lib/push.ts so Android pushes inherit
          // its HIGH importance instead of falling into an implicit channel.
          defaultChannel: 'default',
        },
      ],
      [
        'expo-build-properties',
        {
          // The backend and all image/asset hosts are HTTPS-only, so block
          // plaintext HTTP on Android instead of leaving the OS default open.
          android: {
            usesCleartextTraffic: false,
          },
        },
      ],
      ...nativePlugins,
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  };
};
