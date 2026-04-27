# Flutter — To'liq Order (Buyurtma) Oqimi

Yo'lovchi uchun kategoriya tanlashdan to'lovgacha to'liq real-time oqim.

---

## 1. Umumiy Oqim

```
1. Kategoriyalar ro'yxati (GET /taxi-categories)
2. Narx preview (POST /orders/price-preview)
3. Order yaratish (POST /orders/create)
   → Yaqin haydovchilarga WebSocket orqali xabar ketadi
4. Haydovchi qabul qiladi (WebSocket: order:accepted)
5. Xarita ochiladi — haydovchi kuzatiladi (/location WS)
6. Trip yakunlanadi (WebSocket: order:completed)
7. To'lov ma'lumoti ko'rsatiladi
8. Review berish (ixtiyoriy)
```

---

## 2. HTTP Endpointlar

### 2.1 Kategoriyalar ro'yxati

**GET** `/taxi-categories`

Headers:
```
Authorization: Bearer <accessToken>
```

Response `200`:
```json
[
  {
    "id": "uuid-cat-1",
    "name_uz": "Econom",
    "name_ru": "Эконом",
    "name_en": "Economy",
    "icon_url": "https://cdn.example.com/econom.png",
    "price": "2000.000",
    "is_active": true
  },
  {
    "id": "uuid-cat-2",
    "name_uz": "Comfort",
    "icon_url": "https://cdn.example.com/comfort.png",
    "price": "3500.000",
    "is_active": true
  }
]
```

---

### 2.2 Narx Preview (order yaratmasdan)

**POST** `/orders/price-preview`

Headers:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:
```json
{
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.3110,
  "end_lng": 69.2790,
  "taxiCategoryId": "uuid-cat-1",
  "promoCode": "DISCOUNT20"
}
```

> `taxiCategoryId` va `promoCode` ixtiyoriy.

Response `200`:
```json
{
  "distanceKm": 2.34,
  "estimatedMinutes": 5,
  "breakdown": {
    "baseFare": 5000,
    "perKmCharge": 2340,
    "perMinCharge": 500,
    "categoryCharge": 2000,
    "surgeMultiplier": 1.0,
    "discount": 1968
  },
  "categoryName": "Econom",
  "promoApplied": true,
  "finalPrice": 7872,
  "currency": "UZS"
}
```

---

### 2.3 Order Yaratish

**POST** `/orders/create`

Headers:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:
```json
{
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.3110,
  "end_lng": 69.2790,
  "taxiCategoryId": "uuid-cat-1",
  "promoCode": "DISCOUNT20",
  "payment_method": "cash"
}
```

> `payment_method`: `cash` | `card` | `payme` | `click`

Response `201`:
```json
{
  "success": true,
  "message": "Order yaratildi",
  "data": {
    "order": {
      "id": "uuid-order",
      "user_id": "uuid-user",
      "driver_id": null,
      "start_lat": "41.2995",
      "start_lng": "69.2401",
      "end_lat": "41.311",
      "end_lng": "69.279",
      "price": "7872",
      "distance_km": "2.34",
      "duration_min": "5",
      "status": "pending",
      "taxiCategoryId": "uuid-cat-1",
      "created_at": "2026-04-27T08:00:00.000Z"
    },
    "drivers": [
      { "driverId": "uuid-driver-1", "distanceKm": 0.45 },
      { "driverId": "uuid-driver-2", "distanceKm": 1.23 }
    ],
    "promoApplied": true,
    "appliedPromo": {
      "code": "DISCOUNT20",
      "discount_percent": 20,
      "discount_amount": 1968
    }
  }
}
```

Error `404` — pricing rule yo'q:
```json
{ "statusCode": 404, "message": "No pricing rules found" }
```

---

### 2.4 Mening Orderlarim

**GET** `/orders/my`

Headers:
```
Authorization: Bearer <accessToken>
```

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-order",
      "status": "completed",
      "price": "7872",
      "distance_km": "2.34",
      "created_at": "2026-04-27T08:00:00.000Z",
      "payment": {
        "amount": "7872",
        "method": "cash",
        "status": "success"
      }
    }
  ]
}
```

---

## 3. WebSocket Events (`/ws` namespace)

**Ulanish:**
```
ws://your-domain/ws
```

---

### 3.1 Ro'yxatdan o'tish (har doim birinchi)

Emit: `register`
```json
{
  "userId": "uuid-user"
}
```

---

### 3.2 Haydovchi qabul qilganda

Listen: `order:accepted`
```json
{
  "order_id": "uuid-order",
  "driver_id": "uuid-driver",
  "message": "Haydovchi zakasni qabul qildi"
}
```

---

### 3.3 Order status yangilanganda

Listen: `order:status_updated`
```json
{
  "order_id": "uuid-order",
  "status": "on_the_way"
}
```

Statuslar ketma-ketligi:
```
pending → accepted → on_the_way → completed
                               → cancelled
