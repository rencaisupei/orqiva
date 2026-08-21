import {
  Apple,
  Baby,
  Bike,
  Blocks,
  BookOpen,
  Camera,
  Car,
  CircuitBoard,
  Coffee,
  Cookie,
  Cpu,
  Crown,
  Download,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Hammer,
  Headphones,
  HeartPulse,
  Laptop,
  Luggage,
  Music,
  Package,
  Palette,
  PawPrint,
  Printer,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tent,
  Ticket,
  WashingMachine,
  Watch,
  Wrench,
} from 'lucide-react-native';

import { BRAND } from '@/lib/brand';

/**
 * Maps the `categories.icon` column to a lucide icon component.
 * Add an entry here whenever a new category row is created in the database.
 */
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
  Baby,
  PawPrint,
  BookOpen,
  Blocks,
  Music,
  Camera,
  Watch,
  Gem,
  Crown,
  HeartPulse,
  Wrench,
  Hammer,
  Flower2,
  Apple,
  Coffee,
  Printer,
  Bike,
  Palette,
  Ticket,
  Download,
  CircuitBoard,
  Luggage,
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
