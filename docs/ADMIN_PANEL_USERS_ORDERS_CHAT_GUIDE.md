# Admin Panel - To'liq Request/Response Guide

Bu hujjat admin panel frontend uchun tayyorlangan to'liq API qo'llanma.

Qamrovi:

- userlar ro'yxati
- user detail sahifasi
- kartalar
- orderlar
- order detail
- chat monitoring
- support chat bilan ishlash

---

## 1. Asosiy Qoidalar

### Base header

```http
Authorization: Bearer <admin_or_superadmin_access_token>
```

### Role access

- `Users` -> `admin`, `superadmin`
- `Orders` -> `admin`, `superadmin`
- `Chat admin monitoring` -> `admin`, `superadmin`
- `Cards admin endpoints` -> hozir backendda faqat `admin`

### Language

Quyidagi endpointlarda `language` yoki `lang` ishlatiladi:

- `uz`
- `ru`
- `en`

---

## 2. Users

## 2.1 User yaratish

```http
POST /users
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

Request body:

- `name` - string
- `phone` - string
- `email` - string
- `password` - string
- `role` - `passenger | driver | admin | superadmin`
- `lang` - `uz | ru | en`
- `photo` - file

Example:

```http
POST /users
```

Form-data:

```text
name=Ali Valiyev
phone=+998901234567
email=ali@example.com
password=secret123
role=passenger
lang=uz
photo=<image-file>
```

Response `201`:

```json
{
  "user": {
    "id": "uuid-user",
    "phone": "+998901234567",
    "email": "ali@example.com",
    "name_uz": "Ali Valiyev",
    "name_ru": null,
    "name_en": null,
    "role": "passenger",
    "profile_photo": "https://cdn.example.com/uploads/user.png",
    "created_at": "2026-05-06T12:00:00.000Z",
    "updated_at": "2026-05-06T12:00:00.000Z"
  }
}
```

Possible errors:

- `409` -> user already exists

---

## 2.2 Userlar ro'yxati

```http
GET /users
Authorization: Bearer <token>
```

Query params:

- `page`
- `limit`
- `search`
- `role`
- `phone`
- `email`
- `sortBy`
- `sortOrder`
- `includeDriver`
- `includeWallet`
- `includeStats`
- `startDate`
- `endDate`

Full example:

```http
GET /users?page=1&limit=10&search=ali&role=passenger&sortBy=created_at&sortOrder=desc&includeDriver=true&includeWallet=true&includeStats=true
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "name_ru": null,
        "name_en": null,
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": "https://cdn.example.com/uploads/user.png",
        "password_hash": "$2b$10$hidden",
        "role": "passenger",
        "created_at": "2026-05-01T08:00:00.000Z",
        "updated_at": "2026-05-05T10:00:00.000Z",
        "driver": null,
        "wallet": {
          "user_id": "uuid-user",
          "balance": "125000.00",
          "created_at": "2026-05-01T08:00:00.000Z",
          "updated_at": "2026-05-05T10:00:00.000Z"
        },
        "_count": {
          "orders": 12,
          "reviewsFrom": 3,
          "reviewsTo": 2,
          "cards": 2,
          "notifications": 5
        },
        "driver_rating": null,
        "total_earnings": 0,
        "total_spent": 487000,
        "wallet_balance": 125000
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_users": 21,
      "has_next": true,
      "has_prev": false,
      "per_page": 10
    }
  },
  "timestamp": "2026-05-06T12:00:00.000Z"
}
```

Frontend note:

- Bu response ichida `password_hash` ham qaytishi mumkin, frontend uni ko'rsatmasligi kerak.
- `User Detail` sahifasi uchun ham shu endpointdan foydalanish mumkin.

---

## 2.3 User detail sahifasi

### Muhim

Hozir backendda alohida:

```http
GET /users/:id
```

endpoint yo'q.

Shuning uchun admin panelda `User Detail` quyidagi endpointlar kombinatsiyasi orqali yig'iladi.

### Step 1 - User asosiy ma'lumotlari

```http
GET /users?page=1&limit=1&search=%2B998901234567&includeDriver=true&includeWallet=true&includeStats=true
```

Yoki:

```http
GET /users?page=1&limit=1&email=ali@example.com&includeDriver=true&includeWallet=true&includeStats=true
```

Response:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "role": "passenger",
        "profile_photo": "https://cdn.example.com/uploads/user.png",
        "wallet": {
          "user_id": "uuid-user",
          "balance": "125000.00"
        },
        "_count": {
          "orders": 12,
          "reviewsFrom": 3,
          "reviewsTo": 2,
          "cards": 2,
          "notifications": 5
        },
        "total_spent": 487000,
        "wallet_balance": 125000
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 1,
      "total_users": 1,
      "has_next": false,
      "has_prev": false,
      "per_page": 1
    }
  },
  "timestamp": "2026-05-06T12:00:00.000Z"
}
```

