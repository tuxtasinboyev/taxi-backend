# Flutter Real-Time Location & Map Tracking Guide

## Overview

This guide covers everything needed to implement real-time GPS tracking in the Taxi Flutter app.

- **HTTP API** — save locations to database
- **WebSocket** — real-time location streaming between driver and passenger
- **Flutter code** — complete Dart implementations

---

## 1. Architecture

```
Driver App                    Backend                    Passenger App
    |                            |                            |
    |-- location:driver-update ->|                            |
    |                            |-- location:driver-updated->|
    |                            |                            |
    |                            |<-- location:passenger-update
    |<-- location:passenger-updated                           |
    |                            |                            |
    |-- HTTP POST save-driver-location -> DB + Redis          |
```

**WebSocket namespace:** `ws://your-domain/location`

---

## 2. pubspec.yaml Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^2.0.3+1
  geolocator: ^11.0.0
  google_maps_flutter: ^2.5.3
  flutter_secure_storage: ^9.0.0
  dio: ^5.4.0
  permission_handler: ^11.3.0
```

---

## 3. Android Permissions

**`android/app/src/main/AndroidManifest.xml`**

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

---

## 4. iOS Permissions

**`ios/Runner/Info.plist`**

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Taxi app needs your location to find nearby drivers.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Taxi app needs your location in background for trip tracking.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Taxi app needs your location for real-time tracking.</string>
```

---

## 5. HTTP API Endpoints

### 5.1 Save Driver Location

**POST** `/api/location/save-driver-location`

Headers:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body:
```json
{
  "driverId": "uuid-driver-id",
  "orderId": "uuid-order-id",
  "lat": 41.2995,
  "lng": 69.2401,
  "speed": 45.5,
  "bearing": 180.0
}
```

> `orderId` is optional. Send `null` when driver is not on a trip.

Success response `201`:
```json
{
  "success": true,
  "message": "Driver location saved"
}
```

Error response `404`:
```json
{
  "statusCode": 404,
  "message": "Driver with ID uuid not found"
}
```

---

### 5.2 Save Passenger Location

**POST** `/api/location/save-passenger-location`

Headers:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request body:
```json
{
  "userId": "uuid-user-id",
  "orderId": "uuid-order-id",
  "lat": 41.3111,
  "lng": 69.2790,
  "accuracy": 12.5
}
```

> `orderId` is optional. Send `null` when passenger has no active order.

Success response `201`:
```json
{
  "id": "uuid-location-id",
  "user_id": "uuid-user-id",
  "order_id": "uuid-order-id",
  "lat": 41.3111,
  "lng": 69.279,
  "accuracy": 12.5,
  "timestamp": "2026-04-26T10:00:00.000Z"
}
```

Error response `404`:
```json
{
  "statusCode": 404,
  "message": "User with ID uuid not found"
}
```

---

### 5.3 Get Order Route History

**GET** `/api/location/route-history/:orderId`

Headers:
```
Authorization: Bearer <accessToken>
```

Example: `GET /api/location/route-history/uuid-order-id`

Success response `200`:
```json
{
  "driverRoute": [
    {
      "lat": "41.2995",
      "lng": "69.2401",
      "speed": "45.5",
      "timestamp": "2026-04-26T10:00:00.000Z",
      "driver_id": "uuid-driver-id"
    },
    {
      "lat": "41.3010",
      "lng": "69.2430",
      "speed": "38.0",
      "timestamp": "2026-04-26T10:00:05.000Z",
      "driver_id": "uuid-driver-id"
    }
  ],
  "passengerRoute": [
    {
      "lat": 41.3111,
      "lng": 69.279,
      "timestamp": "2026-04-26T10:00:00.000Z",
      "user_id": "uuid-user-id"
    }
  ]
}
```

Error response `404`:
```json
{
  "statusCode": 404,
  "message": "Order not found"
}
```

---

