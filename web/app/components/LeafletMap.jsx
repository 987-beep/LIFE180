"use client";
import { useEffect, useRef } from "react";

/**
 * Interactive Leaflet Map with smooth OpenStreetMap/Carto tiles,
 * circular avatar markers with pulses, speed badges, and auto-centering.
 */
export default function LeafletMap({
  members = [],
  selectedMemberId = null,
  onSelectMember = () => {},
  center = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let isMounted = true;

    const initMap = () => {
      if (!window.L || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = window.L;
      const initialLat = center ? center.lat : 28.6139;
      const initialLng = center ? center.lng : 77.209;
      const initialZoom = center ? 14 : 4;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([initialLat, initialLng], initialZoom);

      // Clean, modern Carto Voyager basemap (Life360 style)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;
    };

    if (window.L) {
      initMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        if (isMounted) initMap();
      };
      document.body.appendChild(script);
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;

    const currentMemberIds = new Set(members.map((m) => m.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentMemberIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    const bounds = L.latLngBounds([]);

    members.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      bounds.extend([m.lat, m.lng]);

      const isSelected = selectedMemberId === m.id;
      const isDriving = (m.speedKmh || 0) > 15;
      const avatarUrl = m.avatar || "/logo-thumb.png";

      const iconHtml = `
        <div class="life-marker ${isSelected ? "selected" : ""} ${isDriving ? "driving" : ""}">
          <div class="marker-pulse"></div>
          <div class="marker-badge">
            <img src="${avatarUrl}" alt="${m.name}" class="marker-avatar" />
            ${
              isDriving
                ? `<span class="marker-speed">${Math.round(m.speedKmh)}<small>km/h</small></span>`
                : ""
            }
          </div>
          <div class="marker-label">${m.name.split(" ")[0]}</div>
          <div class="marker-pin-tip"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: iconHtml,
        iconSize: [48, 58],
        iconAnchor: [24, 52],
      });

      if (markersRef.current[m.id]) {
        markersRef.current[m.id].setLatLng([m.lat, m.lng]);
        markersRef.current[m.id].setIcon(customIcon);
      } else {
        const marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);
        marker.on("click", () => onSelectMember(m.id));
        markersRef.current[m.id] = marker;
      }
    });

    if (selectedMemberId && markersRef.current[selectedMemberId]) {
      const selectedMember = members.find((m) => m.id === selectedMemberId);
      if (selectedMember && selectedMember.lat && selectedMember.lng) {
        map.flyTo([selectedMember.lat, selectedMember.lng], 15, { duration: 1.2 });
      }
    } else if (members.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [members, selectedMemberId, onSelectMember]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
      }}
    />
  );
}
