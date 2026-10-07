/**
 * TypeScript types mirroring the IshTopish API contract (see API_CONTRACT.md).
 * Money is integer so'm (UZS). Timestamps are RFC3339 strings. IDs are uuid strings.
 */

export type Role = 'customer' | 'worker' | 'company' | 'admin';

export type Gender = 'male' | 'female' | 'any';

export type OrderStatus =
  | 'pending'
  | 'matching'
  | 'invited'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  /**
   * Everybody the order could reach said no.
   *
   * Only happens on an order that named its workers — a broadcast can always be
   * answered by somebody who comes online next, so it runs to its window
   * instead. Kept apart from `expired` because they are different news to the
   * person waiting: "nobody was free" is worth retrying in ten minutes, "they
   * declined" is worth picking somebody else.
   */
  | 'rejected'
  | 'expired';

export interface Wallet {
  balance: number;
  credit_limit: number;
  currency: 'UZS';
  min_balance: number;
}

export interface Category {
  id: string;
  key: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  /** SF symbol name / emoji key */
  icon: string;
  /**
   * Whether the admin still offers it. A retired category is returned by the
   * API on purpose — an order filed under one still needs a name — so anything
   * that offers a *choice* must use `activeCategories` from `useCategories`.
   */
  active: boolean;
  /** display order on the customer's grid; ties fall back to the Uzbek name */
  sort: number;
  /** admin list only — what the row is holding, and so whether it may be deleted */
  orders_count?: number;
  providers_count?: number;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  gender: Gender;
  age: number;
  price_min: number;
  price_max: number;
  lat: number;
  lng: number;
  category_ids: string[];
  online: boolean;
  banned: boolean;
  credit_limit: number;
  rating: number;
  ratings_count: number;
  /** the worker's own photo — the face the customer is letting into their home */
  avatar_url?: string;
  /** short self-description shown on the public profile */
  about?: string;
  experience_years?: number;
  /** human-readable base, e.g. "Chilonzor, Toshkent" */
  address?: string;
  /** small portfolio of previous work */
  images?: string[];
  /** present in matches responses */
  distance_km?: number;
  /**
   * The worker's passport series (AA1234567), taken by the office when the
   * account is opened and unique across the platform. Only ever sent to the
   * worker themselves and to an admin — a public profile never carries it.
   */
  passport_series?: string;
  /** trial jobs: the first `free_orders_limit` may be accepted with an empty wallet */
  free_orders_used: number;
  free_orders_limit: number;
  created_at: string;
}

export interface CompanyProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  description: string;
  images: string[];
  /** the company's service fee in so'm — customers book at this price */
  price: number;
  /** legacy: services as category ids. The firm forms write `services` now. */
  category_ids: string[];
  /** what the firm does, in its own words. Optional — may be empty. */
  services?: string;
  /** office location; 0,0 means no pin was ever set */
  lat: number;
  lng: number;
  /** distance from the customer — only on the nearby list, only for pinned firms */
  distance_km?: number;
  online: boolean;
  banned: boolean;
  rating: number;
  ratings_count: number;
  /** the firm's logo; `images` stays the work gallery */
  avatar_url?: string;
  address?: string;
  /** free text, e.g. "Dush–Shan 9:00–18:00" */
  working_hours?: string;
  employees_count?: number;
  experience_years?: number;
  email?: string;
  website?: string;
  /** the firm's tax number — unique, admin-only, never on a public profile */
  inn?: string;
  /** trial jobs a new firm may take before it needs a subscription */
  free_orders_used: number;
  free_orders_limit: number;
  /**
   * A firm pays by the month, not a commission per job: this date — not a
   * wallet balance — is what lets it accept work. Absent for a firm that has
   * never bought a month.
   */
  subscription_until?: string;
  subscription_active: boolean;
  subscription_days_left: number;
  created_at: string;
}

/**
 * A tariff a firm can buy (`GET /company/subscription/plans`).
 *
 * The plans differ in length and nothing else — every subscribed firm gets the
 * same platform — so a longer term simply costs less per month. `price` is the
 * whole amount for the whole term; `old_price` is the struck-through figure on
 * the card and is never charged.
 */
export interface SubscriptionPlan {
  id: string;
  months: number;
  price: number;
  old_price?: number;
  title?: string;
  active: boolean;
  sort: number;
  /** derived by the server so the card does no arithmetic */
  per_month: number;
  discount_percent: number;
  created_at: string;
}

/**
 * A purchase as the admin history shows it: the sale plus the firm behind it.
 *
 * The figures are the ones copied onto the row the day it was sold, not today's
 * tariff — re-pricing a card must not rewrite what somebody already paid.
 */
export interface AdminSubscription extends CompanySubscription {
  company_name: string;
  company_phone: string;
  user_id: string;
  inn?: string;
}

/** What the subscription history is worth, and who is about to lapse. */
export interface SubscriptionTotals {
  sold: number;
  count: number;
  active_firms: number;
  expiring_firms: number;
}

