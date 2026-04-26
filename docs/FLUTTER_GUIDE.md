# Flutter — Taxi App API Qo'llanma

## Kerakli Packagelar

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.2
```

```bash
flutter pub get
```

---

## 1. Papka strukturasi (tavsiya)

```
lib/
├── main.dart
├── core/
│   ├── api/
│   │   ├── api_client.dart        # Dio instance
│   │   ├── interceptors.dart      # Token refresh interceptor
│   │   └── endpoints.dart        # Barcha URL lar
│   └── storage/
│       └── token_storage.dart    # Token saqlash
├── features/
│   ├── auth/
│   │   ├── auth_service.dart
│   │   └── auth_model.dart
│   ├── orders/
│   │   ├── order_service.dart
│   │   └── order_model.dart
│   └── ...
```

---

## 2. Endpoints — Barcha URLlar

```dart
// lib/core/api/endpoints.dart

class Endpoints {
  static const String baseUrl = 'http://YOUR_SERVER_IP:3000';

  // Auth
  static const String sendOtp        = '/auth/send-otp';
  static const String verifyOtp      = '/auth/verify-otp';
  static const String register       = '/auth/register';
  static const String login          = '/auth/login';
  static const String refresh        = '/auth/refresh';
  static const String sendResetOtp   = '/auth/send-reset-otp';
  static const String verifyResetOtp = '/auth/verify-reset-otp';
  static const String resetPassword  = '/auth/reset-password';

  // User
  static const String me             = '/users/me';
  static const String updateMe       = '/users/me';

  // Driver
  static const String driverMe       = '/drivers/me';
  static const String updateDriverMe = '/drivers/me';

  // Orders
  static const String createOrder    = '/orders/create';
  static const String myOrders       = '/orders/my';
  static String orderById(String id) => '/orders/$id';
  static String updateOrderStatus(String id) => '/orders/update-status/$id';
  static String acceptOrder(String orderId, String driverId) =>
      '/orders/accept/$orderId/$driverId';
  static String completeOrder(String id) => '/orders/complete/$id';

  // Payments
  static const String myPayments     = '/payments/my';
  static String paymentByOrder(String orderId) => '/payments/order/$orderId';

  // Categories
  static const String categories     = '/taxi-categories';

  // Reviews
  static const String reviews        = '/reviews';
  static const String myReviews      = '/reviews/my';

  // Cards
  static const String cards          = '/cards';
  static const String myCards        = '/cards/my';
  static String setDefaultCard(String id) => '/cards/$id/default';
  static String deleteCard(String id)     => '/cards/$id';

  // Chat
  static const String createChat     = '/chat/create';
  static const String sendMessage    = '/chat/message/send';
  static const String chatMessages   = '/chat/messages';
  static const String myChats        = '/chat/list';

  // Location
  static const String saveDriverLocation    = '/api/location/save-driver-location';
  static const String savePassengerLocation = '/api/location/save-passenger-location';
  static String routeHistory(String orderId) => '/api/location/route-history/$orderId';
}
```

---

## 3. Token saqlash

```dart
// lib/core/storage/token_storage.dart

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const _storage = FlutterSecureStorage();
  static const _accessKey  = 'access_token';
  static const _refreshKey = 'refresh_token';

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

  static Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _accessKey),
      _storage.delete(key: _refreshKey),
    ]);
  }

  static Future<bool> hasTokens() async {
    final refresh = await _storage.read(key: _refreshKey);
    return refresh != null && refresh.isNotEmpty;
  }
}
```

---

## 4. Dio — Interceptor (Asosiy qism)

Bu interceptor har safar `401` xatosi kelganda avtomatik refresh qilib, so'rovni qayta yuboradi.

```dart
// lib/core/api/interceptors.dart

import 'package:dio/dio.dart';
import 'token_storage.dart';
import 'endpoints.dart';

class AuthInterceptor extends Interceptor {
  final Dio dio;

  AuthInterceptor(this.dio);

  // Har bir so'rovga token qo'shish
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
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
        // Yangi token bilan so'rovni qayta yuborish
        final newToken = await TokenStorage.getAccessToken();
        final opts = err.requestOptions;
        opts.headers['Authorization'] = 'Bearer $newToken';