### 5.4 Get All Locations (Admin only)

**GET** `/api/location/all-locations`

Headers:
```
Authorization: Bearer <admin-accessToken>
```

Success response `200`:
```json
{
  "drivers": [
    {
      "driverId": "uuid-driver-id",
      "lat": "41.2995",
      "lng": "69.2401",
      "speed": "45.5",
      "bearing": "180.0",
      "timestamp": "2026-04-26T10:00:00.000Z"
    }
  ],
  "passengers": [
    {
      "userId": "uuid-user-id",
      "lat": 41.3111,
      "lng": 69.279,
      "accuracy": 12.5,
      "timestamp": "2026-04-26T10:00:00.000Z"
    }
  ]
}
```

---

## 6. WebSocket Events

### Connection

```
URL:  ws://your-domain/location
or:   wss://your-domain/location  (production)
```

---

### 6.1 Events You EMIT (client → server)

#### `driver:register`
Driver connects to an order room.

```json
{
  "driverId": "uuid-driver-id",
  "orderId": "uuid-order-id"
}
```

---

#### `passenger:register`
Passenger connects to an order room.

```json
{
  "userId": "uuid-user-id",
  "orderId": "uuid-order-id"
}
```

---

#### `location:driver-update`
Driver sends current GPS position (every 2–5 seconds during trip).

```json
{
  "driverId": "uuid-driver-id",
  "orderId": "uuid-order-id",
  "lat": 41.2995,
  "lng": 69.2401,
  "speed": 45.5,
  "bearing": 180.0
}
```

---

#### `location:passenger-update`
Passenger sends current GPS position (every 10–30 seconds).

```json
{
  "userId": "uuid-user-id",
  "orderId": "uuid-order-id",
  "lat": 41.3111,
  "lng": 69.279,
  "accuracy": 12.5
}
```

---

#### `location:get-current`
Request last known positions for both driver and passenger in an order.

```json
{
  "orderId": "uuid-order-id"
}
```

---

#### `location:nearby-drivers`
Find drivers near a pickup point (before creating order).

```json
{
  "lat": 41.2995,
  "lng": 69.2401,
  "radiusKm": 3
}
```

---

#### `order:finished`
Notify server that order is complete — cleans up room and Redis cache.

```json
{
  "orderId": "uuid-order-id"
}
```

---

### 6.2 Events You LISTEN (server → client)

#### `location:driver-updated`
Received by passenger when driver moves.

```json
{
  "type": "driver",
  "id": "uuid-driver-id",
  "lat": 41.2995,
  "lng": 69.2401,
  "speed": 45.5,
  "bearing": 180.0,
  "timestamp": "2026-04-26T10:00:00.000Z"
}
```

---

#### `location:passenger-updated`
Received by driver when passenger moves.

```json
{
  "type": "passenger",
  "id": "uuid-user-id",
  "lat": 41.3111,
  "lng": 69.279,
  "accuracy": 12.5,
  "timestamp": "2026-04-26T10:00:00.000Z"
}
```

---

#### `location:current`
Response to `location:get-current` — last known positions.

```json
{
  "driver": {
    "type": "driver",
    "id": "uuid-driver-id",
    "lat": 41.2995,
    "lng": 69.2401,
    "speed": 45.5,
    "bearing": 180.0,
    "timestamp": "2026-04-26T10:00:00.000Z"
  },
  "passenger": {
    "type": "passenger",
    "id": "uuid-user-id",
    "lat": 41.3111,
    "lng": 69.279,
    "accuracy": 12.5,
    "timestamp": "2026-04-26T10:00:00.000Z"
  }
}
```

> Either `driver` or `passenger` can be `null` if not yet registered.

---

#### `location:nearby-drivers`
Response to `location:nearby-drivers` — list of drivers within radius.

