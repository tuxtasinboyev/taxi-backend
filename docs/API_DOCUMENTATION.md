# Taxi Backend — To'liq API Qo'llanma

## Asosiy ma'lumot

| | |
|---|---|
| **Base URL** | `http://localhost:3000` |
| **Swagger UI** | `http://localhost:3000/api/docs` (login: `yulla` / `yulla`) |
| **Format** | JSON |
| **Auth** | Bearer JWT Token |
| **Tillar** | `uz` / `ru` / `en` |

---

## Autentifikatsiya

Himoyalangan endpointlarga murojaat qilishda header qo'shish shart:

```
Authorization: Bearer <access_token>
```

---

# 1. AUTH — Kirish va Ro'yxatdan o'tish

## 1.1 OTP Yuborish

```http
POST /auth/send-otp
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567"
}
```

**Response `201`:**
```json
{
  "message": "OTP yuborildi",
  "phone": "+998901234567",
  "provider": "eskiz"
}
```

---

## 1.2 OTP Tasdiqlash

```http
POST /auth/verify-otp
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567",
  "otp": "123456"
}
```

**Response `200`:**
```json
{
  "success": true,
  "phone": "+998901234567",
  "message": "Telefon raqami tasdiqlandi"
}
```

---

## 1.3 Ro'yxatdan o'tish

```http
POST /auth/register
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567",
  "password": "mypassword123",
  "name": "Alisher",
  "language": "uz"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Foydalanuvchi muvaffaqiyatli yaratildi",
  "data": {
    "id": "uuid",
    "phone": "+998901234567",
    "role": "passenger"
  }
}
```

---

## 1.4 Login

```http
POST /auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567",
  "password": "mypassword123"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "phone": "+998901234567",
    "role": "passenger"
  }
}
```

> **Muhim:** `access_token` ni saqlang — barcha himoyalangan endpointlarda kerak.

---

## 1.5 Parolni tiklash — OTP yuborish

```http
POST /auth/send-reset-otp
Content-Type: application/json
```

**Body:**
```json
{ "phone": "+998901234567" }
```

---

## 1.6 Parolni tiklash — OTP tasdiqlash

```http
POST /auth/verify-reset-otp
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567",
  "otp": "123456"
}
```

---

## 1.7 Yangi parol o'rnatish

```http
POST /auth/reset-password
Content-Type: application/json
```

**Body:**
```json
{
  "phone": "+998901234567",
  "new_password": "newpassword456"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Parol muvaffaqiyatli yangilandi"
}
```

---

# 2. USERS — Foydalanuvchilar

## 2.1 O'z profilni olish

```http
GET /users/me
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "id": "uuid",
  "name_uz": "Alisher",
  "phone": "+998901234567",
  "email": "alisher@mail.com",
  "role": "passenger",
  "profile_photo": "photo.jpg",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 2.2 O'z profilni yangilash

```http
PUT /users/me
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Majburiy |
|-------|------|----------|
| `name` | string | Yo'q |
| `phone` | string | Yo'q |
| `email` | string | Yo'q |
| `password` | string | Yo'q |
| `language` | `uz`/`ru`/`en` | Yo'q |
| `photo` | file (image) | Yo'q |

---

## 2.3 Barcha foydalanuvchilar — Admin

```http
GET /users?page=1&limit=10&search=Ali&role=passenger
Authorization: Bearer <admin_token>
```

**Query parametrlar:**
| Param | Type | Default | Izoh |
|-------|------|---------|------|
| `page` | number | 1 | Sahifa raqami |
| `limit` | number | 10 | Sahifadagi yozuvlar |
| `search` | string | — | Ism bo'yicha qidirish |
| `role` | `passenger`/`driver`/`admin` | — | Rol filtri |
| `phone` | string | — | Telefon filtri |
| `email` | string | — | Email filtri |
| `sortBy` | string | `created_at` | Saralash maydoni |
| `sortOrder` | `asc`/`desc` | `desc` | Saralash tartibi |
| `includeDriver` | boolean | false | Haydovchi ma'lumotlari |
| `includeWallet` | boolean | false | Hamyon ma'lumotlari |
| `startDate` | ISO string | — | Yaratilgan sana dan |
| `endDate` | ISO string | — | Yaratilgan sana gacha |

**Response `200`:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "totalItems": 520,
    "totalPages": 52,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