/** One month of a firm's subscription as it was sold (GET /admin/companies/{id}/subscriptions). */
export interface CompanySubscription {
  id: string;
  company_id: string;
  months: number;
  price_per_month: number;
  discount_percent: number;
  /** what was actually charged, after the discount */
  amount: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

/**
 * A standing condition the app shows as a banner (`GET /alerts`).
 *
 * Not a notification: a notification is something that happened once, an alert
 * is the state the account is in — out of free jobs, subscription about to
 * lapse — and it stays true until it is dealt with.
 */
export interface AppAlert {
  type: string;
  level: 'info' | 'warning' | 'danger';
  title: string;
  body: string;
  /** what the banner's button should do; absent means no button */
  action?: 'topup' | 'subscription';
  /** which hat the alert is about, so each panel shows its own */
  role: Role;
}

/** Admin-tunable platform values (`GET/PATCH /admin/settings`). */
export interface AppSettings {
  commission_percent: number;
  min_balance: number;
  free_order_limit: number;
  company_monthly_price: number;
  company_discount_percent: number;
  subscription_warn_days: number;
}

export interface User {
  id: string;
  phone: string;
  gmail?: string;
  name?: string;
  avatar_url?: string;
  roles: Role[];
  active: boolean;
  push_token?: string;
  worker_profile?: WorkerProfile;
  company_profile?: CompanyProfile;
  wallet?: Wallet;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  worker_id?: string;
  company_id?: string;
  category_id: string;
  gender: Gender;
  description: string;
  /** the first photo — kept for older builds; always `images[0]` */
  image_url?: string;
  /** every photo the customer attached; often a better description than the words */
  images: string[];
  /** name the customer gave with the order (company orders carry it explicitly) */
  customer_name?: string;
  customer_phone: string;
  /** what the job pays, in so'm — set by the customer, or the company's fee */
  price: number;
  worker_phone?: string;
  lat: number;
  lng: number;
  status: OrderStatus;
  invited_worker_ids: string[];
  invite_expires_at?: string;
  /**
   * Shared by the orders of one "N workers" request — sent on create. Optional
   * here because a server may not echo it back; see `lib/batches.ts`.
   */
  batch_id?: string;
  batch_size?: number;
  created_at: string;
}

/**
 * Who placed a job (GET /orders/{id}/customer).
 *
 * The provider deciding whether to take the work gets to see the other party:
 * their name and face, how many jobs the account has put out, and how the
 * workers who did them rated it afterwards. The phone comes back only once the
 * job is actually theirs — the same rule the order itself follows.
 */
export interface OrderCustomer {
  id: string;
  name: string;
  avatar_url?: string;
  /** only present once the caller holds the order */
  phone?: string;
  /** average stars earned *as a customer*, not as a worker or firm */
  rating: number;
  ratings_count: number;
  orders_count: number;
  member_since: string;
}

/** An order enriched with the names an admin needs (GET /admin/orders). */
export interface AdminOrder extends Order {
  customer_name: string;
  customer_email: string;
  worker_name?: string;
  company_name?: string;
  category_name?: string;
  commission: number;
  /** day / month / year label the order falls in, per the requested period */
  bucket: string;
}

/** GET /admin/stats — every counter is real, no placeholders. */
export interface AdminStats {
  total_users: number;
  total_customers: number;
  total_workers: number;
  online_workers: number;
  banned_workers: number;
  total_companies: number;
  online_companies: number;
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  total_revenue: number;
  revenue_growth: number;
  series: { label: string; count: number; revenue: number }[];
}

export interface Rating {
  id: string;
  order_id: string;
  from_user_id: string;
  to_user_id: string;
  /**
   * The hat the rated account wore on this job. One account can be a worker, a
   * firm and a customer at once, and each reputation is scored separately.
   */
  target_role: Role;
  stars: number;
  comment?: string;
  created_at: string;
}

/**
 * A rating as a public profile shows it (`GET /workers/{id}/reviews`).
 *
 * The same row as `Rating`, read from the other side: the author is a name and
 * a face instead of an account id, and the recipient is implied by the route.
 */
export interface Review {
  id: string;
  order_id: string;
  stars: number;
  comment?: string;
  author_name: string;
  author_avatar?: string;
  created_at: string;
}

/** What a payment bought. A callback carrying only an amount could not tell. */
export type PaymentPurpose = 'wallet' | 'subscription';

export type PaymentStatus = 'pending' | 'success' | 'canceled' | 'failed' | 'completed';

export interface Payment {
  id: string;
  user_id: string;
  /** 'atmos' for gateway payments; 'admin' / 'dev' for money booked by hand */
  provider: string;
  amount: number;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  /** months bought, on a subscription payment */
  months?: number;
  /** the gateway's transaction id */
  external_id?: string;
  /**
   * The hosted invoice page for this payment. Only present in the response
   * that opened it — the app sends the payer there and then waits for the
   * server to confirm settlement.
   */
  pay_url?: string;
  /**
   * What went wrong, in words. Set on a failure and also on a payment that
   * settled with something odd about it — an amount that disagreed with what
   * was asked for, months paid for that could not be applied.
   */
  error?: string;
  paid_at?: string;
  created_at: string;
}

/** A payment with the person behind it — the admin log reads names, not ids. */
export interface AdminPayment extends Payment {
  user_name: string;
  user_phone: string;
  company_name?: string;
}

/** The health of the money coming in. */
export interface PaymentTotals {
  settled: number;
  pending: number;
  failed: number;
  /** Anything carrying a note, whatever its status. */
  problems: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/* ----------------------------- Response shapes ---------------------------- */

export interface OtpRequestResponse {
  sent: boolean;
  /** how long the code stays valid, in seconds */
  expires_in: number;
  /** returned only in dev mode for auto-fill */
  dev_code?: string;
}

export interface OtpVerifyResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

/**
 * Password reset, step 1. The reply is identical for an unregistered number,
 * so `sent` never confirms that the phone has an account.
 */
export interface ForgotPasswordResponse {
  sent: boolean;
  /** how long the code stays valid, in seconds */
  expires_in: number;
  /** returned only in dev mode for auto-fill */
  dev_code?: string;
}

/** Password reset, step 2 — the code is spent for a short-lived reset token. */
export interface ResetVerifyResponse {
  reset_token: string;
  expires_in: number;
}

export interface TopupResponse {
  payment_url?: string;
  ok: true;
}

/** Realtime event envelope from SSE `GET /events`. */
export interface RealtimeEvent<T = unknown> {
  type: string;
  data: T;
}
