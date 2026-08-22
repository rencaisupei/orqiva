import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Button, Description, Input, InputOTP, Label, Typography } from 'heroui-native';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { FormError } from '@/components/FormError';
import { JihuoArtwork } from '@/components/brand/JihuoLogo';
import { bilt } from '@/lib/backend';
import { BRAND } from '@/lib/brand';
import { goBackOrReplace } from '@/lib/navigation';
import { useSessionStore } from '@/lib/session';

type Mode = 'signin' | 'signup' | 'verifySignup' | 'forgot' | 'verifyReset' | 'newPassword';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  hint?: string;
  autoComplete?: 'current-password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Label isRequired>{label}</Label>
      <View className="relative justify-center">
        <Input
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <Pressable
          className="absolute right-1 h-10 w-10 items-center justify-center"
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? '隱藏密碼' : '顯示密碼'}
        >
          {visible ? (
            <EyeOff size={17} color={BRAND.muted} />
          ) : (
            <Eye size={17} color={BRAND.muted} />
          )}
        </Pressable>
      </View>
      {hint ? <Description>{hint}</Description> : null}
    </View>
  );
}

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmedEmail);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setCode('');
  };

  /** Writes the profile/user rows the rest of the app reads, then leaves the auth screen. */
  const finish = async (userId: string, userEmail: string | null) => {
    const name = displayName.trim() || trimmedEmail.split('@')[0];
    await bilt.from('profiles').upsert({ id: userId, display_name: name }, { onConflict: 'id' });
    await bilt
      .from('users')
      .upsert(
        { id: userId, email: userEmail ?? null },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    /* Bootstrap: while the platform has no administrator at all, the first account becomes one. */
    await bilt.rpc('claim_first_admin');
    await useSessionStore.getState().reload();
    setBusy(false);
    goBackOrReplace('/(tabs)');
  };

  const signIn = async () => {
    if (!emailValid) return setError('請輸入有效的 Email');
    if (password.length < 1) return setError('請輸入密碼');

    setBusy(true);
    setError(null);
    const { data, error: signInError } = await bilt.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError || !data.user) {
      setBusy(false);
      const message = signInError?.message ?? '';
      if (/confirm/i.test(message)) {
        setError('這組帳號尚未完成 Email 驗證，請點下方「重寄驗證碼」。');
        return;
      }
      if (/too many|rate limit/i.test(message)) {
        setError('嘗試次數過多，請稍等幾分鐘後再試一次。');
        return;
      }
      setError(
        '密碼錯誤，或這個 Email 尚未註冊。請確認後再試一次；忘記密碼可點下方「忘記密碼」重設。',
      );
      return;
    }

    await finish(data.user.id, data.user.email ?? null);
  };

  const signUp = async () => {
    if (!emailValid) return setError('請輸入有效的 Email');
    if (password.length < MIN_PASSWORD) return setError(`密碼至少需要 ${MIN_PASSWORD} 個字元`);
    if (password !== confirm) return setError('兩次輸入的密碼不一致');

    setBusy(true);
    setError(null);
    const { data, error: signUpError } = await bilt.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpError) {
      setBusy(false);
      if (/already/i.test(signUpError.message)) {
        setError('這個 Email 已經註冊過了，請直接登入或使用忘記密碼。');
        return;
      }
      setError(signUpError.message);
      return;
    }

    // Email confirmation off → a session comes back straight away.
    if (data.session && data.user) {
      await finish(data.user.id, data.user.email ?? null);
      return;
    }

    setBusy(false);
    switchMode('verifySignup');
    setNotice(`已寄送 6 位數驗證碼至 ${trimmedEmail}`);
  };

  const verifySignup = async (token: string) => {
    setBusy(true);
    setError(null);
    const { data, error: verifyError } = await bilt.auth.verifyOtp({
      email: trimmedEmail,
      token,
      type: 'signup',
    });

    if (verifyError || !data.user) {
      setBusy(false);
      setError('驗證碼不正確或已過期，請重新輸入');
      return;
    }

    await finish(data.user.id, data.user.email ?? null);
  };

  const resendSignupCode = async () => {
    setBusy(true);
    setError(null);
    const { error: resendError } = await bilt.auth.resend({
      type: 'signup',
      email: trimmedEmail,
    });
    setBusy(false);
    if (resendError) {
      setError('驗證碼重寄失敗，請稍後再試');
      return;
    }
    setNotice(`已重新寄送驗證碼至 ${trimmedEmail}`);
  };

  const sendResetCode = async () => {
    if (!emailValid) return setError('請輸入有效的 Email');
    setBusy(true);
    setError(null);
    const { error: resetError } = await bilt.auth.resetPasswordForEmail(trimmedEmail);
    setBusy(false);
    if (resetError) {
      setError('重設信寄送失敗，請確認 Email 後再試一次');
      return;
    }
    switchMode('verifyReset');
    setNotice(`已寄送 6 位數驗證碼至 ${trimmedEmail}`);
  };

  const verifyReset = async (token: string) => {
    setBusy(true);
    setError(null);
    const { data, error: verifyError } = await bilt.auth.verifyOtp({
      email: trimmedEmail,
      token,
      type: 'recovery',
    });
    setBusy(false);

    if (verifyError || !data.user) {
      setError('驗證碼不正確或已過期，請重新輸入');
      return;
    }

    setPassword('');
    setConfirm('');
    switchMode('newPassword');
  };

  const applyNewPassword = async () => {
    if (password.length < MIN_PASSWORD) return setError(`密碼至少需要 ${MIN_PASSWORD} 個字元`);
    if (password !== confirm) return setError('兩次輸入的密碼不一致');

    setBusy(true);
    setError(null);
    const { data, error: updateError } = await bilt.auth.updateUser({ password });

    if (updateError || !data.user) {
      setBusy(false);
      setError(updateError?.message ?? '密碼更新失敗，請重新操作一次');
      return;
    }

    await finish(data.user.id, data.user.email ?? null);
  };

  const isOtpStep = mode === 'verifySignup' || mode === 'verifyReset';

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-2">
          <JihuoArtwork width={104} />
          <Typography type="body-xs" align="center" color="muted">
            一組極貨網帳號，買賣都通
          </Typography>
        </View>

        <View className="bg-surface mt-6 gap-4 rounded-3xl p-5">
          {mode === 'signin' || mode === 'signup' ? (
            <View className="bg-background flex-row rounded-full p-1">
              {(
                [
                  { key: 'signin', label: '登入' },
                  { key: 'signup', label: '註冊' },
                ] satisfies { key: Mode; label: string }[]
              ).map((tab) => {
                const active = mode === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    className={`flex-1 items-center rounded-full py-2 ${active ? 'bg-navy' : ''}`}
                    onPress={() => switchMode(tab.key)}
                  >
                    <Typography
                      type="body-sm"
                      className={active ? 'text-white' : 'text-muted'}
                      style={{ fontWeight: '600' }}
                    >
                      {tab.label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {mode === 'signin' ? (
            <>
              <View>
                <Label isRequired>Email</Label>
                <Input
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <PasswordField
                label="密碼"
                placeholder="請輸入密碼"
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
              />

              <FormError message={error} />

              <Button isDisabled={busy} onPress={() => void signIn()}>
                <Button.Label>{busy ? '登入中…' : '登入'}</Button.Label>
              </Button>

              <View className="flex-row items-center justify-between">
                <Button variant="ghost" size="sm" onPress={() => switchMode('forgot')}>
                  <Button.Label>忘記密碼</Button.Label>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={busy || !emailValid}
                  onPress={() => void resendSignupCode()}
                >
                  <Button.Label>重寄驗證碼</Button.Label>
                </Button>
              </View>
            </>
          ) : null}

          {mode === 'signup' ? (
            <>
              <View>
                <Label isRequired>Email</Label>
                <Input
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View>
                <Label>暱稱（選填）</Label>
                <Input
                  placeholder="顯示在商品與訊息中的名稱"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
                <Description>之後也可以在「我的」中修改</Description>
              </View>

              <PasswordField
                label="密碼"
                placeholder={`至少 ${MIN_PASSWORD} 個字元`}
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
                hint="建議混合英文字母與數字"
              />

              <PasswordField
                label="確認密碼"
                placeholder="再輸入一次密碼"
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
              />

              <FormError message={error} />

              <Button isDisabled={busy} onPress={() => void signUp()}>
                <Button.Label>{busy ? '建立帳號中…' : '建立帳號'}</Button.Label>
              </Button>

              <Typography type="body-xs" align="center" color="muted">
                建立後會寄一次 6 位數驗證碼到你的 Email 完成啟用。
              </Typography>

              <View className="flex-row flex-wrap items-center justify-center gap-x-1">
                <Typography type="body-xs" color="muted">
                  建立帳號即表示你已閱讀並同意
                </Typography>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/legal/terms')}
                  hitSlop={6}
                >
                  <Typography
                    type="body-xs"
                    className="text-brand-blue"
                    style={{ fontWeight: '600' }}
                  >
                    服務條款
                  </Typography>
                </Pressable>
                <Typography type="body-xs" color="muted">
                  與
                </Typography>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/legal/privacy')}
                  hitSlop={6}
                >
                  <Typography
                    type="body-xs"
                    className="text-brand-blue"
                    style={{ fontWeight: '600' }}
                  >
                    隱私權政策
                  </Typography>
                </Pressable>
              </View>
            </>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <View className="gap-1">
                <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
                  重設密碼
                </Typography>
                <Typography type="body-sm" color="muted">
                  輸入註冊時使用的 Email，我們會寄驗證碼給你。
                </Typography>
              </View>

              <View>
                <Label isRequired>Email</Label>
                <Input
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <FormError message={error} />

              <Button isDisabled={busy} onPress={() => void sendResetCode()}>
                <Button.Label>{busy ? '寄送中…' : '寄送驗證碼'}</Button.Label>
              </Button>
              <Button variant="ghost" size="sm" onPress={() => switchMode('signin')}>
                <Button.Label>回到登入</Button.Label>
              </Button>
            </>
          ) : null}

          {isOtpStep ? (
            <>
              <View className="gap-1">
                <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
                  輸入驗證碼
                </Typography>
                <Typography type="body-sm" color="muted">
                  {notice ?? `已寄送 6 位數驗證碼至 ${trimmedEmail}`}
                </Typography>
              </View>

              <View className="items-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  onComplete={(value) =>
                    void (mode === 'verifySignup' ? verifySignup(value) : verifyReset(value))
                  }
                >
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                  </InputOTP.Group>
                  <InputOTP.Separator />
                  <InputOTP.Group>
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP>
              </View>

              <FormError message={error} />

              <Button
                isDisabled={busy || code.length < 6}
                onPress={() =>
                  void (mode === 'verifySignup' ? verifySignup(code) : verifyReset(code))
                }
              >
                <Button.Label>{busy ? '驗證中…' : '確認驗證碼'}</Button.Label>
              </Button>

              <View className="flex-row items-center justify-between">
                <Button variant="ghost" size="sm" onPress={() => switchMode('signin')}>
                  <Button.Label>回到登入</Button.Label>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={busy}
                  onPress={() =>
                    void (mode === 'verifySignup' ? resendSignupCode() : sendResetCode())
                  }
                >
                  <Button.Label>重新寄送</Button.Label>
                </Button>
              </View>
            </>
          ) : null}

          {mode === 'newPassword' ? (
            <>
              <View className="gap-1">
                <Typography type="h5" className="text-navy" style={{ fontWeight: '700' }}>
                  設定新密碼
                </Typography>
                <Typography type="body-sm" color="muted">
                  驗證成功，請設定新的登入密碼。
                </Typography>
              </View>

              <PasswordField
                label="新密碼"
                placeholder={`至少 ${MIN_PASSWORD} 個字元`}
                value={password}
                onChangeText={setPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="確認新密碼"
                placeholder="再輸入一次新密碼"
                value={confirm}
                onChangeText={setConfirm}
                autoComplete="new-password"
              />

              <FormError message={error} />

              <Button isDisabled={busy} onPress={() => void applyNewPassword()}>
                <Button.Label>{busy ? '更新中…' : '更新密碼並登入'}</Button.Label>
              </Button>
            </>
          ) : null}
        </View>

        <Button variant="ghost" className="mt-4" onPress={() => router.replace('/(tabs)')}>
          <Button.Label>先逛逛再說</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
