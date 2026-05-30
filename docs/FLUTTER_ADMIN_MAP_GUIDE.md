# Flutter Admin Panel — Real-Time Driver Map Guide

Admin panel uchun barcha haydovchilarni real-time xaritada kuzatish.

---

## 1. Arxitektura

```
Admin App                        Backend                        Drivers
    |                               |                              |
    |-- HTTP GET /active-drivers -->|                              |
    |<-- [ { driverId, lat, lng, name, currentOrder, todayStats } ]|
    |    (to'liq ma'lumot: bir marta, ekran ochilganda)            |
    |                               |                              |
    |-- admin:subscribe (WS) ------>|                              |
    |<-- admin:all-drivers ---------|  (hozirgi pozitsiyalar)      |
    |                               |                              |
    |                               |<-- location:driver-update ---|
    |<-- admin:driver-updated ------|  (faqat lat/lng/speed)       |
    |    Frontend: pozitsiyani merge qiladi, detail ma'lumot saqlanadi
```

> **Nima uchun HTTP va WS ajratilgan?**
> Driver a har 2–5 sekunddpozitsiya yuboradi. Har safar DB dan order+stats
> yuklash = 100 haydovchi × 20 query/min = 2000 query/min. Shuning uchun
> to'liq ma'lumot bir marta HTTP orqali olinadi, faqat koordinatlar WS orqali yangilanadi.

---

## 2. HTTP API

### GET `/api/location/active-drivers`

Redis GEO dan barcha aktiv haydovchilarni qaytaradi — ism, telefon, mashina, status bilan.

**Headers:**
```
Authorization: Bearer <admin-accessToken>
```

**Response `200`:**
```json
[
  {
    "driverId": "uuid-driver-1",
    "lat": 41.2995,
    "lng": 69.2401,
    "name": "Bobur Karimov",
    "phone": "+998901234567",
    "status": "available",
    "carModel": "Chevrolet Nexia",
    "carNumber": "01A111AA",
    "lastSeenAt": "2026-04-26T10:00:00.000Z",
    "currentOrder": null,
    "todayStats": {
      "completedTrips": 5,
      "revenue": 175000
    }
  },
  {
    "driverId": "uuid-driver-2",
    "lat": 41.3110,
    "lng": 69.2790,
    "name": "Sardor Toshmatov",
    "phone": "+998997654321",
    "status": "on_trip",
    "carModel": "Chevrolet Cobalt",
    "carNumber": "01B222BB",
    "lastSeenAt": "2026-04-26T10:00:05.000Z",
    "currentOrder": {
      "startLat": 41.2995,
      "startLng": 69.2401,
      "endLat": 41.3110,
      "endLng": 69.2790,
      "price": 18000,
      "statusLabel": "Mijozni olib bormoqda"
    },
    "todayStats": {
      "completedTrips": 8,
      "revenue": 250000
    }
  }
]
```

> `currentOrder` — haydovchining hozirgi aktiv buyurtmasi (`accepted` yoki `on_the_way` statusda).
> Buyurtma yo'q bo'lsa `null`.
>
> `todayStats` — bugungi yakunlangan buyurtmalar va tushumlar.
> Bugun hech narsa bo'lmagan bo'lsa `null`.

**Response `401`** — token yo'q yoki noto'g'ri:
```json
{ "statusCode": 401, "message": "Unauthorized" }
```

**Response `403`** — admin emas:
```json
{ "statusCode": 403, "message": "Forbidden" }
```

---

### GET `/api/location/all-locations`

DB dan barcha haydovchi va yo'lovchi yozuvlarini qaytaradi (tarixiy ma'lumot).

**Headers:**
```
Authorization: Bearer <admin-accessToken>
```

