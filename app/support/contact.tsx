import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  Button,
  Chip,
  Input,
  Label,
  Separator,
  TextArea,
  Typography,
  useToast,
} from 'heroui-native';
import { router } from 'expo-router';
import { LifeBuoy, ShieldCheck } from 'lucide-react-native';

import { FormError } from '@/components/FormError';
import { OptionSelect, type SelectOption } from '@/components/OptionSelect';
import { useCreateSupportTicket, useMySupportTickets } from '@/lib/api/support';
import { BRAND, BRAND_COPY } from '@/lib/brand';
import { formatDate } from '@/lib/format';
import { useSessionStore, useUserId } from '@/lib/session';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUS_LABEL,
  toSupportCategory,
  type SupportCategory,
} from '@/lib/types';

const CATEGORY_OPTIONS: SelectOption[] = SUPPORT_CATEGORIES.map((key) => ({
  value: key,
  label: SUPPORT_CATEGORY_LABEL[key],
}));

export default function ContactScreen() {
  const userId = useUserId();
  const account = useSessionStore((s) => s.account);
  const profile = useSessionStore((s) => s.profile);
  const { toast } = useToast();

  const createTicket = useCreateSupportTicket();
  const { data: tickets } = useMySupportTickets(userId);

  const [name, setName] = useState(profile?.display_name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [phone, setPhone] = useState(account?.phone ?? '');
  const [category, setCategory] = useState<SupportCategory>('order');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openCount = useMemo(
    () => (tickets ?? []).filter((ticket) => ticket.status !== 'closed').length,
    [tickets],
  );

  const submit = () => {
    if (!name.trim()) {
      setError('請填寫你的稱呼');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('請填寫可以收到回覆的 Email');
      return;
    }
    if (subject.trim().length < 2) {
      setError('請填寫問題主旨');
      return;
    }
    if (message.trim().length < 10) {
      setError('請描述問題內容（至少 10 個字），方便我們判斷');
      return;
    }
    setError(null);

    createTicket.mutate(
      {
        userId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
      },
      {
        onSuccess: () => {
          setSubject('');
          setMessage('');
          toast.show({ variant: 'success', label: '已送出，我們會盡快回覆' });
        },
        onError: (err: Error) => setError(err.message),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-background flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="p-4 gap-3 pb-10" keyboardShouldPersistTaps="handled">
        <View className="bg-surface gap-2 rounded-2xl p-4">
          <View className="flex-row items-center gap-3">
            <View className="bg-brand-blue-soft h-11 w-11 items-center justify-center rounded-xl">
              <LifeBuoy size={20} color={BRAND.blue} />
            </View>
            <View className="flex-1">
              <Typography type="body" className="text-navy" style={{ fontWeight: '600' }}>
                聯絡{BRAND_COPY.nameZh}客服
              </Typography>
              <Typography type="body-xs" color="muted">
                訂單、付款、物流、帳號問題都可以在這裡提出
              </Typography>
            </View>
          </View>
        </View>

        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View>
            <Label isRequired>你的稱呼</Label>
            <Input placeholder="姓名或暱稱" value={name} onChangeText={setName} />
          </View>
          <View>
            <Label isRequired>Email</Label>
            <Input
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View>
            <Label>聯絡電話（選填）</Label>
            <Input
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <OptionSelect
            label="問題類型"
            isRequired
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(value) => {
              const next = toSupportCategory(value);
              if (next) setCategory(next);
            }}
          />
          <View>
            <Label isRequired>主旨</Label>
            <Input placeholder="一句話描述問題" value={subject} onChangeText={setSubject} />
          </View>
          <View>
            <Label isRequired>問題內容</Label>
            <TextArea
              placeholder="請說明發生了什麼、涉及哪一筆訂單或商品，越具體越快處理"
              value={message}
              onChangeText={setMessage}
              numberOfLines={6}
            />
          </View>

          <FormError message={error} />

          <Button isDisabled={createTicket.isPending} onPress={submit}>
            <Button.Label>{createTicket.isPending ? '送出中…' : '送出問題'}</Button.Label>
          </Button>

          {!userId ? (
            <Typography type="body-xs" color="muted">
              未登入也可以送出，我們會以 Email 回覆你。登入後可以直接在這頁看到處理進度。
            </Typography>
          ) : null}
        </View>

        {userId && (tickets ?? []).length > 0 ? (
          <View className="bg-surface gap-3 rounded-2xl p-4">
            <View className="flex-row items-center justify-between gap-3">
              <Typography type="body" className="text-navy flex-1" style={{ fontWeight: '600' }}>
                我的問題紀錄
              </Typography>
              {openCount > 0 ? (
                <Chip size="sm" variant="soft" color="warning">
                  {openCount} 件處理中
                </Chip>
              ) : null}
            </View>

            {(tickets ?? []).map((ticket) => (
              <View key={ticket.id} className="bg-background gap-1.5 rounded-xl p-3">
                <View className="flex-row items-center gap-2">
                  <Typography
                    type="body-sm"
                    numberOfLines={1}
                    className="text-navy flex-1"
                    style={{ fontWeight: '600' }}
                  >
                    {ticket.subject}
                  </Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={ticket.status === 'closed' ? 'success' : 'warning'}
                  >
                    {SUPPORT_STATUS_LABEL[ticket.status]}
                  </Chip>
                </View>
                <Typography type="body-xs" color="muted">
                  {SUPPORT_CATEGORY_LABEL[ticket.category]} · {formatDate(ticket.created_at)}
                </Typography>
                <Typography type="body-sm" color="muted">
                  {ticket.message}
                </Typography>
                {ticket.admin_reply ? (
                  <>
                    <Separator />
                    <Typography type="body-xs" className="text-brand-blue">
                      客服回覆
                    </Typography>
                    <Typography type="body-sm" className="text-navy">
                      {ticket.admin_reply}
                    </Typography>
                  </>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View className="bg-surface flex-row items-center gap-3 rounded-2xl p-4">
          <ShieldCheck size={18} color={BRAND.blue} />
          <Typography type="body-sm" color="muted" className="flex-1">
            我們如何處理你提供的資料，請參閱隱私權政策。
          </Typography>
          <Button size="sm" variant="secondary" onPress={() => router.push('/legal/privacy')}>
            <Button.Label>查看</Button.Label>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