```json
[
  {
    "member": "uuid-driver-id-1",
    "distance": 0.45,
    "unit": "km"
  },
  {
    "member": "uuid-driver-id-2",
    "distance": 1.23,
    "unit": "km"
  }
]
```

---

#### `driver:accepted`
Sent to all participants in order room when driver registers.

```json
{
  "driverId": "uuid-driver-id",
  "message": "Haydovchi yolingizga chiqdi"
}
```

---

#### `order:finished`
Sent to all participants when order is finished.

```json
{
  "message": "Zakas yakunlandi"
}
```

---

## 7. Flutter Code

### 7.1 LocationSocketService

```dart
// lib/services/location_socket_service.dart

import 'package:socket_io_client/socket_io_client.dart' as IO;

class LocationData {
  final String type;
  final String id;
  final double lat;
  final double lng;
  final double? speed;
  final double? bearing;
  final double? accuracy;
  final DateTime timestamp;

  LocationData({
    required this.type,
    required this.id,
    required this.lat,
    required this.lng,
    this.speed,
    this.bearing,
    this.accuracy,
    required this.timestamp,
  });

  factory LocationData.fromJson(Map<String, dynamic> json) {
    return LocationData(
      type: json['type'],
      id: json['id'],
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      speed: json['speed'] != null ? (json['speed'] as num).toDouble() : null,
      bearing: json['bearing'] != null ? (json['bearing'] as num).toDouble() : null,
      accuracy: json['accuracy'] != null ? (json['accuracy'] as num).toDouble() : null,
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}

class LocationSocketService {
  static final LocationSocketService _instance = LocationSocketService._internal();
  factory LocationSocketService() => _instance;
  LocationSocketService._internal();

  IO.Socket? _socket;
  bool _isConnected = false;

  // Callbacks
  Function(LocationData)? onDriverLocationUpdated;
  Function(LocationData)? onPassengerLocationUpdated;
  Function(Map<String, dynamic>)? onCurrentLocations;
  Function(List<dynamic>)? onNearbyDrivers;
  Function(String)? onDriverAccepted;
  Function()? onOrderFinished;

  void connect(String baseUrl) {
    if (_isConnected) return;

    _socket = IO.io(
      '$baseUrl/location',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      _isConnected = true;
      print('[LocationSocket] Connected');
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      print('[LocationSocket] Disconnected');
    });

    _socket!.on('location:driver-updated', (data) {
      if (onDriverLocationUpdated != null) {
        onDriverLocationUpdated!(LocationData.fromJson(data));
      }
    });

    _socket!.on('location:passenger-updated', (data) {
      if (onPassengerLocationUpdated != null) {
        onPassengerLocationUpdated!(LocationData.fromJson(data));
      }
    });

    _socket!.on('location:current', (data) {
      if (onCurrentLocations != null) {
        onCurrentLocations!(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('location:nearby-drivers', (data) {
      if (onNearbyDrivers != null) {
        onNearbyDrivers!(data as List<dynamic>);
      }
    });

    _socket!.on('driver:accepted', (data) {
      if (onDriverAccepted != null) {
        onDriverAccepted!(data['driverId']);
      }
    });

    _socket!.on('order:finished', (_) {
      if (onOrderFinished != null) {
        onOrderFinished!();
      }
    });
  }

  void registerDriver(String driverId, String orderId) {
    _socket?.emit('driver:register', {
      'driverId': driverId,
      'orderId': orderId,
    });
  }

  void registerPassenger(String userId, String orderId) {
    _socket?.emit('passenger:register', {
      'userId': userId,
      'orderId': orderId,
    });
  }

  void sendDriverLocation({
    required String driverId,
    required String orderId,
    required double lat,
    required double lng,
    required double speed,
    required double bearing,
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

  void sendPassengerLocation({
    required String userId,
    required String orderId,
    required double lat,
    required double lng,
    required double accuracy,
  }) {
    _socket?.emit('location:passenger-update', {
      'userId': userId,
      'orderId': orderId,
      'lat': lat,
      'lng': lng,
      'accuracy': accuracy,
    });
  }

  void getCurrentLocations(String orderId) {
    _socket?.emit('location:get-current', {'orderId': orderId});
  }

  void getNearbyDrivers(double lat, double lng, {double radiusKm = 3}) {
    _socket?.emit('location:nearby-drivers', {
      'lat': lat,
      'lng': lng,
      'radiusKm': radiusKm,
    });
  }

  void finishOrder(String orderId) {
    _socket?.emit('order:finished', {'orderId': orderId});
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _isConnected = false;
  }

  bool get isConnected => _isConnected;
}
```