### Step 2 - User kartalari

```http
GET /cards?user_id=uuid-user&page=1&limit=20
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-card",
      "user_id": "uuid-user",
      "provider": "payme",
      "token": "card_token_xyz",
      "last4": "4242",
      "brand": "Visa",
      "expiry_month": 12,
      "expiry_year": 2027,
      "is_default": true,
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-01T10:00:00.000Z",
      "user": {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "name_ru": null,
        "name_en": null,
        "phone": "+998901234567"
      }
    }
  ],
  "pagination": {
    "totalItems": 2,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

### Step 3 - User orderlari

```http
GET /orders/get-all-orders?language=uz&user_id=uuid-user&page=1&limit=20
```

Response:

```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": "uuid-order",
      "user_id": "uuid-user",
      "driver_id": "uuid-driver",
      "start_lat": "41.299500",
      "start_lng": "69.240100",
      "end_lat": "41.311000",
      "end_lng": "69.279000",
      "distance_km": "4.20",
      "duration_min": "8.40",
      "price": "18000.00",
      "status": "completed",
      "created_at": "2026-05-02T12:00:00.000Z",
      "updated_at": "2026-05-02T12:30:00.000Z",
      "finished_at": "2026-05-02T12:30:00.000Z",
      "user": {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "name": "Ali Valiyev"
      },
      "driver": {
        "id": "uuid-driver",
        "car_model_uz": "Cobalt",
        "car_color_uz": "Oq",
        "car_number": "01A123BC",
        "user": {
          "id": "uuid-driver",
          "name_uz": "Jasur",
          "phone": "+998900000000",
          "name": "Jasur"
        },
        "car_model": "Cobalt",
        "car_color": "Oq"
      },
      "taxiCategory": {
        "id": "uuid-category",
        "name_uz": "Econom",
        "name": "Econom"
      },
      "payment": {
        "id": "uuid-payment",
        "amount": "18000.00",
        "method": "cash",
        "status": "pending"
      },
      "fare": null,
      "reviews": [],
      "driverLocations": [],
      "userLocations": [],
      "chats": []
    }
  ],
  "pagination": {
    "totalItems": 3,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

### Step 4 - User chatlari

```http
GET /chat/admin/list?language=uz&user_id=uuid-user&page=1&limit=20
```

Response:

```json
{
  "chats": [
    {
      "id": "uuid-chat",
      "subject": "Qo'llab-quvvatlash",
      "type": "support",
      "order_id": null,
      "order_status": null,
      "created_at": "2026-05-05T09:00:00.000Z",
      "updated_at": "2026-05-05T09:05:00.000Z",
      "participants": [
        {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger",
          "joined_at": "2026-05-05T09:00:00.000Z"
        }
      ],
      "last_message": {
        "id": "uuid-message",
        "chat_id": "uuid-chat",
        "sender": {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger"
        },
        "message": "Assalomu alaykum",
        "message_type": "text",
        "is_read": false,
        "read_at": null,
        "created_at": "2026-05-05T09:05:00.000Z",
        "updated_at": "2026-05-05T09:05:00.000Z"
      },
      "other_user": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": null,
        "role": "passenger"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 2.4 Userni o'chirish

```http
DELETE /users/:id
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "success": true,
  "message": "user deleted successfully"
}
```

---

## 3. Cards

## 3.1 Barcha kartalar

```http
GET /cards?page=1&limit=10
Authorization: Bearer <admin-token>
```

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-card",
      "user_id": "uuid-user",
      "provider": "payme",
      "token": "card_token_xyz",
      "last4": "4242",
      "brand": "Visa",
      "expiry_month": 12,
      "expiry_year": 2027,
      "is_default": true,
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-01T10:00:00.000Z",
      "user": {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "name_ru": null,
        "name_en": null,
        "phone": "+998901234567"
      }
    }
  ],
  "pagination": {
    "totalItems": 14,
    "totalPages": 2,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

## 3.2 Faqat bitta user kartalari

```http
GET /cards?user_id=uuid-user&page=1&limit=20
```

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-card",
      "user_id": "uuid-user",
      "provider": "payme",
      "token": "card_token_xyz",
      "last4": "4242",
      "brand": "Visa",
      "expiry_month": 12,
      "expiry_year": 2027,
      "is_default": true,
      "created_at": "2026-05-01T10:00:00.000Z",
      "updated_at": "2026-05-01T10:00:00.000Z",
      "user": {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "name_ru": null,
        "name_en": null,
        "phone": "+998901234567"
      }
    }
  ],
  "pagination": {
    "totalItems": 2,
    "totalPages": 1,
    "currentPage": 1,
    "itemsPerPage": 20
  }
}
```

