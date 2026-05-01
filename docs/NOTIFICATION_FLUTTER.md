# Taxi App — Push Notification Flutter Integratsiyasi

---

## 1. Paketlarni qo'shish

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^3.x.x
  firebase_messaging: ^15.x.x
  flutter_local_notifications: ^17.x.x
  http: ^1.x.x
  shared_preferences: ^2.x.x
```

```bash
flutter pub get
```

---

## 2. Firebase loyihasini sozlash

### Android
`android/app/` ichiga `google-services.json` faylini qo'ying.

```gradle
// android/build.gradle
dependencies {
  classpath 'com.google.gms:google-services:4.4.0'
}

// android/app/build.gradle
apply plugin: 'com.google.gms.google-services'
```

### iOS
`ios/Runner/` ichiga `GoogleService-Info.plist` faylini qo'ying.

---

## 3. AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<application>
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="taxi_channel"/>
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@mipmap/ic_launcher"/>
</application>
```

---

## 4. main.dart

```dart
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}
```

---

## 5. FCM Service

```dart
// lib/services/fcm_service.dart

import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  // App yopiq paytda kelgan xabarlar
  print('Background message: ${message.messageId}');
}

class FcmService {
  static final _messaging = FirebaseMessaging.instance;
  static final _localNotif = FlutterLocalNotificationsPlugin();

  static Future<void> init({
    required String accessToken,
    required String lang,
  }) async {
    // Ruxsat so'rash
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Background handler
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

    // Local notifications kanalini sozlash
    const androidChannel = AndroidNotificationChannel(
      'taxi_channel',
      'Taxi Notifications',
      importance: Importance.high,
    );
    await _localNotif
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(androidChannel);

    // Local notifications init
    await _localNotif.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
      onDidReceiveNotificationResponse: (response) {
        _routeByType(response.payload ?? '');
      },
    );

    // FCM tokenni olish va backendga yuborish
    final token = await _messaging.getToken();
    if (token != null) {
      await ApiService.registerDeviceToken(
        accessToken: accessToken,
        token: token,
        platform: Platform.isIOS ? 'ios' : 'android',
        lang: lang,
      );
    }

    // Token yangilanganda avtomatik yuborish
    _messaging.onTokenRefresh.listen((newToken) async {
      await ApiService.registerDeviceToken(
        accessToken: accessToken,
        token: newToken,
        platform: Platform.isIOS ? 'ios' : 'android',
        lang: lang,
      );
    });

    // App ochiq paytda kelgan xabarlarni ko'rsatish
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);

    // Bildirishnomaga bosilganda (app background)
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _routeByType(message.data['type'] ?? '');
    });

    // App o'chirilgan paytda bildirishnomadan ochilganda
    final initial = await _messaging.getInitialMessage();
    if (initial != null) {
      _routeByType(initial.data['type'] ?? '');
    }
  }

  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    await _localNotif.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'taxi_channel',
          'Taxi Notifications',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['type'],
    );
  }

  static void _routeByType(String type) {
    switch (type) {
      case 'order_accepted':
      case 'order_on_the_way':
      case 'order_completed':
      case 'order_cancelled':
      case 'order_assigned':
        NavigationService.navigateTo('/order-tracking');
        break;
      case 'promo':
        NavigationService.navigateTo('/promotions');
        break;
      default:
        NavigationService.navigateTo('/notifications');
    }
  }

  // Logout paytida tokenni o'chirish
  static Future<void> logout({required String accessToken}) async {
    final token = await _messaging.getToken();
    if (token != null) {
      await ApiService.removeDeviceToken(
        accessToken: accessToken,
        token: token,
      );
    }
    await _messaging.deleteToken();
  }
}
```

---

## 6. API Service

```dart
// lib/services/api_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const baseUrl = 'http://YOUR_SERVER_IP:3000';

  // ─── Device Token ──────────────────────────────────────────────

  static Future<void> registerDeviceToken({
    required String accessToken,
    required String token,
    String platform = 'android',
    String lang = 'uz',
  }) async {
    await http.post(
      Uri.parse('$baseUrl/notifications/device-token'),
      headers: {
        'Authorization': 'Bearer $accessToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'token': token,
        'platform': platform,
        'lang': lang,
      }),
    );
  }

  static Future<void> removeDeviceToken({
    required String accessToken,
    required String token,
  }) async {
    await http.delete(
      Uri.parse('$baseUrl/notifications/device-token/$token'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }

  // ─── Notifications ─────────────────────────────────────────────

  static Future<Map<String, dynamic>> getMyNotifications({
    required String accessToken,
    int page = 1,
    int limit = 20,
    String lang = 'uz',
  }) async {
    final res = await http.get(
      Uri.parse('$baseUrl/notifications/my?page=$page&limit=$limit&lang=$lang'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return jsonDecode(res.body);
  }

  static Future<void> markAsRead({
    required String accessToken,
    required String notificationId,
  }) async {
    await http.patch(
      Uri.parse('$baseUrl/notifications/$notificationId/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }

  static Future<void> markAllAsRead({required String accessToken}) async {
    await http.patch(
      Uri.parse('$baseUrl/notifications/read-all'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }

  static Future<void> deleteNotification({
    required String accessToken,
    required String notificationId,
  }) async {
    await http.delete(
      Uri.parse('$baseUrl/notifications/$notificationId'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }
}
```

