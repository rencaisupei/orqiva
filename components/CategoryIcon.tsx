import {
  Car,
  Cookie,
  Cpu,
  Dumbbell,
  Footprints,
  Gamepad2,
  Headphones,
  Laptop,
  Package,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tent,
  WashingMachine,
} from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

const ICONS = {
  Cpu,
  Smartphone,
  Laptop,
  Headphones,
  Gamepad2,
  WashingMachine,
  ShoppingBasket,
  Sofa,
  Shirt,
  Footprints,
  Sparkles,
  Dumbbell,
  Car,
  Tent,
  Cookie,
  Package,
} as const;

type Props = {
  name: string;
  size?: number;
  color?: string;
};

export function CategoryIcon({ name, size = 22, color = BRAND.blue }: Props) {
  const Icon = ICONS[name as keyof typeof ICONS] ?? Package;
  return <Icon size={size} color={color} />;
}
