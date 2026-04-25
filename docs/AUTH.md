# Auth API

Bu hujjat `Auth` bo'limidagi barcha endpointlar, request/response namunalari va ishlash ketma-ketligini tushuntiradi.

## Asosiy qoida

- OTP Eskiz orqali yuboriladi.
- OTP amal qilish vaqti: `120 soniya`.
- Bir marta OTP yuborilgandan keyin shu raqamga qayta yuborish uchun `60 soniya` kutish kerak.
- Register uchun OTP va reset password uchun OTP alohida oqimda ishlaydi.
- Login faqat `phone + password` bilan ishlaydi.
- Reset password qilishda eski parol kiritish shart emas.

## Auth Flow

### 1. Ro'yxatdan o'tish

1. `POST /auth/send-otp`
2. `POST /auth/verify-otp`
3. `POST /auth/register`
4. `POST /auth/login`

### 2. Parolni tiklash

1. `POST /auth/send-reset-otp`
2. `POST /auth/verify-reset-otp`
3. `POST /auth/reset-password`
4. `POST /auth/login`

## 1. Send Register OTP

`POST /auth/send-otp`

Request:

```json
{
  "phone": "+998901234567",
  "lang": "uz"
}
```

Response:

```json
{
  "message": "OTP yuborildi",
  "phone": "+998901234567",
  "provider": "eskiz",
  "expires_in_seconds": 120,
  "resend_after_seconds": 60
}
```

SMS matni:

```text
"PROHOME" platformasida ro'yxatdan o'tish uchun kod: 123456
```

## 2. Verify Register OTP

`POST /auth/verify-otp`

Request:

```json
{
  "phone": "+998901234567",
  "otp": "123456"
}
```

Response:

```json
{
  "success": true,
  "phone": "+998901234567",
  "message": "Telefon raqami tasdiqlandi"
}
```

## 3. Register

`POST /auth/register`

Request:

```json
{
  "lang": "uz",
  "name": "Otabek",
  "phone": "+998901234567",
  "password": "strongPassword123",
  "email": "user@example.com"
}
```

Response:

```json
{
  "user": {
    "id": "user-uuid",
    "phone": "+998901234567",
    "email": "user@example.com",
    "role": "passenger",
    "name_uz": "Otabek",
    "created_at": "2026-04-25T17:00:00.000Z",
    "updated_at": "2026-04-25T17:00:00.000Z"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

Eslatma:

- `register` ishlashi uchun oldin `verify-otp` bo'lishi shart.
- Parol baza ichida `hash` holatda saqlanadi.

## 4. Login

`POST /auth/login`

Request:

```json
{
  "phone": "+998901234567",
  "password": "strongPassword123"
}
```

Response:

```json
{
  "user": {
    "id": "user-uuid",
    "phone": "+998901234567",
    "email": "user@example.com",
    "role": "passenger",
    "wallet": {
      "balance": "0",
      "created_at": "2026-04-25T17:00:00.000Z",
      "updated_at": "2026-04-25T17:00:00.000Z"
    },
    "cards": []
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

## 5. Send Reset OTP

`POST /auth/send-reset-otp`

Request:

```json
{
  "phone": "+998901234567",
  "lang": "uz"
}
```

Response:

```json
{
  "success": true,
  "phone": "+998901234567",
  "provider": "eskiz",
  "message": "Parolni tiklash OTP yuborildi",
  "expires_in_seconds": 120,
  "resend_after_seconds": 60
}
```

SMS matni:

```text
"PROHOME" platformasi: parolni tiklash uchun tasdiqlash kodi 123456. Kodni hech kimga bermang.
```

## 6. Verify Reset OTP

`POST /auth/verify-reset-otp`

Request:

```json
{
  "phone": "+998901234567",
  "otp": "123456"
}
```

Response:

```json
{
  "success": true,
  "phone": "+998901234567",
  "message": "Parolni tiklash uchun telefon tasdiqlandi"
}
```

## 7. Reset Password

`POST /auth/reset-password`

Request:

```json
{
  "phone": "+998901234567",
  "password": "newStrongPassword123"
}
```

Response:

```json
{
  "success": true,
  "phone": "+998901234567",
  "message": "Parol muvaffaqiyatli yangilandi"
}
```

Eslatma:

- `reset-password` ishlashi uchun oldin `verify-reset-otp` bo'lishi shart.
- Eski parol kiritish talab qilinmaydi.

## Xatolar

### OTP qayta yuborishdan oldin

Response:

```json
{
  "statusCode": 400,
  "message": "OTP yuborilgan. Qayta yuborish uchun 1 daqiqa kuting",
  "error": "Bad Request"
}
```

### OTP noto'g'ri bo'lsa

Response:

```json
{
  "statusCode": 400,
  "message": "OTP noto'g'ri",
  "error": "Bad Request"
}
```

### OTP vaqti tugasa

Response:

```json
{
  "statusCode": 404,
  "message": "OTP topilmadi yoki muddati tugagan",
  "error": "Not Found"
}
```

### User topilmasa

Response:

```json
{
  "statusCode": 404,
  "message": "Foydalanuvchi topilmadi",
  "error": "Not Found"
}
```

## Swagger

Server ishga tushgandan keyin Swagger:

```text
http://localhost:3000/api/docs
```

Swagger basic auth:

```text
username: yulla
password: yulla
```
