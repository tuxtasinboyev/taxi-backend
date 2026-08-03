# Haydovchilar Reytingi (Driver Ranking) — Flutter Integratsiyasi

Haydovchilar `Driver.rating` (o'rtacha baho, `reviews`dan avtomatik hisoblanadi) bo'yicha tartiblanadi. Baho hali bo'lmagan haydovchilar `0` reyting bilan ro'yxatning oxirida ko'rsatiladi.

---

## 1. `GET /api/drivers/ranking` — Barcha haydovchilar reytingi (admin)

Admin panelda "Haydovchilar reytingi" sahifasi shu endpointdan foydalanadi. Auth: `admin` yoki `superadmin` roli.

**Query parametrlari:**

| Param      | Turi   | Majburiy | Izoh                          |
|------------|--------|----------|--------------------------------|
| `page`     | number | Yo'q     | Default `1`                    |
| `limit`    | number | Yo'q     | Default `10`                   |
| `language` | string | Yo'q     | `uz` \| `ru` \| `en` (default `uz`) |

**Javob:**

```json
{
  "success": true,
  "message": "Driver ranking retrieved successfully",
  "data": {
    "drivers": [
      {
        "rank": 1,
        "id": "driver-uuid",
        "name": "Azizbek",
        "phone": "+998901111111",
        "photo": "https://.../photo.jpg",
        "car_number": "01A111AA",
        "status": "online",
        "rating": 4.8,
        "review_count": 23
      }
    ],
    "pagination": {
      "totalItems": 42,
      "totalPages": 5,
      "currentPage": 1,
      "itemsPerPage": 10
    }
  }
}
```

---

## 2. `GET /api/drivers/ranking/me` — Haydovchining o'z o'rni

Flutter driver ilovasi shu endpointdan foydalanib, haydovchiga **"siz nechinchi o'rindasiz"** va **undan oldingi/keyingi haydovchilarni** ko'rsatadi. Auth: istalgan tizimga kirgan haydovchi (`Authorization: Bearer <token>`).

**Query parametrlari:**

| Param    | Turi   | Majburiy | Izoh                                                        |
|----------|--------|----------|--------------------------------------------------------------|
| `around` | number | Yo'q     | Default `3` — yuqorida va pastda nechta haydovchi ko'rsatilsin |

**So'rov misoli:**

```
GET /api/drivers/ranking/me?around=3
Authorization: Bearer <driver_access_token>
```

**Javob:**

```json
{
  "success": true,
  "message": "Ranking retrieved successfully",
  "data": {
    "my_rank": 5,
    "total_drivers": 42,
    "my_rating": 4.5,
    "neighbors": [
      { "rank": 2, "id": "uuid-2", "name": "Jasur",   "photo": null, "rating": 4.9, "is_me": false },
      { "rank": 3, "id": "uuid-3", "name": "Botir",   "photo": null, "rating": 4.7, "is_me": false },
      { "rank": 4, "id": "uuid-4", "name": "Sanjar",  "photo": null, "rating": 4.6, "is_me": false },
      { "rank": 5, "id": "uuid-5", "name": "Siz",     "photo": null, "rating": 4.5, "is_me": true  },
      { "rank": 6, "id": "uuid-6", "name": "Aziz",    "photo": null, "rating": 4.4, "is_me": false },
      { "rank": 7, "id": "uuid-7", "name": "Doniyor", "photo": null, "rating": 4.3, "is_me": false }
    ]
  }
}
```

`neighbors` ro'yxatida `is_me: true` bo'lgan element — haydovchining o'zi. Flutter tomonda shu elementni ajratib (masalan boshqa fon rangi bilan) ko'rsatish tavsiya etiladi.

---

## 3. Flutter tomonida ishlatish (misol)

```dart
Future<DriverRanking> fetchMyRanking({int around = 3}) async {
  final res = await dio.get(
    '/drivers/ranking/me',
    queryParameters: {'around': around},
    options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
  );
  return DriverRanking.fromJson(res.data['data']);
}
```

UI'da:
- Yuqorida katta qilib **"Siz N-o'rindasiz"** (`my_rank` / `total_drivers`) ko'rsatiladi.
- Pastda `neighbors` ro'yxati vertikal jadval sifatida chiziladi, `is_me: true` bo'lgan qatorni highlight qilib.
- Baho hali yo'q (`rating: 0`) bo'lsa, "Hali baholanmagansiz" kabi matn ko'rsatish mumkin.

---

## Eslatma

- Reyting `Review` (`docs`dagi baholash tizimi) orqali avtomatik hisoblanadi — yangi baho qo'yilganda yoki o'chirilganda darhol yangilanadi (`ReviewService.recalcDriverRating`).
- Ranking real vaqtda hisoblanadi (keshlanmagan), shu sababli har chaqiriqda joriy holatni qaytaradi.
