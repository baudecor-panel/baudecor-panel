"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

// Patch Leaflet's getPosition to handle undefined DOM elements gracefully.
// This prevents "Cannot read properties of undefined (reading '_leaflet_pos')"
// errors that occur during React component cleanup / animation races.
if (typeof L !== "undefined" && L.DomUtil) {
  const _origGetPosition = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: HTMLElement) {
    if (!el) return new L.Point(0, 0);
    return _origGetPosition(el);
  };
}

type Row = {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  product_name?: string;
  quantity?: number | null;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  route_order?: number | null;
  shipment_status?: string;
  payment_status?: string;
  delivery_method?: string;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  dispatch_group?: string | null;
};

type GroupBucket = {
  key: string;
  rows: Row[];
  color: string;
};

const SHOWROOM_LAT = 41.935659350080314;
const SHOWROOM_LNG = 19.220623821826575;
const DEFAULT_CENTER: [number, number] = [42.44, 19.26];

const GROUP_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#eab308",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f43f5e",
  "#8b5cf6",
];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function getStatusColor(status?: string) {
  switch (status) {
    case "Yüklendi / Loaded":
      return "#eab308";
    case "Yolda / On Route":
      return "#2563eb";
    case "Teslim Edildi / Delivered":
      return "#16a34a";
    case "İptal / Cancelled":
      return "#dc2626";
    default:
      return "#64748b";
  }
}

function getMarkerColor(row: Row) {
  if (row.delivery_method === "Kurir / Kurye") {
    return "#f97316";
  }

  if (row.delivery_method === "Sopstveno vozilo / Kendi Araç") {
    return "#3b82f6";
  }

  return getStatusColor(row.shipment_status);
}

function getGroupColor(index: number) {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

function normalizeGroupName(value?: string | null) {
  return (value || "").trim();
}

function getGroupLabel(key: string) {
  return key === "__UNGROUPED__" ? "Grupsuz / Ungrouped" : key;
}

function isValidLatLngTuple(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    value[0] >= -90 &&
    value[0] <= 90 &&
    value[1] >= -180 &&
    value[1] <= 180
  );
}

function toLeafletLatLngs(points: unknown[]): L.LatLng[] {
  const result: L.LatLng[] = [];

  for (const point of points) {
    if (!isValidLatLngTuple(point)) continue;
    result.push(L.latLng(point[0], point[1]));
  }

  return result;
}

function isMapUsable(map: L.Map | null): map is L.Map {
  if (!map) return false;

  try {
    if (!(map as any)._leaflet_id) return false;
    const container = (map as any)._container;
    if (!container || !document.contains(container)) return false;
    const overlayPane = map.getPane("overlayPane");
    return !!overlayPane;
  } catch {
    return false;
  }
}

function safeRemoveLayer(map: L.Map | null, layer: L.Layer | null) {
  if (!map || !layer) return;
  try {
    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  } catch {
    // ignore
  }
}

function safeSetView(map: L.Map | null, center: [number, number], zoom: number) {
  if (!isMapUsable(map)) return;
  try {
    map.setView(center, zoom);
  } catch {
    // ignore
  }
}

function safeFitBounds(map: L.Map | null, points: unknown[]) {
  if (!isMapUsable(map)) return;

  const latLngs = toLeafletLatLngs(points);
  if (latLngs.length === 0) {
    safeSetView(map, DEFAULT_CENTER, 10);
    return;
  }

  try {
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [80, 80] });
  } catch {
    safeSetView(map, DEFAULT_CENTER, 10);
  }
}

function drawPolylineSafe(
  map: L.Map | null,
  points: unknown[],
  options: L.PolylineOptions
): L.Polyline | null {
  if (!isMapUsable(map)) return null;

  const latLngs = toLeafletLatLngs(points);
  if (latLngs.length < 2) return null;

  try {
    const polyline = L.polyline(latLngs, options);
    map.addLayer(polyline);
    return polyline;
  } catch {
    return null;
  }
}

