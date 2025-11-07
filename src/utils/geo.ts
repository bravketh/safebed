import type { LocationRecord } from "@/types/locations";

const EARTH_RADIUS_KM = 6371;

const toRadians = (value: number) => (value * Math.PI) / 180;

export const distanceInKm = (
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number,
) => {
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(targetLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

export const attachDistance = (
  record: LocationRecord,
  originLat: number,
  originLng: number,
) => {
  if (record.latitude == null || record.longitude == null) {
    return { ...record, meters: null };
  }

  const km = distanceInKm(
    originLat,
    originLng,
    record.latitude,
    record.longitude,
  );
  return { ...record, meters: Math.round(km * 1000) };
};
