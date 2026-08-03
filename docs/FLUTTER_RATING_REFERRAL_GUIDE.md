# Reyting (Rating), Haydovchilar Reytingi va Referal Tizimi — Flutter Integratsiyasi

Ushbu hujjat 3 ta o'zaro bog'liq tizimni birlashtiradi:

1. **Reyting/Baholash** — buyurtma tugagach passenger↔driver bir-biriga baho qo'yadi.
2. **Haydovchilar reytingi (ranking)** — barcha haydovchilar `Driver.rating` bo'yicha tartiblanadi, haydovchi o'z o'rnini ko'radi.
3. **Referal tizimi** — haydovchi boshqa odamni taklif qilib, uning har bir buyurtmasidan bonus oladi.

Barcha endpointlar `Authorization: Bearer <access_token>` talab qiladi (aks holida ko'rsatilgan). Base URL: `{{BASE_URL}}/api`.

---

# 1-QISM: Reyting / Baholash

## 1.1. Baho qoldirish

```
POST /api/reviews
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body:**

```json
{
  "order_id": "b3f1c2a0-1111-4a2b-9c3d-abcdef123456",
  "from_user_id": "u-passenger-uuid",
  "to_user_id": "u-driver-uuid",
  "rating": 5,
  "comment": "Juda yaxshi haydovchi, vaqtida yetib keldi",
  "language": "uz"
}
```

| Maydon | Turi | Majburiy | Izoh |
|---|---|---|---|
| `order_id` | string | ✅ | Buyurtma `status` **completed** bo'lishi shart |
| `from_user_id` | string | ✅ | Faqat o'zi (token egasi) nomidan yuborilishi mumkin |
| `to_user_id` | string | ✅ | Baholanuvchi (odatda driver, lekin driver ham passengerga baho bera oladi) |
| `rating` | int | ✅ | `1` dan `5` gacha |
| `comment` | string | — | Ixtiyoriy izoh |
| `language` | enum | — | `uz` \| `ru` \| `en`, izoh shu tilda saqlanadi |

**Muvaffaqiyatli javob (201):**

```json
{
  "success": true,
  "message": "Baho muvaffaqiyatli qoldirildi",
  "data": {
    "id": "review-uuid",
    "order_id": "b3f1c2a0-...",
    "from_user_id": "u-passenger-uuid",
    "to_user_id": "u-driver-uuid",
    "rating": 5,
    "comment_uz": "Juda yaxshi haydovchi, vaqtida yetib keldi",
    "comment_ru": null,
    "comment_en": null,
    "is_flagged": false,
    "flag_reason": null,
    "created_at": "2026-08-03T10:00:00.000Z",
    "updated_at": "2026-08-03T10:00:00.000Z",
    "from": { "id": "u-passenger-uuid", "name_uz": "Ali", "name_ru": null, "name_en": null, "profile_photo": null },
    "to": { "id": "u-driver-uuid", "name_uz": "Jasur", "name_ru": null, "name_en": null, "profile_photo": "https://.../p.jpg" }
  }
}
```

**Xatolar:**
- `403` — `"Faqat yakunlangan buyurtmalarga baho qoldirish mumkin"` (order hali completed emas)
- `403` — `"Siz faqat o'zingiz nomidan baho qoldirishingiz mumkin"`
- `404` — `"Order topilmadi"` / `"Baholanuvchi foydalanuvchi topilmadi"`

> Baho qo'yilgach, agar `to_user_id` driver bo'lsa, uning `Driver.rating`i barcha review'lar o'rtachasiga avtomatik qayta hisoblanadi.

## 1.2. Mening baholarim (yuborgan + qabul qilgan)

```
GET /api/reviews/my?language=uz
Authorization: Bearer <token>
```

**Javob (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "review-uuid",
      "rating": 5,
      "comment": "Juda yaxshi haydovchi",
      "comment_uz": "Juda yaxshi haydovchi",
      "comment_ru": null,
      "comment_en": null,
      "is_flagged": false,
      "created_at": "2026-08-03T10:00:00.000Z",
      "updated_at": "2026-08-03T10:00:00.000Z",
      "direction": "sent",
      "order": { "id": "order-uuid", "status": "completed", "price": 30000 },
      "from": { "id": "u1", "name": "Ali", "name_uz": "Ali", "name_ru": null, "name_en": null, "photo": null },
      "to": { "id": "u2", "name": "Jasur", "name_uz": "Jasur", "name_ru": null, "name_en": null, "photo": "https://.../p.jpg" }
    }
  ]
}
```

`direction` — `"sent"` (men bergan) yoki `"received"` (men olgan).

## 1.3. Bahoni tahrirlash

```
PATCH /api/reviews/:id
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "rating": 4, "comment": "Fikrimni o'zgartirdim", "language": "uz" }
```

Faqat baho egasi o'z bahosini tahrirlashi mumkin (admin — istalganini). Javob formati `1.1` bilan bir xil, `message: "Baho yangilandi"`.

---

# 2-QISM: Haydovchilar Reytingi (Ranking)

## 2.1. Men nechinchi o'rindaman

```
GET /api/drivers/ranking/me?around=3
Authorization: Bearer <driver_token>
```

| Query | Turi | Default | Izoh |
|---|---|---|---|
| `around` | number | `3` | Mendan yuqorida/pastda nechta haydovchi ko'rsatilsin |

**Javob (200):**

```json
{
  "success": true,
  "message": "Ranking retrieved successfully",
  "data": {
    "my_rank": 5,
    "total_drivers": 42,
    "my_rating": 4.5,
    "neighbors": [
      { "rank": 2, "id": "uuid-2", "name": "Jasur",  "photo": null, "rating": 4.9, "is_me": false },
      { "rank": 3, "id": "uuid-3", "name": "Botir",  "photo": null, "rating": 4.7, "is_me": false },
      { "rank": 4, "id": "uuid-4", "name": "Sanjar", "photo": null, "rating": 4.6, "is_me": false },
      { "rank": 5, "id": "uuid-5", "name": "Siz",    "photo": null, "rating": 4.5, "is_me": true  },
      { "rank": 6, "id": "uuid-6", "name": "Aziz",   "photo": null, "rating": 4.4, "is_me": false },
      { "rank": 7, "id": "uuid-7", "name": "Doniyor","photo": null, "rating": 4.3, "is_me": false }
    ]
  }
}
```

Baho hali yo'q haydovchilar uchun `rating: 0` qaytadi (`null` emas) — ular ro'yxat oxirida turadi.

**UI tavsiya:** "Siz **5**-o'rindasiz (jami 42 tadan)" katta ko'rinishda, pastda `neighbors` vertikal jadval, `is_me: true` qatorni ajratib (masalan boshqa fon rang bilan) ko'rsatish.

> Admin panel uchun `GET /api/drivers/ranking` (sahifalash bilan, admin-only) ham mavjud — mobil ilova buni chaqirmaydi.

---

# 3-QISM: Referal Tizimi

Bonus **platformaning 5% komissiya ulushidan** ajratiladi — buyurtma narxi va haydovchining o'z daromadi o'zgarmaydi. Bonus foizi va muddati admin panelda dinamik sozlanadi.

## 3.1. O'z referal kodimni olish

```
GET /api/referral/me/code
Authorization: Bearer <driver_token>
```

**Javob (200):**

```json
{ "success": true, "data": { "referral_code": "YL-4F7K2Q" } }
```

Kod birinchi so'ralganda avtomatik yaratiladi (keyingi chaqiriqlarda o'zgarmaydi). Bu kodni "Do'stingizni taklif qiling" tugmasi orqali ulashing.

