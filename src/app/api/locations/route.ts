import { NextRequest, NextResponse } from "next/server";

import { mockLocations } from "@/data/mock-locations";
import { getSupabaseClient } from "@/lib/supabase";
import type { LocationRecord } from "@/types/locations";
import { attachDistance } from "@/utils/geo";
import { isOpenNow } from "@/utils/hours";

type NearbyLocationRow = {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  meters: number | null;
  capacity: number | null;
  beds_available: number | null;
  hours: Record<string, Array<[string, string]>> | null;
  accessible?: boolean | null;
  pets_allowed?: boolean | null;
  gender_restriction?: string | null;
  lgbtq_friendly?: boolean | null;
  updated_at?: string | null;
  last_verified_at?: string | null;
  source?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  geom?: unknown;
};

const DEFAULT_RADIUS_KM = 5;
const MAX_RESULTS = 50;

const parseNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseBooleanParam = (value: string | null): boolean | null => {
  if (value === null) return null;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const toLocationRecord = (row: NearbyLocationRow): LocationRecord => {
  const [latitude, longitude] = extractCoordinates(row);

  return {
    id: row.id,
    name: row.name,
    category: row.category as LocationRecord["category"],
    phone: row.phone ?? null,
    website: row.website ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    meters: row.meters ?? null,
    capacity: row.capacity ?? null,
    beds_available: row.beds_available ?? null,
    hours: row.hours ?? null,
    accessible: row.accessible ?? null,
    pets_allowed: row.pets_allowed ?? null,
    gender_restriction: row.gender_restriction ?? null,
    lgbtq_friendly: row.lgbtq_friendly ?? null,
    updated_at: row.updated_at ?? null,
    last_verified_at: row.last_verified_at ?? null,
    source: row.source ?? null,
    latitude,
    longitude,
  };
};

const extractCoordinates = (row: NearbyLocationRow): [number | null, number | null] => {
  if (typeof row.latitude === "number" && typeof row.longitude === "number") {
    return [row.latitude, row.longitude];
  }

  if (typeof row.lat === "number" && typeof row.lng === "number") {
    return [row.lat, row.lng];
  }

  if (row.geom && typeof row.geom === "object" && "coordinates" in row.geom) {
    const geom = row.geom as { coordinates?: [number, number] };
    if (Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      const [lng, lat] = geom.coordinates;
      return [lat, lng];
    }
  }

  if (row.geom && typeof row.geom === "string") {
    try {
      const parsed = JSON.parse(row.geom) as { coordinates?: [number, number] };
      if (Array.isArray(parsed.coordinates) && parsed.coordinates.length >= 2) {
        const [lng, lat] = parsed.coordinates;
        return [lat, lng];
      }
    } catch {
      // ignore parse errors
    }
  }

  return [null, null];
};

const applyFilters = (
  records: LocationRecord[],
  {
    category,
    openNow,
    accessible,
    pets,
    gender,
    radiusKm,
    lat,
    lng,
  }: {
    category: string | null;
    openNow: boolean;
    accessible: boolean | null;
    pets: boolean | null;
    gender: string | null;
    radiusKm: number;
    lat: number;
    lng: number;
  },
) => {
  return records
    .map((record) => {
      if (record.meters != null) return record;
      return attachDistance(record, lat, lng);
    })
    .filter((record) => {
      if (category && record.category !== category) return false;
      if (accessible !== null && record.accessible !== accessible) return false;
      if (pets !== null && record.pets_allowed !== pets) return false;
      if (gender && record.gender_restriction && record.gender_restriction !== gender) {
        return false;
      }
      if (openNow && !isOpenNow(record.hours)) return false;
      if (
        record.meters != null &&
        Number.isFinite(record.meters) &&
        record.meters > radiusKm * 1000
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const distanceA = a.meters ?? Number.POSITIVE_INFINITY;
      const distanceB = b.meters ?? Number.POSITIVE_INFINITY;
      return distanceA - distanceB;
    })
    .slice(0, MAX_RESULTS);
};

const buildResponse = (
  records: LocationRecord[],
  filters: Parameters<typeof applyFilters>[1],
) => {
  const filtered = applyFilters(records, filters);
  return NextResponse.json({ results: filtered });
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = parseNumber(searchParams.get("lat"));
  const lng = parseNumber(searchParams.get("lng"));

  if (lat === null || lng === null) {
    return NextResponse.json(
      { error: "Query parameters 'lat' and 'lng' are required." },
      { status: 400 },
    );
  }

  const radiusKm = parseNumber(searchParams.get("radius_km")) ?? DEFAULT_RADIUS_KM;
  const category = searchParams.get("category");
  const openNowFlag = parseBooleanParam(searchParams.get("open_now")) ?? false;
  const accessibleFlag = parseBooleanParam(searchParams.get("accessible"));
  const petsFlag = parseBooleanParam(searchParams.get("pets"));
  const gender = searchParams.get("gender");
  const genderFilter = gender ?? null;

  const filterOptions = {
    category,
    openNow: openNowFlag,
    accessible: accessibleFlag,
    pets: petsFlag,
    gender: genderFilter,
    radiusKm,
    lat,
    lng,
  };

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc("nearby_locations", {
        lat,
        lng,
        radius_km: radiusKm,
        cat: category ?? null,
        only_open: openNowFlag,
        need_accessible: accessibleFlag,
        need_pets: petsFlag,
        gender_focus: genderFilter,
      });

      if (error) {
        console.warn("Supabase RPC nearby_locations error:", error);
      } else if (data) {
        const records = (data as NearbyLocationRow[]).map(toLocationRecord);
        return buildResponse(records, filterOptions);
      }
    } catch (error) {
      console.warn("Supabase RPC nearby_locations threw:", error);
    }
  }

  const fallbackRecords = mockLocations.map((record) => ({
    ...record,
    meters: null,
  }));

  return buildResponse(fallbackRecords, filterOptions);
}