---

## 2.4 Yangi foydalanuvchi yaratish — Admin

```http
POST /users
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

**Form fields:** `name`, `phone`, `email`, `password`, `role`, `language`, `photo`

---

## 2.5 Foydalanuvchini o'chirish — Admin

```http
DELETE /users/:id
Authorization: Bearer <admin_token>
```

---

# 3. DRIVERS — Haydovchilar

## 3.1 Barcha haydovchilar — Admin

```http
GET /drivers?page=1&limit=10&search=Bobur&language=uz
Authorization: Bearer <admin_token>
```

**Query parametrlar:**
| Param | Type | Izoh |
|-------|------|------|
| `page` | number | Sahifa |
| `limit` | number | Hajm |
| `search` | string | Ism bo'yicha |
| `language` | `uz`/`ru`/`en` | Natija tili |

---

## 3.2 Haydovchi yaratish — Admin

```http
POST /drivers
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Izoh |
|-------|------|
| `name` | Ism |
| `phone` | Telefon |
| `email` | Email |
| `password` | Parol |
| `car_model` | Mashina modeli (Cobalt) |
| `car_color` | Mashina rangi (Oq) |
| `car_number` | Davlat raqami (80A123BC) |
| `taxi_category_id` | Kategoriya UUID |
| `language` | `uz`/`ru`/`en` |
| `photo` | Rasm fayli |

---

## 3.3 Haydovchi ID bo'yicha — Admin

```http
GET /drivers/:id
Authorization: Bearer <admin_token>
```

---

## 3.4 Haydovchini yangilash — Admin

```http
PATCH /drivers/:id
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

---

## 3.5 Haydovchini o'chirish — Admin

```http
DELETE /drivers/:id
Authorization: Bearer <admin_token>
```

---

## 3.6 O'z profilini olish — Haydovchi

```http
GET /drivers/me
Authorization: Bearer <driver_token>
```

---

## 3.7 O'z profilini yangilash — Haydovchi

```http
PATCH /drivers/me
Authorization: Bearer <driver_token>
Content-Type: multipart/form-data
```

---

# 4. ORDERS — Buyurtmalar

## 4.1 Yangi buyurtma yaratish

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

**`payment_method` qiymatlari:** `cash` | `card` | `payme` | `click` | `apple_pay` | `google_pay`

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
    "drivers": [
      { "driverId": "uuid", "distanceKm": 1.2 }
    ],
    "promoApplied": true,
    "appliedPromo": {
      "code": "SUMMER2025",
      "discount_percent": 20,
      "discount_amount": 5000
    }
  }
}
```

---

## 4.2 Barcha buyurtmalar — Admin

```http
GET /orders/get-all-orders?language=uz&page=1&limit=10&status=completed
Authorization: Bearer <admin_token>
```

**Query parametrlar:**
| Param | Type | Majburiy | Izoh |
|-------|------|----------|------|
| `language` | `uz`/`ru`/`en` | **Ha** | Natija tili |
| `page` | number | Yo'q | Sahifa (default: 1) |
| `limit` | number | Yo'q | Hajm (default: 10) |
| `search` | string | Yo'q | Foydalanuvchi ismi |
| `driver_id` | UUID | Yo'q | Haydovchi filtri |
| `user_id` | UUID | Yo'q | Yo'lovchi filtri |
| `price_min` | number | Yo'q | Minimum narx |
| `price_max` | number | Yo'q | Maksimum narx |
| `status` | enum | Yo'q | `pending`/`accepted`/`on_the_way`/`completed`/`cancelled` |

---

## 4.3 Buyurtma ID bo'yicha — Admin

```http
GET /orders/:id?language=uz
Authorization: Bearer <admin_token>
```

---

## 4.4 Mening buyurtmalarim

```http
GET /orders/my
Authorization: Bearer <token>
```

---

## 4.5 Haydovchi buyurtmani qabul qilishi

```http
POST /orders/accept/:orderId/:driverId
```

---

## 4.6 Buyurtmani yakunlash

```http
POST /orders/complete/:orderId
```

---

## 4.7 Buyurtma statusini yangilash

```http
PATCH /orders/update-status/:orderId
Content-Type: application/json
```

**Body:**
```json
{ "status": "on_the_way" }
```

**Status zanjiri:** `pending` → `accepted` → `on_the_way` → `completed` / `cancelled`