function buildGroupBuckets(rows: Row[]): GroupBucket[] {
  const groups = new Map<string, Row[]>();

  rows.forEach((row) => {
    const key = normalizeGroupName(row.dispatch_group) || "__UNGROUPED__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return Array.from(groups.entries())
    .sort((a, b) => {
      if (a[0] === "__UNGROUPED__") return 1;
      if (b[0] === "__UNGROUPED__") return -1;
      return a[0].localeCompare(b[0]);
    })
    .map(([key, groupedRows], index) => ({
      key,
      rows: groupedRows,
      color: getGroupColor(index),
    }));
}

export default function DispatchMapClient({
  rows,
  activeGroup,
  selectedRow,
  onMarkDelivered,
  onMarkPaid,
}: {
  rows: Row[];
  activeGroup: string | null;
  selectedRow: Row | null;
  onMarkDelivered: (row: Row) => Promise<void>;
  onMarkPaid: (row: Row) => Promise<void>;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const requestSeqRef = useRef(0);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Suppress Leaflet's _leaflet_pos animation errors that occur during
  // React cleanup / component unmount race conditions.
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (event.message?.includes("_leaflet_pos")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    }
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  const legendGroups = useMemo(() => {
    return buildGroupBuckets(
      rows
        .filter(
          (r) =>
            isFiniteNumber(r.latitude) &&
            isFiniteNumber(r.longitude) &&
            (r.latitude as number) >= -90 &&
            (r.latitude as number) <= 90 &&
            (r.longitude as number) >= -180 &&
            (r.longitude as number) <= 180
        )
        .sort((a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999))
    );
  }, [rows]);

  useEffect(() => {
    if (!mapElRef.current) return;
    if (mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center: DEFAULT_CENTER,
      zoom: 10,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      animate: false,
      animateAddingMarkers: false,
    });

    cluster.addTo(map);

    const showroomMarker = L.circleMarker([SHOWROOM_LAT, SHOWROOM_LNG], {
      radius: 22,
      color: "#fff",
      weight: 3,
      fillColor: "#22c55e",
      fillOpacity: 1,
    });

    showroomMarker.bindTooltip("S", {
      permanent: true,
      direction: "center",
      className: "dispatch-order-label",
    });

    showroomMarker.bindPopup(`
      <div>
        <b>Showroom</b><br/>
        Başlangıç noktası / Start point
      </div>
    `);

    showroomMarker.addTo(map);

    mapRef.current = map;
    clusterRef.current = cluster;

    requestAnimationFrame(() => {
      const currentMap = mapRef.current;
      if (!isMapUsable(currentMap)) return;

      try {
        currentMap.invalidateSize();
      } catch {
        // ignore
      }
    });

    return () => {
      requestSeqRef.current += 1;

      const currentMap = mapRef.current;

      polylinesRef.current.forEach((polyline) => {
        safeRemoveLayer(currentMap, polyline);
      });
      polylinesRef.current = [];
      markersRef.current.clear();

      try {
        cluster.clearLayers();
      } catch {
        // ignore
      }

      try {
        map.stop();
      } catch {
        // ignore
      }

      try {
        map.remove();
      } catch {
        // ignore
      }

      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const currentMap = mapRef.current;
    const cluster = clusterRef.current;

    if (!isMapUsable(currentMap) || !cluster) return;

    const requestId = ++requestSeqRef.current;
    let cancelled = false;
    const controller = new AbortController();

    try {
      cluster.clearLayers();
    } catch {
      // ignore
    }

    polylinesRef.current.forEach((polyline) => {
      safeRemoveLayer(currentMap, polyline);
    });
    polylinesRef.current = [];
    markersRef.current.clear();

    const validRows = rows
      .filter(
        (r) =>
          isFiniteNumber(r.latitude) &&
          isFiniteNumber(r.longitude) &&
          (r.latitude as number) >= -90 &&
          (r.latitude as number) <= 90 &&
          (r.longitude as number) >= -180 &&
          (r.longitude as number) <= 180
      )
      .sort((a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999));

    if (validRows.length === 0) {
      safeSetView(currentMap, DEFAULT_CENTER, 10);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const groupedBuckets = buildGroupBuckets(validRows);
    const allCustomerPoints: [number, number][] = [];

    groupedBuckets.forEach((bucket) => {
      const sortedRows = [...bucket.rows].sort(
        (a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999)
      );

      sortedRows.forEach((row, i) => {
        const lat = row.latitude as number;
        const lng = row.longitude as number;
        const point: [number, number] = [lat, lng];
        const order = row.route_order ?? i + 1;

        allCustomerPoints.push(point);

        try {
          const marker = L.circleMarker(point, {
            radius: 18,
            color: "#fff",
            weight: 2,
            fillColor: getMarkerColor(row),
            fillOpacity: 1,
          });

          marker.bindTooltip(String(order), {
            permanent: true,
            direction: "center",
            className: "dispatch-order-label",
          });

          const deliverButtonId = `deliver-${row.id}`;
          const payButtonId = `pay-${row.id}`;
          const showPayButton = row.payment_status !== "Ödendi / Paid";

          marker.bindPopup(`
            <div style="min-width:240px">
              <b>${row.customer_name || "-"}</b><br/>
              ${row.city || "-"}<br/>
              ${row.customer_address || "-"}<br/>
              Telefon: ${row.customer_phone || "-"}<br/>
              Ürün: ${row.product_name || "-"}<br/>
              Adet: ${row.quantity ?? "-"}<br/>
              Sıra: ${order}<br/>
              Durum: ${row.shipment_status || "-"}<br/>
              Ödeme: ${row.payment_status || "-"}<br/>
              Yöntem: ${row.delivery_method || "-"}<br/>
              Araç: ${row.assigned_vehicle || "-"}<br/>
              Kurye: ${row.assigned_courier || "-"}<br/>
              Grup: ${getGroupLabel(bucket.key)}<br/><br/>

              <div style="display:flex;flex-direction:column;gap:8px">
                ${
                  showPayButton
                    ? `
                  <button
                    id="${payButtonId}"
                    style="
                      width:100%;
                      border:none;
                      border-radius:10px;
                      padding:10px 12px;
                      background:#2563eb;
                      color:white;
                      font-weight:600;
                      cursor:pointer;
                    "
                  >
                    Ödeme Alındı / Paid
                  </button>
                `
                    : ""
                }

                <button
                  id="${deliverButtonId}"
                  style="
                    width:100%;
                    border:none;
                    border-radius:10px;
                    padding:10px 12px;
                    background:#16a34a;
                    color:white;
                    font-weight:600;
                    cursor:pointer;
                  "
                >
                  Teslim Edildi / Delivered
                </button>
              </div>
            </div>
          `);

          marker.on("popupopen", () => {
            const deliverButton = document.getElementById(deliverButtonId);
            const payButton = document.getElementById(payButtonId);

            if (payButton) {
              payButton.onclick = async () => {
                const confirmed = window.confirm(
                  `${row.customer_name || "Bu kayıt"} için ödeme alındı olarak işaretlensin mi?`
                );
                if (!confirmed) return;

                payButton.setAttribute("disabled", "true");
                payButton.textContent = "Kaydediliyor / Saving...";

                try {
                  await onMarkPaid(row);
                } catch {
                  payButton.removeAttribute("disabled");
                  payButton.textContent = "Ödeme Alındı / Paid";
                }
              };
            }

            if (deliverButton) {
              deliverButton.onclick = async () => {
                const confirmed = window.confirm(
                  `${row.customer_name || "Bu kayıt"} teslim edildi olarak işaretlensin mi?`
                );
                if (!confirmed) return;

                deliverButton.setAttribute("disabled", "true");
                deliverButton.textContent = "Kaydediliyor / Saving...";

                try {
                  await onMarkDelivered(row);
                } catch {
                  deliverButton.removeAttribute("disabled");
                  deliverButton.textContent = "Teslim Edildi / Delivered";
                }
              };
            }
          });

          markersRef.current.set(row.id, marker);
          cluster.addLayer(marker);
        } catch {
          // ignore marker failure
        }
      });
    });

    safeFitBounds(currentMap, [[SHOWROOM_LAT, SHOWROOM_LNG], ...allCustomerPoints]);

    const fallbackGroups = groupedBuckets
      .map((bucket) => {
        const sortedRows = [...bucket.rows].sort(
          (a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999)
        );

        const customerPoints = sortedRows.map(
          (row): [number, number] => [row.latitude as number, row.longitude as number]
        );

        return {
          key: bucket.key,
          color: bucket.color,
          fallbackPoints: [[SHOWROOM_LAT, SHOWROOM_LNG], ...customerPoints] as [number, number][],
          apiCoords: [
            [SHOWROOM_LNG, SHOWROOM_LAT] as [number, number],
            ...customerPoints.map(([lat, lng]) => [lng, lat] as [number, number]),
          ],
        };
      })
      .filter((item) => item.fallbackPoints.length >= 2);

    if (fallbackGroups.length === 0) {
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    Promise.all(
      fallbackGroups.map((group) =>
        fetch("/api/route-line", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ coords: group.apiCoords }),
          signal: controller.signal,
        })
          .then((r) => r.json())
          .catch(() => null)
      )
    )
      .then((responses) => {
        if (cancelled) return;
        if (requestId !== requestSeqRef.current) return;

        const mapForDraw = mapRef.current;
        if (!isMapUsable(mapForDraw)) return;

        const newPolylines: L.Polyline[] = [];

        fallbackGroups.forEach((group, index) => {
          const data = responses[index];
          const routeCoords = data?.features?.[0]?.geometry?.coordinates;

          const routePoints: [number, number][] = Array.isArray(routeCoords)
            ? routeCoords
                .map((c: unknown): [number, number] | null => {
                  if (
                    Array.isArray(c) &&
                    c.length >= 2 &&
                    isFiniteNumber(c[0]) &&
                    isFiniteNumber(c[1])
                  ) {
                    return [c[1], c[0]];
                  }
                  return null;
                })
                .filter((v): v is [number, number] => v !== null)
            : [];

          const isHighlighted = activeGroup
            ? getGroupLabel(group.key) === activeGroup || group.key === activeGroup
            : true;

          const polyline =
            drawPolylineSafe(mapForDraw, routePoints, {
              color: group.color,
              weight: isHighlighted ? 6 : 3,
              opacity: isHighlighted ? 0.95 : 0.28,
            }) ??
            drawPolylineSafe(mapForDraw, group.fallbackPoints, {
              color: group.color,
              weight: isHighlighted ? 5 : 3,
              opacity: isHighlighted ? 0.85 : 0.22,
              dashArray: "8 6",
            });

          if (polyline) {
            newPolylines.push(polyline);
          }
        });

        polylinesRef.current = newPolylines;
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        if (cancelled) return;
        if (requestId !== requestSeqRef.current) return;

        const mapForDraw = mapRef.current;
        if (!isMapUsable(mapForDraw)) return;

        const newPolylines: L.Polyline[] = [];

        fallbackGroups.forEach((group) => {
          const isHighlighted = activeGroup
            ? getGroupLabel(group.key) === activeGroup || group.key === activeGroup
            : true;

          const polyline = drawPolylineSafe(mapForDraw, group.fallbackPoints, {
            color: group.color,
            weight: isHighlighted ? 5 : 3,
            opacity: isHighlighted ? 0.85 : 0.22,
            dashArray: "8 6",
          });

          if (polyline) {
            newPolylines.push(polyline);
          }
        });

        polylinesRef.current = newPolylines;
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rows, activeGroup, onMarkDelivered, onMarkPaid]);

  useEffect(() => {
    if (!selectedRow) return;

    const map = mapRef.current;
    if (!isMapUsable(map)) return;

    const lat = selectedRow.latitude;
    const lng = selectedRow.longitude;

    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return;

    try {
      map.setView([lat, lng], 15, { animate: false });
      const marker = markersRef.current.get(selectedRow.id);
      if (marker) {
        marker.openPopup();
      }
    } catch {
      // ignore
    }
  }, [selectedRow]);

  return (
    <div className="relative h-full w-full">
      <style jsx global>{`
        .dispatch-order-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: white !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          margin: 0 !important;
        }
      `}</style>

      <div ref={mapElRef} className="h-full w-full" />

      <div className="absolute right-4 top-4 z-[1000] w-[240px] rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-white shadow-2xl">
        <div className="mb-3 text-sm font-semibold">Harita Legend / Map Legend</div>

        <div className="mb-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
            <span>Araç / Vehicle marker</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-500" />
            <span>Kurye / Courier marker</span>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <div className="mb-2 text-xs font-semibold text-slate-300">
            Grup Renkleri / Group Colors
          </div>

          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 text-xs">
            {legendGroups.map((group) => {
              const label = getGroupLabel(group.key);
              const highlighted = activeGroup
                ? label === activeGroup || group.key === activeGroup
                : true;

              return (
                <div
                  key={group.key}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${
                    highlighted ? "bg-slate-800/80" : "bg-slate-900/40 opacity-70"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="truncate">{label}</span>
                  </div>
                  <span className="shrink-0 text-slate-400">
                    {group.rows.length}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}