---

### 7.2 GpsService

```dart
// lib/services/gps_service.dart

import 'dart:async';
import 'package:geolocator/geolocator.dart';

class GpsService {
  static final GpsService _instance = GpsService._internal();
  factory GpsService() => _instance;
  GpsService._internal();

  StreamSubscription<Position>? _subscription;

  Future<bool> requestPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;
    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  // Driver: high accuracy, every 3 seconds, minimum 5 meters moved
  void startDriverTracking(Function(Position) onPosition) async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return;

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5,
    );

    _subscription = Geolocator.getPositionStream(locationSettings: settings)
        .listen(onPosition);
  }

  // Passenger: balanced accuracy, every 15 seconds, minimum 20 meters moved
  void startPassengerTracking(Function(Position) onPosition) async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return;

    const settings = LocationSettings(
      accuracy: LocationAccuracy.medium,
      distanceFilter: 20,
    );

    _subscription = Geolocator.getPositionStream(locationSettings: settings)
        .listen(onPosition);
  }

  void stopTracking() {
    _subscription?.cancel();
    _subscription = null;
  }
}
```

---

### 7.3 LocationApiService (HTTP)

```dart
// lib/services/location_api_service.dart

import 'package:dio/dio.dart';

class LocationApiService {
  final Dio _dio;

  LocationApiService(this._dio);

  Future<void> saveDriverLocation({
    required String driverId,
    String? orderId,
    required double lat,
    required double lng,
    double? speed,
    double? bearing,
  }) async {
    await _dio.post('/location/save-driver-location', data: {
      'driverId': driverId,
      'orderId': orderId,
      'lat': lat,
      'lng': lng,
      'speed': speed,
      'bearing': bearing,
    });
  }

  Future<void> savePassengerLocation({
    required String userId,
    String? orderId,
    required double lat,
    required double lng,
    double? accuracy,
  }) async {
    await _dio.post('/location/save-passenger-location', data: {
      'userId': userId,
      'orderId': orderId,
      'lat': lat,
      'lng': lng,
      'accuracy': accuracy,
    });
  }

  Future<Map<String, dynamic>> getOrderRoute(String orderId) async {
    final response = await _dio.get('/location/route-history/$orderId');
    return response.data;
  }
}
```

---

### 7.4 Driver Map Screen

