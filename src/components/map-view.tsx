"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { LocationRecord } from "@/types/locations";

type MapViewProps = {
  center: { lat: number; lng: number };
  locations: LocationRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

type MarkerEntry = {
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
};

const markerClassNames = (isSelected: boolean) =>
  [
    "flex",
    "size-4",
    "items-center",
    "justify-center",
    "rounded-full",
    "shadow-lg",
    "transition",
    "hover:scale-110",
    isSelected ? "bg-brand-600 scale-110" : "bg-brand-500",
  ].join(" ");

const createMarkerElement = (label: string, isSelected: boolean) => {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", label);
  element.className = markerClassNames(isSelected);
  return element;
};

export function MapView({ center, locations, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

  const mapStyleUrl = useMemo(
    () => "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl,
      center: [center.lng, center.lat],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    const markers = markersRef.current;

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng, mapStyleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter([center.lng, center.lat]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    locations.forEach((location) => {
      if (location.latitude == null || location.longitude == null) return;

      const popup = new maplibregl.Popup({
        offset: [0, -16],
        closeButton: false,
      }).setHTML(
        `<div class="text-sm font-medium text-zinc-900">${location.name}</div>`,
      );

      const markerElement = createMarkerElement(location.name, location.id === selectedId);

      const marker = new maplibregl.Marker({ element: markerElement })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map);

      markerElement.addEventListener("click", () => {
        onSelect(location.id);
      });

      markersRef.current.set(location.id, { marker, element: markerElement });
    });
  }, [locations, onSelect, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker, element }, id) => {
      const popup = marker.getPopup();
      if (!popup) return;

      if (selectedId && id === selectedId) {
        popup.addTo(map);
        element.className = markerClassNames(true);
        const { lng, lat } = marker.getLngLat();
        map.easeTo({ center: [lng, lat], duration: 500 });
      } else {
        popup.remove();
        element.className = markerClassNames(false);
      }
    });
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-sm md:h-full"
    />
  );
}