        try {
          final response = await dio.fetch(opts);
          handler.resolve(response);
          return;
        } catch (e) {
          // Refresh ham ishlamasa — logout
          await TokenStorage.clearTokens();
        }
      } else {
        await TokenStorage.clearTokens();
      }
    }
    handler.next(err);
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      // Interceptorsiz yangi Dio bilan refresh (cheksiz loop oldini olish)
      final plainDio = Dio(BaseOptions(baseUrl: Endpoints.baseUrl));
      final res = await plainDio.post(
        Endpoints.refresh,
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

## 5. Dio Client

```dart
// lib/core/api/api_client.dart

import 'package:dio/dio.dart';
import 'endpoints.dart';
import 'interceptors.dart';

class ApiClient {
  static final Dio _dio = _createDio();

  static Dio get instance => _dio;

  static Dio _createDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: Endpoints.baseUrl,
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

## 6. Auth Service

```dart
// lib/features/auth/auth_service.dart

import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/storage/token_storage.dart';

class AuthService {
  final Dio _dio = ApiClient.instance;

  // 1. OTP yuborish
  Future<Map<String, dynamic>> sendOtp(String phone, String lang) async {
    final res = await _dio.post(Endpoints.sendOtp, data: {
      'phone': phone,
      'lang': lang,
    });
    return res.data;
  }

  // 2. OTP tasdiqlash
  Future<Map<String, dynamic>> verifyOtp(String phone, String otp) async {
    final res = await _dio.post(Endpoints.verifyOtp, data: {
      'phone': phone,
      'otp': otp,
    });
    return res.data;
  }

  // 3. Ro'yxatdan o'tish
  Future<Map<String, dynamic>> register({
    required String name,
    required String phone,
    required String password,
    required String lang,
    String? email,
  }) async {
    final res = await _dio.post(Endpoints.register, data: {
      'name': name,
      'phone': phone,
      'password': password,
      'lang': lang,
      if (email != null) 'email': email,
    });

    // Tokenlarni saqlash
    await TokenStorage.saveTokens(
      accessToken:  res.data['accessToken'],
      refreshToken: res.data['refreshToken'],
    );

    return res.data;
  }

  // 4. Login
  Future<Map<String, dynamic>> login(String phone, String password) async {
    final res = await _dio.post(Endpoints.login, data: {
      'phone': phone,
      'password': password,
    });

    // Tokenlarni saqlash
    await TokenStorage.saveTokens(
      accessToken:  res.data['accessToken'],
      refreshToken: res.data['refreshToken'],
    );

    return res.data;
  }

  // 5. Refresh token (ilova ochilganda chaqiriladi)
  Future<Map<String, dynamic>?> refreshToken() async {
    final refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null) return null;

    try {
      final res = await _dio.post(Endpoints.refresh, data: {
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

  // 6. Logout
  Future<void> logout() async {
    await TokenStorage.clearTokens();
  }

  // 7. Parolni tiklash
  Future<void> sendResetOtp(String phone, String lang) async {
    await _dio.post(Endpoints.sendResetOtp, data: {'phone': phone, 'lang': lang});
  }

  Future<void> verifyResetOtp(String phone, String otp) async {
    await _dio.post(Endpoints.verifyResetOtp, data: {'phone': phone, 'otp': otp});
  }

  Future<void> resetPassword(String phone, String newPassword) async {
    await _dio.post(Endpoints.resetPassword, data: {
      'phone': phone,
      'password': newPassword,
    });
  }
}
```

---

## 7. main.dart — Ilova ochilganda token tekshirish

```dart
// lib/main.dart

import 'package:flutter/material.dart';
import 'core/storage/token_storage.dart';
import 'features/auth/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: const SplashScreen(),
    );
  }
}

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
    // 1. Refresh token borligini tekshir
    final hasToken = await TokenStorage.hasTokens();

    if (!hasToken) {
      // Hech qanday token yo'q — Login sahifaga o'tish
      _goToLogin();
      return;
    }

    // 2. Refresh token bilan yangi access token olish
    final authService = AuthService();
    final result = await authService.refreshToken();

    if (result != null) {
      // Muvaffaqiyatli — Home sahifaga o'tish
      _goToHome(result['user']);
    } else {
      // Refresh ham ishlamadi — Login sahifaga o'tish
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

## 8. Order Service

```dart
// lib/features/orders/order_service.dart

import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';

class OrderService {
  final Dio _dio = ApiClient.instance;

  // Yangi order yaratish
  Future<Map<String, dynamic>> createOrder({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
    String? categoryId,
    String? promoCode,
    String paymentMethod = 'cash', // cash | card | payme | click
  }) async {
    final res = await _dio.post(Endpoints.createOrder, data: {
      'start_lat': startLat,
      'start_lng': startLng,
      'end_lat': endLat,
      'end_lng': endLng,
      if (categoryId != null) 'taxiCategoryId': categoryId,
      if (promoCode != null) 'promoCode': promoCode,
      'payment_method': paymentMethod,
    });
    return res.data;
  }

  // Mening orderlarim
  Future<List<dynamic>> getMyOrders() async {
    final res = await _dio.get(Endpoints.myOrders);
    return res.data['data'];
  }

  // Order statusini yangilash
  Future<void> updateStatus(String orderId, String status) async {
    await _dio.patch(
      Endpoints.updateOrderStatus(orderId),
      data: {'status': status},
    );
  }
}
```

---

## 9. User Service

```dart
// lib/features/user/user_service.dart

import 'package:dio/dio.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';

class UserService {
  final Dio _dio = ApiClient.instance;

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get(Endpoints.me);
    return res.data;
  }

  Future<Map<String, dynamic>> updateMe({
    String? name,
    String? phone,
    String? email,
    String? language,
  }) async {
    final res = await _dio.put(Endpoints.updateMe, data: {
      if (name     != null) 'name': name,
      if (phone    != null) 'phone': phone,
      if (email    != null) 'email': email,
      if (language != null) 'language': language,
    });
    return res.data;
  }
}
```

---

## 10. Xato (Error) handling

```dart
// lib/core/api/api_error.dart

import 'package:dio/dio.dart';

String handleError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;

    if (data is Map && data.containsKey('message')) {
      final msg = data['message'];
      if (msg is List) return msg.join(', ');
      return msg.toString();
    }

    switch (error.response?.statusCode) {
      case 400: return 'So\'rov noto\'g\'ri';
      case 401: return 'Kirish muddati tugagan, qayta login qiling';
      case 403: return 'Ruxsat yo\'q';
      case 404: return 'Topilmadi';
      case 409: return 'Allaqachon mavjud';
      case 500: return 'Server xatosi';
    }
  }
  return 'Noma\'lum xato';
}
```

---

## 11. To'liq Auth oqimi (Flow)

```
ILOVA BIRINCHI MARTA OCHILGANDA:
─────────────────────────────────
1. send-otp    → telefon yuboriladi, SMS keladi
2. verify-otp  → OTP tasdiqlash
3. register    → ism, parol kiritiladi
                 → accessToken + refreshToken saqlansa

KEYINGI OCHILISHLARDA:
─────────────────────────────────
1. SplashScreen ochiladi
2. refresh_token borligini tekshir
3. POST /auth/refresh → yangi accessToken + refreshToken
4. Home sahifaga o'tish

ACCESS TOKEN MUDDATI TUGASA (401):
─────────────────────────────────
Interceptor avtomatik:
1. refresh_token bilan POST /auth/refresh
2. Yangi accessToken saqlash
3. Asl so'rovni qayta yuborish
4. Agar refresh ham xato bo'lsa → Login sahifaga

LOGOUT:
─────────────────────────────────
TokenStorage.clearTokens() → Login sahifaga
```

---

## 12. WebSocket (Real-time orderlar)

```dart
// pubspec.yaml ga qo'shing:
// socket_io_client: ^2.0.3+1

import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/storage/token_storage.dart';

class SocketService {
  static IO.Socket? _socket;

  static Future<void> connect(String userId) async {
    _socket = IO.io(
      'http://YOUR_SERVER_IP:3000/ws',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setExtraHeaders({})
          .build(),
    );

    _socket!.onConnect((_) {
      // O'zini ro'yxatdan o'tkazish
      _socket!.emit('register', {'userId': userId});
    });

    // Order so'rovi kelganda (haydovchi uchun)
    _socket!.on('order:request', (data) {
      print('Yangi order: $data');
    });

    // Order status o'zgarganda
    _socket!.on('order:status_updated', (data) {
      print('Status: ${data['status']}');
    });

    // Order yakunlanganda
    _socket!.on('order:completed', (data) {
      print('Yakunlandi, maosh: ${data['amount']}');
    });
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
```

---

## 13. Real-time Joylashuv (Xarita)

### Kerakli packagelar

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
  geolocator: ^12.0.0
  flutter_map: ^7.0.0          # yoki google_maps_flutter
  latlong2: ^0.9.0
```

---

### 13.1 Location WebSocket Service

```dart
// lib/features/location/location_socket_service.dart

import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../core/api/endpoints.dart';

class LocationSocketService {
  static IO.Socket? _socket;

  // Ulanish — /location namespace
  static void connect() {
    _socket = IO.io(
      '${Endpoints.baseUrl}/location',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      print('Location socket ulandi');
    });

    _socket!.onDisconnect((_) {
      print('Location socket uzildi');
    });
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  // ── HAYDOVCHI uchun ─────────────────────────────────────────────────────

  // 1. Haydovchi order roomga qo'shiladi (order qabul qilinganda chaqiriladi)
  static void driverRegister(String driverId, String orderId) {
    _socket?.emit('driver:register', {
      'driverId': driverId,
      'orderId': orderId,
    });
  }

  // 2. Haydovchi joylashuvini yuboradi (har 2-3 sek)
  static void sendDriverLocation({
    required String driverId,
    required String orderId,
    required double lat,
    required double lng,
    double speed = 0,
    double bearing = 0,
  }) {
    _socket?.emit('location:driver-update', {
      'driverId': driverId,
      'orderId': orderId,
      'lat': lat,
      'lng': lng,
      'speed': speed,
      'bearing': bearing,
    });
  }

  // ── YO'LOVCHI uchun ──────────────────────────────────────────────────────

  // 1. Yo'lovchi order roomga qo'shiladi (order yaratilganda chaqiriladi)
  static void passengerRegister(String userId, String orderId) {
    _socket?.emit('passenger:register', {
      'userId': userId,
      'orderId': orderId,
    });
  }

  // 2. Yo'lovchi joylashuvini yuboradi (har 10-15 sek)
  static void sendPassengerLocation({
    required String userId,
    required String orderId,
    required double lat,
    required double lng,
    double accuracy = 0,
  }) {
    _socket?.emit('location:passenger-update', {
      'userId': userId,
      'orderId': orderId,
      'lat': lat,
      'lng': lng,
      'accuracy': accuracy,
    });
  }

  // ── LISTEN (Xaritani yangilash uchun) ────────────────────────────────────

  // Haydovchi joylashuvini tinglash (yo'lovchi ekranida)
  static void onDriverLocationUpdated(void Function(Map<String, dynamic>) callback) {
    _socket?.on('location:driver-updated', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // Yo'lovchi joylashuvini tinglash (haydovchi ekranida)
  static void onPassengerLocationUpdated(void Function(Map<String, dynamic>) callback) {
    _socket?.on('location:passenger-updated', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // Ulanib kelganda oxirgi pozitsiyalarni olish
  static void requestCurrentLocations(String orderId) {
    _socket?.emit('location:get-current', {'orderId': orderId});
  }

  static void onCurrentLocations(void Function(Map<String, dynamic>) callback) {
    _socket?.on('location:current', (data) {
      callback(Map<String, dynamic>.from(data));
    });
  }

  // Order yakunlanganda
  static void finishOrder(String orderId) {
    _socket?.emit('order:finished', {'orderId': orderId});
  }

  static void onOrderFinished(void Function() callback) {
    _socket?.on('order:finished', (_) => callback());
  }

  // Yaqin haydovchilarni topish (order yaratishdan oldin)
  static void getNearbyDrivers({
    required double lat,
    required double lng,
    double radiusKm = 3,
  }) {
    _socket?.emit('location:nearby-drivers', {
      'lat': lat,
      'lng': lng,
      'radiusKm': radiusKm,
    });
  }

  static void onNearbyDrivers(void Function(List<dynamic>) callback) {
    _socket?.on('location:nearby-drivers', (data) {
      callback(List<dynamic>.from(data));
    });
  }
}
```

---

### 13.2 GPS olish (Geolocator)

```dart
// lib/features/location/gps_service.dart

import 'package:geolocator/geolocator.dart';

class GpsService {
  static Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return false;
    }
    if (permission == LocationPermission.deniedForever) return false;
    return true;
  }

  static Future<Position> getCurrentPosition() async {
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
      ),
    );
  }

  // Haydovchi uchun — har 2 sek yangi joylashuv
  static Stream<Position> driverLocationStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5, // 5 metr harakatda yangilash
      ),
    );
  }

  // Yo'lovchi uchun — har 10 sek yangi joylashuv
  static Stream<Position> passengerLocationStream() {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        distanceFilter: 20,
      ),
    );
  }
}
```

---

### 13.3 Haydovchi ekrani — joylashuvni yuborish

```dart
// lib/features/driver/driver_map_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../location/gps_service.dart';
import '../location/location_socket_service.dart';

