# Admin Panel — Order Boshqaruvi va Narx Qoidalari

---

## 1. Narx Qoidalari (Pricing Rules)

### Narx Formulasi

```
Narx = (base_fare + per_km × masofa + per_min × vaqt + category.price) × surge_multiplier
Yakuniy narx = Narx - promo_discount
```

**Misol:**
- `base_fare` = 5000 so'm
- `per_km` = 1000, masofa = 3 km → 3000
- `per_min` = 100, vaqt = 6 min → 600
- `category.price` = 2000 (Comfort)
- `surge_multiplier` = 1.2 (tiq-tiq vaqt)
- Jami: (5000 + 3000 + 600 + 2000) × 1.2 = **12 720 so'm**

---

### 1.1 Barcha Qoidalar Ro'yxati

**GET** `/pricing-rules`

Headers:
```
Authorization: Bearer <admin-accessToken>
```

Response `200`:
```json
[
  {
    "id": "uuid-rule-1",
    "city_uz": "Toshkent",
    "base_fare": "5000.00",
    "per_km": "1000.00",
    "per_min": "100.00",
    "surge_multiplier": "1.00",
    "currency": "UZS",
    "is_active": true,
    "valid_from": "2026-01-01T00:00:00.000Z",
    "valid_to": null,
    "taxiCategory": {
      "id": "uuid-cat",
      "name_uz": "Econom"
    }
  }
]
```

---

### 1.2 Faol Qoida

**GET** `/pricing-rules/active`

Response `200`:
```json
{
  "id": "uuid-rule-1",
  "city_uz": "Toshkent",
  "base_fare": "5000.00",
  "per_km": "1000.00",
  "per_min": "100.00",
  "surge_multiplier": "1.00",
  "currency": "UZS",
  "is_active": true,
  "valid_from": "2026-01-01T00:00:00.000Z",
  "valid_to": null
}
```

---

### 1.3 Yangi Qoida Yaratish

**POST** `/pricing-rules`

> Yangi qoida yaratilganda avvalgisi avtomatik `is_active: false` qilinadi.

Headers:
```
Authorization: Bearer <admin-accessToken>
Content-Type: application/json
```

Request:
```json
{
  "lang": "uz",
  "city": "Toshkent",
  "base_fare": 5000,
  "per_km": 1000,
  "per_min": 100,
  "surge_multiplier": 1.0,
  "currency": "UZS",
  "is_active": true,
  "valid_from": "2026-01-01",
  "valid_to": null,
  "taxiCategoryId": null
}
```

> `lang`: `uz` | `ru` | `en`
> `taxiCategoryId`: muayyan kategoriya uchun alohida qoida (ixtiyoriy)

Response `201`:
```json
{
  "id": "uuid-new-rule",
  "city_uz": "Toshkent",
  "base_fare": "5000",
  "per_km": "1000",
  "per_min": "100",
  "surge_multiplier": "1.0",
  "currency": "UZS",
  "is_active": true,
  "valid_from": "2026-01-01T00:00:00.000Z"
}
```

---

### 1.4 Qoidani Yangilash

**PATCH** `/pricing-rules/:id`