## 3.2. Taklif qilingan odam haydovchi bo'lish uchun ariza yuboradi

Haydovchilar hech qachon to'g'ridan-to'g'ri ro'yxatdan o'tmaydi — avval oddiy foydalanuvchi (`/auth/register`), so'ng ariza:

```
POST /api/driver-requests
Authorization: Bearer <passenger_token>
Content-Type: application/json
```

```json
{
  "full_name": "Ali Valiyev",
  "phone": "+998901234567",
  "car_model": "Chevrolet Cobalt",
  "car_number": "01A123BC",
  "license_number": "DL-1234567",
  "referral_code": "YL-4F7K2Q"
}
```

`referral_code` — ixtiyoriy maydon, Flutter ilovasida "Sizni kim taklif qildi? (ixtiyoriy)" input sifatida ko'rsatiladi.

**Javob (201):**

```json
{
  "success": true,
  "message": "So'rovingiz yuborildi",
  "data": {
    "id": "request-uuid",
    "user_id": "u-uuid",
    "full_name": "Ali Valiyev",
    "phone": "+998901234567",
    "car_model": "Chevrolet Cobalt",
    "car_number": "01A123BC",
    "license_number": "DL-1234567",
    "status": "pending",
    "created_at": "2026-08-03T10:00:00.000Z"
  }
}
```