```

---

### 3.4 Order yakunlanganda

Listen: `order:completed`
```json
{
  "order_id": "uuid-order",
  "amount": 7872
}
```

---

## 4. Flutter Kodi

### 4.1 pubspec.yaml

```yaml
dependencies:
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  socket_io_client: ^2.0.3+1
  google_maps_flutter: ^2.5.3
  geolocator: ^11.0.0
```

---

### 4.2 CategoryService

```dart
// lib/features/order/category_service.dart

import 'package:dio/dio.dart';

class TaxiCategory {
  final String id;
  final String name;
  final String? iconUrl;
  final double price;

  TaxiCategory({
    required this.id,
    required this.name,
    this.iconUrl,
    required this.price,
  });

  factory TaxiCategory.fromJson(Map<String, dynamic> json, String lang) {
    return TaxiCategory(
      id: json['id'],
      name: json['name_$lang'] ?? json['name_uz'] ?? '',
      iconUrl: json['icon_url'],
      price: double.tryParse(json['price']?.toString() ?? '0') ?? 0,
    );
  }
}

class CategoryService {
  final Dio _dio;
  CategoryService(this._dio);

  Future<List<TaxiCategory>> getCategories({String lang = 'uz'}) async {
    final res = await _dio.get('/taxi-categories');
    final List<dynamic> data = res.data;
    return data
        .where((c) => c['is_active'] == true)
        .map((c) => TaxiCategory.fromJson(c, lang))
        .toList();
  }
}
```

---

### 4.3 OrderService

```dart
// lib/features/order/order_service.dart

import 'package:dio/dio.dart';

class PricePreview {
  final double distanceKm;
  final int estimatedMinutes;
  final double finalPrice;
  final String currency;
  final bool promoApplied;
  final Map<String, dynamic> breakdown;

  PricePreview({
    required this.distanceKm,
    required this.estimatedMinutes,
    required this.finalPrice,
    required this.currency,
    required this.promoApplied,
    required this.breakdown,
  });

  factory PricePreview.fromJson(Map<String, dynamic> json) {
    return PricePreview(
      distanceKm: (json['distanceKm'] as num).toDouble(),
      estimatedMinutes: json['estimatedMinutes'],
      finalPrice: (json['finalPrice'] as num).toDouble(),
      currency: json['currency'] ?? 'UZS',
      promoApplied: json['promoApplied'] ?? false,
      breakdown: json['breakdown'] ?? {},
    );
  }
}

class OrderService {
  final Dio _dio;
  OrderService(this._dio);

  // Narx hisoblash
  Future<PricePreview> getPricePreview({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
    String? categoryId,
    String? promoCode,
  }) async {
    final res = await _dio.post('/orders/price-preview', data: {
      'start_lat': startLat,
      'start_lng': startLng,
      'end_lat': endLat,
      'end_lng': endLng,
      if (categoryId != null) 'taxiCategoryId': categoryId,
      if (promoCode != null) 'promoCode': promoCode,
    });
    return PricePreview.fromJson(res.data);
  }

  // Order yaratish
  Future<Map<String, dynamic>> createOrder({
    required double startLat,
    required double startLng,
    required double endLat,
    required double endLng,
    String? categoryId,
    String? promoCode,
    String paymentMethod = 'cash',
  }) async {
    final res = await _dio.post('/orders/create', data: {
      'start_lat': startLat,
      'start_lng': startLng,
      'end_lat': endLat,
      'end_lng': endLng,
      if (categoryId != null) 'taxiCategoryId': categoryId,
      if (promoCode != null) 'promoCode': promoCode,
      'payment_method': paymentMethod,
    });
    return res.data['data'];
  }

  Future<List<dynamic>> getMyOrders() async {
    final res = await _dio.get('/orders/my');
    return res.data['data'];
  }
}
```

---

### 4.4 OrderSocketService

```dart
// lib/features/order/order_socket_service.dart

import 'package:socket_io_client/socket_io_client.dart' as IO;

class OrderSocketService {
  static final OrderSocketService _i = OrderSocketService._();
  factory OrderSocketService() => _i;
  OrderSocketService._();

  IO.Socket? _socket;

  // Callbacks
  Function(String driverId)? onDriverAccepted;
  Function(String status)? onStatusUpdated;
  Function(double amount)? onOrderCompleted;
  Function()? onOrderCancelled;