---

## 7. Notification modeli

```dart
// lib/models/notification_model.dart

class NotificationModel {
  final String id;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final Map<String, dynamic>? data;
  final DateTime createdAt;

  const NotificationModel({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    this.data,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'],
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      type: json['type'] ?? 'system',
      isRead: json['is_read'] ?? false,
      data: json['data'] != null
          ? Map<String, dynamic>.from(json['data'])
          : null,
      createdAt: DateTime.parse(json['created_at']),
    );
  }

  NotificationModel copyWith({bool? isRead}) {
    return NotificationModel(
      id: id,
      title: title,
      message: message,
      type: type,
      isRead: isRead ?? this.isRead,
      data: data,
      createdAt: createdAt,
    );
  }
}
```

---

## 8. Notifications sahifasi

```dart
// lib/pages/notifications_page.dart

import 'package:flutter/material.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<NotificationModel> _list = [];
  int _unreadCount = 0;
  bool _loading = true;
  int _page = 1;
  bool _hasMore = true;
  final ScrollController _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 100) {
        _loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _page = 1; });
    final token = await SecureStorage.getAccessToken();
    final lang = await SecureStorage.getLang();
    final res = await ApiService.getMyNotifications(
      accessToken: token,
      page: 1,
      lang: lang,
    );
    setState(() {
      _list = (res['data'] as List)
          .map((e) => NotificationModel.fromJson(e))
          .toList();
      _unreadCount = res['unread_count'] ?? 0;
      _hasMore = (res['pagination']['total_pages'] ?? 1) > 1;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (!_hasMore) return;
    _page++;
    final token = await SecureStorage.getAccessToken();
    final lang = await SecureStorage.getLang();
    final res = await ApiService.getMyNotifications(
      accessToken: token,
      page: _page,
      lang: lang,
    );
    final more = (res['data'] as List)
        .map((e) => NotificationModel.fromJson(e))
        .toList();
    setState(() {
      _list.addAll(more);
      _hasMore = _page < (res['pagination']['total_pages'] ?? 1);
    });
  }

  Future<void> _markRead(int index) async {
    final notif = _list[index];
    if (notif.isRead) return;
    final token = await SecureStorage.getAccessToken();
    await ApiService.markAsRead(
      accessToken: token,
      notificationId: notif.id,
    );
    setState(() {
      _list[index] = notif.copyWith(isRead: true);
      _unreadCount = (_unreadCount - 1).clamp(0, 999);
    });
  }

  Future<void> _markAllRead() async {
    final token = await SecureStorage.getAccessToken();
    await ApiService.markAllAsRead(accessToken: token);
    setState(() {
      _list = _list.map((n) => n.copyWith(isRead: true)).toList();
      _unreadCount = 0;
    });
  }

  Future<void> _delete(int index) async {
    final token = await SecureStorage.getAccessToken();
    await ApiService.deleteNotification(
      accessToken: token,
      notificationId: _list[index].id,
    );
    setState(() => _list.removeAt(index));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Text('Bildirishnomalar'),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              CircleAvatar(
                radius: 10,
                backgroundColor: Colors.red,
                child: Text(
                  '$_unreadCount',
                  style: const TextStyle(fontSize: 11, color: Colors.white),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text("Barchasini o'qi"),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _list.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.notifications_off, size: 60, color: Colors.grey),
                          SizedBox(height: 12),
                          Text('Bildirishnomalar yo\'q',
                              style: TextStyle(color: Colors.grey)),
                        ],
                      ),
                    )
                  : ListView.separated(
                      controller: _scroll,
                      itemCount: _list.length + (_hasMore ? 1 : 0),
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        if (index == _list.length) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: CircularProgressIndicator(),
                            ),
                          );
                        }
                        final notif = _list[index];
                        return Dismissible(
                          key: Key(notif.id),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            color: Colors.red,
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 20),
                            child: const Icon(Icons.delete, color: Colors.white),
                          ),
                          onDismissed: (_) => _delete(index),
                          child: _NotificationTile(
                            notif: notif,
                            onTap: () => _markRead(index),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel notif;
  final VoidCallback onTap;

  const _NotificationTile({required this.notif, required this.onTap});

  IconData get _icon {
    switch (notif.type) {
      case 'order_accepted':   return Icons.check_circle_outline;
      case 'order_on_the_way': return Icons.directions_car;
      case 'order_completed':  return Icons.done_all;
      case 'order_cancelled':  return Icons.cancel_outlined;
      case 'order_assigned':   return Icons.assignment_ind_outlined;
      case 'promo':            return Icons.local_offer_outlined;
      default:                 return Icons.notifications_outlined;
    }
  }

  Color get _color {
    switch (notif.type) {
      case 'order_accepted':
      case 'order_completed':  return Colors.green;
      case 'order_on_the_way': return Colors.blue;
      case 'order_cancelled':  return Colors.red;
      case 'promo':            return Colors.orange;
      default:                 return Colors.grey;
    }
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60)  return 'Hozirgina';
    if (diff.inMinutes < 60)  return '${diff.inMinutes} daqiqa oldin';
    if (diff.inHours < 24)    return '${diff.inHours} soat oldin';
    if (diff.inDays < 7)      return '${diff.inDays} kun oldin';
    return '${dt.day}.${dt.month}.${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      tileColor: notif.isRead ? null : Colors.blue.withOpacity(0.05),
      leading: CircleAvatar(
        backgroundColor: _color.withOpacity(0.15),
        child: Icon(_icon, color: _color, size: 20),
      ),
      title: Text(
        notif.title,
        style: TextStyle(
          fontWeight: notif.isRead ? FontWeight.normal : FontWeight.w600,
          fontSize: 14,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            notif.message,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 2),
          Text(
            _timeAgo(notif.createdAt),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ],
      ),
      isThreeLine: true,
      trailing: notif.isRead
          ? null
          : Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Colors.blue,
                shape: BoxShape.circle,
              ),
            ),
      onTap: onTap,
    );
  }
}
```