**Response `200`:**
```json
{
  "success": true,
  "message": "All locations retrieved successfully",
  "data": {
    "drivers": [
      {
        "driverId": "uuid-driver-1",
        "lat": "41.2995",
        "lng": "69.2401",
        "speed": "45.5",
        "bearing": "180.0",
        "timestamp": "2026-04-26T10:00:00.000Z"
      }
    ],
    "passengers": [
      {
        "userId": "uuid-user-1",
        "lat": 41.3111,
        "lng": 69.279,
        "accuracy": 12.5,
        "timestamp": "2026-04-26T10:00:00.000Z"
      }
    ]
  }
}
```

---

## 3. WebSocket Events

**Namespace:** `ws://your-domain/location`

---

### Admin EMIT qiladigan eventlar

#### `admin:subscribe`
Admin xarita roomga qo'shiladi. Server darhol barcha aktiv haydovchi pozitsiyalarini yuboradi.

```json
{}
```
*(body yo'q, faqat event nomi yuboriladi)*

---

#### `admin:get-all-drivers`
Hozirgi barcha haydovchi pozitsiyalarini qayta so'rash.

```json
{}
```

---

### Admin LISTEN qiladigan eventlar

#### `admin:all-drivers`
`admin:subscribe` yoki `admin:get-all-drivers` ga javob. Barcha aktiv haydovchi pozitsiyalari.

```json
[
  {
    "type": "driver",
    "id": "uuid-driver-1",
    "lat": 41.2995,
    "lng": 69.2401,
    "speed": 45.5,
    "bearing": 180.0,
    "timestamp": "2026-04-26T10:00:00.000Z"
  },
  {
    "type": "driver",
    "id": "uuid-driver-2",
    "lat": 41.311,
    "lng": 69.279,
    "speed": 32.0,
    "bearing": 90.0,
    "timestamp": "2026-04-26T10:00:03.000Z"
  }
]
```

> Agar hech qanday aktiv haydovchi bo'lmasa: `[]`

---

#### `admin:driver-updated`
Istalgan haydovchi harakat qilganda real-time yangilanish.

```json
{
  "type": "driver",
  "id": "uuid-driver-1",
  "lat": 41.3001,
  "lng": 69.2415,
  "speed": 48.0,
  "bearing": 175.0,
  "timestamp": "2026-04-26T10:00:05.000Z"
}
```

---

## 4. Flutter Kodi

### 4.1 DriverInfo model

```dart
// lib/models/driver_info.dart

import 'package:flutter/material.dart';

class CurrentOrder {
  final double startLat;
  final double startLng;
  final double endLat;
  final double endLng;
  final double price;
  final String statusLabel;

  CurrentOrder({
    required this.startLat,
    required this.startLng,
    required this.endLat,
    required this.endLng,
    required this.price,
    required this.statusLabel,
  });

  factory CurrentOrder.fromJson(Map<String, dynamic> json) {
    return CurrentOrder(
      startLat: (json['startLat'] as num).toDouble(),
      startLng: (json['startLng'] as num).toDouble(),
      endLat: (json['endLat'] as num).toDouble(),
      endLng: (json['endLng'] as num).toDouble(),
      price: (json['price'] as num).toDouble(),
      statusLabel: json['statusLabel'] ?? '',
    );
  }
}

class TodayStats {
  final int completedTrips;
  final double revenue;

  TodayStats({required this.completedTrips, required this.revenue});

  factory TodayStats.fromJson(Map<String, dynamic> json) {
    return TodayStats(
      completedTrips: json['completedTrips'] ?? 0,
      revenue: (json['revenue'] as num).toDouble(),
    );
  }
}

class DriverInfo {
  final String driverId;
  double lat;
  double lng;
  final String? name;
  final String? phone;
  final String? status;
  final String? carModel;
  final String? carNumber;
  double? speed;
  double? bearing;
  DateTime? lastSeenAt;
  final CurrentOrder? currentOrder;  // HTTP dan keladi
  final TodayStats? todayStats;      // HTTP dan keladi

  DriverInfo({
    required this.driverId,
    required this.lat,
    required this.lng,
    this.name,
    this.phone,
    this.status,
    this.carModel,
    this.carNumber,
    this.speed,
    this.bearing,
    this.lastSeenAt,
    this.currentOrder,
    this.todayStats,
  });

  // HTTP /active-drivers dan
  factory DriverInfo.fromHttp(Map<String, dynamic> json) {
    return DriverInfo(
      driverId: json['driverId'],
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      name: json['name'],
      phone: json['phone'],
      status: json['status'],
      carModel: json['carModel'],
      carNumber: json['carNumber'],
      lastSeenAt: json['lastSeenAt'] != null
          ? DateTime.parse(json['lastSeenAt'])
          : null,
      currentOrder: json['currentOrder'] != null
          ? CurrentOrder.fromJson(json['currentOrder'])
          : null,
      todayStats: json['todayStats'] != null
          ? TodayStats.fromJson(json['todayStats'])
          : null,
    );
  }

  // WebSocket admin:all-drivers dan (pozitsiya + id)
  factory DriverInfo.fromSocket(Map<String, dynamic> json) {
    return DriverInfo(
      driverId: json['id'],
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      speed: json['speed'] != null ? (json['speed'] as num).toDouble() : null,
      bearing:
          json['bearing'] != null ? (json['bearing'] as num).toDouble() : null,
    );
  }

  // WebSocket admin:driver-updated — faqat pozitsiyani yangilash
  // Detail ma'lumotlar (name, order, stats) saqlanib qoladi
  void updatePosition(Map<String, dynamic> json) {
    lat = (json['lat'] as num).toDouble();
    lng = (json['lng'] as num).toDouble();
    speed = json['speed'] != null ? (json['speed'] as num).toDouble() : null;
    bearing =
        json['bearing'] != null ? (json['bearing'] as num).toDouble() : null;
    lastSeenAt = DateTime.now();
  }

  Color get statusColor {
    switch (status) {
      case 'available':
        return Colors.green;
      case 'on_trip':
        return Colors.blue;
      case 'offline':
        return Colors.grey;
      default:
        return Colors.orange;
    }
  }

  String get statusLabel {
    switch (status) {
      case 'available':
        return 'Mavjud';
      case 'on_trip':
        return 'Safarда';
      case 'offline':
        return 'Oflayn';
      default:
        return 'Noma\'lum';
    }
  }
}
```

---

### 4.2 AdminMapSocketService

```dart
// lib/services/admin_map_socket_service.dart

import 'package:socket_io_client/socket_io_client.dart' as IO;

class AdminMapSocketService {
  static final AdminMapSocketService _instance =
      AdminMapSocketService._internal();
  factory AdminMapSocketService() => _instance;
  AdminMapSocketService._internal();

  IO.Socket? _socket;

  Function(List<dynamic>)? onAllDrivers;
  Function(Map<String, dynamic>)? onDriverUpdated;

  void connect(String baseUrl) {
    if (_socket != null && _socket!.connected) return;

    _socket = IO.io(
      '$baseUrl/location',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      print('[AdminMapSocket] Connected');
      // Ulangandan keyin darhol subscribe bo'lish
      subscribeToMap();
    });

    _socket!.onDisconnect((_) {
      print('[AdminMapSocket] Disconnected');
    });

    _socket!.onConnectError((err) {
      print('[AdminMapSocket] Error: $err');
    });

    _socket!.on('admin:all-drivers', (data) {
      if (onAllDrivers != null) {
        onAllDrivers!(data is List ? data : []);
      }
    });

    _socket!.on('admin:driver-updated', (data) {
      if (onDriverUpdated != null) {
        onDriverUpdated!(Map<String, dynamic>.from(data));
      }
    });
  }

  void subscribeToMap() {
    _socket?.emit('admin:subscribe', {});
  }

  void refreshAllDrivers() {
    _socket?.emit('admin:get-all-drivers', {});
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  bool get isConnected => _socket?.connected ?? false;
}
```

---

### 4.3 AdminMapApiService

```dart
// lib/services/admin_map_api_service.dart

import 'package:dio/dio.dart';
import '../models/driver_info.dart';

class AdminMapApiService {
  final Dio _dio;

  AdminMapApiService(this._dio);

  Future<List<DriverInfo>> getActiveDrivers() async {
    final response = await _dio.get('/location/active-drivers');
    final List<dynamic> data = response.data;
    return data.map((e) => DriverInfo.fromHttp(e)).toList();
  }
}
```

---

### 4.4 AdminMapScreen

```dart
// lib/screens/admin_map_screen.dart

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/driver_info.dart';
import '../services/admin_map_socket_service.dart';
import '../services/admin_map_api_service.dart';

class AdminMapScreen extends StatefulWidget {
  const AdminMapScreen({Key? key}) : super(key: key);

  @override
  State<AdminMapScreen> createState() => _AdminMapScreenState();
}

class _AdminMapScreenState extends State<AdminMapScreen> {
  final _socketService = AdminMapSocketService();
  late final AdminMapApiService _apiService;

  GoogleMapController? _mapController;

  // driverId -> DriverInfo
  final Map<String, DriverInfo> _drivers = {};
  final Set<Marker> _markers = {};

  String _filterStatus = 'all'; // all | available | on_trip | offline
  DriverInfo? _selectedDriver;

  @override
  void initState() {
    super.initState();
    // _apiService = AdminMapApiService(yourDioInstance);
    _loadInitialDrivers();
    _initSocket();
  }

  Future<void> _loadInitialDrivers() async {
    try {
      final drivers = await _apiService.getActiveDrivers();
      setState(() {
        for (final d in drivers) {
          _drivers[d.driverId] = d;
        }
        _rebuildMarkers();
      });
    } catch (e) {
      debugPrint('Failed to load drivers: $e');
    }
  }

  void _initSocket() {
    _socketService.onAllDrivers = (data) {
      setState(() {
        for (final item in data) {
          final d = DriverInfo.fromSocket(Map<String, dynamic>.from(item));
          // Agar HTTP dan ma'lumot bo'lsa, faqat pozitsiyani yangilash
          if (_drivers.containsKey(d.driverId)) {
            _drivers[d.driverId]!.updatePosition(Map<String, dynamic>.from(item));
          } else {
            _drivers[d.driverId] = d;
          }
        }
        _rebuildMarkers();
      });
    };

    _socketService.onDriverUpdated = (data) {
      final driverId = data['id'] as String;
      setState(() {
        if (_drivers.containsKey(driverId)) {
          _drivers[driverId]!.updatePosition(data);
        } else {
          _drivers[driverId] = DriverInfo.fromSocket(data);
        }
        _rebuildMarkersForDriver(driverId);
      });
    };
  }

  void _rebuildMarkers() {
    _markers.clear();
    for (final driver in _visibleDrivers) {
      _markers.add(_buildMarker(driver));
    }
  }

  void _rebuildMarkersForDriver(String driverId) {
    _markers.removeWhere((m) => m.markerId.value == driverId);
    final driver = _drivers[driverId];
    if (driver != null && _isVisible(driver)) {
      _markers.add(_buildMarker(driver));
    }
  }

  Marker _buildMarker(DriverInfo driver) {
    return Marker(
      markerId: MarkerId(driver.driverId),
      position: LatLng(driver.lat, driver.lng),
      rotation: driver.bearing ?? 0,
      icon: BitmapDescriptor.defaultMarkerWithHue(
        driver.status == 'available'
            ? BitmapDescriptor.hueGreen
            : driver.status == 'on_trip'
                ? BitmapDescriptor.hueBlue
                : BitmapDescriptor.hueRed,
      ),
      infoWindow: InfoWindow(
        title: driver.name ?? 'Haydovchi',
        snippet: driver.carNumber ?? '',
      ),
      onTap: () => _onDriverTap(driver),
    );
  }

  bool _isVisible(DriverInfo driver) {
    if (_filterStatus == 'all') return true;
    return driver.status == _filterStatus;
  }

  List<DriverInfo> get _visibleDrivers {
    return _drivers.values.where(_isVisible).toList();
  }

  void _onDriverTap(DriverInfo driver) {
    setState(() => _selectedDriver = driver);
    _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(LatLng(driver.lat, driver.lng), 16),
    );
    _showDriverBottomSheet(driver);
  }

  void _showDriverBottomSheet(DriverInfo driver) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _DriverDetailSheet(driver: driver),
    );
  }

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Haydovchilar xaritasi (${_visibleDrivers.length})'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _socketService.refreshAllDrivers();
              _loadInitialDrivers();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Status filter
          _FilterBar(
            selected: _filterStatus,
            onChanged: (status) {
              setState(() {
                _filterStatus = status;
                _rebuildMarkers();
              });
            },
            counts: {
              'all': _drivers.length,
              'available': _drivers.values
                  .where((d) => d.status == 'available')
                  .length,
              'on_trip': _drivers.values
                  .where((d) => d.status == 'on_trip')
                  .length,
              'offline': _drivers.values
                  .where((d) => d.status == 'offline')
                  .length,
            },
          ),
          Expanded(
            child: GoogleMap(
              initialCameraPosition: const CameraPosition(
                target: LatLng(41.2995, 69.2401),
                zoom: 12,
              ),
              markers: Set<Marker>.from(_markers),
              onMapCreated: (controller) => _mapController = controller,
              myLocationButtonEnabled: false,
            ),
          ),
        ],
      ),
    );
  }
}

// Filter bar widget
class _FilterBar extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  final Map<String, int> counts;

  const _FilterBar({
    required this.selected,
    required this.onChanged,
    required this.counts,
  });

  @override
  Widget build(BuildContext context) {
    final filters = [
      ('all', 'Hammasi', Colors.grey),
      ('available', 'Mavjud', Colors.green),
      ('on_trip', 'Safarда', Colors.blue),
      ('offline', 'Oflayn', Colors.red),
    ];

    return Container(
      height: 48,
      color: Colors.white,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: filters.map((f) {
          final key = f.$1;
          final label = f.$2;
          final color = f.$3;
          final isSelected = selected == key;
          return GestureDetector(
            onTap: () => onChanged(key),
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: isSelected ? color : color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: color),
              ),
              child: Center(
                child: Text(
                  '$label (${counts[key] ?? 0})',
                  style: TextStyle(
                    color: isSelected ? Colors.white : color,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// Driver detail bottom sheet
class _DriverDetailSheet extends StatelessWidget {
  final DriverInfo driver;

  const _DriverDetailSheet({required this.driver});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: driver.statusColor.withOpacity(0.15),
                child: Icon(Icons.drive_eta, size: 30, color: driver.statusColor),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      driver.name ?? 'Ism mavjud emas',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: driver.statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: driver.statusColor),
                      ),
                      child: Text(
                        driver.statusLabel,
                        style: TextStyle(
                            color: driver.statusColor, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _InfoRow(icon: Icons.phone, label: 'Telefon', value: driver.phone ?? '-'),
          _InfoRow(
              icon: Icons.directions_car,
              label: 'Mashina',
              value: driver.carModel ?? '-'),
          _InfoRow(
              icon: Icons.numbers,
              label: 'Raqam',
              value: driver.carNumber ?? '-'),
          _InfoRow(
              icon: Icons.speed,
              label: 'Tezlik',
              value: driver.speed != null
                  ? '${driver.speed!.toStringAsFixed(1)} km/h'
                  : '-'),
          _InfoRow(
              icon: Icons.location_on,
              label: 'Koordinat',
              value:
                  '${driver.lat.toStringAsFixed(5)}, ${driver.lng.toStringAsFixed(5)}'),
          if (driver.lastSeenAt != null)
            _InfoRow(
              icon: Icons.access_time,
              label: 'Oxirgi faollik',
              value: _formatTime(driver.lastSeenAt!),
            ),

          // Hozirgi buyurtma
          if (driver.currentOrder != null) ...[
            const Divider(height: 24),
            const Text(
              'Hozirgi buyurtma',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            _InfoRow(
              icon: Icons.my_location,
              label: 'Holat',
              value: driver.currentOrder!.statusLabel,
            ),
            _InfoRow(
              icon: Icons.attach_money,
              label: 'Narx',
              value: '${driver.currentOrder!.price.toStringAsFixed(0)} so\'m',
            ),
          ] else ...[
            const Divider(height: 24),
            const _InfoRow(
              icon: Icons.inbox,
              label: 'Buyurtma',
              value: 'Buyurtma yo\'q (bo\'sh)',
            ),
          ],

          // Bugungi statistika
          if (driver.todayStats != null) ...[
            const Divider(height: 24),
            const Text(
              'Bugungi statistika',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),
            _InfoRow(
              icon: Icons.check_circle_outline,
              label: 'Qatnovlar',
              value: '${driver.todayStats!.completedTrips} ta',
            ),
            _InfoRow(
              icon: Icons.payments_outlined,
              label: 'Tushum',
              value: '${driver.todayStats!.revenue.toStringAsFixed(0)} so\'m',
            ),
          ],

          const SizedBox(height: 8),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return '${diff.inSeconds} soniya oldin';
    if (diff.inMinutes < 60) return '${diff.inMinutes} daqiqa oldin';
    return '${diff.inHours} soat oldin';
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 10),
          Text(label,
              style: TextStyle(
                  color: Colors.grey.shade600, fontSize: 14)),
          const Spacer(),
          Text(value,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
```

---

### 4.5 AdminMapScreen ni ishga tushirish

```dart
// App ichida (masalan, admin home page)

Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => const AdminMapScreen()),
);
```

---

## 5. To'liq oqim

```
1. Admin login qiladi    → accessToken oladi (role: admin)
2. AdminMapScreen ochiladi
3. HTTP GET /active-drivers  → barcha haydovchilar (ism, mashina, status)
                              → harita markerlar chiziladi
4. WebSocket ulanish     → AdminMapSocketService.connect()
5. admin:subscribe       → server:
                              - admin ni "admin:map" roomga qo'shadi
                              - lastLocations dan barcha driver pozitsiyasini yuboradi
                        ← admin:all-drivers [ ...pozitsiyalar ]
                              → markerlar pozitsiyalari yangilanadi
6. Haydovchi harakat qilganda:
   Driver: location:driver-update emit qiladi
   Server: order roomga + admin:map roomga yuboradi
                        ← admin:driver-updated { id, lat, lng, speed, bearing }
                              → tegishli marker siljiydi
7. Admin marker bosadi   → DriverInfo bottom sheet ochiladi
8. Admin filter bosadi   → available / on_trip / offline bo'yicha saralaydi
```

---

## 6. Marker ranglari

| Status      | Rang    | Tavsif                    |
|-------------|---------|---------------------------|
| `available` | Yashil  | Bo'sh, buyurtma kutmoqda  |
| `on_trip`   | Ko'k    | Faol safarда              |
| `offline`   | Qizil   | Oflayn / ko'rinmaydi      |
| Noma'lum    | To'q sariq | Redis da bor, status yo'q |

---

## 7. Optimal sozlamalar

- **HTTP polling:** `getActiveDrivers()` ni faqat ekran ochilganda chaqiring. Real-time yangilanishlar WebSocket orqali keladi — har sekundda HTTP so'rov qilmang.
- **Marker rebuild:** Har bir `admin:driver-updated` da faqat shu bir marker qayta quriladi (`_rebuildMarkersForDriver`), barcha markerlar emas.
- **Memory:** Admin ekrandan chiqsa `AdminMapSocketService.disconnect()` chaqirish shart emas — socket ulanib turadi. Faqat app yopilganda uziladi.
