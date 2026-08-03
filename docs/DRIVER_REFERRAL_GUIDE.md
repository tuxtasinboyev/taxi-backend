# Haydovchilar Referal Tizimi — Flutter Integratsiyasi

Haydovchi boshqa odamni taklif qilib, u haydovchi bo'lib ishlay boshlasa — referrer (taklif qilgan) uning har bir buyurtmasidan **bonus** oladi. Bonus foizi va muddati **admin panelda dinamik sozlanadi** (kodda hardcode qilinmagan).

## Muhim: bonus qayerdan olinadi

Bonus **platformaning o'z komissiya ulushidan** (har buyurtmadan olinadigan 5%) ajratiladi:
- Buyurtma narxi o'zgarmaydi.
- Referal qilingan haydovchining o'z komissiyasi/net daromadi o'zgarmaydi (u avvalgidek 95% oladi).
- Bonus alohida `ReferralEarning` yozuvi sifatida saqlanadi va **wallet balansiga qo'shilmaydi** — mobil ilovada alohida bo'lim sifatida ko'rsatilishi kerak.

---

## 1. Referal kodini olish

```
GET /api/referral/me/code
Authorization: Bearer <driver_access_token>
```

Haydovchining hali kodi bo'lmasa, avtomatik generatsiya qilinadi.

```json
{ "success": true, "data": { "referral_code": "YL-4F7K2Q" } }
```

Bu kodni haydovchi do'stiga ulashadi (masalan "Share" tugmasi orqali matn/link sifatida).

---

## 2. Yangi haydovchi referal kodi bilan ariza topshiradi

Haydovchilar hech qachon o'zi ro'yxatdan o'tmaydi — avval oddiy foydalanuvchi sifatida ro'yxatdan o'tadi (`/auth/register`), so'ng haydovchi bo'lish uchun ariza yuboradi:

```
POST /api/driver-requests
Authorization: Bearer <passenger_access_token>
Content-Type: application/json

{
  "full_name": "Ali Valiyev",
  "phone": "+998901234567",
  "car_model": "Chevrolet Cobalt",
  "car_number": "01A123BC",
  "license_number": "DL-1234567",
  "referral_code": "YL-4F7K2Q"
}
```

- `referral_code` — ixtiyoriy. Flutter ilovasida "Sizni kim taklif qildi?" input maydoni sifatida ko'rsatiladi.
- Agar kod noto'g'ri bo'lsa, `400 Bad Request: "Referal kodi noto'g'ri"` qaytadi.

Admin arizani tasdiqlaganda (`PATCH /api/driver-requests/:id/accept`) yangi haydovchi yaratiladi va referal bog'lanishi avtomatik o'rnatiladi. Bu bosqichda Flutterdan hech qanday qo'shimcha chaqiruv kerak emas.

---

## 3. Men taklif qilgan haydovchilar ro'yxati

```
GET /api/referral/me/referrals?language=uz
Authorization: Bearer <driver_access_token>
```

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

Har bir referal qilingan haydovchi uchun **`rating`** maydoni ham qaytadi — Flutterda ro'yxatda yulduzcha bilan ko'rsatish tavsiya etiladi (masalan "Siz taklif qilgan Jasur — 4.7 ⭐, 42 ta buyurtma bajargan, sizga 15 750 so'm bonus keltirgan").

---

## 4. Referaldan kelgan daromadlarim (alohida hisob)

```
GET /api/referral/me/earnings?page=1&limit=20
Authorization: Bearer <driver_access_token>
```

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

**Mobil UI tavsiyasi:** bu ro'yxat haydovchining oddiy daromad/wallet sahifasidan **alohida** bo'lim/tab sifatida ("Referal daromadi") ko'rsatilishi kerak — chunki bu pul haydovchining o'z buyurtma daromadidan emas, balki platformaning komissiya ulushidan kelib chiqadi.

---

## 5. Admin panel (ma'lumot uchun, mobil kerak emas)

- `GET /api/referral/settings` / `PATCH /api/referral/settings` — bonus foizi, muddati, yoqilgan/o'chirilganligini boshqarish.
- `GET /api/referral/admin/stats` — barcha referrerlar, ular taklif qilgan haydovchilar va jami to'langan bonuslar statistikasi.
- `POST /api/referral/admin/link` — admin/xodim tomonidan **qo'lda** referal biriktirish: `{ "phone": "+998901111111", "referral_code": "YL-4F7K2Q" }`. Haydovchi ariza berishda kod kiritmagan yoki keyinroq tuzatish kerak bo'lganda ishlatiladi. Bundan tashqari, admin `POST /api/drivers` orqali haydovchini to'g'ridan-to'g'ri yaratayotganda ham ixtiyoriy `referral_code` maydonini yuborishi mumkin — shu bilan bir vaqtning o'zida ham haydovchi yaratiladi, ham referal bog'lanadi.

Bular faqat admin panelda ishlatiladi, Flutter ilovasiga tegishli emas.
