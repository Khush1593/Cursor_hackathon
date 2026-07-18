/**
 * Demo ER locations for emergency geolocation (hackathon — not live maps data).
 */
export type DemoEr = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export const DEMO_EMERGENCY_ROOMS: DemoEr[] = [
  {
    name: 'City General Hospital ER',
    address: '100 Main St',
    latitude: 37.7749,
    longitude: -122.4194,
  },
  {
    name: 'Bayview Medical Center ER',
    address: '450 Harbor Ave',
    latitude: 37.7599,
    longitude: -122.4148,
  },
  {
    name: 'Mission Urgent & Trauma',
    address: '2200 Mission St',
    latitude: 37.7615,
    longitude: -122.4192,
  },
];

export type NearestEr = {
  name: string;
  address: string;
  distance_miles: number;
};

/** Haversine distance in miles. */
export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function findNearestEr(
  latitude: number,
  longitude: number,
): NearestEr | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  let best: NearestEr | null = null;
  for (const er of DEMO_EMERGENCY_ROOMS) {
    const miles = distanceMiles(latitude, longitude, er.latitude, er.longitude);
    if (!best || miles < best.distance_miles) {
      best = {
        name: er.name,
        address: er.address,
        distance_miles: Math.round(miles * 10) / 10,
      };
    }
  }
  return best;
}
