import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Typography } from 'heroui-native';
import { Grid2x2, House, MessageCircle, Plus, User } from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

type TabButtonProps = { onPress?: (event: GestureResponderEvent) => void };

function PublishTabButton({ onPress }: TabButtonProps) {
  return (
    <View className="flex-1 items-center justify-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="發布商品"
        onPress={onPress}
        className="items-center justify-center rounded-full"
        style={{
          width: 52,
          height: 52,
          marginTop: -18,
          backgroundColor: BRAND.orange,
          shadowColor: BRAND.orange,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Plus size={26} color={BRAND.white} strokeWidth={2.6} />
      </Pressable>
      <Typography type="body-xs" className="text-brand-orange mt-0.5" style={{ fontWeight: '600' }}>
        發布
      </Typography>
    </View>
  );
}

export default function TabLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: BRAND.background },
          tabBarStyle: {
            backgroundColor: BRAND.white,
            borderTopColor: BRAND.border,
            height: 62,
            paddingTop: 6,
            paddingBottom: 6,
          },
          tabBarLabelStyle: { fontSize: 11 },
          tabBarActiveTintColor: BRAND.blue,
          tabBarInactiveTintColor: BRAND.muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '首頁',
            tabBarIcon: ({ color, size }) => <House color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: '分類',
            tabBarIcon: ({ color, size }) => <Grid2x2 color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="publish"
          options={{
            title: '發布',
            tabBarButton: (props) => <PublishTabButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: '訊息',
            tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size ?? 22} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '我的',
            tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 22} />,
          }}
        />
      </Tabs>
    </>
  );
}