  void connect(String baseUrl) {
    if (_socket?.connected == true) return;

    _socket = IO.io(
      '$baseUrl/ws',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();

    _socket!.on('order:accepted', (data) {
      onDriverAccepted?.call(data['driver_id']);
    });

    _socket!.on('order:status_updated', (data) {
      onStatusUpdated?.call(data['status']);
    });

    _socket!.on('order:completed', (data) {
      onOrderCompleted?.call((data['amount'] as num).toDouble());
    });

    _socket!.on('order:cancelled', (_) {
      onOrderCancelled?.call();
    });
  }

  void register(String userId) {
    _socket?.emit('register', {'userId': userId});
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
```

---

### 4.5 OrderCreateScreen

```dart
// lib/screens/order_create_screen.dart

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../features/order/category_service.dart';
import '../features/order/order_service.dart';
import '../features/order/order_socket_service.dart';
import 'order_tracking_screen.dart';

class OrderCreateScreen extends StatefulWidget {
  const OrderCreateScreen({Key? key}) : super(key: key);

  @override
  State<OrderCreateScreen> createState() => _OrderCreateScreenState();
}

class _OrderCreateScreenState extends State<OrderCreateScreen> {
  final _orderService = OrderService(ApiClient.instance);
  final _categoryService = CategoryService(ApiClient.instance);
  final _socket = OrderSocketService();

  List<TaxiCategory> _categories = [];
  TaxiCategory? _selectedCategory;
  PricePreview? _pricePreview;

  LatLng? _startPoint;
  LatLng? _endPoint;
  String _paymentMethod = 'cash';
  String? _promoCode;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _initSocket();
  }

  Future<void> _loadCategories() async {
    final cats = await _categoryService.getCategories();
    setState(() => _categories = cats);
  }

  void _initSocket() {
    _socket.connect('http://YOUR_SERVER');

    // Haydovchi qabul qilganda xarita ekraniga o'tish
    _socket.onDriverAccepted = (driverId) {
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => OrderTrackingScreen(
            orderId: _currentOrderId!,
            userId: currentUserId,
            driverId: driverId,
          ),
        ),
      );
    };
  }

  String? _currentOrderId;

