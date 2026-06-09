# Order To'liq Flow — API + Socket + Notification

> Ushbu hujjat order yaratishdan tortib yakunlanishigacha bo'lgan barcha bosqichlarni qamrab oladi.

---

## Mundarija

1. [Ulanish (Socket setup)](#1-ulanish-socket-setup)
2. [Device Token ro'yxatdan o'tkazish](#2-device-token-royxatdan-otkazish)
3. [Order yaratish → Driver qidirish](#3-order-yaratish--driver-qidirish)
4. [Driver — order:request olish](#4-driver--orderrequest-olish-socket)
5. [Driver — orderni qabul qilish](#5-driver--orderni-qabul-qilish)
6. [Driver — orderni rad etish](#6-driver--orderni-rad-etish)
7. [Order holati yangilash](#7-order-holati-yangilash)
8. [Order yakunlash](#8-order-yakunlash)
9. [Barcha Notification turlari](#9-barcha-notification-turlari-firebase)
10. [Barcha Socket eventlari jadvali](#10-barcha-socket-eventlari-jadvali)

---

## 1. Ulanish (Socket setup)

Tizimda **2 ta Socket namespace** bor:

| Namespace   | Maqsad                                  |
|-------------|------------------------------------------|
| `/ws`       | Order eventlari (qabul, rad, status)    |
| `/location` | Joylashuv eventlari (harakatlanish, yaqin driverlar) |

### `/ws` ga ulanish (Passenger va Driver):

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/ws", {
  transports: ["websocket"],
  auth: { role: "passenger" }, // yoki "driver", "admin"
});

socket.on("connect", () => {
  // O'zini ro'yxatdan o'tkazish (MAJBURIY)
  socket.emit("register", {
    userId: "user-uuid",      // passenger bo'lsa
    // driverId: "driver-uuid" // driver bo'lsa
  });
});
```

### `/location` ga ulanish:

```js
const locationSocket = io("http://localhost:3000/location", {
  transports: ["websocket"],
});
```

---

## 2. Device Token ro'yxatdan o'tkazish

Firebase push notification ishlashi uchun login bo'lgandan keyin darhol device tokenni serverga yuborish kerak.

**`POST /api/notifications/device-token`**

### Headers:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body:
```json
{
  "token": "fcm-device-token-string",
  "platform": "android",
  "lang": "uz"
}
```

| Maydon     | Tur      | Majburiy | Qiymatlar              |
|------------|----------|----------|------------------------|
| `token`    | `string` | ✅ Ha    | Firebase FCM token     |
| `platform` | `string` | ❌ Yo'q  | `android` / `ios`      |
| `lang`     | `string` | ❌ Yo'q  | `uz` / `ru` / `en`    |

### Response:
```json
{
  "success": true
}
```

---

## 3. Order yaratish → Driver qidirish

Passenger order yaratadi — server **avtomatik** 5 km radiusda online driverlarni qidiradi va ularga xabar yuboradi.

**`POST /api/orders/create`**

### Headers:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Request Body:
```json
{
  "start_lat": 41.299496,
  "start_lng": 69.240074,
  "end_lat": 41.311081,
  "end_lng": 69.279819,
  "taxiCategoryId": "uuid-category",
  "promoCode": "DISCOUNT20",
  "payment_method": "cash"
}
```

| Maydon           | Tur      | Majburiy | Tavsif                          |
|------------------|----------|----------|---------------------------------|
| `start_lat`      | `number` | ✅ Ha    | Boshlash nuqtasi (latitude)     |
| `start_lng`      | `number` | ✅ Ha    | Boshlash nuqtasi (longitude)    |
| `end_lat`        | `number` | ✅ Ha    | Manzil (latitude)               |
| `end_lng`        | `number` | ✅ Ha    | Manzil (longitude)              |
| `taxiCategoryId` | `string` | ❌ Yo'q  | Taxi turi UUID                  |
| `promoCode`      | `string` | ❌ Yo'q  | Promo kod                       |
| `payment_method` | `string` | ❌ Yo'q  | `cash` yoki `card` (default: `cash`) |

### Response (201):
```json
{
  "success": true,
  "message": "Order yaratildi",
  "data": {
    "order": {
      "id": "order-uuid",
      "user_id": "user-uuid",
      "driver_id": null,
      "status": "pending",
      "start_lat": "41.299496",
      "start_lng": "69.240074",
      "end_lat": "41.311081",
      "end_lng": "69.279819",
      "price": "15000",
      "distance_km": "3.20",
      "duration_min": "6.40",
      "taxiCategoryId": "uuid-category",
      "created_at": "2026-06-02T10:00:00.000Z"
    },
    "drivers": [
      {
        "driverId": "driver-uuid-1",
        "distanceKm": 1.2
      },
      {
        "driverId": "driver-uuid-2",
        "distanceKm": 2.8
      }
    ],
    "promoApplied": true,
    "appliedPromo": {
      "code": "DISCOUNT20",
      "discount_percent": 20,
      "discount_amount": 3000
    }
  }
}
```

### Order yaratilganda server ichida nima bo'ladi:

```
POST /api/orders/create
        │
        ▼
1. User tekshiriladi (DB)
        │
        ▼
2. Redis GEORADIUS — 5 km ichidagi driverlar topiladi
        │
        ▼
3. Faqat status='online' driverlar filterlangan
        │
        ▼
4. Narx hisoblanadi (base_fare + per_km + per_min + category)
        │
        ▼
5. Promo kod tekshiriladi va chegirma qo'llanadi
        │
        ▼
6. Order DB ga yoziladi + Payment 'pending' yaratiladi
        │
        ├──▶ Socket: har bir driverga "order:request" emit
        │
        └──▶ Firebase: yaqin driverlarga push notification
             (yaqinda driver yo'q bo'lsa — barcha online driverlarga)
```

---

## 4. Driver — `order:request` olish (Socket)

Order yaratilganda yaqindagi har bir driverning telefoniga socket orqali keladi.

**Namespace:** `/ws`
**Event (tinglash):** `order:request`

### Driver qanday tinglaydi:

```js
socket.on("order:request", (data) => {
  console.log("Yangi buyurtma!", data);
  // Qabul yoki rad etish
});
```

### Keluvchi data:
```json
{
  "order_id": "order-uuid",
  "distance_km": 1.2,
  "price": 15000,
  "promo_applied": true
}
```

| Maydon         | Tur       | Tavsif                               |
|----------------|-----------|--------------------------------------|
| `order_id`     | `string`  | Order UUID                           |
| `distance_km`  | `number`  | Driver joylashuvidan order boshlanish nuqtasigacha |
| `price`        | `number`  | Order narxi (so'm)                   |
| `promo_applied`| `boolean` | Promo kod qo'llanganmi               |

---

## 5. Driver — orderni qabul qilish

### Usul A — HTTP API (tavsiya etiladi):

**`POST /api/orders/accept/:orderId/:driverId`**

```
POST /api/orders/accept/order-uuid/driver-uuid
```

### Response:
```json
{
  "success": true,
  "message": "Order haydovchi tomonidan qabul qilindi",
  "data": {
    "id": "order-uuid",
    "user_id": "user-uuid",
    "driver_id": "driver-uuid",
    "status": "accepted",
    "price": "15000",
    "distance_km": "3.20",
    "updated_at": "2026-06-02T10:01:00.000Z"
  }
}
```

### Usul B — Socket:

**Namespace:** `/ws`
**Event (emit):** `order:accept`

```js
socket.emit("order:accept", {
  driverId: "driver-uuid",
  orderId: "order-uuid",
});
```

**Javob (driver o'ziga):**

Event: `order:accepted`
```json
{
  "order_id": "order-uuid",
  "status": "accepted",
  "message": "Siz bu zakasni qabul qildingiz ✅"
}
```

### Qabul qilingandan keyin server nima qiladi:

```
Driver accepts order
        │
        ▼
1. Order status → 'accepted', driver_id biriktiriladi
        │
        ▼
2. Driver status → 'busy'
        │
        ├──▶ Socket: boshqa driverlarga "order:cancelled" (order band)
        │
        ├──▶ Socket: passengerlga "order:accepted"
        │
        └──▶ Firebase: passengerlga push notification
```

**Passenger oladigan socket event:** `order:accepted`
```json
{
  "order_id": "order-uuid",
  "driver_id": "driver-uuid",
  "message": "Haydovchi zakasni qabul qildi"
}
```

**Boshqa driverlar oladigan socket event:** `order:cancelled`
```json
{
  "order_id": "order-uuid"
}
```

---

## 6. Driver — orderni rad etish

**`POST /api/orders/reject/:orderId`**

### Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

### Response:
```json
{
  "success": true,
  "message": "Buyurtma rad etildi"
}
```

### Rad etilgandan keyin:

- Driver o'ziga socket: `order:rejected_by_you`
- Passengerlga Firebase push: "Haydovchi rad etdi, boshqa qidirilmoqda"

---

## 7. Order holati yangilash

**`PATCH /api/orders/update-status/:orderId`**

### Request Body:
```json
{
  "status": "on_the_way"
}
```

| Status       | Ma'nosi                        |
|--------------|--------------------------------|
| `pending`    | Kutilmoqda                     |
| `accepted`   | Haydovchi qabul qildi          |
| `on_the_way` | Haydovchi mijozni olib bormoqda |
| `completed`  | Yakunlandi                     |
| `cancelled`  | Bekor qilindi                  |

### Response:
```json
{
  "success": true,
  "message": "Order status yangilandi",
  "data": {
    "id": "order-uuid",
    "status": "on_the_way",
    "updated_at": "2026-06-02T10:05:00.000Z"
  }
}
```

**Driver va passenger oladigan socket event:** `order:status_updated`
```json
{
  "order_id": "order-uuid",
  "status": "on_the_way"
}
```

---

## 8. Order yakunlash

**`POST /api/orders/complete/:orderId`**

### Response:
```json
{
  "success": true,
  "message": "Order muvaffaqiyatli yakunlandi",
  "data": {
    "id": "order-uuid",
    "status": "completed",
    "finished_at": "2026-06-02T10:30:00.000Z"
  }
}
```

### Yakunlangandan keyin server nima qiladi:

```
complete order
        │
        ▼
1. Komissiya hisoblanadi
   cash → driverdan 5% yechiladi
   card → passengerdan 10% yechiladi
        │
        ▼
2. Driver walletiga daromad qo'shiladi
        │
        ▼
3. Order status → 'completed', finished_at = now()
        │
        ▼
4. Driver status → 'online' (yana bo'sh)
        │
        ▼
5. Payment status → 'success'
        │
        ├──▶ Socket (driver): "order:completed" + earned amount
        ├──▶ Firebase (passenger): "Sayohat yakunlandi"
        └──▶ Firebase (driver): "Buyurtma yakunlandi + daromad"
```

**Driver oladigan socket event:** `order:completed`
```json
{
  "order_id": "order-uuid",
  "amount": 14250
}
```

---

## 9. Barcha Notification turlari (Firebase)

Flutter tomonida `type` maydoni bo'yicha qaysi ekranga o'tishni hal qilish kerak.

### FCM Payload strukturasi (Flutter da keladi):

```json
{
  "notification": {
    "title": "Yangi buyurtma!",
    "body": "Narx: 15000 so'm — Qabul qilasizmi?"
  },
  "data": {
    "type": "order_request",
    "order_id": "order-uuid"
  }
}
```

### Barcha `type` qiymatlari:

| `type`              | Kimga        | Qachon                          | `data` ichida               |
|---------------------|--------------|---------------------------------|-----------------------------|
| `order_request`     | Driver       | Yangi order yaratilganda        | `order_id`                  |
| `order_accepted`    | Passenger    | Driver qabul qilganda           | `order_id`, `driver_id`     |
| `order_rejected`    | Passenger    | Driver rad etganda              | `order_id`                  |
| `order_assigned`    | Driver       | Admin driver biriktirganda      | `order_id`                  |
| `order_assigned`    | Passenger    | Admin driver biriktirganda      | `order_id`, `driver_id`     |
| `order_on_the_way`  | Passenger    | Status `on_the_way` bo'lganda   | `order_id`                  |
| `order_completed`   | Passenger    | Order yakunlanganda             | `order_id`                  |
| `order_completed`   | Driver       | Order yakunlanganda             | `order_id`, `earned`        |
| `order_cancelled`   | Passenger    | Order bekor qilinganda          | `order_id`                  |
| `order_cancelled`   | Driver       | Order bekor qilinganda          | `order_id`                  |

### Flutter da notification handle qilish:

```dart
FirebaseMessaging.onMessage.listen((RemoteMessage message) {
  final type = message.data['type'];
  final orderId = message.data['order_id'];

  switch (type) {
    case 'order_request':
      // Driver: yangi order qabul qilish ekraniga o'tish
      Navigator.push(context, OrderRequestScreen(orderId: orderId));
      break;
    case 'order_accepted':
      // Passenger: driver harakatini kuzatish ekraniga
      Navigator.push(context, TrackDriverScreen(orderId: orderId));
      break;
    case 'order_completed':
      // Ikkalasiga: baholash ekraniga
      Navigator.push(context, RatingScreen(orderId: orderId));
      break;
    case 'order_cancelled':
      // Xabar ko'rsatish
      showDialog(...);
      break;
  }
});
```

### Tilga qarab notification matni:

Server device tokenidagi `lang` maydoniga qarab to'g'ri tildagi matn yuboradi:

| `lang` | Title misol         | Body misol                              |
|--------|---------------------|-----------------------------------------|
| `uz`   | Yangi buyurtma!     | Narx: 15000 so'm — Qabul qilasizmi?     |
| `ru`   | Новый заказ!        | Цена: 15000 сум — Принять?              |
| `en`   | New order!          | Price: 15000 sum — Accept?              |

---

## 10. Barcha Socket eventlari jadvali

### Namespace `/ws` — Order eventlari

| Event (emit → server)      | Kim yuboradi | Data                                   |
|----------------------------|--------------|----------------------------------------|
| `register`                 | Har kim      | `{ userId? }` yoki `{ driverId? }`     |
| `order:accept`             | Driver       | `{ driverId, orderId }`                |
| `admin:register`           | Admin        | —                                      |
| `admin:subscribe_orders`   | Admin        | `{ orderId? }`                         |

| Event (server → client)    | Kim oladi    | Data                                   |
|----------------------------|--------------|----------------------------------------|
| `order:request`            | Driver       | `{ order_id, distance_km, price, promo_applied }` |
| `order:accepted`           | Passenger    | `{ order_id, driver_id, message }`     |
| `order:accepted`           | Driver       | `{ order_id, status, message }`        |
| `order:cancelled`          | Boshqa driverlar | `{ order_id }`                     |
| `order:rejected_by_you`    | Driver       | `{ order_id }`                         |
| `order:assigned`           | Driver       | `{ order_id, message, price }`         |
| `order:status_updated`     | Driver + Passenger | `{ order_id, status }`           |
| `order:completed`          | Driver       | `{ order_id, amount }`                 |
| `order:updated`            | Driver       | `{ order_id, new_price }`              |
| `admin:registered`         | Admin        | `{ success, room }`                    |
| `admin:order:created`      | Admin        | order ma'lumotlari                     |
| `admin:order:accepted`     | Admin        | order ma'lumotlari                     |
| `admin:order:completed`    | Admin        | order ma'lumotlari                     |
| `admin:order:status_updated`| Admin       | order ma'lumotlari                     |

---

### Namespace `/location` — Joylashuv eventlari

| Event (emit → server)          | Kim yuboradi  | Data                                              |
|--------------------------------|---------------|---------------------------------------------------|
| `driver:register`              | Driver        | `{ driverId, orderId }`                           |
| `passenger:register`           | Passenger     | `{ userId, orderId }`                             |
| `location:driver-update`       | Driver        | `{ driverId, orderId, lat, lng, speed, bearing }` |
| `location:passenger-update`    | Passenger     | `{ userId, orderId, lat, lng, accuracy }`         |
| `location:get-current`         | Har kim       | `{ orderId }`                                     |
| `location:nearby-drivers`      | Passenger     | `{ lat, lng, radiusKm }`                          |
| `order:finished`               | Har kim       | `{ orderId }`                                     |
| `admin:subscribe`              | Admin         | —                                                 |
| `admin:get-all-drivers`        | Admin         | —                                                 |
| `admin:join_order`             | Admin         | `{ orderId }`                                     |
| `admin:leave_order`            | Admin         | `{ orderId }`                                     |

| Event (server → client)        | Kim oladi     | Data                                              |
|--------------------------------|---------------|---------------------------------------------------|
| `location:nearby-drivers`      | Passenger     | `[{ driverId, distanceKm }]`                      |
| `location:driver-updated`      | Order room    | `{ type, id, lat, lng, speed, bearing, timestamp }` |
| `location:passenger-updated`   | Order room    | `{ type, id, lat, lng, accuracy, timestamp }`     |
| `location:current`             | Har kim       | `{ driver: {...}, passenger: {...} }`             |
| `driver:accepted`              | Order room    | `{ driverId, message }`                           |
| `order:finished`               | Order room    | `{ message }`                                     |
| `admin:driver-updated`         | Admin         | driver joylashuvi                                 |
| `admin:all-drivers`            | Admin         | barcha driver joylashuvlari                       |
| `admin:joined_order`           | Admin         | `{ success, orderId, locations }`                 |
| `admin:left_order`             | Admin         | `{ success, orderId }`                            |

---

## To'liq Order Flow Diagrammasi

```
PASSENGER                 SERVER                    DRIVER(lar)
    │                        │                           │
    │──POST /orders/create──>│                           │
    │                        │──Redis GEORADIUS 5km─────>│ (topiladi)
    │                        │<──[driver list]───────────│
    │                        │                           │
    │                        │──Socket "order:request"──>│ (har biriga)
    │                        │──Firebase push ──────────>│ (har biriga)
    │<──HTTP Response ────────│                           │
    │  { order, drivers }    │                           │
    │                        │                           │
    │                        │<──"order:accept" ─────────│
    │                        │  (yoki POST /accept/...)  │
    │                        │                           │
    │                        │──Socket "order:accepted"─>│ (qabul qilgan)
    │<──Socket "order:accepted"│                          │
    │                        │──Socket "order:cancelled">│ (boshqalarga)
    │<──Firebase push─────────│                           │
    │  "Haydovchi kelmoqda"  │                           │
    │                        │                           │
    │  [Harakatlanish jarayoni]                          │
    │  /location socket ─────────────────────────────────│
    │<──"location:driver-updated" (har 2-5 sek)──────────│
    │                        │                           │
    │                        │<──POST /complete/:id ──────│
    │<──Firebase "Yakunlandi"─│                           │
    │                        │──Socket "order:completed"─>│
    │                        │  { amount: 14250 }        │
```
