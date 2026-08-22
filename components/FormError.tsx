import { View } from 'react-native';
import { Typography } from 'heroui-native';
import { CircleAlert } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

/**
 * Inline form / auth error banner.
 *
 * HeroUI's `FieldError` returns `null` unless it is rendered inside a form-field
 * context that reports `isInvalid`, so every standalone
 * `<FieldError>{message}</FieldError>` in this app silently rendered nothing —
 * including "Email 或密碼不正確" on the sign-in screen. Anything that surfaces a
 * validation or request error to the user must use this component instead.
 *
 * The tinted background is an inline rgba value on purpose: `text-danger` is a
 * proven Uniwind utility, but an opacity-modified `bg-danger/10` on a HeroUI
 * semantic token is not, and a silently transparent error box is exactly the
 * bug this component exists to prevent.
 */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  const text = message?.trim();
  if (!text) return null;

  return (
    <View
      accessibilityRole="alert"
      className={cn('flex-row items-start gap-2 rounded-xl border px-3 py-2.5', className)}
      style={{
        backgroundColor: 'rgba(224, 57, 46, 0.10)',
        borderColor: 'rgba(224, 57, 46, 0.28)',
      }}
    >
      <View className="pt-0.5">
        <CircleAlert size={15} color={BRAND.danger} />
      </View>
      <Typography type="body-sm" className="flex-1 leading-5" style={{ color: BRAND.danger }}>
        {text}
      </Typography>
    </View>
  );
}