  Future<void> _calculatePrice() async {
    if (_startPoint == null || _endPoint == null) return;
    setState(() => _isLoading = true);
    try {
      final preview = await _orderService.getPricePreview(
        startLat: _startPoint!.latitude,
        startLng: _startPoint!.longitude,
        endLat: _endPoint!.latitude,
        endLng: _endPoint!.longitude,
        categoryId: _selectedCategory?.id,
        promoCode: _promoCode,
      );
      setState(() => _pricePreview = preview);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Narxni hisoblashda xato: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _createOrder() async {
    if (_startPoint == null || _endPoint == null || _pricePreview == null) return;
    setState(() => _isLoading = true);
    try {
      final result = await _orderService.createOrder(
        startLat: _startPoint!.latitude,
        startLng: _startPoint!.longitude,
        endLat: _endPoint!.latitude,
        endLng: _endPoint!.longitude,
        categoryId: _selectedCategory?.id,
        promoCode: _promoCode,
        paymentMethod: _paymentMethod,
      );

      _currentOrderId = result['order']['id'];

      // Haydovchi kutish ekranini ko'rsatish
      setState(() {}); // "Haydovchi kutilmoqda..." ko'rsatish
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order yaratishda xato: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Taksi chaqirish')),
      body: Column(
        children: [
          // Kategoriya tanlash
          SizedBox(
            height: 90,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(12),
              itemCount: _categories.length,
              itemBuilder: (_, i) {
                final cat = _categories[i];
                final isSelected = _selectedCategory?.id == cat.id;
                return GestureDetector(
                  onTap: () {
                    setState(() => _selectedCategory = cat);
                    if (_startPoint != null && _endPoint != null) {
                      _calculatePrice();
                    }
                  },
                  child: Container(
                    width: 80,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: isSelected ? Colors.blue : Colors.grey,
                        width: isSelected ? 2 : 1,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      color: isSelected ? Colors.blue.shade50 : Colors.white,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (cat.iconUrl != null)
                          Image.network(cat.iconUrl!, height: 36)
                        else
                          const Icon(Icons.directions_car, size: 36),
                        const SizedBox(height: 4),
                        Text(cat.name, style: const TextStyle(fontSize: 12)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Narx ko'rsatish
          if (_pricePreview != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: Colors.grey.shade100,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_pricePreview!.distanceKm} km • ~${_pricePreview!.estimatedMinutes} min',
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                  Text(
                    '${_pricePreview!.finalPrice.toStringAsFixed(0)} ${_pricePreview!.currency}',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                      color: Colors.blue,
                    ),
                  ),
                ],
              ),
            ),

          // To'lov usuli
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: DropdownButton<String>(
              value: _paymentMethod,
              isExpanded: true,
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Naqd pul')),
                DropdownMenuItem(value: 'card', child: Text('Karta')),
                DropdownMenuItem(value: 'payme', child: Text('Payme')),
                DropdownMenuItem(value: 'click', child: Text('Click')),
              ],
              onChanged: (v) => setState(() => _paymentMethod = v!),
            ),
          ),

          const Spacer(),

          // Order yaratish tugmasi
          if (_currentOrderId == null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isLoading || _pricePreview == null
                      ? null
                      : _createOrder,
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          _pricePreview != null
                              ? 'Taksi chaqirish • ${_pricePreview!.finalPrice.toStringAsFixed(0)} so\'m'
                              : 'Manzilni belgilang',
                        ),
                ),
              ),
            )
          else
            const Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text(
                    'Haydovchi qidirilmoqda...',
                    style: TextStyle(fontSize: 16),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    super.dispose();
  }
}
```

---

### 4.6 OrderTrackingScreen

```dart
// lib/screens/order_tracking_screen.dart
// (FLUTTER_LOCATION_GUIDE.md dagi PassengerMapScreen ga o'xshash)
// LocationSocketService.registerPassenger(userId, orderId) chaqiriladi
// location:driver-updated event kuzatiladi

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/location_socket_service.dart';
import '../features/order/order_socket_service.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;
  final String userId;
  final String driverId;

  const OrderTrackingScreen({
    Key? key,
    required this.orderId,
    required this.userId,
    required this.driverId,
  }) : super(key: key);

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  final _locationSocket = LocationSocketService();
  final _orderSocket = OrderSocketService();

  GoogleMapController? _mapController;
  LatLng? _driverPosition;
  String _currentStatus = 'accepted';

  final Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();

    // Haydovchi lokatsiyasini kuzatish
    _locationSocket.onDriverLocationUpdated = (data) {
      setState(() {
        _driverPosition = LatLng(data.lat, data.lng);
        _markers.removeWhere((m) => m.markerId.value == 'driver');
        _markers.add(Marker(
          markerId: const MarkerId('driver'),
          position: _driverPosition!,
          rotation: data.bearing ?? 0,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Haydovchi'),
        ));
      });
      _mapController?.animateCamera(
        CameraUpdate.newLatLng(_driverPosition!),
      );
    };

    // Order status o'zgarishi
    _orderSocket.onStatusUpdated = (status) {
      setState(() => _currentStatus = status);
    };

    // Order yakunlanganda
    _orderSocket.onOrderCompleted = (amount) {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Safar yakunlandi'),
          content: Text('To\'lov: ${amount.toStringAsFixed(0)} so\'m'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.of(context).pop();
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    };

    _locationSocket.registerPassenger(widget.userId, widget.orderId);
    _locationSocket.getCurrentLocations(widget.orderId);
  }

  String get _statusText {
    switch (_currentStatus) {
      case 'accepted': return 'Haydovchi kelyapti...';
      case 'on_the_way': return 'Manzilga ketyapti';
      case 'completed': return 'Safar yakunlandi';
      default: return 'Kutilmoqda...';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_statusText)),
      body: GoogleMap(
        initialCameraPosition: const CameraPosition(
          target: LatLng(41.2995, 69.2401),
          zoom: 15,
        ),
        markers: _markers,
        onMapCreated: (c) => _mapController = c,
      ),
    );
  }

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }
}
```

---

## 5. To'liq Oqim Diagrammasi

```
KATEGORI TANLASH
    └─> GET /taxi-categories

MANZIL BELGILASH (xaritada)
    └─> POST /orders/price-preview
            └─> narx, masofa, vaqt ko'rsatiladi

TAKSI CHAQIRISH
    └─> POST /orders/create
            └─> { order.id, drivers: [...], finalPrice }
            └─> Yaqin haydovchilarga WS: order:request yuboriladi

HAYDOVCHI KUTISH
    └─> WS listen: order:accepted { driver_id }
            └─> OrderTrackingScreen ochiladi

HAYDOVCHI KUZATISH
    └─> /location WS: passenger:register(userId, orderId)
    └─> location:driver-updated → marker yangilanadi
    └─> WS: order:status_updated { status: on_the_way }

SAFAR YAKUNLANISHI
    └─> WS: order:completed { amount }
    └─> To'lov dialogi ko'rsatiladi
    └─> GET /orders/my → tarix
```

---

## 6. WebSocket `/ws` Namespace — Barcha Eventlar

| Event | Yo'nalish | Ma'lumot |
|---|---|---|
| `register` | emit | `{ userId }` |
| `order:accepted` | listen | `{ order_id, driver_id }` |
| `order:status_updated` | listen | `{ order_id, status }` |
| `order:completed` | listen | `{ order_id, amount }` |
| `order:cancelled` | listen | `{ order_id }` |
| `order:request` | driver listen | `{ order_id, price, distance_km }` |
| `order:accept` | driver emit | `{ driverId, orderId }` |