Request (faqat o'zgartiriladiganlarni yuboring):
```json
{
  "surge_multiplier": 1.5,
  "per_km": 1200
}
```

Response `200`:
```json
{
  "id": "uuid-rule-1",
  "surge_multiplier": "1.50",
  "per_km": "1200.00"
}
```

---

### 1.5 Qoidani O'chirish

**DELETE** `/pricing-rules/:id`

Response `200`:
```json
{ "message": "Pricing rule deleted" }
```

---

## 2. Taxi Kategoriyalar

### 2.1 Barcha Kategoriyalar

**GET** `/taxi-categories`

Headers: `Authorization: Bearer <admin-accessToken>`

Response:
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
    "price": "3500.000",
    "is_active": true
  }
]
```

---

## 3. Order Boshqaruvi

### 3.1 Barcha Orderlar (Filtrlash bilan)

**GET** `/orders/get-all-orders`

Query params:
```
language=uz          (majburiy: uz | ru | en)
page=1
limit=10
status=pending       (pending | accepted | on_the_way | completed | cancelled)
driver_id=uuid
user_id=uuid
price_min=5000
price_max=50000
search=Ali
```

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-order",
      "status": "pending",
      "price": "7872",
      "distance_km": "2.34",
      "duration_min": "5",
      "created_at": "2026-04-27T08:00:00.000Z",
      "user": {
        "id": "uuid-user",
        "name": "Ali Valiyev",
        "phone": "+998901234567"
      },
      "driver": null,
      "taxiCategory": { "name": "Econom" },
      "payment": {
        "amount": "7872",
        "method": "cash",
        "status": "pending"
      }
    }
  ],
  "pagination": {
    "totalItems": 150,
    "totalPages": 15,
    "currentPage": 1,
    "itemsPerPage": 10
  }
}
```

---

### 3.2 Order Detali

**GET** `/orders/:id?language=uz`

Response `200`:
```json
{
  "success": true,
  "data": {
    "id": "uuid-order",
    "status": "on_the_way",
    "price": "7872",
    "distance_km": "2.34",
    "start_lat": "41.2995",
    "start_lng": "69.2401",
    "end_lat": "41.311",
    "end_lng": "69.279",
    "user": {
      "id": "uuid-user",
      "name": "Ali Valiyev",
      "phone": "+998901234567"
    },
    "driver": {
      "id": "uuid-driver",
      "car_model": "Chevrolet Nexia",
      "car_number": "01A111AA",
      "user": { "name": "Bobur Karimov", "phone": "+998997654321" }
    },
    "payment": { "amount": "7872", "method": "cash", "status": "pending" },
    "reviews": []
  }
}
```

---

### 3.3 Admin — Order Yaratish

Admin istalgan foydalanuvchi uchun order yarata oladi va darhol haydovchi biriktiroladi.

**POST** `/orders/admin-create`

Headers:
```
Authorization: Bearer <admin-accessToken>
Content-Type: application/json
```

Request:
```json
{
  "user_id": "uuid-user",
  "start_lat": 41.2995,
  "start_lng": 69.2401,
  "end_lat": 41.3110,
  "end_lng": 69.2790,
  "taxiCategoryId": "uuid-cat-1",
  "payment_method": "cash",
  "driver_id": "uuid-driver"
}
```

> `driver_id` ixtiyoriy — yuborilsa darhol biriktiriladi, haydovchiga WebSocket xabar ketadi.

Response `201`:
```json
{
  "success": true,
  "message": "Admin tomonidan order yaratildi",
  "data": {
    "order": {
      "id": "uuid-order",
      "status": "accepted",
      "price": "7872",
      "driver_id": "uuid-driver"
    },
    "drivers": [
      { "driverId": "uuid-driver-1", "distanceKm": 0.45 }
    ]
  }
}
```

---

### 3.4 Order uchun Yaqin Haydovchilar

**GET** `/orders/:id/nearby-drivers?radiusKm=5`