## 3.3 Admin kartani o'chirishi

```http
DELETE /cards/admin/:id
Authorization: Bearer <admin-token>
```

Response `200`:

```json
{
  "success": true,
  "message": "Karta o'chirildi"
}
```

---

## 4. Orders

## 4.1 Order yaratish

```http
POST /orders/admin-create
Content-Type: application/json
Authorization: Bearer <token>
```

Request body:

```json
{
  "user_id": "uuid-user",
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.311,
  "end_lng": 69.279,
  "taxiCategoryId": "uuid-category",
  "promoCode": "DISCOUNT20",
  "payment_method": "cash",
  "driver_id": "uuid-driver"
}
```

Response `201/200`:

```json
{
  "success": true,
  "message": "Admin tomonidan order yaratildi",
  "data": {
    "order": {
      "id": "uuid-order",
      "user_id": "uuid-user",
      "driver_id": null,
      "start_lat": "41.299500",
      "start_lng": "69.240100",
      "end_lat": "41.311000",
      "end_lng": "69.279000",
      "price": "18000",
      "distance_km": "4.20",
      "duration_min": "8.4",
      "status": "pending",
      "created_at": "2026-05-06T12:10:00.000Z",
      "updated_at": "2026-05-06T12:10:00.000Z",
      "finished_at": null,
      "taxiCategoryId": "uuid-category"
    },
    "drivers": [
      {
        "driverId": "uuid-driver",
        "distanceKm": 1.8
      }
    ],
    "promoApplied": true,
    "appliedPromo": {
      "code": "DISCOUNT20",
      "discount_percent": 20,
      "discount_amount": 4500
    }
  }
}
```

---

## 4.2 Barcha orderlar

```http
GET /orders/get-all-orders?language=uz&page=1&limit=10
Authorization: Bearer <token>
```

Query params:

- `language` required
- `page`
- `limit`
- `search`
- `driver_id`
- `user_id`
- `price_min`
- `price_max`
- `status`

Example:

```http
GET /orders/get-all-orders?language=uz&page=1&limit=10&status=completed&search=ali
```

Response `200`:

