# Review API — Admin Panel Documentation

> Rollar: `superadmin` va `admin` — barcha endpointlarga kirish huquqi bor.
> `superadmin` barcha narsani boshqaradi. `admin` ham xuddi shunday, lekin tizim sozlamalari bo'yicha cheklov qo'yilishi mumkin.

Barcha so'rovlarda `Authorization: Bearer <admin_token>` header majburiy.

---

## Endpoint xaritasi

| Method | URL | Kim | Tavsif |
|---|---|---|---|
| `POST` | `/reviews` | User | Baho yaratish |
| `GET` | `/reviews/my` | User | O'z baholari |
| `PATCH` | `/reviews/:id` | User / Admin | Tahrirlash |
| `PATCH` | `/reviews/:id/flag` | **Admin** | Atmetka qo'yish |
| `GET` | `/reviews` | **Admin** | Barcha baholar |
| `GET` | `/reviews/:id` | **Admin** | Bitta baho |
| `DELETE` | `/reviews/:id` | **Admin** | O'chirish |

---

## 1. Barcha baholarni ko'rish

**GET** `/reviews`
a
Keng filtrlash imkoniyati bilan.

**Query Params:**

| Param | Type | Default | Tavsif |
|---|---|---|---|
| `page` | number | `1` | Sahifa raqami |
| `limit` | number | `10` | Har sahifada nechta (max 100) |
| `language` | `uz` \| `ru` \| `en` | `uz` | Javob tili |
| `order_id` | string | — | Order IDsi bo'yicha filter |
| `from_user_id` | string | — | Baho qoldiruvchi |
| `to_user_id` | string | — | Baholanuvchi |
| `rating` | number (1–5) | — | Yulduz soni |
| `is_flagged` | `true` \| `false` | — | Atmetka holati bo'yicha filter |

**Misollar:**
```
GET /reviews?page=1&limit=20&language=uz
GET /reviews?is_flagged=true
GET /reviews?rating=1&is_flagged=false
GET /reviews?to_user_id=uuid&rating=5
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 2,
      "comment": "Yomon haydovchi",
      "is_flagged": true,
      "flag_reason": "Noto'g'ri kontent",
      "created_at": "2026-05-13T10:00:00Z",
      "updated_at": "2026-05-13T11:00:00Z",
      "order": { "id": "uuid", "status": "completed", "price": 15000 },
      "from": { "id": "uuid", "name": "Ali", "photo": "url" },
      "to":   { "id": "uuid", "name": "Haydovchi Vali", "photo": "url" }
    }
  ],
  "pagination": {
    "totalItems": 150,
    "totalPages": 8,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

---

## 2. Bitta bahoni ko'rish

**GET** `/reviews/:id?language=uz`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "rating": 1,
    "comment": "Juda yomon",
    "is_flagged": false,
    "flag_reason": null,
    "created_at": "2026-05-13T10:00:00Z",
    "updated_at": "2026-05-13T10:00:00Z",
    "order": { "id": "uuid", "status": "completed", "price": 25000, "created_at": "..." },
    "from": { "id": "uuid", "name": "Ali", "photo": "url" },
    "to":   { "id": "uuid", "name": "Vali", "photo": "url" }
  }
}
```

---

## 3. Bahoni tahrirlash (admin)

**PATCH** `/reviews/:id`

Admin istalgan foydalanuvchining bahosini tahrirlay oladi.

**Request Body (barcha maydonlar ixtiyoriy):**
```json
{
  "rating": 3,
  "comment": "Moderator tomonidan tuzatildi",
  "language": "uz"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Baho yangilandi",
  "data": { ... }
}
```

> **Eslatma:** `comment` yuborilganda tizim avval barcha til variantlarini (`comment_uz`, `comment_ru`, `comment_en`) tozalaydi va faqat ko'rsatilgan tilda saqlaydi. Rating yangilansa, haydovchining umumiy reytingi ham qayta hisoblanadi.

