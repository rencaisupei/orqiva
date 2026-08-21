import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

export type OtaStatus = 'unsupported' | 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

/** OTA only runs in a real release build: web, Expo Go and dev builds have no update channel. */
const OTA_SUPPORTED = Platform.OS !== 'web' && Updates.isEnabled && !__DEV__;

/** Don't hammer the update server every time the app is brought forward. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type OtaState = {
  status: OtaStatus;
  /** True once a new bundle is downloaded and only needs a restart. */
  isReady: boolean;
  error: string | null;
  check: () => void;
  restart: () => void;
};

/**
 * Silent in-app updates: checks for a new JS bundle on launch and whenever the
 * app returns to the foreground, downloads it in the background and then lets
 * the caller offer a restart. Never throws — a failed check just leaves the
 * running bundle alone.
 */
export function useOtaUpdates(): OtaState {
  const [status, setStatus] = useState<OtaStatus>(OTA_SUPPORTED ? 'idle' : 'unsupported');
  const [error, setError] = useState<string | null>(null);
  const lastCheck = useRef(0);
  const busy = useRef(false);

  const run = useCallback(async (force: boolean) => {
    if (!OTA_SUPPORTED || busy.current) return;
    const now = Date.now();
    if (!force && now - lastCheck.current < CHECK_INTERVAL_MS) return;

    busy.current = true;
    lastCheck.current = now;
    setStatus('checking');
    setError(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setStatus('idle');
        return;
      }
      setStatus('downloading');
      const fetched = await Updates.fetchUpdateAsync();
      setStatus(fetched.isNew ? 'ready' : 'idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!OTA_SUPPORTED) return undefined;
    void run(true);
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void run(false);
    });
    return () => subscription.remove();
  }, [run]);

  const restart = useCallback(() => {
    void Updates.reloadAsync();
  }, []);

  return {
    status,
    isReady: status === 'ready',
    error,
    check: () => void run(true),
    restart,
  };
}

/** Build identity for the admin console / diagnostics card. */
export function getBuildInfo() {
  return {
    supported: OTA_SUPPORTED,
    runtimeVersion: Updates.runtimeVersion ?? null,
    channel: Updates.channel ?? null,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
    isEmbedded: Updates.isEmbeddedLaunch,
  };
}