```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": "uuid-order",
      "user_id": "uuid-user",
      "driver_id": "uuid-driver",
      "start_lat": "41.299500",
      "start_lng": "69.240100",
      "end_lat": "41.311000",
      "end_lng": "69.279000",
      "distance_km": "4.20",
      "duration_min": "8.40",
      "price": "18000.00",
      "status": "completed",
      "created_at": "2026-05-02T12:00:00.000Z",
      "updated_at": "2026-05-02T12:30:00.000Z",
      "finished_at": "2026-05-02T12:30:00.000Z",
      "user": {
        "id": "uuid-user",
        "name_uz": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "name": "Ali Valiyev"
      },
      "driver": {
        "id": "uuid-driver",
        "car_model_uz": "Cobalt",
        "car_color_uz": "Oq",
        "car_number": "01A123BC",
        "user": {
          "id": "uuid-driver",
          "name_uz": "Jasur",
          "phone": "+998900000000",
          "name": "Jasur"
        },
        "car_model": "Cobalt",
        "car_color": "Oq"
      },
      "taxiCategory": {
        "id": "uuid-category",
        "name_uz": "Econom",
        "name": "Econom"
      },
      "payment": {
        "id": "uuid-payment",
        "order_id": "uuid-order",
        "amount": "18000.00",
        "method": "cash",
        "status": "pending"
      },
      "fare": null,
      "reviews": [],
      "driverLocations": [],
      "userLocations": [],
      "chats": [
        {
          "id": "uuid-chat",
          "type": "order",
          "order_id": "uuid-order",
          "participants": [],
          "messages": []
        }
      ]
    }
  ],
  "pagination": {
    "totalItems": 25,
    "totalPages": 3,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

---

## 4.3 Bitta order detail

```http
GET /orders/:id?language=uz
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "id": "uuid-order",
    "user_id": "uuid-user",
    "driver_id": "uuid-driver",
    "start_lat": "41.299500",
    "start_lng": "69.240100",
    "end_lat": "41.311000",
    "end_lng": "69.279000",
    "distance_km": "4.20",
    "duration_min": "8.40",
    "price": "18000.00",
    "status": "completed",
    "created_at": "2026-05-02T12:00:00.000Z",
    "updated_at": "2026-05-02T12:30:00.000Z",
    "finished_at": "2026-05-02T12:30:00.000Z",
    "user": {
      "id": "uuid-user",
      "name_uz": "Ali Valiyev",
      "phone": "+998901234567",
      "email": "ali@example.com",
      "name": "Ali Valiyev"
    },
    "driver": {
      "id": "uuid-driver",
      "car_model_uz": "Cobalt",
      "car_color_uz": "Oq",
      "car_number": "01A123BC",
      "user": {
        "id": "uuid-driver",
        "name_uz": "Jasur",
        "phone": "+998900000000",
        "name": "Jasur"
      },
      "car_model": "Cobalt",
      "car_color": "Oq"
    },
    "taxiCategory": {
      "id": "uuid-category",
      "name_uz": "Econom",
      "name": "Econom"
    },
    "payment": {
      "id": "uuid-payment",
      "order_id": "uuid-order",
      "amount": "18000.00",
      "method": "cash",
      "status": "pending"
    },
    "fare": null,
    "reviews": [
      {
        "id": "uuid-review",
        "rating": 5,
        "comment": "Yaxshi xizmat",
        "from_name": "Ali Valiyev",
        "to_name": "Jasur"
      }
    ],
    "driverLocations": [],
    "userLocations": [],
    "chats": [
      {
        "id": "uuid-chat",
        "type": "order",
        "order_id": "uuid-order",
        "participants": [],
        "messages": []
      }
    ]
  }
}
```

---

## 4.4 Driver biriktirish

```http
PATCH /orders/:id/assign-driver/:driverId
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "success": true,
  "message": "Haydovchi biriktirildi",
  "data": {
    "id": "uuid-order",
    "user_id": "uuid-user",
    "driver_id": "uuid-driver",
    "status": "accepted",
    "user": {
      "id": "uuid-user",
      "name_uz": "Ali Valiyev",
      "phone": "+998901234567"
    },
    "driver": {
      "id": "uuid-driver",
      "user": {
        "id": "uuid-driver",
        "name_uz": "Jasur",
        "phone": "+998900000000"
      }
    }
  }
}
```

---

## 4.5 Yaqin driverlar

```http
GET /orders/:id/nearby-drivers?radiusKm=5
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "driverId": "uuid-driver",
      "distanceKm": 1.8,
      "name": "Jasur",
      "phone": "+998900000000",
      "carModel": "Cobalt",
      "carNumber": "01A123BC",
      "rating": 4.8,
      "status": "online"
    }
  ]
}
```

---

## 4.6 Orderni yangilash

```http
PATCH /orders/:id
Content-Type: application/json
Authorization: Bearer <token>
```

Request example:

```json
{
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.315,
  "end_lng": 69.28
}
```

Response `200`:

```json
{
  "id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "start_lat": "41.299500",
  "start_lng": "69.240100",
  "end_lat": "41.315000",
  "end_lng": "69.280000",
  "status": "accepted",
  "updated_at": "2026-05-06T12:15:00.000Z"
}
```

---

## 5. Chat Monitoring

## 5.1 Barcha chatlar

```http
GET /chat/admin/list?language=uz&page=1&limit=20
Authorization: Bearer <token>
```

Optional query params:

- `type=support`
- `type=order`
- `search=ali`
- `user_id=uuid-user`
- `order_id=uuid-order`

Response `200`:

```json
{
  "chats": [
    {
      "id": "uuid-chat",
      "subject": "Qo'llab-quvvatlash",
      "type": "support",
      "order_id": null,
      "order_status": null,
      "created_at": "2026-05-05T09:00:00.000Z",
      "updated_at": "2026-05-05T09:05:00.000Z",
      "participants": [
        {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger",
          "joined_at": "2026-05-05T09:00:00.000Z"
        }
      ],
      "last_message": {
        "id": "uuid-message",
        "chat_id": "uuid-chat",
        "sender": {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger"
        },
        "message": "Assalomu alaykum",
        "message_type": "text",
        "is_read": false,
        "read_at": null,
        "created_at": "2026-05-05T09:05:00.000Z",
        "updated_at": "2026-05-05T09:05:00.000Z"
      },
      "other_user": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": null,
        "role": "passenger"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 5.2 Bitta chat detail

```http
GET /chat/admin/:chatId?language=uz
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "id": "uuid-chat",
  "subject": "Qo'llab-quvvatlash",
  "type": "support",
  "order_id": null,
  "order_status": null,
  "created_at": "2026-05-05T09:00:00.000Z",
  "updated_at": "2026-05-05T09:05:00.000Z",
  "participants": [
    {
      "id": "uuid-user",
      "name": "Ali Valiyev",
      "phone": "+998901234567",
      "email": "ali@example.com",
      "profile_photo": null,
      "role": "passenger",
      "joined_at": "2026-05-05T09:00:00.000Z"
    }
  ],
  "last_message": {
    "id": "uuid-message",
    "chat_id": "uuid-chat",
    "sender": {
      "id": "uuid-user",
      "name": "Ali Valiyev",
      "phone": "+998901234567",
      "email": "ali@example.com",
      "profile_photo": null,
      "role": "passenger"
    },
    "message": "Assalomu alaykum",
    "message_type": "text",
    "is_read": false,
    "read_at": null,
    "created_at": "2026-05-05T09:05:00.000Z",
    "updated_at": "2026-05-05T09:05:00.000Z"
  },
  "other_user": {
    "id": "uuid-user",
    "name": "Ali Valiyev",
    "phone": "+998901234567",
    "email": "ali@example.com",
    "profile_photo": null,
    "role": "passenger"
  }
}
```

---

## 5.3 Chat xabarlari

```http
GET /chat/admin/messages?chat_id=uuid-chat&language=uz&page=1&limit=50
Authorization: Bearer <token>
```

Response `200`:

```json
{
  "messages": [
    {
      "id": "uuid-message-2",
      "chat_id": "uuid-chat",
      "sender": {
        "id": "uuid-admin",
        "name": "Admin",
        "phone": "+998901234568",
        "email": "admin@example.com",
        "profile_photo": null,
        "role": "admin"
      },
      "message": "Salom, qanday yordam bera olaman?",
      "message_type": "text",
      "is_read": false,
      "read_at": null,
      "created_at": "2026-05-05T09:06:00.000Z",
      "updated_at": "2026-05-05T09:06:00.000Z"
    },
    {
      "id": "uuid-message-1",
      "chat_id": "uuid-chat",
      "sender": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": null,
        "role": "passenger"
      },
      "message": "Assalomu alaykum",
      "message_type": "text",
      "is_read": false,
      "read_at": null,
      "created_at": "2026-05-05T09:05:00.000Z",
      "updated_at": "2026-05-05T09:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## 5.4 Chatga javob yozish

```http
POST /chat/message/send
Content-Type: application/json
Authorization: Bearer <token>
```

Request body:

```json
{
  "chat_id": "uuid-chat",
  "message": "Salom, qanday yordam bera olaman?",
  "language": "uz"
}
```

Response `201/200`:

```json
{
  "id": "uuid-message-2",
  "chat_id": "uuid-chat",
  "sender": {
    "id": "uuid-admin",
    "name": "Admin",
    "phone": "+998901234568",
    "email": "admin@example.com",
    "profile_photo": null,
    "role": "admin"
  },
  "message": "Salom, qanday yordam bera olaman?",
  "message_type": "text",
  "is_read": false,
  "read_at": null,
  "created_at": "2026-05-05T09:06:00.000Z",
  "updated_at": "2026-05-05T09:06:00.000Z"
}
```

Muhim:

- `support` chatga admin/superadmin javob bera oladi.
- admin birinchi javob yuborganda support chat participantiga aylanishi mumkin.

---

## 5.5 User bo'yicha chatlar

```http
GET /chat/admin/list?language=uz&user_id=uuid-user&page=1&limit=20
```

Response:

```json
{
  "chats": [
    {
      "id": "uuid-chat",
      "subject": "Qo'llab-quvvatlash",
      "type": "support",
      "order_id": null,
      "order_status": null,
      "created_at": "2026-05-05T09:00:00.000Z",
      "updated_at": "2026-05-05T09:05:00.000Z",
      "participants": [
        {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger",
          "joined_at": "2026-05-05T09:00:00.000Z"
        }
      ],
      "last_message": null,
      "other_user": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": null,
        "role": "passenger"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 5.6 Order bo'yicha chatlar

```http
GET /chat/admin/list?language=uz&order_id=uuid-order&page=1&limit=20
```

Response:

```json
{
  "chats": [
    {
      "id": "uuid-order-chat",
      "subject": "Buyurtma chat",
      "type": "order",
      "order_id": "uuid-order",
      "order_status": "accepted",
      "created_at": "2026-05-05T10:00:00.000Z",
      "updated_at": "2026-05-05T10:03:00.000Z",
      "participants": [
        {
          "id": "uuid-user",
          "name": "Ali Valiyev",
          "phone": "+998901234567",
          "email": "ali@example.com",
          "profile_photo": null,
          "role": "passenger",
          "joined_at": "2026-05-05T10:00:00.000Z"
        },
        {
          "id": "uuid-driver",
          "name": "Jasur",
          "phone": "+998900000000",
          "email": "driver@example.com",
          "profile_photo": null,
          "role": "driver",
          "joined_at": "2026-05-05T10:00:00.000Z"
        }
      ],
      "last_message": {
        "id": "uuid-msg",
        "chat_id": "uuid-order-chat",
        "sender": {
          "id": "uuid-driver",
          "name": "Jasur",
          "phone": "+998900000000",
          "email": "driver@example.com",
          "profile_photo": null,
          "role": "driver"
        },
        "message": "5 daqiqada yetib boraman",
        "message_type": "text",
        "is_read": false,
        "read_at": null,
        "created_at": "2026-05-05T10:03:00.000Z",
        "updated_at": "2026-05-05T10:03:00.000Z"
      },
      "other_user": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "profile_photo": null,
        "role": "passenger"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 6. Socket Guide

Admin panel uchun initial data ni HTTP orqali olish tavsiya qilinadi.
Socket esa real-time update uchun ishlatiladi.

Namespace lar:

- Chat -> `/chat`
- Orders -> `/ws`
- Locations -> `/location`

Socket connect example:

```js
const chatSocket = io(`${BASE_URL}/chat`, {
  auth: {
    userId: "uuid-admin",
    deviceId: "admin-web",
    role: "admin"
  }
});

const orderSocket = io(`${BASE_URL}/ws`, {
  auth: {
    userId: "uuid-admin",
    role: "admin"
  }
});

const locationSocket = io(`${BASE_URL}/location`, {
  auth: {
    userId: "uuid-admin",
    role: "admin"
  }
});
```

---

## 6.1 Chat Socket - Admin Monitoring

Namespace:

```text
/chat
```

### Client -> Server

#### `admin:subscribe_chats`

Request:

```json
{
  "scope": "all"
}
```

Yoki:

```json
{
  "scope": "support"
}
```

Yoki:

```json
{
  "scope": "order"
}
```

Response event:

```json
{
  "success": true,
  "scope": "all"
}
```

#### `admin:join_chat`

Request:

```json
{
  "chat_id": "uuid-chat",
  "language": "uz"
}
```

Response event `admin:joined_chat`:

```json
{
  "success": true,
  "chat_id": "uuid-chat",
  "chat_info": {
    "id": "uuid-chat",
    "subject": "Qo'llab-quvvatlash",
    "type": "support",
    "order_id": null,
    "order_status": null,
    "participants": [
      {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567",
        "email": "ali@example.com",
        "role": "passenger"
      }
    ]
  }
}
```

#### `admin:leave_chat`

Request:

```json
{
  "chat_id": "uuid-chat"
}
```

Response event `admin:left_chat`:

```json
{
  "success": true,
  "chat_id": "uuid-chat"
}
```

### Server -> Client

#### `admin:chat:created`

Support chat yoki order chat yaratilganda keladi.

Payload:

```json
{
  "chat": {
    "id": "uuid-chat",
    "subject": "Qo'llab-quvvatlash",
    "type": "support",
    "order_id": null,
    "order_status": null,
    "created_at": "2026-05-06T12:20:00.000Z",
    "updated_at": "2026-05-06T12:20:00.000Z"
  },
  "trigger": "admin:chat:created",
  "order_id": null,
  "order_status": null,
  "type": "support"
}
```

#### `admin:chat:new_message`

Payload:

```json
{
  "chat": {
    "id": "uuid-chat",
    "subject": "Qo'llab-quvvatlash",
    "type": "support",
    "updated_at": "2026-05-06T12:21:00.000Z"
  },
  "trigger": "admin:chat:new_message",
  "id": "uuid-chat",
  "type": "support",
  "order_id": null,
  "order_status": null,
  "message": {
    "id": "uuid-message",
    "chat_id": "uuid-chat",
    "sender": {
      "id": "uuid-user",
      "name": "Ali Valiyev",
      "phone": "+998901234567",
      "email": "ali@example.com",
      "role": "passenger"
    },
    "message": "Salom",
    "message_type": "text",
    "is_read": false,
    "read_at": null,
    "created_at": "2026-05-06T12:21:00.000Z",
    "updated_at": "2026-05-06T12:21:00.000Z"
  }
}
```

#### `admin:chat:message_deleted`

Payload:

```json
{
  "chat": {
    "id": "uuid-chat",
    "subject": "Qo'llab-quvvatlash",
    "type": "support"
  },
  "trigger": "admin:chat:message_deleted",
  "id": "uuid-chat",
  "type": "support",
  "order_id": null,
  "order_status": null,
  "message_id": "uuid-message"
}
```

#### `admin:chat:messages_read`

Payload:

```json
{
  "chat": {
    "id": "uuid-chat",
    "subject": "Qo'llab-quvvatlash",
    "type": "support"
  },
  "trigger": "admin:chat:messages_read",
  "id": "uuid-chat",
  "type": "support",
  "order_id": null,
  "order_status": null,
  "read_by": "uuid-user",
  "timestamp": "2026-05-06T12:22:00.000Z"
}
```

#### `admin:chat:typing`

Payload:

```json
{
  "chat_id": "uuid-chat",
  "user_id": "uuid-user",
  "is_typing": true,
  "timestamp": "2026-05-06T12:22:10.000Z"
}
```

Frontend tavsiya:

- Chat list page -> `admin:subscribe_chats { scope: "all" }`
- Support inbox -> `admin:subscribe_chats { scope: "support" }`
- Order chat monitor -> `admin:subscribe_chats { scope: "order" }`
- Chat detail -> `admin:join_chat`

---

## 6.2 Orders Socket - Admin Monitoring

Namespace:

```text
/ws
```

### Client -> Server

#### `admin:register`

Request:

```json
{}
```

Response `admin:registered`:

```json
{
  "success": true,
  "room": "admin:orders"
}
```

#### `admin:subscribe_orders`

Barcha order eventlari uchun:

```json
{}
```

Bitta order detail uchun:

```json
{
  "orderId": "uuid-order"
}
```

Response `admin:orders_subscribed`:

```json
{
  "success": true,
  "order_id": "uuid-order"
}
```

#### `admin:unsubscribe_orders`

Request:

```json
{
  "orderId": "uuid-order"
}
```

Response `admin:orders_unsubscribed`:

```json
{
  "success": true,
  "order_id": "uuid-order"
}
```

### Server -> Client

#### `admin:order:created`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": null,
  "status": "pending",
  "price": 18000,
  "distance_km": 4.2,
  "duration_min": 8.4,
  "created_at": "2026-05-06T12:30:00.000Z",
  "promo_applied": true,
  "nearby_drivers_count": 5
}
```

#### `admin:order:assigned`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "status": "accepted",
  "price": 18000,
  "assigned_at": "2026-05-06T12:31:00.000Z"
}
```

#### `admin:order:accepted`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "status": "accepted",
  "accepted_at": "2026-05-06T12:31:10.000Z"
}
```

#### `admin:order:status_updated`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "status": "on_the_way",
  "updated_at": "2026-05-06T12:35:00.000Z"
}
```

#### `admin:order:updated`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "status": "accepted",
  "new_price": 22000,
  "promo_applied": false,
  "applied_promo": null,
  "updated_at": "2026-05-06T12:36:00.000Z"
}
```

#### `admin:order:completed`

Payload:

```json
{
  "order_id": "uuid-order",
  "user_id": "uuid-user",
  "driver_id": "uuid-driver",
  "status": "completed",
  "amount": 17100,
  "completed_at": "2026-05-06T12:45:00.000Z"
}
```

Frontend tavsiya:

- Orders list page -> `admin:register` yoki `admin:subscribe_orders`
- Order detail page -> `admin:subscribe_orders { orderId }`

---

## 6.3 Location Socket - Admin Order Tracking

Namespace:

```text
/location
```

### Client -> Server

#### `admin:subscribe`

Admin map uchun barcha driverlarni kuzatadi.

Request:

```json
{}
```

Response event `admin:all-drivers`:

```json
[
  {
    "type": "driver",
    "id": "uuid-driver",
    "lat": 41.2995,
    "lng": 69.2401,
    "speed": 30,
    "bearing": 120,
    "timestamp": "2026-05-06T12:40:00.000Z"
  }
]
```

#### `admin:get-all-drivers`

Request:

```json
{}
```

Response event:

```json
[
  {
    "type": "driver",
    "id": "uuid-driver",
    "lat": 41.2995,
    "lng": 69.2401,
    "speed": 30,
    "bearing": 120,
    "timestamp": "2026-05-06T12:40:00.000Z"
  }
]
```

#### `admin:join_order`

Bitta orderning live location roomiga kiradi.

Request:

```json
{
  "orderId": "uuid-order"
}
```

Response event `admin:joined_order`:

```json
{
  "success": true,
  "orderId": "uuid-order",
  "locations": {
    "driver": {
      "type": "driver",
      "id": "uuid-driver",
      "lat": 41.2995,
      "lng": 69.2401,
      "speed": 30,
      "bearing": 120,
      "timestamp": "2026-05-06T12:40:00.000Z"
    },
    "passenger": {
      "type": "passenger",
      "id": "uuid-user",
      "lat": 41.311,
      "lng": 69.279,
      "accuracy": 15,
      "timestamp": "2026-05-06T12:40:05.000Z"
    }
  }
}
```

#### `admin:leave_order`

Request:

```json
{
  "orderId": "uuid-order"
}
```

Response event `admin:left_order`:

```json
{
  "success": true,
  "orderId": "uuid-order"
}
```

### Server -> Client

Admin `order:<orderId>` roomga kirganidan keyin quyidagi eventlarni oladi:

- `driver:accepted`
- `location:driver-updated`
- `location:passenger-updated`
- `location:current`
- `order:finished`

`location:driver-updated` payload:

```json
{
  "type": "driver",
  "id": "uuid-driver",
  "lat": 41.2995,
  "lng": 69.2401,
  "speed": 32,
  "bearing": 90,
  "timestamp": "2026-05-06T12:41:00.000Z"
}
```

`location:passenger-updated` payload:

```json
{
  "type": "passenger",
  "id": "uuid-user",
  "lat": 41.311,
  "lng": 69.279,
  "accuracy": 10,
  "timestamp": "2026-05-06T12:41:05.000Z"
}
```

`admin:driver-updated` payload:

```json
{
  "type": "driver",
  "id": "uuid-driver",
  "lat": 41.2995,
  "lng": 69.2401,
  "speed": 32,
  "bearing": 90,
  "timestamp": "2026-05-06T12:41:00.000Z"
}
```

---

## 7. Admin Panel Page Mapping

## 7.1 Users page

Ishlatiladigan API:

- `GET /users`

## 7.2 User detail page

Ishlatiladigan API:

- `GET /users`
- `GET /cards?user_id=<id>`
- `GET /orders/get-all-orders?user_id=<id>`
- `GET /chat/admin/list?user_id=<id>`

## 7.3 Cards page

Ishlatiladigan API:

- `GET /cards`
- `DELETE /cards/admin/:id`

## 7.4 Orders page

Ishlatiladigan API:

- `GET /orders/get-all-orders`

Ishlatiladigan socket:

- `/ws` -> `admin:register`
- `/ws` -> `admin:order:created`
- `/ws` -> `admin:order:assigned`
- `/ws` -> `admin:order:accepted`
- `/ws` -> `admin:order:status_updated`
- `/ws` -> `admin:order:updated`
- `/ws` -> `admin:order:completed`

## 7.5 Order detail page

Ishlatiladigan API:

- `GET /orders/:id`
- `GET /orders/:id/nearby-drivers`
- `PATCH /orders/:id/assign-driver/:driverId`
- `PATCH /orders/:id`
- `GET /chat/admin/list?order_id=<id>`

Ishlatiladigan socket:

- `/ws` -> `admin:subscribe_orders { orderId }`
- `/location` -> `admin:join_order`
- `/location` -> `location:driver-updated`
- `/location` -> `location:passenger-updated`
- `/location` -> `order:finished`

## 7.6 Chat page

Ishlatiladigan API:

- `GET /chat/admin/list`
- `GET /chat/admin/:chatId`
- `GET /chat/admin/messages`
- `POST /chat/message/send`

Ishlatiladigan socket:

- `/chat` -> `admin:subscribe_chats`
- `/chat` -> `admin:join_chat`
- `/chat` -> `admin:chat:created`
- `/chat` -> `admin:chat:new_message`
- `/chat` -> `admin:chat:message_deleted`
- `/chat` -> `admin:chat:messages_read`
- `/chat` -> `admin:chat:typing`

---

## 8. Hozirgi Backend Cheklovlari

1. `GET /users/:id` hali yo'q.
2. `Cards` admin endpointlari hozir faqat `admin` uchun.
3. `Users` list docs/query misolida `superadmin` filter alohida ko'rsatilmagan.
4. `User Detail` sahifasi bitta endpoint bilan emas, bir nechta endpoint bilan yig'iladi.

---

## 9. Tavsiya Etiladigan Keyingi Backend Qo'shimchalar

Agar admin panelni yanada qulay qilmoqchi bo'lsangiz, keyin quyidagilarni qo'shish yaxshi bo'ladi:

1. `GET /users/:id`
2. `GET /users/:id/cards`
3. `GET /users/:id/orders`
4. `GET /users/:id/chats`
5. `GET /chat/admin/unread-summary`

Shunda frontend aggregatsiyasi ancha soddalashadi.
