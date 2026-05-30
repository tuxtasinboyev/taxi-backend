# Flutter Frontend — Passenger / Driver Real-Time Order, Location, Payment, Chat Guide

Ushbu hujjat loyihaning Flutter tarafida ishlaydigan to‘liq oqimini qamrab oladi:

- Yo‘lovchi va haydovchi jarayonlari
- Buyurtma berish, qabul qilish, yo‘lga chiqish, tugatish
- Real-time socket eventlari
- Lokatsiya saqlash va kuzatish
- To‘lovlar
- Chat va xabar yuborish

---

## 1. Tizim arxitekturasi

### 1.1 Nima uchun HTTP va WebSocket birga ishlaydi?

- HTTP: buyurtma yaratish, statuslarni so‘rash, to‘lovlar va chat xabarlarini saqlash uchun.
- WebSocket: real-time order statuslari, driver location yangilanishlari, buyurtma takliflari va chat eventlari uchun.

### 1.2 Umumiy oqim

```
Passenger App                Backend                  Driver App
   |-- POST /orders/create -->|                        |
   |<-- { order, drivers }    |                        |
   |                          |-- WS order:request -->|
   |                          |<-- driver accepts      |
   |<-- WS order:status_updated|                        |
   |                          |-- POST /location/save-driver-location
   |<-- WS location:driver-updated                    |
   |                          |-- POST /orders/complete/:orderId
   |<-- WS order:completed                            |
```

---

## 2. WebSocket — real-time aloqalar

### 2.1 Ulash

**WebSocket URL:**

```dartinal socket = IO.io('https://your-domain/ws', {
  'transports': ['websocket', 'polling'],
  'auth': { 'token': '<jwt>' },
});
```

### 2.2 Ro‘yxatdan o‘tish (register)

```dart
socket.emit('register', {
  'userId': '<passenger_uuid>',
  'driverId': '<driver_uuid>',
});
```

- Yo‘lovchi faqat `userId` yuboradi.
- Haydovchi faqat `driverId` yuboradi.
- Admin/monitor uchun `role` handshake auth orqali yuborilishi mumkin.

### 2.3 Asosiy eventlar

| Event                  | Kim tinglaydi         | Rol              | Payload                                           | Maqsad                    |
| ---------------------- | --------------------- | ---------------- | ------------------------------------------------- | ------------------------- |
| `order:request`        | Haydovchi             | driver           | `{ order_id, distance_km, price, promo_applied }` | Yangi buyurtma taklifi    |
| `order:cancelled`      | Haydovchi             | driver           | `{ order_id }`                                    | Buyurtma bekor qilindi    |
| `order:status_updated` | Haydovchi + Yo‘lovchi | driver/passenger | `{ order_id, status }`                            | Buyurtma statusi o‘zgardi |
| `order:completed`      | Yo‘lovchi + Haydovchi | driver/passenger | `{ order_id, amount }`                            | Safar tugadi              |
| `order:updated`        | Haydovchi             | driver           | `{ order_id, new_price }`                         | Narx yangilandi           |

> Ushbu eventlar `docs/API_DOCUMENTATION.md` ning WebSocket bo‘limida ko‘rsatilgan.

### 2.4 Qo‘shimcha admin socket eventlari

- `admin:register` — admin order monitoring uchun.
- `admin:subscribe_orders` — admin ma'lum orderlarni tinglash uchun.
- `admin:orders_subscribed` — obuna muvaffaqiyati.

Adminlar odatda `/ws` namespace orqali ulanishadi.

---

## 3. Yo‘lovchi (Passenger) jarayoni

### 3.1 Buyurtma yaratish

```http
POST /orders/create
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.3111,
  "end_lng": 69.2797,
  "taxiCategoryId": "uuid-category",
  "promoCode": "SUMMER2025",
  "payment_method": "cash"
}
```

**Response `201`:**

