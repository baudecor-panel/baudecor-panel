"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

if (typeof L !== "undefined" && L.DomUtil) {
  const orig = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: HTMLElement) {
    if (!el) return new L.Point(0, 0);
    return orig(el);
  };
}

type RouteRow = {
  id: string;
  customer_name?: string;
  product_name?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type Props = {
  rows: RouteRow[];
  onSave: (orderedIds: string[]) => void;
  onClose: () => void;
  saving: boolean;
};

const SHOWROOM_LAT = 41.935659350080314;
const SHOWROOM_LNG = 19.220623821826575;

export default function ManualRouteMapClient({ rows, onSave, onClose, saving }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [ordered, setOrdered] = useState<string[]>([]);

  const validRows = rows.filter(
    (r) => typeof r.latitude === "number" && typeof r.longitude === "number" &&
      Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
  );

  function makeIcon(label: string, color: string) {
    return L.divIcon({
      className: "",
      html: `<div style="
        width:36px;height:36px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:13px;font-family:sans-serif;
        cursor:pointer;
      ">${label}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  useEffect(() => {
    refreshMarkers(ordered);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered]);

  function refreshMarkers(currentOrdered: string[]) {
    validRows.forEach((row) => {
      const marker = markersRef.current.get(row.id);
      if (!marker) return;
      const idx = currentOrdered.indexOf(row.id);
      if (idx >= 0) {
        marker.setIcon(makeIcon(String(idx + 1), "#3b82f6"));
        marker.setZIndexOffset(1000 + idx);
      } else {
        marker.setIcon(makeIcon("?", "#64748b"));
        marker.setZIndexOffset(0);
      }
    });
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [42.44, 19.26],
      zoom: 8,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    // Showroom marker
    L.marker([SHOWROOM_LAT, SHOWROOM_LNG], {
      icon: L.divIcon({
        className: "",
        html: `<div style="
          width:40px;height:40px;border-radius:50%;
          background:#16a34a;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:11px;font-family:sans-serif;
        ">S</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
      zIndexOffset: 9999,
    }).addTo(map).bindPopup("Showroom (Başlangıç / Polazna tačka)");

    validRows.forEach((row) => {
      const marker = L.marker([row.latitude as number, row.longitude as number], {
        icon: makeIcon("?", "#64748b"),
      }).addTo(map);

      marker.bindTooltip(
        `<b>${row.customer_name || "-"}</b><br/>${row.product_name || "-"}<br/>${row.city || "-"}`,
        { permanent: false, direction: "top" }
      );

      marker.on("click", () => {
        setOrdered((prev) => {
          if (prev.includes(row.id)) {
            return prev.filter((id) => id !== row.id);
          } else {
            return [...prev, row.id];
          }
        });
      });

      markersRef.current.set(row.id, marker);
    });

    // Fit bounds
    if (validRows.length > 0) {
      const latlngs: L.LatLngExpression[] = [
        [SHOWROOM_LAT, SHOWROOM_LNG],
        ...validRows.map((r) => [r.latitude as number, r.longitude as number] as L.LatLngExpression),
      ];
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  function handleReset() {
    setOrdered([]);
    refreshMarkers([]);
  }

  const unorderedRows = validRows.filter((r) => !ordered.includes(r.id));
  const orderedRows = ordered.map((id) => validRows.find((r) => r.id === id)).filter(Boolean) as RouteRow[];

  return (
    <div className="flex h-full">
      {/* Map */}
      <div ref={containerRef} className="flex-1 h-full" />

      {/* Sidebar */}
      <div className="w-80 flex flex-col bg-slate-950 border-l border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Manuel Sıralama</p>
          <p className="mt-1 text-xs text-slate-500">
            Haritadaki noktalara tıklayarak sıra ver. Tekrar tıklarsan iptal olur.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {orderedRows.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Sıralananlar ({orderedRows.length})
              </p>
              <div className="space-y-1.5">
                {orderedRows.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">{row.customer_name || "-"}</p>
                      <p className="truncate text-[10px] text-slate-500">{row.city || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unorderedRows.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sırasız ({unorderedRows.length})
              </p>
              <div className="space-y-1.5">
                {unorderedRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 opacity-60">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">?</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-white">{row.customer_name || "-"}</p>
                      <p className="truncate text-[10px] text-slate-500">{row.city || "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validRows.length === 0 && (
            <p className="text-sm text-slate-500 text-center pt-8">
              Bu grupta koordinatlı kayıt yok.
            </p>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={() => onSave(ordered)}
            disabled={saving || ordered.length === 0}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Kaydediliyor..." : `Sıralamayı Kaydet (${ordered.length}/${validRows.length})`}
          </button>
          <button
            onClick={handleReset}
            className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-400 transition hover:text-white"
          >
            Sıfırla / Reset
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-400 transition hover:text-white"
          >
            Kapat / Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}
