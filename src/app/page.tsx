"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { MapView } from "@/components/map-view";
import type { LocationRecord } from "@/types/locations";
import { isOpenNow } from "@/utils/hours";

type Coordinates = { lat: number; lng: number };

type FilterState = {
  category: "all" | LocationRecord["category"];
  radiusKm: number;
  openNow: boolean;
  accessible: boolean | null;
  pets: boolean | null;
  gender: "all" | "women" | "men" | "youth" | "family";
};

type ApiResponse = {
  results: LocationRecord[];
};

const DEFAULT_COORDS: Coordinates = { lat: 43.6532, lng: -79.3832 }; // Toronto core
const STORAGE_KEY = "safebed:last-results";

const CATEGORY_OPTIONS: Array<{ value: FilterState["category"]; label: string }> = [
  { value: "all", label: "All services" },
  { value: "shelter", label: "Shelters" },
  { value: "warming_cooling", label: "Warming & cooling" },
  { value: "food_bank", label: "Food support" },
  { value: "drop_in", label: "Drop-in" },
  { value: "washroom", label: "Public washrooms" },
  { value: "harm_reduction", label: "Harm reduction" },
  { value: "outreach", label: "Outreach teams" },
  { value: "clinic", label: "Health clinics" },
  { value: "other", label: "Other supports" },
];

const GENDER_OPTIONS: Array<{ value: FilterState["gender"]; label: string }> = [
  { value: "all", label: "All genders" },
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "youth", label: "Youth" },
  { value: "family", label: "Family" },
];

const RADIUS_OPTIONS = [2, 5, 10, 20];

const formatDistance = (meters: number | null) => {
  if (meters == null || Number.isNaN(meters)) return "—";
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const createQueryString = (coords: Coordinates, filters: FilterState) => {
  const params = new URLSearchParams({
    lat: coords.lat.toString(),
    lng: coords.lng.toString(),
    radius_km: filters.radiusKm.toString(),
  });

  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.openNow) params.set("open_now", "true");
  if (filters.accessible !== null) params.set("accessible", String(filters.accessible));
  if (filters.pets !== null) params.set("pets", String(filters.pets));
  if (filters.gender !== "all") params.set("gender", filters.gender);

  return params.toString();
};

const safeReadLocalStorage = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const safeWriteLocalStorage = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
};