```json
{
  "success": true,
  "message": "Order yaratildi",
  "data": {
    "order": {
      "id": "uuid",
      "status": "pending",
      "price": 25000,
      "distance_km": 4.2,
      "duration_min": 8.4
    },
    "drivers": [{ "driverId": "uuid", "distanceKm": 1.2 }]
  }
}
```

### 3.2 To‘lov turi

`payment_method` qiymatlari:

- `cash`
- `card`
- `payme`
- `click`
- `apple_pay`
- `google_pay`

Agar `card`, `payme`, `click`, `apple_pay` yoki `google_pay` bo‘lsa, frontend oldin to‘lov provayderiga murojaat qilib token olishi kerak.

### 3.3 Order statusini kuzatish

Yo‘lovchi WebSocket orqali quyidagi eventlarni tinglaydi:

- `order:status_updated` — `accepted`, `on_the_way`, `completed`, `cancelled`
- `order:completed` — to‘lov summasi bilan

### 3.4 Driver joylashuvini real-time ko‘rsatish

Yo‘lovchi xaritada haydovchi pozitsiyasini yangilanishini ko‘rishi uchun:

- haydovchi backendga manzilini yuboradi (`POST /api/location/save-driver-location`)
- backend socket orqali `location:driver-updated` eventini yo‘llaydi

**Driver location event misoli:**

```json
{
  "type": "driver",
  "id": "uuid-driver-1",
  "lat": 41.3001,
  "lng": 69.2415,
  "speed": 48.0,
  "bearing": 175.0,
  "timestamp": "2026-04-26T10:00:05.000Z"
}
```

### 3.5 Yo‘lovchi joylashuvini saqlash

```http
POST /api/location/save-passenger-location
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "order_id": "uuid",
  "lat": 41.322222,
  "lng": 69.255555,
  "accuracy": 5
}
```

Bu yo‘lovchi mobil ilovasi ichida joylashuvni yo‘lovchi tomondan saqlash uchun ishlatiladi.

### 3.6 Route history

```http
GET /api/location/route-history/:order_id
```

**Response misoli:**

```json
{
  "driverRoute": [
    { "lat": "41.311081", "lng": "69.240562", "timestamp": "2025-04-25T12:30:00Z" }
  ],
  "passengerRoute": [ ... ]
}
```

---

## 4. Haydovchi (Driver) jarayoni

### 4.1 Buyurtma taklifini qabul qilish

Haydovchi buyurtma taklifini oladi:

- WebSocket: `order:request`

```json
{
  "order_id": "uuid",
  "distance_km": 1.2,
  "price": 25000,
  "promo_applied": false
}
```

Buyurtmani qabul qilish:

```http
POST /orders/accept/:orderId/:driverId
Authorization: Bearer <driver_token>
```

**Response `200`:**

```json
{ "success": true, "message": "Order qabul qilindi" }
```

### 4.2 Buyurtma holatini yangilash

Haydovchi uchun asosiy statuslar:

- `accepted` — buyurtma qabul qilindi
- `on_the_way` — mijozga yo‘lga tushildi
- `completed` — safar tugadi

Haydovchi orderni tugatadi:

```http
POST /orders/complete/:orderId
Authorization: Bearer <driver_token>
```

**Response `200`:**

```json
{ "success": true, "message": "Order yakunlandi" }
```

### 4.3 Joylashuvni serverga yuborish

```http
POST /api/location/save-driver-location
Authorization: Bearer <driver_token>
Content-Type: application/json
```

**Body:**

```json
{
  "order_id": "uuid",
  "lat": 41.311081,
  "lng": 69.240562,
  "speed": 45,
  "bearing": 120
}
```

> Ushbu so‘rov odatda 2–5 soniyada bir marta yuboriladi.

### 4.4 Haydovchi statuslari

Haydovchining real-time xarita markerlari va holati uchun statuslar:

- `available`
- `on_trip`
- `offline`
- boshqa holatlar bo‘lsa, `unknown` tarzida ko‘rsatiladi.

---

## 5. To‘lovlar

### 5.1 Buyurtma yaratilganda to‘lov usuli

