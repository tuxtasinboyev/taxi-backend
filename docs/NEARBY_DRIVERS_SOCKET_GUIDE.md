# Socket — `location:nearby-drivers` — To'liq Qo'llanma

## Umumiy ma'lumot

| Parametr     | Qiymat                          |
|--------------|---------------------------------|
| **Protokol** | WebSocket (Socket.IO)           |
| **Namespace**| `/location`                     |
| **Transport**| `websocket`, `polling`          |
| **Server URL**| `ws://your-domain.com/location` |

---

## 1. Ulanish (Connection)

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000/location", {
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Ulandi:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Uzildi");
});
```

---

## 2. SO'ROV (Emit) — Client → Server

**Event nomi:** `location:nearby-drivers`

### Payload:

```json
{
  "lat": 41.299496,
  "lng": 69.240074,
  "radiusKm": 3
}
```

### Maydonlar:

| Maydon      | Tur      | Majburiy | Default | Tavsif                                      |
|-------------|----------|----------|---------|---------------------------------------------|
| `lat`       | `number` | ✅ Ha    | —       | Passenger ning kenglik koordinatasi          |
| `lng`       | `number` | ✅ Ha    | —       | Passenger ning uzunlik koordinatasi          |
| `radiusKm`  | `number` | ❌ Yo'q  | `3`     | Qidirish radiusi kilometrda                  |

### Misol:

```js
socket.emit("location:nearby-drivers", {
  lat: 41.299496,
  lng: 69.240074,
  radiusKm: 3,
});
```

---

## 3. JAVOB (Response) — Server → Client

**Event nomi:** `location:nearby-drivers`

### Muvaffaqiyatli javob (driverlar bor):

```json
[
  {
    "driverId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "distanceKm": 1.23
  },
  {
    "driverId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "distanceKm": 2.75
  }
]
```

### Yaqinda driver yo'q bo'lsa:

```json
[]
```

### Response maydonlari:

| Maydon        | Tur      | Tavsif                              |
|---------------|----------|-------------------------------------|
| `driverId`    | `string` | Driver ning UUID si                 |
| `distanceKm`  | `number` | Passengerdan driverga masofa (km)   |

### Response ni tinglash:

```js
socket.on("location:nearby-drivers", (drivers) => {
  if (drivers.length === 0) {
    console.log("Yaqin atrofda driver yo'q");
    return;
  }

  drivers.forEach((driver) => {
    console.log(`Driver: ${driver.driverId} — ${driver.distanceKm} km`);
  });
});
```

---

## 4. TO'LIQ FLOW

```
Passenger                  Server (/location)              Redis GEO
    |                             |                             |
    |--[location:nearby-drivers]->|                             |
    |   { lat, lng, radiusKm }    |                             |
    |                             |-[GEORADIUS drivers:geo]---->|
    |                             |  lng, lat, radius km WITHDIST|
    |                             |<-[driverId, distance]--------|
    |<-[location:nearby-drivers]--|                             |
    |  [{ driverId, distanceKm }] |                             |
```

### Ichki ishlash tartibi:

1. Client `location:nearby-drivers` eventini emit qiladi
2. `LocationGateway.handleNearbyDrivers()` ishga tushadi
3. `RedisGeoService.getNearbyDrivers(lat, lng, radiusKm)` chaqiriladi
4. Redis `GEORADIUS drivers:geo <lng> <lat> <radius> km WITHDIST` buyrug'i bajariladi
5. Redis radius ichidagi barcha driverlarni masofasi bilan qaytaradi
6. Natija `location:nearby-drivers` eventi orqali faqat so'ragan clientga yuboriladi

---

## 5. DRIVERLAR QANDAY RO'YXATGA OLINADI

Nearby-drivers da ko'rinishi uchun driver avval o'z joylashuvini yuborishi kerak.  
Driver har **2–5 sekundda** quyidagi eventni jo'natadi:

```js
socket.emit("location:driver-update", {
  driverId: "a1b2c3d4-...",
  orderId: null,       // faol order bo'lmasa null
  lat: 41.305000,
  lng: 69.245000,
  speed: 40,
  bearing: 180,
});
```

Bu event Redis `GEOADD drivers:geo` ga yozadi — shundan keyin nearby-drivers so'rovida ko'rinadi.

---

## 6. TO'LIQ MISOL (JavaScript/TypeScript)

```ts
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:3000/location", {
  transports: ["websocket"],
});

// Ulanish
socket.on("connect", () => {
  console.log("✅ Socket ulandi:", socket.id);

  // Yaqin driverlarni so'rash
  socket.emit("location:nearby-drivers", {
    lat: 41.299496,
    lng: 69.240074,
    radiusKm: 3,
  });
});

// Javobni qabul qilish
socket.on("location:nearby-drivers", (drivers: { driverId: string; distanceKm: number }[]) => {
  if (!drivers.length) {
    console.log("Yaqin atrofda driver topilmadi");
    return;
  }

  console.log(`${drivers.length} ta driver topildi:`);
  drivers.forEach((d) => {
    console.log(`  → ${d.driverId} | ${d.distanceKm.toFixed(2)} km`);
  });
});

// Xato
socket.on("connect_error", (err) => {
  console.error("Ulanish xatosi:", err.message);
});
```

---

## 7. FLUTTER MISOLI (Dart)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket socket = IO.io(
  'http://your-domain.com',
  IO.OptionBuilder()
      .setTransports(['websocket'])
      .setPath('/location/socket.io')
      .build(),
);

socket.onConnect((_) {
  print('✅ Ulandi');

  // So'rov yuborish
  socket.emit('location:nearby-drivers', {
    'lat': 41.299496,
    'lng': 69.240074,
    'radiusKm': 3,
  });
});

// Javob olish
socket.on('location:nearby-drivers', (data) {
  List drivers = data as List;

  if (drivers.isEmpty) {
    print('Driver topilmadi');
    return;
  }

  for (var driver in drivers) {
    print('Driver: ${driver['driverId']} — ${driver['distanceKm']} km');
  }
});
```

---

## 8. XATO HOLATLARI

| Holat                            | Natija                                |
|----------------------------------|---------------------------------------|
| `lat` yoki `lng` NaN bo'lsa      | Server `[]` qaytaradi                 |
| `radiusKm` berilmasa             | Default **3 km** ishlatiladi          |
| Radius ichida driver yo'q        | `[]` — bo'sh array                    |
| Driver hali location yubormagan  | Ro'yxatga tushmaган, ko'rinmaydi      |
| Redis ulanmagan bo'lsa           | Server exception throw qiladi         |

---

## 9. BOSHQA LOCATION EVENTLARI (Qo'shimcha)

| Event (emit)               | Tavsif                                  |
|----------------------------|-----------------------------------------|
| `driver:register`          | Driver order roomga ulanadi             |
| `passenger:register`       | Passenger order roomga ulanadi          |
| `location:driver-update`   | Driver joylashuvini real-time yuboradi  |
| `location:passenger-update`| Passenger joylashuvini yuboradi         |
| `location:get-current`     | Order uchun oxirgi joylashuvni olish    |
| `location:nearby-drivers`  | **Yaqin driverlarni topish** ← shu     |
| `order:finished`           | Order yakunlanganda room tozalanadi     |
| `admin:subscribe`          | Admin xarita roomga ulanadi             |
