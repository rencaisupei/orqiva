import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import {
  Toast,
  useToast,
  type ToastComponentProps,
  type ToastShowConfig,
  type ToastShowOptions,
} from 'heroui-native';

import { containsBrand, protectBrand } from '@/components/brand/BrandText';
import { NoTranslate } from '@/components/brand/NoTranslate';

type BrandToastProps = ToastComponentProps & Omit<ToastShowConfig, 'duration' | 'id'>;

/**
 * HeroUI 的 toast 只吃字串（label / description），所以沒辦法像 protectBrand 那樣
 * 把品牌名單獨切出來 —— 含品牌名的訊息改走自訂 toast，版型與 HeroUI 的預設
 * toast 相同（icon ／文字 ／動作按鈕，flex-row gap-3），外層標成不可翻譯。
 */
function BrandToast({
  label,
  description,
  actionLabel,
  onActionPress,
  icon,
  ...rest
}: BrandToastProps) {
  const { hide, show } = rest;

  return (
    <NoTranslate>
      <Toast {...rest} className="flex-row gap-3">
        {icon ? <View>{icon}</View> : null}
        <View className="flex-1">
          {label ? <Toast.Title>{protectBrand(label)}</Toast.Title> : null}
          {description ? <Toast.Description>{protectBrand(description)}</Toast.Description> : null}
        </View>
        {actionLabel ? (
          <Toast.Action onPress={() => onActionPress?.({ show, hide })}>
            {protectBrand(actionLabel)}
          </Toast.Action>
        ) : null}
      </Toast>
    </NoTranslate>
  );
}

/**
 * useToast 的替代品：呼叫方式完全一樣（`const { toast } = useBrandToast()`），
 * 但訊息裡出現品牌名時會改用不可翻譯的 toast，其餘訊息照舊交給 HeroUI 的預設
 * toast，開著瀏覽器翻譯的使用者仍然看得到翻譯後的系統訊息。
 */
export function useBrandToast() {
  const { toast } = useToast();

  const show = useCallback(
    (options: string | ToastShowOptions) => {
      if (typeof options === 'string') {
        if (!containsBrand(options)) return toast.show(options);
        return toast.show({ component: (props) => <BrandToast {...props} label={options} /> });
      }

      // 呼叫方已經自己畫 toast，內容由它負責。
      if (options.component) return toast.show(options);

      if (!containsBrand(options.label, options.description, options.actionLabel)) {
        return toast.show(options);
      }

      const { id, duration, ...config } = options;
      return toast.show({
        id,
        duration,
        component: (props) => <BrandToast {...props} {...config} />,
      });
    },
    [toast],
  );

  return useMemo(() => ({ toast: { show, hide: toast.hide } }), [show, toast]);
}
