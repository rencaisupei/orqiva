import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Description, FieldError, Input, InputOTP, Label, Typography } from 'heroui-native';
import { router } from 'expo-router';

import { JihuoArtwork } from '@/components/brand/JihuoLogo';
import { bilt } from '@/lib/backend';
import { goBackOrReplace } from '@/lib/navigation';
import { useSessionStore } from '@/lib/session';

export default function SignInScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendCode = async () => {
    if (!emailValid) {
      setError('請輸入有效的 Email');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: otpError } = await bilt.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (otpError) {
      setError('驗證碼寄送失敗，請確認 Email 後再試一次');
      return;
    }
    setStep('code');
  };

  const verify = async (token: string) => {
    setBusy(true);
    setError(null);
    const { data, error: verifyError } = await bilt.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });

    if (verifyError || !data.user) {
      setBusy(false);
      setError('驗證碼不正確或已過期，請重新輸入');
      return;
    }

    const userId = data.user.id;
    const name = displayName.trim() || email.trim().split('@')[0];

    await bilt.from('profiles').upsert({ id: userId, display_name: name }, { onConflict: 'id' });
    await bilt
      .from('users')
      .upsert(
        { id: userId, email: data.user.email ?? null },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    await useSessionStore.getState().reload();

    setBusy(false);
    goBackOrReplace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-6 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-3">
          <View className="bg-surface rounded-3xl px-6 py-4">
            <JihuoArtwork width={180} />
          </View>
          <Typography type="body-sm" align="center" color="muted">
            一組極貨網帳號，買賣都通
          </Typography>
        </View>

        <View className="bg-surface mt-10 gap-5 rounded-3xl p-5">
          {step === 'email' ? (
            <>
              <View className="gap-1">
                <Typography type="h5" className="text-navy">
                  登入 / 註冊
                </Typography>
                <Typography type="body-sm" color="muted">
                  一組帳號即可同時當買家與賣家
                </Typography>
              </View>

              <View>
                <Label>Email</Label>
                <Input
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
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

              {error ? <FieldError>{error}</FieldError> : null}

              <Button isDisabled={busy} onPress={() => void sendCode()}>
                <Button.Label>{busy ? '寄送中…' : '寄送驗證碼'}</Button.Label>
              </Button>
            </>
          ) : (
            <>
              <View className="gap-1">
                <Typography type="h5" className="text-navy">
                  輸入驗證碼
                </Typography>
                <Typography type="body-sm" color="muted">
                  已寄送 6 位數驗證碼至 {email.trim()}
                </Typography>
              </View>

              <View className="items-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  onComplete={(value) => void verify(value)}
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

              {error ? <FieldError>{error}</FieldError> : null}

              <Button isDisabled={busy || code.length < 6} onPress={() => void verify(code)}>
                <Button.Label>{busy ? '驗證中…' : '驗證並登入'}</Button.Label>
              </Button>

              <View className="flex-row justify-between">
                <Button variant="ghost" size="sm" onPress={() => setStep('email')}>
                  <Button.Label>更換 Email</Button.Label>
                </Button>
                <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => void sendCode()}>
                  <Button.Label>重新寄送</Button.Label>
                </Button>
              </View>
            </>
          )}
        </View>

        <Button variant="ghost" className="mt-6" onPress={() => router.replace('/(tabs)')}>
          <Button.Label>先逛逛再說</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