```dart
// lib/screens/driver_map_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/gps_service.dart';
import '../services/location_socket_service.dart';
import '../services/location_api_service.dart';

class DriverMapScreen extends StatefulWidget {
  final String driverId;
  final String orderId;

  const DriverMapScreen({
    Key? key,
    required this.driverId,
    required this.orderId,
  }) : super(key: key);

  @override
  State<DriverMapScreen> createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen> {
  final _socketService = LocationSocketService();
  final _gpsService = GpsService();
  late final LocationApiService _apiService;

  GoogleMapController? _mapController;
  LatLng? _driverPosition;
  LatLng? _passengerPosition;
  final Set<Marker> _markers = {};

  // Save to DB every 10 location updates (roughly every 30 seconds)
  int _updateCounter = 0;
  static const int _dbSaveInterval = 10;

  @override
  void initState() {
    super.initState();
    // _apiService = LocationApiService(yourDioInstance);
    _initSocket();
    _startTracking();
  }

  void _initSocket() {
    _socketService.onPassengerLocationUpdated = (data) {
      setState(() {
        _passengerPosition = LatLng(data.lat, data.lng);
        _markers.removeWhere((m) => m.markerId.value == 'passenger');
        _markers.add(Marker(
          markerId: const MarkerId('passenger'),
          position: _passengerPosition!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          infoWindow: const InfoWindow(title: 'Yo\'lovchi'),
        ));
      });
    };

    _socketService.onOrderFinished = () {
      _stopTracking();
      Navigator.of(context).pop();
    };

    // Register driver into order room
    _socketService.registerDriver(widget.driverId, widget.orderId);

    // Request current positions
    _socketService.getCurrentLocations(widget.orderId);
  }

  void _startTracking() {
    _gpsService.startDriverTracking((Position position) {
      final latLng = LatLng(position.latitude, position.longitude);

      // Update map marker
      setState(() {
        _driverPosition = latLng;
        _markers.removeWhere((m) => m.markerId.value == 'driver');
        _markers.add(Marker(
          markerId: const MarkerId('driver'),
          position: latLng,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          rotation: position.heading,
          infoWindow: const InfoWindow(title: 'Men (haydovchi)'),
        ));
      });

      // Move camera to follow driver
      _mapController?.animateCamera(
        CameraUpdate.newLatLng(latLng),
      );

      // Send via WebSocket (every update, real-time)
      _socketService.sendDriverLocation(
        driverId: widget.driverId,
        orderId: widget.orderId,
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        bearing: position.heading,
      );

      // Save to DB every N updates
      _updateCounter++;
      if (_updateCounter >= _dbSaveInterval) {
        _updateCounter = 0;
        _apiService.saveDriverLocation(
          driverId: widget.driverId,
          orderId: widget.orderId,
          lat: position.latitude,
          lng: position.longitude,
          speed: position.speed,
          bearing: position.heading,
        );
      }
    });
  }

  void _stopTracking() {
    _gpsService.stopTracking();
  }

  void _onOrderComplete() {
    _socketService.finishOrder(widget.orderId);
    _stopTracking();
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _stopTracking();
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buyurtma bajarmoqda')),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _driverPosition ?? const LatLng(41.2995, 69.2401),
              zoom: 15,
            ),
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            onMapCreated: (controller) {
              _mapController = controller;
            },
          ),
          Positioned(
            bottom: 20,
            left: 20,
            right: 20,
            child: ElevatedButton(
              onPressed: _onOrderComplete,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: const Text(
                'Buyurtmani yakunlash',
                style: TextStyle(fontSize: 16, color: Colors.white),
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

### 7.5 Passenger Map Screen

```dart
// lib/screens/passenger_map_screen.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/gps_service.dart';
import '../services/location_socket_service.dart';
import '../services/location_api_service.dart';

class PassengerMapScreen extends StatefulWidget {
  final String userId;
  final String orderId;

  const PassengerMapScreen({
    Key? key,
    required this.userId,
    required this.orderId,
  }) : super(key: key);

  @override
  State<PassengerMapScreen> createState() => _PassengerMapScreenState();
}

class _PassengerMapScreenState extends State<PassengerMapScreen> {
  final _socketService = LocationSocketService();
  final _gpsService = GpsService();
  late final LocationApiService _apiService;

  GoogleMapController? _mapController;
  LatLng? _driverPosition;
  LatLng? _passengerPosition;
  final Set<Marker> _markers = {};
  String? _acceptedDriverId;

  int _updateCounter = 0;
  static const int _dbSaveInterval = 3; // passenger saves less often

  @override
  void initState() {
    super.initState();
    // _apiService = LocationApiService(yourDioInstance);
    _initSocket();
    _startTracking();
  }