**Xato:** `400` — `"Referal kodi noto'g'ri"` (kod mavjud emas).

Admin arizani tasdiqlagach (`PATCH /driver-requests/:id/accept`), referal bog'lanishi **avtomatik** o'rnatiladi — Flutterdan qo'shimcha chaqiruv shart emas.

## 3.3. Men taklif qilgan haydovchilar ro'yxati

```
GET /api/referral/me/referrals?language=uz
Authorization: Bearer <driver_token>
```

**Javob (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "driver-uuid",
      "name": "Jasur",
      "phone": "+998901111111",
      "photo": "https://.../photo.jpg",
      "status": "online",
      "rating": 4.7,
      "joined_at": "2026-06-01T10:00:00.000Z",
      "completed_orders": 42,
      "total_earned_from": 15750.0
    }
  ]
}
```

Har bir yozuvda **`rating`** (taklif qilingan haydovchining reytingi) ham qaytadi — ro'yxatda yulduzcha bilan ko'rsating.

## 3.4. Referaldan kelgan daromadlarim (alohida hisob)

```
GET /api/referral/me/earnings?page=1&limit=20
Authorization: Bearer <driver_token>
```

**Javob (200):**

```json
{
  "success": true,
  "data": {
    "total_earned": 87500.0,
    "earnings": [
      {
        "id": "earning-uuid",
        "amount": 375.0,
        "percent_applied": 25,
        "referred_driver_name": "Jasur",
        "order_id": "order-uuid",
        "order_number": 1042,
        "order_price": 30000.0,
        "created_at": "2026-08-01T14:20:00.000Z"
      }
    ],
    "pagination": { "totalItems": 42, "totalPages": 3, "currentPage": 1, "itemsPerPage": 20 }
  }
}
```

**Muhim UI qoidasi:** bu ro'yxat haydovchining oddiy wallet/daromad sahifasidan **alohida bo'lim** ("Referal daromadi") sifatida ko'rsatilishi kerak — bu pul haydovchining o'z buyurtma daromadidan emas, balki platforma komissiyasidan kelib chiqadi.

---

## Xulosa jadvali (barcha endpointlar)

| Endpoint | Method | Auth | Maqsad |
|---|---|---|---|
| `/reviews` | POST | passenger/driver | Baho qoldirish |
| `/reviews/my` | GET | istalgan | O'z baholarim |
| `/reviews/:id` | PATCH | egasi | Bahoni tahrirlash |
| `/drivers/ranking/me` | GET | driver | O'z reytingdagi o'rnim + atrofdagilar |
| `/referral/me/code` | GET | driver | O'z referal kodim |
| `/driver-requests` | POST | passenger | Haydovchi bo'lish arizasi (+ referal kod) |
| `/referral/me/referrals` | GET | driver | Men taklif qilganlar (reyting bilan) |
| `/referral/me/earnings` | GET | driver | Referal bonuslarim (alohida hisob) |
