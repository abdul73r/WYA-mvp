# WYA — MVP

Where You At — the live food-truck discovery & ordering platform. This is the working MVP: real auth, real Firestore reads/writes, real Google Maps integration, real owner dashboard, real pickup orders.

## Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind
- **Auth**: Firebase Authentication (email/password)
- **Database**: Cloud Firestore (real-time)
- **File storage**: Firebase Storage (truck logos & menu photos)
- **Maps**: Google Maps JavaScript API via `@react-google-maps/api`
- **Geolocation**: Browser `navigator.geolocation`

Payments (Stripe Connect) are intentionally left for a later phase. The MVP simulates payment via the "Place order" button.

## Roles

The app supports three roles. Admin is reserved for later.

| Role | What they can do |
| --- | --- |
| `customer` | Browse the live map, view truck profiles, follow trucks, place pickup orders, track order status |
| `owner` | Create a truck, edit menu, mark items sold out, Go Live (broadcast location), accept/prepare/ready orders |
| `admin` | (Future) Manage marketplace, refunds, disputes |

The role is chosen during sign-up and stored in `users/{uid}.role`. It cannot be changed by the user.

## What's in v1 (the MVP)

- [x] Sign up & log in as customer or owner
- [x] Owner setup flow: create truck profile with logo upload
- [x] Owner dashboard: Go Live toggle, update location, mark open/closed, today's stats
- [x] Menu management: add / edit / delete / sold-out, with photo upload
- [x] Customer home: live trucks list ranked by distance
- [x] Customer map (Google Maps): live truck pins with pulse animation, you-are-here, bottom sheet
- [x] Truck profile: menu, follow button, add to cart
- [x] Cart (single-truck) with quantity controls and notes
- [x] Place pickup order → writes `orders/*` and `orders/{id}/order_items/*` atomically
- [x] Real-time order status, both for customer and truck owner (Firestore onSnapshot)
- [x] Owner order queue: Accept → Preparing → Ready → Completed
- [x] Follow / unfollow trucks, Following tab
- [x] Notifications collection (write on every status change)
- [x] Firestore security rules enforcing role-based access
- [x] Storage rules limiting uploads to the truck's owner

## Setup — 10 minutes

### 1. Install

```bash
cd wya-mvp
npm install
```

### 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> and create a new project.
2. In **Authentication** → **Sign-in method**, enable **Email/Password**.
3. In **Firestore Database**, create a database in **production mode**.
4. In **Storage**, create a default bucket.
5. In **Project settings → Your apps**, add a Web app and copy the config.

### 3. Get a Google Maps API key

1. Go to <https://console.cloud.google.com>.
2. Enable **Maps JavaScript API**.
3. Create an API key (restrict it to your domain in production).

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

### 5. Deploy Firestore rules + indexes

Install the Firebase CLI if you haven't:

```bash
npm i -g firebase-tools
firebase login
firebase use --add  # pick your project
```

Then deploy:

```bash
npm run deploy:rules
```

This pushes `firestore.rules`, `firestore.indexes.json`, and `storage.rules`.

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Walking through the MVP

### As an owner

1. Sign up → choose **Truck owner** → enter name + password.
2. On the **Set up your truck** screen, give it a name, cuisine, description, and (optionally) a logo. This creates the `food_trucks/{truckId}` doc and links it back to your user record.
3. From the dashboard, tap **Go live**. The browser asks for location. Once granted, your truck's `is_live = true` and `location` are written to Firestore. Customers see you on the map within ~1s.
4. Open **Menu** → tap **+ Item** to create a menu item with photo. Items live under `food_trucks/{truckId}/menu_items/*`.
5. When a customer places an order, it appears in **Orders** in real time. Tap **Accept** → **Start preparing** → **Mark ready** → **Picked up**. Each transition writes a notification to the customer.

### As a customer

1. Sign up → choose **Customer**.
2. **Map** tab shows every truck that's currently live, sourced from `where('is_live','==', true)` with an onSnapshot listener.
3. Tap a truck → view profile → tap **Follow** (creates `follows/{userId}_{truckId}` doc).
4. Add menu items to your cart (single-truck cart, stored in `localStorage`).
5. **Place pickup order** writes the order + items in a `writeBatch` and routes you to the order detail page, which subscribes to the order doc for live status updates.

## Database schema

See `src/lib/types.ts` for the full TypeScript types. Top-level collections:

- `users` — one doc per user (id = uid), holds `role`, `name`, `email`, `truck_id` (for owners)
- `food_trucks` — one doc per truck, owned by `owner_id`
  - subcollection `menu_items` — owned by the truck
- `live_locations` — one doc per truck for high-frequency location updates (mirrors `food_trucks.{id}.location`)
- `orders` — one doc per order
  - subcollection `order_items` — line items
- `follows` — id = `{userId}_{truckId}`
- `notifications` — per-user notifications

## Security model

`firestore.rules` enforces:

- A user can only read & write their own `users/{uid}` doc; role is immutable once set.
- `food_trucks` are publicly readable; only the truck's `owner_id` can write.
- `menu_items` inherit the truck's ownership.
- `live_locations` follow the same rule.
- `orders` can be created by a customer (must set `customer_id = uid` and `status = 'placed'`); can be read by the customer or the truck owner; only the truck owner can update status.
- `follows` are per-user-private writes.

`storage.rules` only allows uploads under `trucks/{ownerUid}/` and limits files to 5 MB images.

## Roadmap (not in v1)

- Driver app for delivery (currently pickup-only by design)
- Stripe Connect payments + payouts
- Promotions / discount codes
- Reviews + photos
- Push notifications (FCM)
- Admin console

## Project layout

```
src/
  app/
    page.tsx                 # routes to /login or role-specific dashboard
    login/, signup/          # auth
    home/                    # customer home
    map/                     # customer live map
    truck/[id]/              # customer truck profile
    cart/                    # customer cart
    orders/, orders/[id]/    # customer orders + tracking
    following/, profile/     # customer extras
    setup/                   # owner one-time truck setup
    dashboard/               # owner home: Go Live, stats, active orders
    menu/                    # owner menu editor
    orders-owner/, [id]/     # owner order queue + detail
    owner-profile/           # owner account
  components/
    AuthProvider context, BrandMark, Spinner, RoleGuard,
    CustomerNav, OwnerNav, PageShell, Map, Toast
  lib/
    firebase.ts, auth.tsx, types.ts,
    trucks.ts, menu.ts, orders.ts, follows.ts,
    notifications.ts, storage.ts, location.ts, cart.ts, utils.ts
firestore.rules / firestore.indexes.json
storage.rules
firebase.json
```