const useUserCoordinates = (fallback: Coordinates) => {
  const [coords, setCoords] = useState<Coordinates>(fallback);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "unsupported">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setStatus("error");
      setErrorMessage("Running in a non-browser environment.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMessage("Device does not support geolocation.");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("ready");
      },
      (error) => {
        setStatus("error");
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage("Location permission was denied. Showing results near downtown.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMessage("Unable to determine location. Showing results near downtown.");
            break;
          case error.TIMEOUT:
            setErrorMessage("Location request timed out. Showing results near downtown.");
            break;
          default:
            setErrorMessage("Could not load location. Showing results near downtown.");
        }
      },
      {
        timeout: 10_000,
      },
    );
  }, []);

  return { coords, status, errorMessage };
};

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>({
    category: "all",
    radiusKm: 5,
    openNow: false,
    accessible: null,
    pets: null,
    gender: "all",
  });

  const { coords, status: geoStatus, errorMessage: geoError } = useUserCoordinates(DEFAULT_COORDS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cachedResults, setCachedResults] = useState<LocationRecord[] | null>(null);

  useEffect(() => {
    const cached = safeReadLocalStorage<LocationRecord[]>(STORAGE_KEY);
    if (cached) {
      setCachedResults(cached);
      if (!selectedId && cached.length > 0) {
        setSelectedId(cached[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryKey = useMemo(
    () => [
      "locations",
      coords.lat.toFixed(3),
      coords.lng.toFixed(3),
      filters.category,
      filters.radiusKm,
      filters.openNow,
      filters.accessible,
      filters.pets,
      filters.gender,
    ],
    [
      coords.lat,
      coords.lng,
      filters.accessible,
      filters.category,
      filters.gender,
      filters.openNow,
      filters.pets,
      filters.radiusKm,
    ],
  );

  const fetchLocations = useCallback(async (): Promise<ApiResponse> => {
    const params = createQueryString(coords, filters);
    const response = await fetch(`/api/locations?${params}`);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to load nearby services.");
    }

    return (await response.json()) as ApiResponse;
  }, [coords, filters]);

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: fetchLocations,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: cachedResults ? { results: cachedResults } : undefined,
  });

  useEffect(() => {
    if (data?.results) {
      setCachedResults(data.results);
      safeWriteLocalStorage(STORAGE_KEY, data.results);
      if (!selectedId && data.results.length > 0) {
        setSelectedId(data.results[0].id);
      }
    }
  }, [data?.results, selectedId]);

  const results = useMemo(
    () => data?.results ?? [],
    [data?.results],
  );

  useEffect(() => {
    if (!results.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !results.some((location) => location.id === selectedId)) {
      setSelectedId(results[0].id);
    }
  }, [results, selectedId]);

  const openCount = useMemo(
    () => results.filter((location) => isOpenNow(location.hours)).length,
    [results],
  );

  const onSelectLocation = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const loadingState =
    isLoading && !(data?.results?.length || cachedResults?.length)
      ? "Loading nearby supports…"
      : null;

  const infoBanner = geoError ?? (geoStatus === "unsupported" ? "Geolocation is not supported on this device. Use manual filters to explore services." : null);

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#f3f6ff] via-white to-white text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-600">SafeBed</p>
            <h1 className="text-2xl font-semibold md:text-3xl">
              Find warm beds, meals, and outreach near you
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              Real-time view of shelters, warming &amp; cooling centres, food programs, and outreach
              teams. Toggle filters to match accessibility, family needs, pets, and operating hours.
            </p>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <p className="font-medium">Crisis support</p>
            <p>Call 911 for emergencies. For distress support dial 988 in Canada.</p>
          </div>
        </div>
      </header>

      {infoBanner && (
        <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="mx-auto max-w-6xl">{infoBanner}</div>
        </div>
      )}

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <div className="flex w-full flex-col gap-4 md:w-2/3">
          <MapView
            center={coords}
            locations={results}
            selectedId={selectedId}
            onSelect={onSelectLocation}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            {loadingState ? (
              <span>{loadingState}</span>
            ) : (
              <>
                <span className="font-medium text-zinc-800">
                  {results.length} services within {filters.radiusKm} km
                </span>
                <span>·</span>
                <span>{openCount} open now</span>
                {isFetching && <span className="animate-pulse text-zinc-400">Updating…</span>}
              </>
            )}
          </div>
        </div>

        <aside className="flex w-full flex-col gap-4 md:w-1/3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Filters</h2>
            <div className="mt-3 flex flex-col gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Category
                </span>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  value={filters.category}
                  onChange={(event) =>
                    handleFilterChange("category", event.target.value as FilterState["category"])
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Radius
                </span>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  value={filters.radiusKm}
                  onChange={(event) =>
                    handleFilterChange("radiusKm", Number.parseInt(event.target.value, 10))
                  }
                >
                  {RADIUS_OPTIONS.map((radius) => (
                    <option key={radius} value={radius}>
                      {radius} km
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-500"
                    checked={filters.openNow}
                    onChange={(event) => handleFilterChange("openNow", event.target.checked)}
                  />
                  <span className="text-sm font-medium text-zinc-700">Open now</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-500"
                    checked={filters.accessible === true}
                    onChange={(event) =>
                      handleFilterChange("accessible", event.target.checked ? true : null)
                    }
                  />
                  <span className="text-sm font-medium text-zinc-700">Accessible</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-500"
                    checked={filters.pets === true}
                    onChange={(event) =>
                      handleFilterChange("pets", event.target.checked ? true : null)
                    }
                  />
                  <span className="text-sm font-medium text-zinc-700">Pet friendly</span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Focus
                  </span>
                  <select
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    value={filters.gender}
                    onChange={(event) =>
                      handleFilterChange("gender", event.target.value as FilterState["gender"])
                    }
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <h2 className="border-b border-zinc-100 px-4 py-3 text-base font-semibold text-zinc-900">
              Nearby services
            </h2>
            <div className="max-h-[540px] space-y-3 overflow-y-auto px-4 py-3">
              {queryError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {queryError.message}
                </div>
              )}

              {!results.length && !queryError && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-8 text-center text-sm text-zinc-600">
                  No services found within {filters.radiusKm} km. Try widening your search.
                </div>
              )}

              {results.map((location) => {
                const open = isOpenNow(location.hours);
                const distance = formatDistance(location.meters);
                const isSelected = location.id === selectedId;
                const lastVerified = location.last_verified_at ?? location.updated_at;
                const bedsAvailable =
                  typeof location.beds_available === "number" ? location.beds_available : null;
                const capacity = typeof location.capacity === "number" ? location.capacity : null;
                const directionsUrl =
                  location.latitude != null && location.longitude != null
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${location.latitude},${location.longitude}`,
                      )}`
                    : location.address
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`
                    : null;

                return (
                  <article
                    key={location.id}
                    className={`flex flex-col gap-3 rounded-xl border px-3 py-3 transition hover:shadow-md ${
                      isSelected
                        ? "border-brand-400 bg-brand-50/60 shadow-sm"
                        : "border-zinc-200 bg-white"
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectLocation(location.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectLocation(location.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">{location.name}</h3>
                        <p className="text-xs uppercase tracking-wide text-zinc-500">
                          {CATEGORY_OPTIONS.find((option) => option.value === location.category)
                            ?.label ?? location.category}
                        </p>
                      </div>
                      <span className="rounded-full border px-2 py-1 text-xs font-medium text-zinc-500">
                        {distance}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-1 font-medium ${
                          open
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {open ? "Open now" : "Closed"}
                      </span>
                      {location.accessible && (
                        <span className="rounded-full bg-sky-100 px-2 py-1 font-medium text-sky-700">
                          Accessible
                        </span>
                      )}
                      {location.pets_allowed && (
                        <span className="rounded-full bg-orange-100 px-2 py-1 font-medium text-orange-700">
                          Pets OK
                        </span>
                      )}
                      {location.gender_restriction &&
                        location.gender_restriction !== "all" && (
                          <span className="rounded-full bg-purple-100 px-2 py-1 font-medium text-purple-700">
                            {location.gender_restriction}
                          </span>
                        )}
                    </div>

                    {location.address && (
                      <p className="text-sm text-zinc-600">{location.address}</p>
                    )}
                    {location.notes && (
                      <p className="text-xs text-zinc-500">{location.notes}</p>
                    )}
                    {(bedsAvailable !== null || capacity !== null) && (
                      <p className="text-sm font-medium text-zinc-700">
                        Beds available:{" "}
                        {bedsAvailable !== null ? bedsAvailable : "Unknown"}
                        {capacity !== null ? ` / ${capacity}` : ""}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {location.phone && (
                        <a
                          href={`tel:${location.phone}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Call
                        </a>
                      )}
                      {location.address && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-brand-200 hover:text-brand-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (typeof navigator !== "undefined" && navigator.clipboard) {
                              navigator.clipboard.writeText(location.address).catch(() => {
                                // ignore clipboard errors
                              });
                            }
                          }}
                        >
                          Copy address
                        </button>
                      )}
                      {directionsUrl && (
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-brand-200 hover:text-brand-700"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Directions
                        </a>
                      )}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-zinc-400">
                      <p>
                        Last verified:{" "}
                        {lastVerified ? new Date(lastVerified).toLocaleDateString() : "Unknown"}
                      </p>
                      {location.source && <p>Source: {location.source}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