class DriverMapScreen extends StatefulWidget {
  final String driverId;
  final String orderId;

  const DriverMapScreen({
    super.key,
    required this.driverId,
    required this.orderId,
  });

  @override
  State<DriverMapScreen> createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen> {
  StreamSubscription<Position>? _locationSub;

  @override
  void initState() {
    super.initState();
    _startTracking();
  }

  Future<void> _startTracking() async {
    final hasPermission = await GpsService.requestPermission();
    if (!hasPermission) return;

    // 1. Socket ulanish
    LocationSocketService.connect();

    // 2. Order roomga qo'shilish
    LocationSocketService.driverRegister(widget.driverId, widget.orderId);

    // 3. GPS stream — har 2-5 sek
    _locationSub = GpsService.driverLocationStream().listen((position) {
      // Socket orqali yuborish
      LocationSocketService.sendDriverLocation(
        driverId: widget.driverId,
        orderId: widget.orderId,
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        bearing: position.heading,
      );
    });

    // 4. Yo'lovchi joylashuvini tinglash (xaritada ko'rsatish uchun)
    LocationSocketService.onPassengerLocationUpdated((data) {
      final lat = data['lat'] as double;
      final lng = data['lng'] as double;
      // xaritada yo'lovchi markerini yangilash
      setState(() {
        // _passengerLatLng = LatLng(lat, lng);
      });
    });
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    LocationSocketService.finishOrder(widget.orderId);
    LocationSocketService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('Xarita shu yerda')),
      // flutter_map yoki google_maps_flutter ishlatiladi
    );
  }
}
```

---

### 13.4 Yo'lovchi ekrani — haydovchini kuzatish

```dart
// lib/features/passenger/passenger_map_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../location/gps_service.dart';
import '../location/location_socket_service.dart';