---

## 4.8 Buyurtmani yangilash

```http
PATCH /orders/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (hammasi ixtiyoriy):**
```json
{
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.3111,
  "end_lng": 69.2797,
  "taxiCategoryId": "uuid",
  "promoCode": "DISCOUNT10",
  "payment_method": "payme"
}
```

---

# 5. PAYMENTS — To'lovlar

## 5.1 Barcha to'lovlar — Admin

```http
GET /payments
Authorization: Bearer <admin_token>
```

---

## 5.2 Order bo'yicha to'lov

```http
GET /payments/order/:order_id
```

---

## 5.3 Mening to'lovlarim

```http
GET /payments/my?language=uz
Authorization: Bearer <token>
```

---

## 5.4 Bitta to'lovim

```http
GET /payments/my/:payment_id?language=uz
Authorization: Bearer <token>
```

---

## 5.5 To'lov yaratish — Admin

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

---

## 5.6 To'lovni yangilash — Admin

```http
PUT /payments/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

---

## 5.7 To'lovni deactivate qilish — Admin

```http
PUT /payments/active/:id
Authorization: Bearer <admin_token>
```

---

## 5.8 To'lovni o'chirish — Admin

```http
DELETE /payments/:id
Authorization: Bearer <admin_token>
```

---

# 6. TAXI CATEGORIES — Taxi Kategoriyalari

## 6.1 Barcha kategoriyalar (Ochiq)

```http
GET /taxi-categories?language=uz
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Econom",
      "icon_url": "econom.png",
      "price": 2000,
      "is_active": true
    }
  ]
}
```

---

## 6.2 Kategoriya ID bo'yicha

```http
GET /taxi-categories/:id
```

---

## 6.3 Kategoriya yaratish — Admin

```http
POST /taxi-categories
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Izoh |
|-------|------|------|
| `name` | string | Kategoriya nomi |
| `language` | `uz`/`ru`/`en` | Til |
| `price` | decimal | 1 km narxi |
| `is_active` | boolean | Faolmi |
| `icon` | file | Ikonka rasm |

---

## 6.4 Kategoriyani yangilash — Admin

```http
PUT /taxi-categories/:id
Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
```

---

## 6.5 Kategoriyani o'chirish — Admin

```http
DELETE /taxi-categories/:id
Authorization: Bearer <admin_token>
```

---

# 7. PRICING RULES — Narx Qoidalari

## 7.1 Barcha qoidalar — Admin

```http
GET /pricing-rules
Authorization: Bearer <admin_token>
```

---

## 7.2 Faol qoida — Admin

```http
GET /pricing-rules/active
Authorization: Bearer <admin_token>
```

---

## 7.3 Qoida ID bo'yicha — Admin

```http
GET /pricing-rules/:id
Authorization: Bearer <admin_token>
```

---

## 7.4 Yangi qoida yaratish — Admin

```http
POST /pricing-rules
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "lang": "uz",
  "city": "Toshkent",
  "base_fare": 8000,
  "per_km": 2500,
  "per_min": 500,
  "surge_multiplier": 1.2,
  "currency": "UZS",
  "is_active": true,
  "valid_from": "2025-01-01T00:00:00Z",
  "valid_to": "2025-12-31T23:59:59Z",
  "taxiCategoryId": "uuid"
}
```

---

## 7.5 Qoidani yangilash — Admin

```http
PATCH /pricing-rules/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

---

## 7.6 Qoidani o'chirish — Admin

```http
DELETE /pricing-rules/:id
Authorization: Bearer <admin_token>
```

---

# 8. PROMO CODES — Promokodlar

## 8.1 Barcha promokodlar — Admin

```http
GET /promocodes
Authorization: Bearer <admin_token>
```

---

## 8.2 Promokod ID bo'yicha — Admin

```http
GET /promocodes/:id
Authorization: Bearer <admin_token>
```

---

## 8.3 Promokod yaratish — Admin

