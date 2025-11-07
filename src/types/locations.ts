export type HoursDayKey =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export type HoursSchedule = Partial<Record<HoursDayKey, Array<[string, string]>>>;

export type LocationCategory =
  | "shelter"
  | "warming_cooling"
  | "food_bank"
  | "drop_in"
  | "washroom"
  | "harm_reduction"
  | "outreach"
  | "clinic"
  | "other";

export type LocationGenderRestriction =
  | "women"
  | "men"
  | "all"
  | "youth"
  | "family";

export type LocationRecord = {
  id: string;
  name: string;
  category: LocationCategory;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  meters: number | null;
  capacity: number | null;
  beds_available: number | null;
  hours: HoursSchedule | null;
  accessible: boolean | null;
  pets_allowed: boolean | null;
  gender_restriction: LocationGenderRestriction | null;
  lgbtq_friendly: boolean | null;
  updated_at: string | null;
  last_verified_at: string | null;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
};
