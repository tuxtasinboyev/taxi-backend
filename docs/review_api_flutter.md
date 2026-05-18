# Review API — Flutter Client Documentation

Barcha so'rovlarda `Authorization: Bearer <token>` header majburiy.

Base URL: `https://your-api.com`

---

## 1. Baho qoldirish

**POST** `/reviews`

Faqat `completed` statusdagi buyurtmalarga baho qoldiriladi.

**Request Body:**
```json
{
  "order_id": "uuid",
  "from_user_id": "uuid",
  "to_user_id": "uuid",
  "rating": 5,
  "comment": "Juda yaxshi haydovchi",
  "language": "uz"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `order_id` | string (UUID) | ✅ | Buyurtma IDsi |
| `from_user_id` | string (UUID) | ✅ | Baho qoldiruvchi (o'zingizning ID) |
| `to_user_id` | string (UUID) | ✅ | Baholanuvchi foydalanuvchi |
| `rating` | int (1–5) | ✅ | Yulduzlar soni |
| `comment` | string | ❌ | Izoh matni |
| `language` | `uz` \| `ru` \| `en` | ❌ | Default: `uz` |

**Response 201:**
```json
{
  "success": true,
  "message": "Baho muvaffaqiyatli qoldirildi",
  "data": {
    "id": "uuid",
    "rating": 5,
    "comment_uz": "Juda yaxshi haydovchi",
    "from": { "id": "uuid", "name_uz": "Ali", "profile_photo": "url" },
    "to":   { "id": "uuid", "name_uz": "Vali", "profile_photo": "url" }
  }
}
```

**Errors:**
- `403` — buyurtma yakunlanmagan yoki o'zga nomidan baho qoldirishga urinish
- `404` — order yoki foydalanuvchi topilmadi

---

## 2. Mening baholarim

**GET** `/reviews/my?language=uz`

Foydalanuvchi yuborgan ham, qabul qilgan ham baholarni qaytaradi.

**Query params:**
| Param | Type | Required | Default |
|---|---|---|---|
| `language` | `uz` \| `ru` \| `en` | ❌ | `uz` |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 4,
      "comment": "Yaxshi",
      "is_flagged": false,
      "created_at": "2026-05-13T10:00:00Z",
      "updated_at": "2026-05-13T10:00:00Z",
      "direction": "sent",
      "order": { "id": "uuid", "status": "completed", "price": 25000 },
      "from": { "id": "uuid", "name": "Ali", "photo": "url" },
      "to":   { "id": "uuid", "name": "Vali", "photo": "url" }
    }
  ]
}
```

`direction`:
- `"sent"` — siz baho qoldirdingiz
- `"received"` — sizga baho qoldirildi

---

## 3. O'z bahosini tahrirlash

**PATCH** `/reviews/:id`

Foydalanuvchi faqat o'zi qoldirgan bahoni tahrirlay oladi.

**Request Body (barcha maydonlar ixtiyoriy):**
```json
{
  "rating": 3,
  "comment": "O'rtacha",
  "language": "uz"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `rating` | int (1–5) | ❌ | Yangi yulduz soni |
| `comment` | string | ❌ | Yangi izoh |
| `language` | `uz` \| `ru` \| `en` | ❌ | Izoh tili, default `uz` |

**Response 200:**
```json
{
  "success": true,
  "message": "Baho yangilandi",
  "data": { ... }
}
```

**Errors:**
- `403` — boshqa foydalanuvchining bahosini tahrirlashga urinish
- `404` — baho topilmadi

---

## Flutter Dart namunalari

### Servis klassi

```dart
class ReviewService {
  final Dio _dio;

  ReviewService(this._dio);

  Future<Map<String, dynamic>> createReview({
    required String orderId,
    required String fromUserId,
    required String toUserId,
    required int rating,
    String? comment,
    String language = 'uz',
  }) async {
    final response = await _dio.post('/reviews', data: {
      'order_id': orderId,
      'from_user_id': fromUserId,
      'to_user_id': toUserId,
      'rating': rating,
      if (comment != null) 'comment': comment,
      'language': language,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> getMyReviews({String language = 'uz'}) async {
    final response = await _dio.get('/reviews/my', queryParameters: {
      'language': language,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> updateReview({
    required String id,
    int? rating,
    String? comment,
    String language = 'uz',
  }) async {
    final response = await _dio.patch('/reviews/$id', data: {
      if (rating != null) 'rating': rating,
      if (comment != null) 'comment': comment,
      'language': language,
    });
    return response.data;
  }
}
```

### Review Model

```dart
class Review {
  final String id;
  final int rating;
  final String? comment;
  final bool isFlagged;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String direction; // 'sent' | 'received'
  final ReviewUser from;
  final ReviewUser to;

  Review.fromJson(Map<String, dynamic> json)
      : id = json['id'],
        rating = json['rating'],
        comment = json['comment'],
        isFlagged = json['is_flagged'] ?? false,
        createdAt = DateTime.parse(json['created_at']),
        updatedAt = DateTime.parse(json['updated_at']),
        direction = json['direction'] ?? '',
        from = ReviewUser.fromJson(json['from']),
        to = ReviewUser.fromJson(json['to']);
}

class ReviewUser {
  final String id;
  final String name;
  final String? photo;

  ReviewUser.fromJson(Map<String, dynamic> json)
      : id = json['id'],
        name = json['name'],
        photo = json['photo'];
}
```

### Yulduz widget namunasi

```dart
Widget buildStars(int rating) {
  return Row(
    mainAxisSize: MainAxisSize.min,
    children: List.generate(5, (i) => Icon(
      i < rating ? Icons.star : Icons.star_border,
      color: Colors.amber,
      size: 20,
    )),
  );
}
```

---

## Xato kodlari

| HTTP | Ma'nosi |
|---|---|
| `400` | Noto'g'ri so'rov (validatsiya xatosi) |
| `401` | Token yo'q yoki muddati o'tgan |
| `403` | Ruxsat yo'q |
| `404` | Resurs topilmadi |
| `500` | Server xatosi |
