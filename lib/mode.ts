import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { router, usePathname } from 'expo-router';

import { useMyStoreQuery } from '@/lib/api/seller';
import { useUserId } from '@/lib/session';

const STORAGE_KEY = 'jihuowang.app-mode.v1';

/** 買家與賣家是兩套完整介面，同一個帳號一次只待在其中一邊。 */
export type AppMode = 'buyer' | 'seller';

type ModeState = {
  mode: AppMode;
  hydrated: boolean;
  setMode: (mode: AppMode) => void;
};

export const useModeStore = create<ModeState>((set) => ({
  mode: 'buyer',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  },
}));

/* 開啟 App 時讀回上次待的那一邊，讓賣家不用每天重新切換。 */
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    useModeStore.setState({ mode: raw === 'seller' ? 'seller' : 'buyer', hydrated: true });
  } catch {
    useModeStore.setState({ hydrated: true });
  }
})();

export function useAppMode(): AppMode {
  return useModeStore((s) => s.mode);
}

/** 切到賣家介面。還沒有店鋪的人先走申請流程，成功後就會落在賣家中心。 */
export function enterSellerMode(hasStore: boolean) {
  useModeStore.getState().setMode('seller');
  router.replace(hasStore ? '/seller' : '/seller/onboarding');
}

/** 回到買家介面（賣家分頁列的「我的」→ 切換回買家）。 */
export function exitSellerMode() {
  useModeStore.getState().setMode('buyer');
  router.replace('/');
}

/*
 * 落地判斷只做一次：如果每次 pathname 變動都判斷，使用者從賣家中心點進商品頁
 * 就會被彈回賣家首頁。登出時旗標歸零，換帳號登入才會重新判斷一次。
 */
let landingHandled = false;

/**
 * 掛在 SystemGate：
 * - 上次停在賣家模式的人，開 App 直接進賣家中心（只在還停在買家首頁時才轉）。
 * - 店鋪不存在或已登出時把模式收回買家，避免卡在需要登入的賣家頁。
 */
export function useModeLanding() {
  const mode = useModeStore((s) => s.mode);
  const hydrated = useModeStore((s) => s.hydrated);
  const setMode = useModeStore((s) => s.setMode);
  const userId = useUserId();
  const { data: store, isLoading } = useMyStoreQuery(userId);
  const pathname = usePathname();

  useEffect(() => {
    if (userId) return;
    landingHandled = false;
    if (mode === 'seller') setMode('buyer');
  }, [userId, mode, setMode]);

  useEffect(() => {
    if (landingHandled) return;
    if (!hydrated || mode !== 'seller' || !userId || isLoading) return;
    landingHandled = true;
    if (!store) {
      setMode('buyer');
      return;
    }
    if (pathname === '/' || pathname === '/index') router.replace('/seller');
  }, [hydrated, mode, userId, isLoading, store, pathname, setMode]);
}