```http
POST /promocodes
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Body:**
```json
{
  "code": "SUMMER2025",
  "discount_percent": 20,
  "valid_from": "2025-06-01T00:00:00Z",
  "valid_to": "2025-08-31T23:59:59Z",
  "is_active": true
}
```

---

## 8.4 Promokodni yangilash — Admin

```http
PATCH /promocodes/:id
Authorization: Bearer <admin_token>
Content-Type: application/json
```

---

## 8.5 Promokodni o'chirish — Admin

```http
DELETE /promocodes/:id
Authorization: Bearer <admin_token>
```

---

# 9. REVIEWS — Baholar

## 9.1 Baho qoldirish

```http
POST /reviews
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "order_id": "uuid",
  "from_user_id": "uuid-sender",
  "to_user_id": "uuid-receiver",
  "rating": 5,
  "comment": "Ajoyib haydovchi!",
  "language": "uz"
}
```

> **Qoidalar:** Faqat `completed` statusdagi buyurtmaga baho qoldirish mumkin. `from_user_id` token egasi bo'lishi shart.

**Response `201`:**
```json
{
  "success": true,
  "message": "Baho muvaffaqiyatli qoldirildi",
  "data": {
    "id": "uuid",
    "rating": 5,
    "comment_uz": "Ajoyib haydovchi!",
    "created_at": "2025-04-25T10:00:00Z"
  }
}
```

---

## 9.2 Mening baholary

```http
GET /reviews/my?language=uz
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Ajoyib haydovchi!",
      "direction": "sent",
      "order": { "id": "uuid", "status": "completed", "price": 25000 },
      "from": { "id": "uuid", "name": "Alisher", "photo": "photo.jpg" },
      "to": { "id": "uuid", "name": "Bobur", "photo": "photo2.jpg" }
    }
  ]
}
```

> **`direction`:** `sent` — yuborgan | `received` — qabul qilgan

---

## 9.3 Barcha baholar — Admin

```http
GET /reviews?page=1&limit=10&language=uz&rating=5&to_user_id=uuid
Authorization: Bearer <admin_token>
```

**Query parametrlar:**
| Param | Type | Izoh |
|-------|------|------|
| `page` | number | Sahifa |
| `limit` | number | Hajm |
| `language` | `uz`/`ru`/`en` | Natija tili |
| `order_id` | UUID | Order filtri |
| `from_user_id` | UUID | Kim qoldirgan |
| `to_user_id` | UUID | Kim haqida |
| `rating` | 1–5 | Reyting filtri |

---

## 9.4 Baho ID bo'yicha — Admin

```http
GET /reviews/:id?language=uz
Authorization: Bearer <admin_token>
```

---

## 9.5 Bahoni o'chirish — Admin

```http
DELETE /reviews/:id
Authorization: Bearer <admin_token>
```

> Baho o'chirilganda haydovchi reytingi avtomatik qayta hisoblanadi.

---

# 10. CARDS — Kartalar

## 10.1 Karta qo'shish

```http
POST /cards
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "provider": "payme",
  "token": "card_token_from_payment_provider",
  "last4": "4242",
  "brand": "Visa",
  "expiry_month": 12,
  "expiry_year": 2027,
  "is_default": true
}
```

---

## 10.2 Mening kartalarim

```http
GET /cards/my
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "provider": "payme",
      "last4": "4242",
      "brand": "Visa",
      "expiry_month": 12,
      "expiry_year": 2027,
      "is_default": true
    }
  ]
}
```

---

## 10.3 Asosiy kartani o'zgartirish

```http
PATCH /cards/:id/default
Authorization: Bearer <token>
```

---

## 10.4 Kartani o'chirish

```http
DELETE /cards/:id
Authorization: Bearer <token>
```

---

## 10.5 Barcha kartalar — Admin

```http
GET /cards?page=1&limit=10&user_id=uuid
Authorization: Bearer <admin_token>
```

---

## 10.6 Kartani o'chirish — Admin

```http
DELETE /cards/admin/:id
Authorization: Bearer <admin_token>
```

---

# 11. CHAT — Xabarlar

## 11.1 Chat yaratish yoki olish

```http
POST /chat/create
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{ "order_id": "uuid" }
```

---

## 11.2 Xabar yuborish

```http
POST /chat/message/send
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "chat_id": "uuid",
  "message": "Salom, 5 daqiqada yetib boraman"
}
```

---

## 11.3 Chat xabarlarini olish

```http
GET /chat/messages?chat_id=uuid&page=1&limit=50
Authorization: Bearer <token>
```

---

## 11.4 Mening chatlarim

```http
GET /chat/list?page=1&limit=20
Authorization: Bearer <token>
```

---

## 11.5 Bitta chat

```http
GET /chat/:chatId?language=uz
Authorization: Bearer <token>
```

---

# 12. LOCATIONS — Joylashuv

## 12.1 Haydovchi joylashuvini saqlash

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

> Har 2–5 soniyada bir marta yuboriladi.

---

## 12.2 Yo'lovchi joylashuvini saqlash

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

---

## 12.3 Yo'l tarixi

```http
GET /api/location/route-history/:order_id
```

**Response:**
```json
{
  "driverRoute": [
    { "lat": "41.311081", "lng": "69.240562", "timestamp": "2025-04-25T12:30:00Z" }
  ],
  "passengerRoute": [
    { "lat": "41.312000", "lng": "69.250000", "timestamp": "2025-04-25T12:32:00Z" }
  ]
}
```

---

## 12.4 Barcha joylashuvlar — Admin

```http
GET /api/location/all-locations
Authorization: Bearer <admin_token>
```

---

# 13. DASHBOARD — Admin Panel Statistikasi

> Barcha dashboard endpointlari faqat `admin` uchun.

## 13.1 Asosiy kartochkalar

```http
GET /dashboard/summary
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "today_orders": 12,
    "month_orders": 340,
    "order_growth_percent": 15.3,
    "today_revenue": 850000,
    "month_revenue": 24500000,
    "revenue_growth_percent": 8.7,
    "new_users_this_month": 47,
    "user_growth_percent": 22.1,
    "online_drivers": 18,
    "total_drivers": 65,
    "driver_online_percent": 27.7
  }
}
```

---

## 13.2 Umumiy statistika

```http
GET /dashboard/overview
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": { "total": 520, "drivers": 65 },
    "orders": {
      "total": 1840,
      "completed": 1600,
      "cancelled": 120,
      "pending": 5,
      "active": 120
    },
    "revenue": { "total": 98500000 },
    "other": {
      "active_promo_codes": 3,
      "active_categories": 4
    }
  }
}
```

---

## 13.3 Buyurtma statistikasi

```http
GET /dashboard/orders/stats?period=month
Authorization: Bearer <admin_token>
```

**`period`:** `day` | `week` | `month` | `year`

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "total_in_period": 340,
    "by_status": [
      { "status": "completed", "count": 290 },
      { "status": "cancelled", "count": 35 },
      { "status": "pending", "count": 15 }
    ],
    "by_category": [
      {
        "category_id": "uuid",
        "category_name": "Econom",
        "count": 200,
        "total_revenue": 15000000
      }
    ],
    "daily_chart": [
      { "date": "2025-04-01", "count": 12, "revenue": 850000 },
      { "date": "2025-04-02", "count": 15, "revenue": 1100000 }
    ]
  }
}
```

