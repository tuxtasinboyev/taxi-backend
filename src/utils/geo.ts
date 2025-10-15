import haversine from "haversine-distance";

export function calcDistanceKm(
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
) {
    const meters = haversine(
        { lat: start.lat, lon: start.lng },
        { lat: end.lat, lon: end.lng }
    );
    return meters / 1000;
}