Headers:
```
Authorization: Bearer <admin-accessToken>
```

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "driverId": "uuid-driver-1",
      "distanceKm": 0.45,
      "name": "Bobur Karimov",
      "phone": "+998901234567",
      "carModel": "Chevrolet Nexia",
      "carNumber": "01A111AA",
      "rating": 4.8,
      "status": "available"
    },
    {
      "driverId": "uuid-driver-2",
      "distanceKm": 1.23,
      "name": "Sardor Toshmatov",
      "phone": "+998997654321",
      "carModel": "Chevrolet Cobalt",
      "carNumber": "01B222BB",
      "rating": 4.5,
      "status": "available"
    }
  ]
}
```

---

### 3.5 Admin — Haydovchi Biriktirish

**PATCH** `/orders/:id/assign-driver/:driverId`

Headers:
```
Authorization: Bearer <admin-accessToken>
```

Response `200`:
```json
{
  "success": true,
  "message": "Haydovchi biriktirildi",
  "data": {
    "id": "uuid-order",
    "status": "accepted",
    "driver_id": "uuid-driver",
    "driver": {
      "user": { "name": "Bobur Karimov", "phone": "+998901234567" }
    }
  }
}
```

> Haydovchiga avtomatik WebSocket `order:assigned` event yuboriladi.
> Yo'lovchiga avtomatik WebSocket `order:accepted` event yuboriladi.

---

### 3.6 Order Statusini Yangilash

**PATCH** `/orders/update-status/:orderId`

Request:
```json
{ "status": "on_the_way" }
```

> Statuslar: `pending` → `accepted` → `on_the_way` → `completed` → `cancelled`

> `completed` bosganda avtomatik:
> - To'lov `success` ga o'tadi
> - Haydovchi hamyoniga pul qo'shiladi
> - Komissiya hisoblanadi (naqd: 5%, karta: 10%)

Response `200`:
```json
{
  "success": true,
  "message": "Order status yangilandi",
  "data": { "id": "uuid-order", "status": "on_the_way" }
}
```

---

### 3.7 Narx Preview (Admin ham ishlatishi mumkin)

**POST** `/orders/price-preview`

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

Response:
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

## 4. WebSocket — Admin Order Boshqaruvi

Admin haydovchi biriktirganida ikki tomonga xabar ketadi:

### Haydovchiga (listen `order:assigned`):
```json
{
  "order_id": "uuid-order",
  "message": "Admin sizga buyurtma biriktirdi",
  "price": 7872
}
```

### Yo'lovchiga (listen `order:accepted`):
```json
{
  "order_id": "uuid-order",
  "driver_id": "uuid-driver",
  "message": "Haydovchi tayinlandi"
}
```

---

## 5. Flutter Admin — Order Yaratish Ekrani

```dart
// lib/screens/admin_order_create_screen.dart

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

class AdminOrderCreateScreen extends StatefulWidget {
  const AdminOrderCreateScreen({Key? key}) : super(key: key);

  @override
  State<AdminOrderCreateScreen> createState() => _AdminOrderCreateScreenState();
}

class _AdminOrderCreateScreenState extends State<AdminOrderCreateScreen> {
  final Dio _dio = ApiClient.instance;

  final _userIdCtrl = TextEditingController();
  double? _startLat, _startLng, _endLat, _endLng;
  String _paymentMethod = 'cash';
  String? _selectedCategoryId;
  String? _selectedDriverId;