---

## 4. Bahoga atmetka (flag) qo'yish

**PATCH** `/reviews/:id/flag`

Shubhali yoki noto'g'ri baholarni belgilash uchun. Belgilangan baholar `is_flagged=true` qilib filter qilinadi.

**Request Body:**
```json
{
  "is_flagged": true,
  "flag_reason": "Haqoratli so'zlar mavjud"
}
```

| Field | Type | Required | Tavsif |
|---|---|---|---|
| `is_flagged` | boolean | ✅ | `true` = bayroq qo'y, `false` = olib tashla |
| `flag_reason` | string | ❌ | Sabab (faqat `is_flagged: true` da saqlanadi) |

**Bayroq qo'yish:**
```json
{ "is_flagged": true, "flag_reason": "Spam kontent" }
```

**Bayroqni olib tashlash:**
```json
{ "is_flagged": false }
```

**Response 200:**
```json
{
  "success": true,
  "message": "Baho belgilandi (flagged)",
  "data": {
    "id": "uuid",
    "is_flagged": true,
    "flag_reason": "Spam kontent"
  }
}
```

---

## 5. Bahoni o'chirish

**DELETE** `/reviews/:id`

Baho o'chirilgandan so'ng haydovchi reytingi avtomatik qayta hisoblanadi.

**Response 200:**
```json
{
  "success": true,
  "message": "Baho o'chirildi"
}
```

---

## Admin panel workflow — tavsiya etilgan ssenariylar

### Shubhali baholarni tekshirish
```
1. GET /reviews?is_flagged=true          → belgilangan baholar ro'yxati
2. GET /reviews/:id                      → tafsilotlarni ko'rish
3. PATCH /reviews/:id/flag  {is_flagged:false}  → tozalash (muammo yo'q)
   yoki
   DELETE /reviews/:id                  → o'chirish (qoidabuzarlik)
```

### Past reytingli baholarni tekshirish
```
GET /reviews?rating=1&is_flagged=false   → atmetka qo'yilmagan 1 yulduzlilar
```

### Haydovchi bo'yicha barcha baholar
```
GET /reviews?to_user_id=<driver_user_id>
```

### Foydalanuvchi bo'yicha barcha baholar
```
GET /reviews?from_user_id=<user_id>
```

---

## Flag sabablariga tavsiya etilgan standartlar

| Kod | Ma'nosi |
|---|---|
| `Spam kontent` | Reklama yoki takroriy baho |
| `Haqoratli so'zlar` | So'kinish, kamsitish |
| `Noto'g'ri kontent` | Mavzuga aloqasiz matn |
| `Soxta baho` | Suiiste'mol qilingan baho |
| `Shaxsiy ma'lumot` | Telefon, manzil yoki boshqa ma'lumot |

---

## Xato kodlari

| HTTP | Ma'nosi |
|---|---|
| `400` | Noto'g'ri so'rov (validatsiya) |
| `401` | Token yo'q yoki muddati o'tgan |
| `403` | Rol yetarli emas |
| `404` | Baho topilmadi |
| `500` | Server xatosi |

---

## Rollar va ruxsatlar jadvali

| Endpoint | user | admin | superadmin |
|---|---|---|---|
| `POST /reviews` | ✅ | ✅ | ✅ |
| `GET /reviews/my` | ✅ | ✅ | ✅ |
| `PATCH /reviews/:id` (o'z bahosi) | ✅ | ✅ | ✅ |
| `PATCH /reviews/:id` (boshqa bahosi) | ❌ | ✅ | ✅ |
| `PATCH /reviews/:id/flag` | ❌ | ✅ | ✅ |
| `GET /reviews` | ❌ | ✅ | ✅ |
| `GET /reviews/:id` | ❌ | ✅ | ✅ |
| `DELETE /reviews/:id` | ❌ | ✅ | ✅ |
