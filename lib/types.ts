export type Role = 'buyer' | 'seller' | 'admin';

export type UserAccount = {
  id: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  name_en: string | null;
  icon: string;
  sort_order: number;
};

export type CategoryWithCount = Category & { product_count: number };

export type Store = {
  id: string;
  owner_id: string | null;
  name: string;
  logo_url: string | null;
  description: string | null;
  location: string;
  rating: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreSummary = Pick<
  Store,
  'id' | 'name' | 'logo_url' | 'rating' | 'rating_count' | 'location'
>;

export type ProductCondition = 'new' | 'used';
export type ProductStatus = 'active' | 'draft' | 'suspended';

export type Product = {
  id: string;
  store_id: string;
  seller_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  stock: number;
  condition: ProductCondition;
  location: string;
  shipping_methods: string[];
  specs: Record<string, string>;
  status: ProductStatus;
  rating: number;
  rating_count: number;
  sold_count: number;
  view_count: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductListItem = Product & {
  store: StoreSummary | null;
};

export type ProductDetail = ProductListItem & {
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  product_images: { id: string; url: string; sort_order: number }[];
};

export type CartItem = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  shipping_method: string;
  selected: boolean;
  product: ProductListItem | null;
};

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
  reviewed: boolean;
};

export type Order = {
  id: string;
  order_no: string;
  buyer_id: string;
  store_id: string | null;
  seller_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  shipping_method: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  shipping_address: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  store: Pick<Store, 'id' | 'name' | 'logo_url'> | null;
  order_items: OrderItem[];
};

export type Review = {
  id: string;
  product_id: string;
  order_id: string | null;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null;
};

export type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string | null;
  store_id: string;
  product_id: string | null;
  last_message: string | null;
  last_message_at: string;
  store: Pick<Store, 'id' | 'name' | 'logo_url'> | null;
  product: Pick<Product, 'id' | 'title' | 'cover_url' | 'price'> | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationType =
  | 'new_order'
  | 'order_status'
  | 'seller_reply'
  | 'product_sold'
  | 'product_published'
  | 'system';

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type SellerStatistic = {
  id: string;
  store_id: string;
  stat_date: string;
  views: number;
  orders_count: number;
  revenue: number;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: 'product' | 'store' | 'user';
  target_id: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved';
  created_at: string;
};

export type SortKey = 'newest' | 'popular' | 'price_asc' | 'price_desc' | 'rating';

export type ProductFilters = {
  categoryId?: string;
  storeId?: string;
  sellerId?: string;
  q?: string;
  sort?: SortKey;
  minPrice?: number;
  maxPrice?: number;
  condition?: ProductCondition;
  location?: string;
  minRating?: number;
  shipping?: string;
  limit?: number;
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '最新' },
  { key: 'popular', label: '熱門' },
  { key: 'price_asc', label: '價格低到高' },
  { key: 'price_desc', label: '價格高到低' },
  { key: 'rating', label: '評價最高' },
];

export const SHIPPING_METHODS = ['宅配', '超商取貨', '面交'] as const;

export const LOCATIONS = [
  '台北市',
  '新北市',
  '桃園市',
  '台中市',
  '台南市',
  '高雄市',
  '新竹市',
  '其他',
] as const;

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '待付款',
  paid: '備貨中',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};