  void _initSocket() {
    // Driver moved — update driver marker on map
    _socketService.onDriverLocationUpdated = (data) {
      setState(() {
        _driverPosition = LatLng(data.lat, data.lng);
        _markers.removeWhere((m) => m.markerId.value == 'driver');
        _markers.add(Marker(
          markerId: const MarkerId('driver'),
          position: _driverPosition!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          rotation: data.bearing ?? 0,
          infoWindow: const InfoWindow(title: 'Haydovchi'),
        ));
      });
    };

    // Driver accepted — show message
    _socketService.onDriverAccepted = (driverId) {
      setState(() => _acceptedDriverId = driverId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Haydovchi yolingizga chiqdi!'),
          backgroundColor: Colors.green,
        ),
      );
    };

    // Current positions on connect
    _socketService.onCurrentLocations = (data) {
      if (data['driver'] != null) {
        final d = data['driver'];
        final pos = LatLng(
          (d['lat'] as num).toDouble(),
          (d['lng'] as num).toDouble(),
        );
        setState(() {
          _driverPosition = pos;
          _markers.removeWhere((m) => m.markerId.value == 'driver');
          _markers.add(Marker(
            markerId: const MarkerId('driver'),
            position: pos,
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
            infoWindow: const InfoWindow(title: 'Haydovchi'),
          ));
        });
        _mapController?.animateCamera(CameraUpdate.newLatLng(pos));
      }
    };

    // Order finished
    _socketService.onOrderFinished = () {
      _gpsService.stopTracking();
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          title: const Text('Buyurtma yakunlandi'),
          content: const Text('Safar muvaffaqiyatli yakunlandi!'),
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

    // Register passenger into order room
    _socketService.registerPassenger(widget.userId, widget.orderId);

    // Request current positions
    _socketService.getCurrentLocations(widget.orderId);
  }

  void _startTracking() {
    _gpsService.startPassengerTracking((Position position) {
      final latLng = LatLng(position.latitude, position.longitude);

      setState(() {
        _passengerPosition = latLng;
        _markers.removeWhere((m) => m.markerId.value == 'passenger');
        _markers.add(Marker(
          markerId: const MarkerId('passenger'),
          position: latLng,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          infoWindow: const InfoWindow(title: 'Men'),
        ));
      });

      // Send via WebSocket
      _socketService.sendPassengerLocation(
        userId: widget.userId,
        orderId: widget.orderId,
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
      );

      // Save to DB periodically
      _updateCounter++;
      if (_updateCounter >= _dbSaveInterval) {
        _updateCounter = 0;
        _apiService.savePassengerLocation(
          userId: widget.userId,
          orderId: widget.orderId,
          lat: position.latitude,
          lng: position.longitude,
          accuracy: position.accuracy,
        );
      }
    });
  }

  @override
  void dispose() {
    _gpsService.stopTracking();
    _mapController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Haydovchini kuting'),
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: _driverPosition ??
                  _passengerPosition ??
                  const LatLng(41.2995, 69.2401),
              zoom: 15,
            ),
            markers: _markers,
            myLocationEnabled: true,
            onMapCreated: (controller) {
              _mapController = controller;
            },
          ),
          if (_acceptedDriverId != null)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade600,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Haydovchi yolingizga chiqdi!',
                  style: TextStyle(color: Colors.white, fontSize: 16),
                  textAlign: TextAlign.center,
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

### 7.6 Nearby Drivers Screen (Before Order)