---

## 13.4 Daromad statistikasi

```http
GET /dashboard/revenue/stats?period=month
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "total_revenue": 24500000,
    "total_transactions": 290,
    "failed_amount": 320000,
    "pending_amount": 150000,
    "by_method": [
      { "method": "cash", "count": 180, "total": 15000000 },
      { "method": "card", "count": 60, "total": 6500000 },
      { "method": "payme", "count": 50, "total": 3000000 }
    ],
    "daily_chart": [
      { "date": "2025-04-01", "revenue": 850000 }
    ]
  }
}
```

---

## 13.5 Haydovchi statistikasi

```http
GET /dashboard/drivers/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 65,
    "online": 18,
    "offline": 40,
    "busy": 7,
    "average_rating": 4.3,
    "top_drivers": [
      {
        "id": "uuid",
        "name": "Alisher",
        "phone": "+998901234567",
        "photo": "photo.jpg",
        "car_model": "Cobalt",
        "car_number": "01A123BC",
        "status": "online",
        "rating": 4.9,
        "completed_orders": 342,
        "category": "Econom"
      }
    ]
  }
}
```

---

## 13.6 Foydalanuvchi statistikasi

```http
GET /dashboard/users/stats?period=month
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "total": 520,
    "new_in_period": 47,
    "by_role": [
      { "role": "passenger", "count": 455 },
      { "role": "driver", "count": 65 }
    ],
    "top_passengers": [
      {
        "id": "uuid",
        "name": "Bobur",
        "phone": "+998901111111",
        "photo": null,
        "total_orders": 87
      }
    ],
    "registration_chart": [
      { "date": "2025-04-01", "count": 3 },
      { "date": "2025-04-02", "count": 5 }
    ]
  }
}
```