  List<dynamic> _categories = [];
  List<dynamic> _nearbyDrivers = [];
  Map<String, dynamic>? _pricePreview;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    final res = await _dio.get('/taxi-categories');
    setState(() => _categories = res.data);
  }

  Future<void> _calculatePrice() async {
    if (_startLat == null || _endLat == null) return;
    final res = await _dio.post('/orders/price-preview', data: {
      'start_lat': _startLat,
      'start_lng': _startLng,
      'end_lat': _endLat,
      'end_lng': _endLng,
      if (_selectedCategoryId != null) 'taxiCategoryId': _selectedCategoryId,
    });
    setState(() => _pricePreview = res.data);
  }

  Future<void> _loadNearbyDrivers(String orderId) async {
    final res = await _dio.get('/orders/$orderId/nearby-drivers?radiusKm=5');
    setState(() => _nearbyDrivers = res.data['data']);
  }

  Future<void> _createOrder() async {
    if (_userIdCtrl.text.isEmpty || _startLat == null) return;
    setState(() => _isLoading = true);

    try {
      final res = await _dio.post('/orders/admin-create', data: {
        'user_id': _userIdCtrl.text.trim(),
        'start_lat': _startLat,
        'start_lng': _startLng,
        'end_lat': _endLat,
        'end_lng': _endLng,
        'payment_method': _paymentMethod,
        if (_selectedCategoryId != null) 'taxiCategoryId': _selectedCategoryId,
        if (_selectedDriverId != null) 'driver_id': _selectedDriverId,
      });

      final orderId = res.data['data']['order']['id'];
      await _loadNearbyDrivers(orderId);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order muvaffaqiyatli yaratildi!'),
          backgroundColor: Colors.green,
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Xato: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _assignDriver(String orderId, String driverId) async {
    await _dio.patch('/orders/$orderId/assign-driver/$driverId');
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Haydovchi biriktirildi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin: Order Yaratish')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User ID
            TextField(
              controller: _userIdCtrl,
              decoration: const InputDecoration(
                labelText: 'Foydalanuvchi ID',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),

            // Kategoriya
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(
                labelText: 'Kategoriya',
                border: OutlineInputBorder(),
              ),
              value: _selectedCategoryId,
              items: _categories.map<DropdownMenuItem<String>>((c) {
                return DropdownMenuItem(
                  value: c['id'],
                  child: Text(c['name_uz'] ?? ''),
                );
              }).toList(),
              onChanged: (v) => setState(() => _selectedCategoryId = v),
            ),
            const SizedBox(height: 12),

            // To'lov usuli
            DropdownButtonFormField<String>(
              decoration: const InputDecoration(
                labelText: 'To\'lov usuli',
                border: OutlineInputBorder(),
              ),
              value: _paymentMethod,
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Naqd')),
                DropdownMenuItem(value: 'card', child: Text('Karta')),
                DropdownMenuItem(value: 'payme', child: Text('Payme')),
                DropdownMenuItem(value: 'click', child: Text('Click')),
              ],
              onChanged: (v) => setState(() => _paymentMethod = v!),
            ),
            const SizedBox(height: 16),

            // Narx preview
            if (_pricePreview != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Masofa: ${_pricePreview!['distanceKm']} km'),
                    Text('Vaqt: ~${_pricePreview!['estimatedMinutes']} daqiqa'),
                    Text(
                      'Narx: ${_pricePreview!['finalPrice']} ${_pricePreview!['currency']}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 16),

            // Yaqin haydovchilar
            if (_nearbyDrivers.isNotEmpty) ...[
              const Text(
                'Yaqin haydovchilar:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              ..._nearbyDrivers.map((d) => ListTile(
                    leading: const Icon(Icons.drive_eta, color: Colors.green),
                    title: Text(d['name'] ?? d['driverId']),
                    subtitle: Text(
                      '${d['carNumber'] ?? ''} • ${d['distanceKm']} km',
                    ),
                    trailing: ElevatedButton(
                      onPressed: () => _assignDriver('ORDER_ID', d['driverId']),
                      child: const Text('Biriktir'),
                    ),
                  )),
            ],

            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _createOrder,
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('Order yaratish'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 6. Endpoint Ro'yxati (Admin)

| Method | URL | Tavsif |
|---|---|---|
| `POST` | `/orders/price-preview` | Narx hisoblash |
| `POST` | `/orders/admin-create` | Admin order yaratish |
| `GET` | `/orders/get-all-orders` | Barcha orderlar (filtr bilan) |
| `GET` | `/orders/:id` | Order detali |
| `GET` | `/orders/:id/nearby-drivers` | Yaqin haydovchilar |
| `PATCH` | `/orders/:id/assign-driver/:driverId` | Haydovchi biriktirish |
| `PATCH` | `/orders/update-status/:id` | Status yangilash |
| `GET` | `/pricing-rules` | Barcha narx qoidalari |
| `GET` | `/pricing-rules/active` | Faol qoida |
| `POST` | `/pricing-rules` | Yangi qoida |
| `PATCH` | `/pricing-rules/:id` | Qoidani tahrirlash |
| `DELETE` | `/pricing-rules/:id` | Qoidani o'chirish |
| `GET` | `/taxi-categories` | Kategoriyalar |
