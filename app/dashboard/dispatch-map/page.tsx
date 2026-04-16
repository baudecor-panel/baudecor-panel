"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";

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
  delivery_status?: string;
  payment_status?: string;
  shipment_date?: string | null;
  delivery_method?: string;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  dispatch_group?: string | null;
};

const DispatchMapClient = dynamic(() => import("./DispatchMapClient"), {
  ssr: false,
  loading: () => (
    <main className="flex h-full items-center justify-center bg-slate-950 text-white">
      Harita yükleniyor / Mapa se učitava...
    </main>
  ),
});

function getGroupKey(row: Row) {
  return row.dispatch_group?.trim() || "GRUPSIZ";
}

function buildNavigationLink(row: Row) {
  const hasCoords =
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude);

  if (hasCoords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${row.latitude},${row.longitude}`;
  }

  const addressText = [row.customer_address || "", row.city || ""]
    .filter(Boolean)
    .join(", ")
    .trim();

  if (!addressText) return "-";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    addressText
  )}`;
}

export default function DispatchMapPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [courierFilter, setCourierFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [onlyActiveGroup, setOnlyActiveGroup] = useState(true);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, customer_phone, customer_address, product_name, quantity, city, latitude, longitude, route_order, shipment_status, delivery_status, payment_status, shipment_date, delivery_method, assigned_vehicle, assigned_courier, dispatch_group"
      )
      .neq("shipment_status", "Teslim Edildi / Delivered")
      .neq("delivery_status", "İade Edildi / Returned")
      .order("route_order", { ascending: true });

    if (error) {
      alert("Karta nijesu učitani / Harita verileri alınamadı: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as Row[]);
    setLoading(false);
  }

  async function handleMarkDelivered(row: Row) {
    const { error } = await supabase
      .from("sales")
      .update({
        shipment_status: "Teslim Edildi / Delivered",
        delivery_status: "Teslim Edildi / Delivered",
      })
      .eq("id", row.id);

    if (error) {
      alert(`Hata / Error: ${error.message}`);
      throw error;
    }

    setRows((prev) => prev.filter((item) => item.id !== row.id));
    setSelectedRow((prev) => (prev?.id === row.id ? null : prev));
  }

  async function handleMarkPaid(row: Row) {
    const { error } = await supabase
      .from("sales")
      .update({
        payment_status: "Ödendi / Paid",
      })
      .eq("id", row.id);

    if (error) {
      alert(`Hata / Error: ${error.message}`);
      throw error;
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              payment_status: "Ödendi / Paid",
            }
          : item
      )
    );

    setSelectedRow((prev) =>
      prev?.id === row.id
        ? {
            ...prev,
            payment_status: "Ödendi / Paid",
          }
        : prev
    );
  }

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (dateFilter) {
      result = result.filter((r) => (r.shipment_date || "") === dateFilter);
    }

    if (methodFilter !== "all") {
      result = result.filter((r) => (r.delivery_method || "") === methodFilter);
    }

    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      result = result.filter((r) => (r.city || "").toLowerCase().includes(q));
    }

    if (vehicleFilter.trim()) {
      const q = vehicleFilter.trim().toLowerCase();
      result = result.filter((r) =>
        (r.assigned_vehicle || "").toLowerCase().includes(q)
      );
    }

    if (courierFilter.trim()) {
      const q = courierFilter.trim().toLowerCase();
      result = result.filter((r) =>
        (r.assigned_courier || "").toLowerCase().includes(q)
      );
    }

    if (groupFilter.trim()) {
      const q = groupFilter.trim().toLowerCase();
      result = result.filter((r) => getGroupKey(r).toLowerCase().includes(q));
    }

    return result;
  }, [
    rows,
    dateFilter,
    methodFilter,
    cityFilter,
    vehicleFilter,
    courierFilter,
    groupFilter,
  ]);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();

    filteredRows.forEach((row) => {
      const key = getGroupKey(row);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(row);
    });

    return Array.from(map.entries())
      .map(([groupName, items]) => [
        groupName,
        items
          .slice()
          .sort((a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999)),
      ] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRows]);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroup(null);
      return;
    }

    const hasActiveGroup =
      activeGroup && groups.some(([group]) => group === activeGroup);

    if (!hasActiveGroup) {
      setActiveGroup(groups[0][0]);
    }
  }, [groups, activeGroup]);

  const activeRows = useMemo(() => {
    if (!activeGroup) return filteredRows;
    return filteredRows.filter((row) => getGroupKey(row) === activeGroup);
  }, [filteredRows, activeGroup]);

  const mapRows = onlyActiveGroup ? activeRows : filteredRows;

  useEffect(() => {
    if (!selectedRow) return;
    const stillExists = mapRows.some((row) => row.id === selectedRow.id);
    if (!stillExists) {
      setSelectedRow(null);
    }
  }, [mapRows, selectedRow]);

  const rowsWithoutCoords = useMemo(() => {
    return mapRows.filter(
      (r) => typeof r.latitude !== "number" || typeof r.longitude !== "number"
    );
  }, [mapRows]);

  const mapKey = useMemo(() => {
    return JSON.stringify({
      group: activeGroup,
      count: mapRows.length,
      onlyActiveGroup,
    });
  }, [activeGroup, mapRows.length, onlyActiveGroup]);

  async function copyRouteList() {
    const text = mapRows
      .slice()
      .sort((a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999))
      .map((row, index) => {
        const order = row.route_order ?? index + 1;
        const city = row.city || "-";
        const address = row.customer_address || "-";
        const customer = row.customer_name || "-";
        const phone = row.customer_phone || "-";
        const vehicle = row.assigned_vehicle || "-";
        const courier = row.assigned_courier || "-";
        const group = getGroupKey(row);
        const product = row.product_name || "-";
        const quantity = row.quantity ?? "-";
        const navLink = buildNavigationLink(row);

        return `${order} - ${customer}
Ürün / Product: ${product}
Adet / Qty: ${quantity}
Grad / Şehir: ${city}
Adres / Address: ${address}
Telefon / Telefon: ${phone}
Vozilo / Araç: ${vehicle}
Kurir / Kurye: ${courier}
Grup / Group: ${group}
Konum / Navigation: ${navLink}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      alert("Ruta kopirana / Rota kopyalandı");
    } catch {
      alert("Kopiranje neuspješno / Kopyalama başarısız");
    }
  }

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-slate-950 text-white">
        Yükleniyor / Učitava se...
      </main>
    );
  }

  return (
    <main className="h-screen bg-slate-950 text-white">
      <div className="border-b border-slate-800 bg-slate-900/80 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="all">Sve / Tümü</option>
            <option value="Sopstveno vozilo / Kendi Araç">Sopstveno vozilo / Kendi Araç</option>
            <option value="Kurir / Kurye">Kurir / Kurye</option>
          </select>

          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="Grad / Şehir"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            placeholder="Vozilo / Araç"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            placeholder="Kurir / Kurye"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <input
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            placeholder="Grupa / Sevkiyat Grubu"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            Ukupno zapisa / Toplam kayıt: {filteredRows.length}
          </p>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={onlyActiveGroup}
                onChange={(e) => setOnlyActiveGroup(e.target.checked)}
                className="h-4 w-4"
              />
              Samo aktivna grupa / Sadece aktif grup
            </label>

            <button
              onClick={fetchData}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
            >
              Yenile / Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-109px)]">
        <aside className="w-[430px] shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-lg font-semibold">Grupe ruta / Rota Grupları</h2>
            <p className="mt-1 text-sm text-slate-400">
              Ukupno grupa / Grup sayısı: {groups.length}
            </p>
          </div>

          <div className="space-y-3 p-3">
            {groups.map(([groupName, items]) => {
              const selected = activeGroup === groupName;
              const orderList = items
                .map((x, i) => x.route_order ?? i + 1)
                .join(", ");

              return (
                <button
                  key={groupName}
                  onClick={() => setActiveGroup(groupName)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-blue-500/40 bg-blue-500/10"
                      : "border-slate-800 bg-slate-950/50 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="font-semibold text-white">{groupName}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    {items.length} narudžbi / sipariş
                  </div>
                  <div className="mt-2 text-xs text-slate-400 break-words">
                    Redoslijed / Sıralar: {orderList || "-"}
                  </div>
                </button>
              );
            })}

            {groups.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                Grup bulunamadı / Nema grupa
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-300">
                Aktivna lista / Aktif Liste
              </h3>

              <button
                onClick={copyRouteList}
                className="rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
              >
                KOPIRAJ RUTU
              </button>
            </div>

            <div className="space-y-3">
              {mapRows
                .slice()
                .sort((a, b) => (a.route_order ?? 9999) - (b.route_order ?? 9999))
                .map((row, index) => {
                  const hasCoords =
                    typeof row.latitude === "number" &&
                    typeof row.longitude === "number";

                  return (
                    <div
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        selectedRow?.id === row.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-800 bg-slate-950/50 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">
                        {row.route_order ?? index + 1}. {row.customer_name || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {row.city || "-"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.customer_address || "-"}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        Status / Durum: {row.shipment_status || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Plaćanje / Ödeme: {row.payment_status || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Telefon / Telefon: {row.customer_phone || "-"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Koordinate / Koordinat:{" "}
                        {hasCoords
                          ? `${row.latitude}, ${row.longitude}`
                          : "NEMA / YOK"}
                      </div>
                    </div>
                  );
                })}

              {mapRows.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-400">
                  Nema zapisa / Kayıt yok
                </div>
              )}
            </div>

            {rowsWithoutCoords.length > 0 && (
              <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-4">
                <h4 className="text-sm font-semibold text-red-300">
                  Nedostaju koordinate / Koordinatı Eksik Kayıtlar
                </h4>
                <div className="mt-3 space-y-2">
                  {rowsWithoutCoords.map((row, index) => (
                    <div key={row.id} className="text-xs text-red-200">
                      {row.route_order ?? index + 1}. {row.customer_name || "-"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <DispatchMapClient
            key={mapKey}
            rows={mapRows}
            activeGroup={activeGroup}
            selectedRow={selectedRow}
            onMarkDelivered={handleMarkDelivered}
            onMarkPaid={handleMarkPaid}
          />
        </section>
      </div>
    </main>
  );
}