`/orders/create` so‘roviga `payment_method` maydonini qo‘shing.

### 5.2 Mening to‘lovlarim

```http
GET /payments/my?language=uz
Authorization: Bearer <token>
```

### 5.3 Bitta to‘lov

```http
GET /payments/my/:payment_id?language=uz
Authorization: Bearer <token>
```

### 5.4 Administratsiya orqali to‘lov yaratish

```http
POST /payments
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**

```json
{
  "order_id": "uuid",
  "amount": 35000,
  "method": "payme",
  "status": "pending"
}
```

### 5.5 To‘lovni yangilash (admin)

```http
PUT /payments/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

---

## 6. Chat va xabarlar

### 6.1 Chat yaratish yoki olish

```http
POST /chat/create
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{ "order_id": "uuid" }
```

### 6.2 Chat xabar yuborish

```http
POST /chat/message/send
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "chat_id": "uuid",
  "message": "Salom, haydovchi qayerga ketyapti?"
}
```

### 6.3 Xabarlarni olish

```http
GET /chat/messages?chat_id=uuid&page=1&limit=50
Authorization: Bearer <token>
```

### 6.4 Bitta chatni olish

```http
GET /chat/:chatId?language=uz
Authorization: Bearer <token>
```

> Hozirgi loyihada chat asosan HTTP API orqali ishlaydi. Agar realtime chat qo‘llab-quvvatlansa, unda alohida socket eventlari bo‘lishi mumkin.

---

## 7. Full order haydovchi / yo‘lovchi oqimi

### 7.1 Yo‘lovchi tomoni

1. `GET /taxi-categories` — kategoriya tanlash.
2. Xarita orqali start/end koordinatalarni tanlash.
3. `POST /orders/price-preview` — narxni oldindan ko‘rish.
4. `POST /orders/create` — buyurtma yaratish.
5. WS `order:status_updated` ni tinglash.
6. WS `location:driver-updated` orqali haydovchi manzilini ko‘rsatish.
7. `GET /payments/my` yoki `GET /payments/my/:payment_id` orqali to‘lov holatini tekshirish.
8. `POST /chat/create` + `POST /chat/message/send` orqali haydovchi bilan muloqot.

### 7.2 Haydovchi tomoni

1. `/ws` ga ulanadi va `register` orqali `driverId` ni yuboradi.
2. `order:request` eventini oladi.
3. `POST /orders/accept/:orderId/:driverId` orqali buyurtma qabul qiladi.
4. `POST /api/location/save-driver-location` orqali lokatsiyasini yuboradi.
5. `order:status_updated` va `order:completed` eventlari orqali yo‘lovchiga holatni jo‘natadi.
6. Chat xabarlariga HTTP orqali javob beradi.

---

## 8. Muhim kalit so‘zlar

- `socket_io_client`
- `/ws`
- `register`
- `order:request`
- `order:status_updated`
- `order:completed`
- `location:driver-updated`
- `POST /orders/create`
- `POST /orders/accept/:orderId/:driverId`
- `POST /orders/complete/:orderId`
- `POST /api/location/save-driver-location`
- `POST /api/location/save-passenger-location`
- `GET /api/location/route-history/:order_id`
- `POST /chat/create`
- `POST /chat/message/send`

---

## 9. Tavsiya

- Real-time joylashuv uchun faqat map markerlarini yangilang; har bir eventda UI ni qayta qurishda minimal bo‘ling.
- Buyurtma statusini `order:status_updated` orqali tuting.
- To‘lov turlarini frontendda oldindan aniqlang va `payment_method` ni backendga jo‘natishga moslang.
- Chat uchun avvalo HTTP endpointlardan foydalaning; agar socket chat kerak bo‘lsa, `ws://<domain>/ws` dan yangi eventlar qo‘shing.

---

## 10. Faylni joylashtirish

Ushbu hujjat `docs/FLUTTER_FULL_FRONTEND_REALTIME_GUIDE.md` faylida saqlangan.