---

## 9. Login / Register da ishga tushirish

```dart
// Login yoki register muvaffaqiyatli bo'lgandan keyin chaqiriladi
final response = await ApiService.login(phone: phone, password: password);

await SecureStorage.saveAccessToken(response['accessToken']);
await SecureStorage.saveLang('uz'); // yoki foydalanuvchi tanlagan til

await FcmService.init(
  accessToken: response['accessToken'],
  lang: 'uz',
);
```

---

## 10. Logout

```dart
final token = await SecureStorage.getAccessToken();
await FcmService.logout(accessToken: token);
await SecureStorage.clear();
```

---

## 11. Notification turlari

| type | Holat | Kimga |
|------|-------|-------|
| `order_accepted` | Haydovchi qabul qildi | Yo'lovchi |
| `order_on_the_way` | Haydovchi yo'lda | Yo'lovchi |
| `order_completed` | Sayohat yakunlandi | Yo'lovchi + Haydovchi |
| `order_cancelled` | Bekor qilindi | Yo'lovchi + Haydovchi |
| `order_assigned` | Admin haydovchi biriktirdi | Yo'lovchi + Haydovchi |
| `promo` | Aksiya / promo-kod | Belgilangan userlar |
| `admin` | Admin xabari | Belgilangan userlar |
| `system` | Tizim xabari | Hammaga |

---

## 12. Ko'p qurilma

Bir foydalanuvchi bir nechta qurilmaga kira oladi. Har bir qurilma o'z tiliga ega:

```
User ─── iPhone (lang: ru)   ◄── "Заказ принят"
     └── Android (lang: uz)  ◄── "Buyurtma qabul qilindi"
```

Token ro'yxatdan o'tkazish:
```dart
await ApiService.registerDeviceToken(
  accessToken: token,
  token: fcmToken,
  platform: 'android', // yoki 'ios'
  lang: 'uz',          // qurilma tili
);
```

---

## 13. Backend API (foydalanuvchi)

| Method | URL | Tavsif |
|--------|-----|--------|
| `POST` | `/notifications/device-token` | FCM token saqlash |
| `DELETE` | `/notifications/device-token/:token` | Token o'chirish |
| `GET` | `/notifications/my?page=1&limit=20&lang=uz` | Bildirishnomalar ro'yxati |
| `PATCH` | `/notifications/:id/read` | Bitta o'qildi |
| `PATCH` | `/notifications/read-all` | Barchasini o'qildi |
| `DELETE` | `/notifications/:id` | O'chirish |

---

## 14. Response namunasi (`GET /notifications/my`)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Buyurtma qabul qilindi",
      "message": "Haydovchi buyurtmangizni qabul qildi",
      "type": "order_accepted",
      "is_read": false,
      "data": { "order_id": "uuid", "driver_id": "uuid" },
      "created_at": "2026-04-29T10:00:00.000Z"
    }
  ],
  "unread_count": 3,
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "total_pages": 2
  }
}
```