class PassengerMapScreen extends StatefulWidget {
  final String userId;
  final String orderId;

  const PassengerMapScreen({
    super.key,
    required this.userId,
    required this.orderId,
  });

  @override
  State<PassengerMapScreen> createState() => _PassengerMapScreenState();
}

class _PassengerMapScreenState extends State<PassengerMapScreen> {
  StreamSubscription<Position>? _locationSub;
  double? _driverLat;
  double? _driverLng;
  double? _driverBearing;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final hasPermission = await GpsService.requestPermission();
    if (!hasPermission) return;

    LocationSocketService.connect();

    // 1. Order roomga qo'shilish
    LocationSocketService.passengerRegister(widget.userId, widget.orderId);

    // 2. Ulanib kelganda oxirgi joylashuvlarni olish
    LocationSocketService.requestCurrentLocations(widget.orderId);
    LocationSocketService.onCurrentLocations((data) {
      final driver = data['driver'];
      if (driver != null) {
        setState(() {
          _driverLat = (driver['lat'] as num).toDouble();
          _driverLng = (driver['lng'] as num).toDouble();
        });
      }
    });

    // 3. Haydovchi joylashuvini real-time tinglash
    LocationSocketService.onDriverLocationUpdated((data) {
      setState(() {
        _driverLat = (data['lat'] as num).toDouble();
        _driverLng = (data['lng'] as num).toDouble();
        _driverBearing = data['bearing'] != null
            ? (data['bearing'] as num).toDouble()
            : null;
      });
      // Xaritadagi haydovchi markerini yangilash
    });

