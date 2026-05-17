import { Timestamp, GeoPoint } from 'firebase/firestore';

export type Role = 'customer' | 'owner' | 'admin';

export interface UserDoc {
  id: string;
  email: string;
  name: string;
  role: Role;
  truck_id?: string;
  created_at: Timestamp;
}

export type CuisineTag =
  | 'mexican' | 'korean' | 'halal' | 'burgers' | 'seafood'
  | 'desserts' | 'vegan' | 'pizza' | 'bbq' | 'other';

export interface FoodTruck {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  cuisine: CuisineTag;
  logo_url?: string;
  cover_url?: string;
  hours?: string;
  promotion?: string;
  address?: string;            // parking address (free-text)
  address_label?: string;      // resolved display name from geocoding
  bank_holder_name?: string;
  bank_account_last4?: string;
  // Stripe Connect
  stripe_account_id?: string;
  stripe_payouts_enabled?: boolean;
  stripe_charges_enabled?: boolean;
  stripe_details_submitted?: boolean;
  is_live: boolean;
  is_open: boolean;
  rating: number;
  rating_count: number;
  follower_count: number;
  location?: GeoPoint;
  location_updated_at?: Timestamp;
  created_at: Timestamp;
}

export type PayoutStatus = 'pending' | 'paid' | 'failed' | 'in_transit';

export interface Payout {
  id: string;
  truck_id: string;
  amount_cents: number;
  bank_last4?: string;
  status: PayoutStatus;
  stripe_payout_id?: string;
  stripe_account_id?: string;
  failure_message?: string;
  created_at: Timestamp;
  paid_at?: Timestamp;
}

export type DietaryTag = 'vegan' | 'vegetarian' | 'gluten_free' | 'spicy' | 'halal' | 'kosher' | 'dairy_free' | 'nut_free';

export interface MenuItem {
  id: string;
  truck_id: string;
  name: string;
  description: string;
  price_cents: number;
  photo_url?: string;
  sold_out: boolean;
  section?: string;
  tags?: DietaryTag[];
  prep_minutes?: number;      // estimated prep time in minutes
  position: number;
  created_at: Timestamp;
}

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  truck_id: string;
  truck_name: string;
  status: OrderStatus;
  mode: 'pickup';
  subtotal_cents: number;
  tax_cents: number;
  tip_cents?: number;
  discount_cents?: number;
  promo_code?: string;
  total_cents: number;
  prep_minutes?: number;     // ETA for the order based on items
  pickup_code?: string;      // 4-digit code customer shows the truck at pickup
  payment_status?: 'pending' | 'paid' | 'failed';
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  placed_at: Timestamp;
  accepted_at?: Timestamp;
  ready_at?: Timestamp;
  completed_at?: Timestamp;
  cancelled_at?: Timestamp;
  cancelled_by?: 'customer' | 'owner';
  rated?: boolean;
  notes?: string;
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
  notes?: string;
}

export interface Follow {
  id: string;
  user_id: string;
  truck_id: string;
  created_at: Timestamp;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'order_status' | 'live' | 'follow' | 'promo' | 'message';
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  created_at: Timestamp;
}

export interface LiveLocation {
  truck_id: string;
  location: GeoPoint;
  updated_at: Timestamp;
}

export interface Review {
  id: string;
  truck_id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  rating: number;
  body?: string;
  owner_reply?: string;
  owner_reply_at?: Timestamp;
  created_at: Timestamp;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: 'customer' | 'owner';
  sender_name: string;
  text: string;
  created_at: Timestamp;
}

export interface CartLine {
  menu_item_id: string;
  name: string;
  unit_price_cents: number;
  qty: number;
  photo_url?: string;
  notes?: string;
  prep_minutes?: number;
}

export interface Cart {
  truck_id: string;
  truck_name: string;
  lines: CartLine[];
}