---

## 13.7 So'nggi faollik

```http
GET /dashboard/recent-activity?limit=10
Authorization: Bearer <admin_token>
```

**`limit`:** 1–50 (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "recent_orders": [
      {
        "id": "uuid",
        "status": "completed",
        "price": 35000,
        "distance_km": 5.3,
        "created_at": "2025-04-25T10:00:00Z",
        "user_name": "Alisher",
        "user_phone": "+998901234567",
        "driver_name": "Bobur",
        "driver_phone": "+998901111111",
        "category": "Econom",
        "payment_method": "cash",
        "payment_status": "success"
      }
    ],
    "recent_payments": [
      {
        "id": "uuid",
        "amount": 35000,
        "method": "cash",
        "status": "success",
        "paid_at": "2025-04-25T10:05:00Z",
        "order_id": "uuid",
        "user_name": "Alisher",
        "user_phone": "+998901234567"
      }
    ],
    "recent_users": [
      {
        "id": "uuid",
        "name_uz": "Kamol",
        "phone": "+998902222222",
        "role": "passenger",
        "created_at": "2025-04-25T09:00:00Z",
        "profile_photo": null
      }
    ]
  }
}
```

---

# WebSocket (Real-time)

**URL:** `ws://localhost:3000/ws`

## Ulanish

```javascript
const socket = io('http://localhost:3000/ws', {
  transports: ['websocket', 'polling']
});

// O'zini ro'yxatdan o'tkazish
socket.emit('register', { userId: 'uuid', driverId: 'uuid' });
```

## Hodisalar (Events)

| Event | Kim oladi | Ma'lumot |
|-------|-----------|---------|
| `order:request` | Haydovchi | `{ order_id, distance_km, price, promo_applied }` |
| `order:cancelled` | Haydovchi | `{ order_id }` |
| `order:status_updated` | Haydovchi + Yo'lovchi | `{ order_id, status }` |
| `order:completed` | Haydovchi | `{ order_id, amount }` |
| `order:updated` | Haydovchi | `{ order_id, new_price }` |

---

# Xato kodlari

| HTTP kod | Ma'no |
|----------|-------|
| `200` | Muvaffaqiyatli |
| `201` | Yaratildi |
| `400` | Noto'g'ri so'rov (Bad Request) |
| `401` | Token yo'q yoki noto'g'ri |
| `403` | Ruxsat yo'q (Forbidden) |
| `404` | Topilmadi (Not Found) |
| `409` | Allaqachon mavjud (Conflict) |
| `500` | Server xatosi |

---

# Rollar

| Rol | Huquqlar |
|-----|---------|
| `passenger` | Buyurtma berish, profil, kartalar, baholar, chat |
| `driver` | Buyurtma qabul qilish, joylashuv, profil, chat |
| `admin` | Barcha endpointlar + dashboard |

---

# Admin hisobi (default)

| | |
|---|---|
| **Phone** | `ADMIN_PHONE` (`.env`) |
| **Password** | `ADMIN_PASSWORD` (`.env`) |
| **Email** | `ADMIN_EMAIL` (`.env`) |

---

# Frontend — Axios sozlash (React/Next.js)

```typescript
// api/axios.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

## Login va token saqlash

```typescript
const login = async (phone: string, password: string) => {
  const { data } = await api.post('/auth/login', { phone, password });
  localStorage.setItem('access_token', data.access_token);
  return data.user;
};
```

## Dashboard ma'lumotlarini olish

```typescript
// Summary kartochkalar
const summary = await api.get('/dashboard/summary');

// Oylik buyurtmalar grafigi
const orders = await api.get('/dashboard/orders/stats', {
  params: { period: 'month' }
});

// Haydovchilar statistikasi
const drivers = await api.get('/dashboard/drivers/stats');

// So'nggi 20 faollik
const activity = await api.get('/dashboard/recent-activity', {
  params: { limit: 20 }
});
```

## Buyurtmalar jadvalini olish

```typescript
const getOrders = async (page: number, filters = {}) => {
  const { data } = await api.get('/orders/get-all-orders', {
    params: { language: 'uz', page, limit: 10, ...filters }
  });
  return data;
};
```
