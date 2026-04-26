# Flutter Refresh Token Guide

Foydalanuvchi bir marta login qilib, ilovani yopib-ochganda qayta login so'ralmaydi.
Bu refresh token orqali amalga oshiriladi.

---

## 1. Qanday ishlaydi

```
LOGIN / REGISTER
    |
    └─> Backend: accessToken (15 daqiqa) + refreshToken (30 kun) qaytaradi
    └─> Flutter: ikkalasini xavfsiz saqlaydi (flutter_secure_storage)

ILOVA YOPILADI / OCHILADI
    |
    └─> SplashScreen: refreshToken bor-yo'qligini tekshiradi
    └─> POST /auth/refresh → yangi accessToken + yangi refreshToken
    └─> Home sahifaga o'tish (login so'ralmaydi)

SO'ROV 401 XATOSI BERSA (accessToken eskirgan)
    |
    └─> Interceptor avtomatik POST /auth/refresh chaqiradi
    └─> Yangi tokenlar saqlanadi
    └─> So'rov qayta yuboriladi (foydalanuvchi hech narsa sezmaydi)

REFRESH TOKEN HAM ESKIRSA (30 kun o'tgan)
    |
    └─> Tokenlar o'chiriladi
    └─> Login sahifaga yo'naltiriladi
```

---

## 2. HTTP API

### POST `/auth/refresh`

**Headers:**
```
Content-Type: application/json
```

**Request body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `201` — muvaffaqiyatli:**
```json
{
  "success": true,
  "user": {
    "id": "uuid-user-id",
    "phone": "+998901234567",
    "role": "passenger",
    "name_uz": "Ali Valiyev",
    "name_ru": null,
    "name_en": null,
    "email": null,
    "profile_photo": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-04-26T10:00:00.000Z",
    "wallet": {
      "balance": "150000"
    },
    "cards": []
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response `401` — refresh token eskirgan yoki noto'g'ri:**
```json
{
  "statusCode": 401,
  "message": "Refresh token yaroqsiz yoki muddati tugagan"
}
```

> Har safar yangi `refreshToken` ham qaytariladi — uni ham saqlab qo'ying (token rotation).

---

## 3. pubspec.yaml

```yaml
dependencies:
  flutter_secure_storage: ^9.0.0
  dio: ^5.4.0
```

---

## 4. TokenStorage

Tokenlarni qurilmada xavfsiz saqlash.

```dart
// lib/core/storage/token_storage.dart

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _storage   = FlutterSecureStorage();
  static const _accessKey = 'access_token';
  static const _refreshKey = 'refresh_token';

  // Saqlash (login / register / refresh dan keyin)
  static Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _accessKey,  value: accessToken),
      _storage.write(key: _refreshKey, value: refreshToken),
    ]);
  }

  static Future<String?> getAccessToken()  => _storage.read(key: _accessKey);
  static Future<String?> getRefreshToken() => _storage.read(key: _refreshKey);

  // Logout yoki token yaroqsiz bo'lganda
  static Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _accessKey),
      _storage.delete(key: _refreshKey),
    ]);
  }

  // Ilova ochilganda: foydalanuvchi session bor-yo'qligini tekshirish
  static Future<bool> hasTokens() async {
    final refresh = await _storage.read(key: _refreshKey);
    return refresh != null && refresh.isNotEmpty;
  }
}
```

---

## 5. Dio Interceptor (avtomatik refresh)

Har qanday so'rov `401` qaytarsa — interceptor avtomatik refresh qilib, so'rovni qayta yuboradi.
Foydalanuvchi hech narsa sezmaydi.

```dart
// lib/core/api/interceptors.dart

import 'package:dio/dio.dart';
import 'token_storage.dart';

class AuthInterceptor extends Interceptor {
  final Dio dio;

  AuthInterceptor(this.dio);

  // Har bir so'rovga Authorization header qo'shish
  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await TokenStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  // 401 kelsa — refresh qilib qayta urinish
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      final refreshed = await _tryRefresh();

      if (refreshed) {
        // Yangi access token bilan so'rovni qayta yuborish
        final newToken = await TokenStorage.getAccessToken();
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newToken';

        try {
          final response = await dio.fetch(opts);
          handler.resolve(response);
          return;
        } catch (_) {
          await TokenStorage.clearTokens();
        }
      } else {
        // Refresh ham ishlamadi — tokenlarni o'chirib, login ga yo'naltirish
        await TokenStorage.clearTokens();
      }
    }

    handler.next(err);
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // MUHIM: Asosiy dio emas, yangi Dio ishlatiladi
      // Aks holda interceptor o'zini cheksiz chaqiradi (infinite loop)
      final plainDio = Dio(
        BaseOptions(baseUrl: 'http://YOUR_SERVER_IP:3000'),
      );

      final res = await plainDio.post(
        '/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      if (res.statusCode == 201 && res.data['success'] == true) {
        await TokenStorage.saveTokens(
          accessToken:  res.data['accessToken'],
          refreshToken: res.data['refreshToken'],
        );
        return true;
      }
    } catch (_) {}

    return false;
  }
}
```

---

## 6. ApiClient

```dart
// lib/core/api/api_client.dart