    // 4. O'z joylashuvini har 10-15 sek yuborish
    _locationSub = GpsService.passengerLocationStream().listen((position) {
      LocationSocketService.sendPassengerLocation(
        userId: widget.userId,
        orderId: widget.orderId,
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
      );
    });

    // 5. Order yakunlanishini tinglash
    LocationSocketService.onOrderFinished(() {
      Navigator.of(context).pushReplacementNamed('/order-complete');
    });
  }

  @override
  void dispose() {
    _locationSub?.cancel();
    LocationSocketService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Xarita widget shu yerga
          const Center(child: Text('Xarita')),

          if (_driverLat != null)
            Positioned(
              bottom: 20,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.all(12),
                color: Colors.white,
                child: Text(
                  'Haydovchi: $_driverLat, $_driverLng',
                  style: const TextStyle(fontSize: 14),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
```

---

### 13.5 Real-time oqim diagrammasi

```
YO'LOVCHI EKRANI                    SERVER                    HAYDOVCHI EKRANI
─────────────────                 ──────────                  ─────────────────
passenger:register  ──────────►  /location room
                                  order:{id}
driver:register     ◄──────────────────────────────────────  driver:register

GPS (har 10 sek)
location:passenger-update ──►   order:{id} room  ──►  location:passenger-updated
                                                        (haydovchi xaritasida)

                                 order:{id} room  ◄──  location:driver-update
location:driver-updated  ◄──                           (GPS har 2-3 sek)
(yo'lovchi xaritasida)

order:finished  ──────────────► room tozalanadi ◄───── order:finished
```

---

### 13.6 WebSocket events jadvali

| Event (emit) | Kim yuboradi | Ma'lumot |
|---|---|---|
| `driver:register` | Haydovchi | `{ driverId, orderId }` |
| `passenger:register` | Yo'lovchi | `{ userId, orderId }` |
| `location:driver-update` | Haydovchi | `{ driverId, orderId, lat, lng, speed, bearing }` |
| `location:passenger-update` | Yo'lovchi | `{ userId, orderId, lat, lng, accuracy }` |
| `location:get-current` | Har ikki tomon | `{ orderId }` |
| `location:nearby-drivers` | Yo'lovchi | `{ lat, lng, radiusKm }` |
| `order:finished` | Har ikki tomon | `{ orderId }` |

| Event (listen) | Kim oladi | Ma'lumot |
|---|---|---|
| `location:driver-updated` | Yo'lovchi | `{ type, id, lat, lng, speed, bearing, timestamp }` |
| `location:passenger-updated` | Haydovchi | `{ type, id, lat, lng, accuracy, timestamp }` |
| `location:current` | Yangi ulanganlar | `{ driver: {...}, passenger: {...} }` |
| `location:nearby-drivers` | Yo'lovchi | `[{ driverId, distanceKm }]` |
| `driver:accepted` | Yo'lovchi | `{ driverId, message }` |
| `order:finished` | Har ikki tomon | `{ message }` |

---

## Eslatmalar

| Masala | Yechim |
|--------|--------|
| `http://` ishlamaydi | `AndroidManifest.xml` ga `android:usesCleartextTraffic="true"` qo'shing yoki HTTPS ishlating |
| iOS simulator server ko'rmaydi | `localhost` o'rniga kompyuterning IP manzilini yozing |
| Token saqlash | `flutter_secure_storage` ishlatiladi — xavfsiz (Keychain/Keystore) |
| Rasm yuklash | `FormData` va `MultipartFile` ishlatiladi |
| Rasm ko'rsatish | `Image.network('http://IP:3000/uploads/FILENAME')` |
| Location permission Android | `AndroidManifest.xml` ga `ACCESS_FINE_LOCATION` qo'shing |
| Location permission iOS | `Info.plist` ga `NSLocationWhenInUseUsageDescription` qo'shing |
