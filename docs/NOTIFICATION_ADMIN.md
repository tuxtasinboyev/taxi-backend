# Taxi App — Admin Notification API

Barcha admin endpointlari `Authorization: Bearer <adminToken>` talab qiladi.

---

## Endpointlar

### 1. Barcha bildirishnomalarni ko'rish

```
GET /notifications/admin/all
```

**Query params:**

| Param | Type | Default | Tavsif |
|-------|------|---------|--------|
| `page` | number | 1 | Sahifa raqami |
| `limit` | number | 20 | Bir sahifadagi miqdor |
| `user_id` | string | — | Bitta userning notificationlari |

**Request:**
```http
GET /notifications/admin/all?page=1&limit=20
Authorization: Bearer <adminToken>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title_uz": "Buyurtma qabul qilindi",
      "title_ru": "Заказ принят",
      "title_en": "Order accepted",
      "message_uz": "Haydovchi qabul qildi",
      "message_ru": "Водитель принял",
      "message_en": "Driver accepted",
      "type": "order_accepted",
      "is_read": false,
      "data": { "order_id": "uuid" },
      "created_at": "2026-04-29T10:00:00.000Z",
      "user": {
        "id": "uuid",
        "phone": "+998901234567",
        "name_uz": "Otabek",
        "role": "passenger"
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "total_pages": 5
  }
}
```

---

### 2. Bitta foydalanuvchiga notification yuborish

```
POST /notifications/admin/send-to-user
```

**Request:**
```http
POST /notifications/admin/send-to-user
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "user_id": "foydalanuvchi-uuid",
  "title_uz": "Muhim xabar",
  "title_ru": "Важное сообщение",
  "title_en": "Important message",
  "message_uz": "Hisobingiz tekshirilmoqda",
  "message_ru": "Ваш аккаунт проверяется",
  "message_en": "Your account is being reviewed",
  "type": "admin"
}
```

**Response:**
```json
{
  "success": true
}
```

> Foydalanuvchining barcha qurilmalariga avtomatik yuboriladi.  
> Har bir qurilma o'z tiliga mos xabar oladi (uz/ru/en).

---

### 3. Barcha foydalanuvchilarga notification yuborish

```
POST /notifications/admin/send-to-all
```

**Request:**
```http
POST /notifications/admin/send-to-all
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "title_uz": "Yangi versiya",
  "title_ru": "Новая версия",
  "title_en": "New version",
  "message_uz": "Ilovaning yangi versiyasi chiqdi",
  "message_ru": "Вышла новая версия приложения",
  "message_en": "A new version of the app is available",
  "type": "system",
  "role": "all"
}
```

**`role` qiymatlari:**

| Qiymat | Tavsif |
|--------|--------|
| `all` | Barcha foydalanuvchilar (default) |
| `passenger` | Faqat yo'lovchilar |
| `driver` | Faqat haydovchilar |

**Response:**
```json
{
  "notified": 1250
}
```

---

### 4. Bitta qurilmaga (device token) notification yuborish

```
POST /notifications/admin/send-to-device
```

**Request:**
```http
POST /notifications/admin/send-to-device
Authorization: Bearer <adminToken>
Content-Type: application/json

{
  "device_token": "fcm_token_here",
  "title": "Test xabar",
  "message": "Bu test bildirishnomasi"
}
```

**Response:**
```json
true
```

> Bu endpoint DB ga saqlamaydi, faqat FCM ga yuboradi.  
> Test maqsadida yoki alohida qurilmaga yuborishda ishlatiladi.

---

## Notification turlari (`type`)

| type | Tavsif |
|------|--------|
| `order_accepted` | Buyurtma qabul qilindi |
| `order_on_the_way` | Haydovchi yo'lda |
| `order_completed` | Sayohat yakunlandi |
| `order_cancelled` | Buyurtma bekor qilindi |
| `order_assigned` | Haydovchi biriktirildi |
| `promo` | Aksiya yoki promo-kod |
| `system` | Tizim yangilanishi |
| `admin` | Admin tomonidan yuborilgan |

---

## Avtomatik yuboriladigan notificationlar

Quyidagi holatlarda backend o'zi avtomatik yuboradi, admindan amal talab qilinmaydi:

| Holat | Kimga | type |
|-------|-------|------|
| Haydovchi buyurtma qabul qildi | Yo'lovchi | `order_accepted` |
| Status `on_the_way` ga o'zgardi | Yo'lovchi | `order_on_the_way` |
| Buyurtma yakunlandi | Yo'lovchi + Haydovchi | `order_completed` |
| Buyurtma bekor qilindi | Yo'lovchi + Haydovchi | `order_cancelled` |
| Admin haydovchi biriktirdi | Yo'lovchi + Haydovchi | `order_assigned` |