import 'package:dio/dio.dart';
import 'interceptors.dart';

class ApiClient {
  static final Dio _dio = _createDio();

  static Dio get instance => _dio;

  static Dio _createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: 'http://YOUR_SERVER_IP:3000',
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(AuthInterceptor(dio));

    return dio;
  }
}
```

---

## 7. AuthService

```dart
// lib/features/auth/auth_service.dart

import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/storage/token_storage.dart';

class AuthService {
  final Dio _dio = ApiClient.instance;

  // Login
  Future<Map<String, dynamic>> login(String phone, String password) async {
    final res = await _dio.post('/auth/login', data: {
      'phone': phone,
      'password': password,
    });

    await TokenStorage.saveTokens(
      accessToken:  res.data['accessToken'],
      refreshToken: res.data['refreshToken'],
    );

    return res.data;
  }

  // Register
  Future<Map<String, dynamic>> register({
    required String name,
    required String phone,
    required String password,
    required String lang,
  }) async {
    final res = await _dio.post('/auth/register', data: {
      'name': name,
      'phone': phone,
      'password': password,
      'lang': lang,
    });

    await TokenStorage.saveTokens(
      accessToken:  res.data['accessToken'],
      refreshToken: res.data['refreshToken'],
    );

    return res.data;
  }

  // Ilova ochilganda chaqiriladi — yangi accessToken olish
  Future<Map<String, dynamic>?> refreshToken() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final res = await _dio.post('/auth/refresh', data: {
        'refresh_token': refreshToken,
      });

      await TokenStorage.saveTokens(
        accessToken:  res.data['accessToken'],
        refreshToken: res.data['refreshToken'],
      );

      return res.data;
    } catch (_) {
      await TokenStorage.clearTokens();
      return null;
    }
  }

  // Logout
  Future<void> logout() async {
    await TokenStorage.clearTokens();
  }
}
```

---

## 8. SplashScreen — Ilova ochilganda

```dart
// lib/screens/splash_screen.dart

import 'package:flutter/material.dart';
import '../../core/storage/token_storage.dart';
import '../auth/auth_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    // 1. Qurilmada refresh token bormi?
    final hasToken = await TokenStorage.hasTokens();

    if (!hasToken) {
      _goToLogin();
      return;
    }

    // 2. Refresh token bilan yangi access token olish
    final result = await AuthService().refreshToken();

    if (result != null) {
      // Muvaffaqiyatli — foydalanuvchi ma'lumotlari bilan Home ga o'tish
      _goToHome(result['user']);
    } else {
      // Refresh eskirgan — qayta login kerak
      _goToLogin();
    }
  }

  void _goToHome(Map<String, dynamic> user) {
    Navigator.of(context).pushReplacementNamed('/home', arguments: user);
  }

  void _goToLogin() {
    Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
```

---

## 9. main.dart

```dart
// lib/main.dart

import 'package:flutter/material.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      initialRoute: '/',
      routes: {
        '/':      (_) => const SplashScreen(),
        '/login': (_) => const LoginScreen(),
        '/home':  (_) => const HomeScreen(),
      },
    );
  }
}
```

---

## 10. To'liq oqim

```
BIRINCHI MARTA:
──────────────────────────────────────────────
  send-otp  → verify-otp → register / login
      └─> accessToken + refreshToken → TokenStorage ga saqlanadi
      └─> HomeScreen

KEYINGI SAFAR ILOVA OCHILGANDA:
──────────────────────────────────────────────
  SplashScreen
      └─> TokenStorage.hasTokens() → true
      └─> POST /auth/refresh { refresh_token }
              ├─> 201 OK → yangi accessToken + refreshToken saqlanadi
              │       └─> HomeScreen (login so'ralmaydi)
              └─> 401   → TokenStorage.clearTokens()
                              └─> LoginScreen

SO'ROV 401 QAYTARSA (accessToken eskirgan):
──────────────────────────────────────────────
  API so'rov → 401
      └─> AuthInterceptor._tryRefresh()
              ├─> POST /auth/refresh (alohida plainDio bilan)
              │       └─> OK → yangi tokenlar saqlanadi
              │               └─> So'rov qayta yuboriladi (foydalanuvchi sezmasdi)
              └─> Fail → TokenStorage.clearTokens()
                              └─> LoginScreen
```

---

## 11. Muhim qoidalar

| Qoida | Sabab |
|---|---|
| `_tryRefresh` da yangi `Dio` ishlatish | Asosiy Dio interceptori o'zini cheksiz chaqirib yuboradi |
| Har refresh da `refreshToken` ni ham saqlash | Backend har safar yangi refresh token qaytaradi (rotation) |
| `hasTokens()` faqat `refreshToken` ni tekshiradi | `accessToken` qisqa muddatli, yo'q bo'lishi normal |
| Refresh muvaffaqiyatsiz bo'lsa tokenlarni o'chirish | Eskirgan token bilan loop bo'lmasligi uchun |