```dart
// lib/screens/nearby_drivers_screen.dart

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/gps_service.dart';
import '../services/location_socket_service.dart';

class NearbyDriversScreen extends StatefulWidget {
  const NearbyDriversScreen({Key? key}) : super(key: key);

  @override
  State<NearbyDriversScreen> createState() => _NearbyDriversScreenState();
}

class _NearbyDriversScreenState extends State<NearbyDriversScreen> {
  final _socketService = LocationSocketService();
  final _gpsService = GpsService();

  List<dynamic> _nearbyDrivers = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _socketService.onNearbyDrivers = (drivers) {
      setState(() {
        _nearbyDrivers = drivers;
        _isLoading = false;
      });
    };
    _loadNearbyDrivers();
  }

  Future<void> _loadNearbyDrivers() async {
    setState(() => _isLoading = true);
    final position = await _gpsService.getCurrentPosition();
    if (position != null) {
      _socketService.getNearbyDrivers(
        position.latitude,
        position.longitude,
        radiusKm: 3,
      );
    } else {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Yaqin haydovchilar')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _nearbyDrivers.isEmpty
              ? const Center(child: Text('Yaqin atrofda haydovchi topilmadi'))
              : ListView.builder(
                  itemCount: _nearbyDrivers.length,
                  itemBuilder: (context, index) {
                    final driver = _nearbyDrivers[index];
                    return ListTile(
                      leading: const Icon(Icons.drive_eta, color: Colors.green),
                      title: Text('Haydovchi ID: ${driver['member']}'),
                      subtitle: Text(
                        '${(driver['distance'] as num).toStringAsFixed(2)} km uzoqlikda',
                      ),
                    );
                  },
                ),
    );
  }
}
```

---

## 8. App Initialization

```dart
// lib/main.dart (relevant part)

import 'services/location_socket_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Connect WebSocket on app start
  LocationSocketService().connect('http://your-domain.com');

  runApp(const MyApp());
}
```

---

## 9. Complete Flow Summary

### Passenger Flow

```
1. App opens           → LocationSocketService.connect()
2. Search screen       → getNearbyDrivers(lat, lng, radius=3)
                        ← location:nearby-drivers [ list ]
3. Create order (HTTP) → POST /api/orders
4. Order accepted      → registerPassenger(userId, orderId)
                        ← driver:accepted { driverId }
5. Map screen shown    → getCurrentLocations(orderId)
                        ← location:current { driver, passenger }
6. GPS starts          → sendPassengerLocation every 15-30 sec
7. Driver moves        ← location:driver-updated { lat, lng, bearing }
                        → update driver marker on map
8. Order done          ← order:finished
                        → show completion dialog
```

### Driver Flow

```
1. App opens           → LocationSocketService.connect()
2. Order assigned      → registerDriver(driverId, orderId)
3. Map screen shown    → getCurrentLocations(orderId)
                        ← location:current { driver, passenger }
4. GPS starts          → sendDriverLocation every 2-5 sec (WebSocket)
                        → saveDriverLocation every ~30 sec (HTTP to DB)
5. Passenger moves     ← location:passenger-updated { lat, lng }
                        → update passenger marker on map
6. Trip complete       → finishOrder(orderId)
                        → GPS stops, screen closes
```

---

## 10. Update Frequency Recommendations

| Scenario | WebSocket interval | DB save interval |
|---|---|---|
| Driver on trip | 2–5 seconds | Every 10 WS updates (~30 sec) |
| Driver idle | No tracking | No tracking |
| Passenger on trip | 10–30 seconds | Every 3 WS updates (~1 min) |
| Passenger waiting | 30 seconds | Every 3 WS updates |

---

## 11. Error Handling

```dart
// In LocationSocketService.connect()

_socket!.onConnectError((data) {
  print('[LocationSocket] Connection error: $data');
  // Retry after 5 seconds
  Future.delayed(const Duration(seconds: 5), () => connect(baseUrl));
});

_socket!.onError((data) {
  print('[LocationSocket] Error: $data');
});
```

```dart
// In GpsService — handle permission denied
Future<Position?> getCurrentPosition() async {
  final hasPermission = await requestPermission();
  if (!hasPermission) {
    // Show settings dialog
    await Geolocator.openAppSettings();
    return null;
  }
  return await Geolocator.getCurrentPosition(
    desiredAccuracy: LocationAccuracy.high,
  );
}
```
