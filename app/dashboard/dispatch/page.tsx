"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

type DispatchRow = {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  product_name?: string;
  quantity?: number;
  delivery_status?: string;
  payment_status?: string;
  delivery_method?: string;
  shipment_date?: string | null;
  shipment_status?: string;
  route_order?: number | null;
  loading_order?: number | null;
  shipment_note?: string | null;
  route_mode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  dispatch_group?: string | null;
  created_at: string;
};

type MethodFilter = "all" | "Sopstveno vozilo / Kendi Araç" | "Kurir / Kurye";

type DispatchRowWithDistance = DispatchRow & {
  showroom_distance: number;
};

type GroupSection = {
  groupName: string;
  vehicleRows: DispatchRow[];
  courierRows: DispatchRow[];
};

const SHOWROOM_LAT = 41.935659350080314;
const SHOWROOM_LNG = 19.220623821826575;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function getMonthMatrix(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - firstWeekday);

  const weeks: Date[][] = [];
  const cursor = new Date(startDate);

  for (let week = 0; week < 6; week++) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

function normalizeGroupName(value?: string | null) {
  return (value || "").trim();
}

function normalizeText(value?: string | null) {
  return (value || "").trim();
}

function hasValue(value?: string | null) {
  return normalizeText(value).length > 0;
}

function formatDateForInput(date?: string | null) {
  if (!date) return "";

  if (date.includes("-")) return date;

  if (date.includes(".")) {
    const parts = date.split(".");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
  }

  return "";
}

function isVehicleRow(row: DispatchRow) {
  const method = normalizeText(row.delivery_method);

  if (hasValue(row.assigned_vehicle)) return true;
  if (hasValue(row.assigned_courier)) return false;
  if (method === "Kurir / Kurye") return false;

  return true;
}

function isCourierRow(row: DispatchRow) {
  const method = normalizeText(row.delivery_method);

  if (hasValue(row.assigned_courier)) return true;
  if (hasValue(row.assigned_vehicle)) return false;

  return method === "Kurir / Kurye";
}

function EnglishDatePicker({
  value,
  onChange,
  placeholder = "Odaberi datum / Tarih seç",
}: {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const parsed = parseDateValue(value);
    return parsed
      ? new Date(parsed.getFullYear(), parsed.getMonth(), 1)
      : new Date();
  });

  useEffect(() => {
    const parsed = parseDateValue(value);
    if (parsed) {
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthMatrix = getMonthMatrix(visibleMonth);

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[56px] w-full items-center rounded-xl border border-slate-700 bg-slate-950 px-4 text-left text-white transition hover:border-slate-600 focus:border-blue-500 focus:outline-none"
      >
        <span
          className={`block w-full truncate text-sm ${
            value ? "text-white" : "text-slate-400"
          }`}
        >
          {value || placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[320px] rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-white"
            >
              Önceki / Prev
            </button>

            <div className="text-sm font-semibold text-white">
              {MONTH_NAMES[visibleMonth.getMonth()]}{" "}
              {visibleMonth.getFullYear()}
            </div>

            <button
              type="button"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-white"
            >
              Sonraki / Next
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_NAMES.map((day) => (
              <div
                key={day}
                className="pb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                {day}
              </div>
            ))}

            {monthMatrix.flat().map((day) => {
              const dayValue = formatDateValue(day);
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = value === dayValue;

              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => {
                    onChange(dayValue);
                    setOpen(false);
                  }}
                  className={`aspect-square rounded-xl text-sm transition ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : isCurrentMonth
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "bg-slate-950 text-slate-500 hover:bg-slate-900"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function getDistanceKm(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
) {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    Number.isNaN(lat1) ||
    Number.isNaN(lng1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lng2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}




function formatDistance(distance: number) {
  if (!Number.isFinite(distance)) return "Mesafe yok / Nema udaljenosti";
  return `${distance.toFixed(1)} km`;
}

function getMethodLabel(row: DispatchRow) {
  if (isVehicleRow(row)) return "Sopstveno vozilo / Kendi Araç";
  if (isCourierRow(row)) return "Kurir / Kurye";
  return normalizeText(row.delivery_method) || "Belirsiz / Nepoznato";
}

function buildGroupSections(rows: DispatchRow[]) {
  const map = new Map<string, DispatchRow[]>();

  rows.forEach((row) => {
    const groupName = normalizeGroupName(row.dispatch_group);
    if (!groupName) return;

    if (!map.has(groupName)) {
      map.set(groupName, []);
    }

    map.get(groupName)?.push(row);
  });

  return Array.from(map.entries())
    .map(([groupName, groupRows]) => {
      const vehicleRows = groupRows
        .filter((row) => isVehicleRow(row))
        .sort((a, b) => {
          const orderA = a.route_order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.route_order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.customer_name?.localeCompare(b.customer_name || "") || 0;
        });

      const courierRows = groupRows
        .filter((row) => isCourierRow(row))
        .sort((a, b) => {
          const orderA = a.route_order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.route_order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.customer_name?.localeCompare(b.customer_name || "") || 0;
        });

      return {
        groupName,
        vehicleRows,
        courierRows,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export default function DispatchPage() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [optimizingGroup, setOptimizingGroup] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<string[]>([]);

  async function fetchDispatchRows() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, customer_phone, customer_address, product_name, quantity, delivery_status, payment_status, delivery_method, shipment_date, shipment_status, route_order, loading_order, shipment_note, route_mode, latitude, longitude, city, assigned_vehicle, assigned_courier, dispatch_group, created_at"
      )
      .or(
        "delivery_status.neq.Teslim Edildi / Delivered,payment_status.neq.Ödendi / Paid"
      )
      .neq("delivery_status", "İade Edildi / Returned")
      .order("shipment_date", { ascending: true, nullsFirst: false })
      .order("dispatch_group", { ascending: true, nullsFirst: true })
      .order("route_order", { ascending: true, nullsFirst: true })
      .order("loading_order", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (error) {
      alert("Sevkiyat kayıtları alınamadı / Zapisi isporuke nijesu učitani");
      setRows([]);
    } else {
      setRows((data || []) as DispatchRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchDispatchRows();
  }, []);

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.city?.trim()).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const existingGroups = useMemo(() => {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      const value = normalizeGroupName(row.dispatch_group);
      if (!value) return;
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const cityValue = row.city?.trim() || "";
      const methodLabel = getMethodLabel(row);
      const groupValue = normalizeGroupName(row.dispatch_group);
      const rowDate = row.shipment_date || "";

      const cityOk = cityFilter === "all" || cityValue === cityFilter;
      const methodOk = methodFilter === "all" || methodLabel === methodFilter;
      const dateOk = !dateFilter || rowDate === dateFilter;

      let groupOk = true;
      if (groupFilter === "ungrouped") {
        groupOk = !groupValue;
      } else if (groupFilter !== "all") {
        groupOk = groupValue === groupFilter;
      }

      return cityOk && methodOk && dateOk && groupOk;
    });
  }, [rows, cityFilter, methodFilter, groupFilter, dateFilter]);

  const filteredIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const groupSections = useMemo(() => buildGroupSections(filteredRows), [filteredRows]);

  const ungroupedRows = useMemo(() => {
    const result: DispatchRowWithDistance[] = filteredRows
      .filter((row) => !normalizeGroupName(row.dispatch_group))
      .map((row) => ({
        ...row,
        showroom_distance: getDistanceKm(
          SHOWROOM_LAT,
          SHOWROOM_LNG,
          row.latitude,
          row.longitude
        ),
      }));

    return result.sort((a, b) => {
      const methodA = isVehicleRow(a);
      const methodB = isVehicleRow(b);

      if (methodA !== methodB) {
        return methodA ? -1 : 1;
      }

      const dateA = a.shipment_date || "9999-99-99";
      const dateB = b.shipment_date || "9999-99-99";
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const orderA = a.route_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.route_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const loadingA = a.loading_order ?? Number.MAX_SAFE_INTEGER;
      const loadingB = b.loading_order ?? Number.MAX_SAFE_INTEGER;
      if (loadingA !== loadingB) return loadingA - loadingB;

      const distanceA = a.showroom_distance;
      const distanceB = b.showroom_distance;
      if (distanceA !== distanceB) return distanceA - distanceB;

      return (a.customer_name || "").localeCompare(b.customer_name || "");
    });
  }, [filteredRows]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );

  const selectedGroupNames = useMemo(() => {
    return Array.from(
      new Set(
        selectedRows
          .map((row) => normalizeGroupName(row.dispatch_group))
          .filter(Boolean) as string[]
      )
    );
  }, [selectedRows]);

  const activeGroupName = useMemo(() => {
    if (selectedGroupNames.length === 1) return selectedGroupNames[0];
    const ready = normalizeGroupName(groupNameInput);
    return ready || null;
  }, [selectedGroupNames, groupNameInput]);

  const activeGroupRows = useMemo(() => {
    if (!activeGroupName) return [];
    return rows.filter(
      (row) => normalizeGroupName(row.dispatch_group) === activeGroupName
    );
  }, [rows, activeGroupName]);

  const activeGroupSelectedCount = useMemo(() => {
    if (!activeGroupName) return 0;
    return selectedRows.filter(
      (row) => normalizeGroupName(row.dispatch_group) === activeGroupName
    ).length;
  }, [selectedRows, activeGroupName]);

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }
  function shouldUngroupOnFieldChange(
    row: DispatchRow,
    field: keyof DispatchRow,
    value: any
  ) {
    const currentGroup = normalizeGroupName(row.dispatch_group);
    if (!currentGroup) return false;

    if (field === "delivery_method" && value !== row.delivery_method) return true;
    if (field === "shipment_date" && value !== (row.shipment_date || "")) return true;
    if (field === "route_mode" && value !== row.route_mode) return true;

    return false;
  }

  async function updateField(
    id: string,
    field: keyof DispatchRow,
    value: any,
    successMessage?: string
  ) {
    const currentRow = rows.find((row) => row.id === id);

    const updatePayload: Partial<DispatchRow> & Record<string, any> = {
      [field]: value,
    };

    if (currentRow && shouldUngroupOnFieldChange(currentRow, field, value)) {
      updatePayload.dispatch_group = null;
    }

    setSavingIds((prev) => [...prev, id]);

    const { error } = await supabase.from("sales").update(updatePayload).eq("id", id);

    setSavingIds((prev) => prev.filter((item) => item !== id));

    if (error) {
      alert("Greška / Hata: " + error.message);
      return false;
    }

    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updatePayload } : row))
    );

    if (successMessage) {
      alert(successMessage);
    }

    return true;
  }


  function resetFilters() {
    setCityFilter("all");
    setMethodFilter("all");
    setGroupFilter("all");
    setDateFilter("");
  }

  async function updateSingleRow(
    id: string,
    payload: Partial<DispatchRow>,
    successMessage?: string
  ) {
    setSavingIds((prev) => [...prev, id]);

    const { error } = await supabase.from("sales").update(payload).eq("id", id);

    setSavingIds((prev) => prev.filter((item) => item !== id));

    if (error) {
      alert("Greška / Hata: " + error.message);
      return false;
    }

    if (successMessage) {
      alert(successMessage);
    }

    await fetchDispatchRows();
    return true;
  }

  async function optimizeSingleGroupRows(groupRows: DispatchRow[]) {
    if (groupRows.length === 0) {
      alert("Bu grupta optimize edilecek kayıt yok / U ovoj grupi nema zapisa za optimizaciju");
      return false;
    }

    const vehicleRows = groupRows.filter((row) => isVehicleRow(row));
    const courierRows = groupRows.filter((row) => isCourierRow(row));


    async function updateOrders(
      targetRows: DispatchRow[],
      optimizedRows: DispatchRow[]
    ) {
      for (let index = 0; index < optimizedRows.length; index++) {
        const row = optimizedRows[index];
        const loadingOrder = targetRows.length - index;

        const { error } = await supabase
          .from("sales")
          .update({
            route_order: index + 1,
            loading_order: loadingOrder,
          })
          .eq("id", row.id);

        if (error) {
          alert("Rota güncellenemedi / Ažuriranje rute nije uspjelo: " + error.message);
          return false;
        }
      }

      return true;
    }

    function optimizeNearestNeighbor(rowsToOptimize: DispatchRow[]) {
      const validRows = rowsToOptimize.filter(
        (row) =>
          typeof row.latitude === "number" &&
          typeof row.longitude === "number" &&
          Number.isFinite(row.latitude) &&
          Number.isFinite(row.longitude)
      );

      const invalidRows = rowsToOptimize.filter(
        (row) =>
          !(
            typeof row.latitude === "number" &&
            typeof row.longitude === "number" &&
            Number.isFinite(row.latitude) &&
            Number.isFinite(row.longitude)
          )
      );

      if (validRows.length <= 1) {
        return [...validRows, ...invalidRows];
      }

      const routeMode = normalizeText(validRows[0]?.route_mode) || "Daleko → Blizu / Uzak → Yakın";

      if (routeMode === "Ručno / Manuel") {
        return [...validRows, ...invalidRows];
      }

      const withDistances = validRows.map((row) => ({
        row,
        distance: getDistanceKm(
          SHOWROOM_LAT,
          SHOWROOM_LNG,
          row.latitude as number,
          row.longitude as number
        ),
      }));

      withDistances.sort((a, b) =>
        routeMode === "Daleko → Blizu / Uzak → Yakın"
          ? b.distance - a.distance
          : a.distance - b.distance
      );

      return [...withDistances.map((x) => x.row), ...invalidRows];
    }

    if (vehicleRows.length > 0) {
      const orderedVehicleRows = optimizeNearestNeighbor(vehicleRows);
      const ok = await updateOrders(vehicleRows, orderedVehicleRows);
      if (!ok) return false;
    }

    if (courierRows.length > 0) {
      const orderedCourierRows = optimizeNearestNeighbor(courierRows);
      const ok = await updateOrders(courierRows, orderedCourierRows);
      if (!ok) return false;
    }

    return true;
  }

  async function optimizeGroup(groupName: string) {
    const value = normalizeGroupName(groupName);

    if (!value) {
      alert("Önce grup seç / Prvo odaberi grupu");
      return;
    }

    const groupRows = rows.filter(
      (row) => normalizeGroupName(row.dispatch_group) === value
    );

    if (groupRows.length === 0) {
      alert("Grup bulunamadı / Grupa nije pronađena");
      return;
    }

    setOptimizingGroup(value);
    const ok = await optimizeSingleGroupRows(groupRows);
    setOptimizingGroup(null);

    if (ok) {
      await fetchDispatchRows();
      alert(`Rota optimize edildi / Ruta optimizovana: ${value}`);
    }
  }

  async function optimizeSelectedGroup() {
    const groupName = activeGroupName;

    if (!groupName) {
      alert("Optimize için aktif grup yok / Nema aktivne grupe za optimizaciju");
      return;
    }

    await optimizeGroup(groupName);
  }

  function buildNavigationUrl(row: DispatchRow) {
    if (row.latitude == null || row.longitude == null) return "";
    return `https://www.google.com/maps/dir/?api=1&destination=${row.latitude},${row.longitude}`;
  }

  async function copyGroupRoute(groupName: string) {
    const groupRows = rows
      .filter((row) => normalizeGroupName(row.dispatch_group) === groupName)
      .sort((a, b) => {
        const vehicleA = isVehicleRow(a);
        const vehicleB = isVehicleRow(b);

        if (vehicleA !== vehicleB) {
          return vehicleA ? -1 : 1;
        }

        const routeA = a.route_order ?? Number.MAX_SAFE_INTEGER;
        const routeB = b.route_order ?? Number.MAX_SAFE_INTEGER;
        if (routeA !== routeB) return routeA - routeB;

        return (a.customer_name || "").localeCompare(b.customer_name || "");
      });

    if (groupRows.length === 0) {
      alert("Kopyalanacak grup bulunamadı / Nije pronađena grupa za kopiranje");
      return;
    }

    const lines = groupRows.map((row, index) => {
      const vehicle = row.assigned_vehicle || "-";
      const courier = row.assigned_courier || "-";
      const navigationUrl = buildNavigationUrl(row);

      return [
        `${index + 1}. ${row.customer_name || "-"}`,
        `Proizvod / Ürün: ${row.product_name || "-"}`,
        `Adet / Quantity: ${row.quantity ?? "-"}`,
        `Grad / Şehir: ${row.city || "-"}`,
        `Adresa / Adres: ${row.customer_address || "-"}`,
        `Telefon / Telefon: ${row.customer_phone || "-"}`,
        `Araç / Vehicle: ${vehicle}`,
        `Kurir / Kurye: ${courier}`,
        `Grupa / Grup: ${groupName}`,
        `Google Maps: ${navigationUrl || "-"}`,
      ].join("\n");
    });

    const text = lines.join("\n\n------------------------------\n\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopiedGroup(groupName);
      setTimeout(() => {
        setCopiedGroup((current) => (current === groupName ? null : current));
      }, 2000);
    } catch {
      alert("Kopyalama başarısız / Kopiranje nije uspjelo");
    }
  }

  function openPrintPage(groupName: string) {
    const url = `/dispatch-print?group=${encodeURIComponent(groupName)}`;
    window.open(url, "_blank");
  }

  async function optimizeAndPrintGroup(groupName: string) {
    const value = normalizeGroupName(groupName);

    if (!value) {
      alert("Önce grup seç / Prvo odaberi grupu");
      return;
    }

    const groupRows = rows.filter(
      (row) => normalizeGroupName(row.dispatch_group) === value
    );

    if (groupRows.length > 0) {
      const ok = await optimizeSingleGroupRows(groupRows);
      if (!ok) return;
      await fetchDispatchRows();
    }

    openPrintPage(groupName);
  }

  async function printActiveGroup() {
    const groupName = activeGroupName;

    if (!groupName) {
      alert("Yazdırmak için aktif grup yok / Nema aktivne grupe za štampu");
      return;
    }

    await optimizeAndPrintGroup(groupName);
  }

  async function setGroupForIds(ids: string[], value: string | null) {
    if (ids.length === 0) {
      alert("Lütfen kayıt seç / Molimo odaberite kayıtlar");
      return false;
    }

    const { error } = await supabase
      .from("sales")
      .update({ dispatch_group: value })
      .in("id", ids);

    if (error) {
      alert("Greška / Hata: " + error.message);
      return false;
    }

    await fetchDispatchRows();
    return true;
  }

  function getManualGroupName() {
    const value = groupNameInput.trim();

    if (!value) {
      alert("Grup adı gir / Unesi naziv grupe");
      return null;
    }

    const exists = rows.some(
      (row) => normalizeGroupName(row.dispatch_group) === value
    );

    if (exists) {
      const confirmAdd = window.confirm(
        "Bu grup zaten var. İçine eklemek istiyor musun? / Ova grupa već postoji. Da li želiš dodati u nju?"
      );

      if (!confirmAdd) {
        return null;
      }
    }

    return value;
  }

  async function groupAllFiltered() {
    const ids = filteredRows.map((row) => row.id);
    const groupName = getManualGroupName();

    if (!groupName) return;

    const ok = await setGroupForIds(ids, groupName);

    if (ok) {
      setGroupNameInput(groupName);
      setSelectedIds([]);
      alert(
        `Tüm görünen kayıtlar bu gruba alındı / Svi prikazani zapisi dodati su u ovu grupu: ${groupName}`
      );
    }
  }

  async function groupSelectedRows() {
    const groupName = getManualGroupName();

    if (!groupName) return;

    const ok = await setGroupForIds(selectedIds, groupName);

    if (ok) {
      setGroupNameInput(groupName);
      setSelectedIds([]);
      alert(
        `Seçili kayıtlar bu gruba alındı / Odabrani zapisi dodati su u ovu grupu: ${groupName}`
      );
    }
  }

  async function addSelectedToGroup() {
    const value = groupNameInput.trim();

    if (!value) {
      alert("Grup adı gir / Unesi naziv grupe");
      return;
    }

    const ok = await setGroupForIds(selectedIds, value);

    if (ok) {
      setSelectedIds([]);
      alert(
        `Seçili kayıtlar gruba eklendi / Odabrani zapisi dodati su u grupu: ${value}`
      );
    }
  }

  async function removeSelectedFromGroup() {
    const targetIds = rows
      .filter((row) => selectedIds.includes(row.id))
      .map((row) => row.id);

    const ok = await setGroupForIds(targetIds, null);

    if (ok) {
      setSelectedIds([]);
      alert(
        "Seçili kayıtlar gruptan çıkarıldı / Odabrani zapisi uklonjeni su iz grupe"
      );
    }
  }

  async function clearAllGroups() {
    const groupIds = rows
      .filter((row) => normalizeGroupName(row.dispatch_group))
      .map((row) => row.id);

    if (groupIds.length === 0) {
      alert("Temizlenecek grup yok / Nema grupa za čišćenje");
      return;
    }

    const confirmed = window.confirm(
      "Tüm grup bağlantıları kaldırılacak. Emin misin? / Sve veze grupa biće uklonjene. Da li si siguran?"
    );

    if (!confirmed) return;

    const ok = await setGroupForIds(groupIds, null);

    if (ok) {
      setGroupNameInput("");
      setSelectedIds([]);
      alert("Tüm gruplar temizlendi / Sve grupe su očišćene");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
              BAUDECOR SEVKIYAT / BAUDECOR DISPATCH
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Operativni centar isporuke / Sevkiyat Operasyon Merkezi
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400 sm:text-base">
              Upravljaj isporukama kroz tok: izaberi → grupiši → optimizuj → štampaj. /
              Seç → grupla → optimize et → yazdır akışına göre sevkiyatları yönet.
            </p>
          </div>

          <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Ukupno / Toplam
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">{rows.length}</div>
              <div className="mt-1 text-xs text-slate-400">
                Aktivni zapisi isporuke / Aktif sevkiyat kayıtları
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Filtrirano / Filtre Sonucu
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {filteredRows.length}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Vidljivi zapisi / Görünen kayıt
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/70">
                Odabrano / Seçili
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {selectedIds.length}
              </div>
              <div className="mt-1 text-xs text-emerald-200/70">
                Spremno za obradu / İşleme hazır kayıt
              </div>
            </div>

            <div className="rounded-2xl border border-blue-700/40 bg-blue-950/30 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-blue-300/70">
                Aktivna grupa / Aktif Grup
              </div>
              <div className="mt-2 truncate text-lg font-semibold text-white">
                {activeGroupName || "-"}
              </div>
              <div className="mt-1 text-xs text-blue-200/70">
                Gruptaki seçili: {activeGroupSelectedCount} / Odabrano u grupi
              </div>
            </div>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Filteri / Filtreler</h2>
              <p className="mt-1 text-sm text-slate-400">
                Suzi prikaz prema gradu, metodu, grupi i datumu. /
                Şehir, yöntem, grup ve tarihe göre görünümü daralt.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={toggleSelectAllFiltered}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
              >
                {allFilteredSelected
                  ? "Görünenleri Bırak / Vidljivo seçimi kaldır"
                  : "Odaberi prikazane / Görünenleri Seç"}
              </button>

              <button
                onClick={() => {
                  resetFilters();
                  setDateFilter(new Date().toISOString().slice(0, 10));
                }}
                className="rounded-xl border border-cyan-600/40 bg-cyan-600/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-600/20"
              >
                Bugün / Danas
              </button>

              <button
                onClick={resetFilters}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
              >
                Filtreleri Temizle / Clear Filters
              </button>

              <button
                onClick={fetchDispatchRows}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
              >
                Yenile / Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Grad / Şehir
              </label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="all">Sve / Tümü</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Metod / Yöntem
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="all">Sve / Tümü</option>
                <option value="Sopstveno vozilo / Kendi Araç">
                  Sopstveno vozilo / Kendi Araç
                </option>
                <option value="Kurir / Kurye">Kurir / Kurye</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Grupa / Grup
              </label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              >
                <option value="all">Sve / Tümü</option>
                <option value="ungrouped">Bez grupe / Grupsuz</option>
                {existingGroups.map((group) => (
                  <option key={group.name} value={group.name}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Datum / Tarih
              </label>
              <EnglishDatePicker value={dateFilter} onChange={setDateFilter} />
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Tok operacije / Operasyon Akışı
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Izaberi → Grupiši → Optimizuj → Štampaj /
                Seç → Grupla → Optimize Et → Yazdır
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={optimizeSelectedGroup}
                disabled={!activeGroupName || optimizingGroup === activeGroupName}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {optimizingGroup === activeGroupName
                  ? "Rota hesaplanıyor... / Optimizuje se..."
                  : "Optimizuj aktivnu grupu / Aktif Grubu Optimize Et"}
              </button>

              <button
                onClick={printActiveGroup}
                disabled={!activeGroupName}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aktif Grubu Yazdır / Print Active Group
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                1. Izaberi / Seç
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Označi zapise isporuke sa liste. / Sevkiyat kayıtlarını listeden işaretle.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                2. Grupiši / Grupla
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Grupiši odabrane zapise ili ih dodaj postojećoj grupi. / Seçilenleri bir grup altında topla veya mevcut gruba ekle.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                3. Optimizuj / Optimize Et
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Ažuriraj rutu i redoslijed utovara za aktivnu grupu. / Aktif grubun rota ve yükleme sırasını güncelle.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                4. Štampaj / Yazdır
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Pošalji aktivnu grupu na ekran za štampu. / Aktif grubu yazdırma ekranına gönder.
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Operacije grupisanja / Gruplama İşlemleri
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Pregledaj grupe, odaberi ih, izvrši radnje, dodaj ili ukloni isporuke. /
              Grupları gör, seç, üstünde işlem yap, sevkiyat ekle veya çıkar.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <label className="mb-2 block text-sm text-slate-300">
                Naziv grupe / Grup Adı
              </label>
              <input
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                placeholder="Primjer / Örn: MONDAY-TRUCK-1"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
              <p className="mt-2 text-xs text-slate-500">
                Klikni na postojeću grupu ispod da se učita u ovo polje. /
                Aşağıdaki grup kutularından birine tıklarsan bu alana gelir.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-300">
                Odabrani zapisi / Seçili Kayıtlar
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {selectedIds.length}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Spremna grupa / Hazır grup: {groupNameInput || "-"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-sm font-medium text-slate-300">
              Postojeće grupe / Mevcut Gruplar
            </p>

            {existingGroups.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {existingGroups.map((group) => {
                  const isActive = groupNameInput === group.name;

                  return (
                    <button
                      key={group.name}
                      onClick={() => {
                        setGroupNameInput(group.name);
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-emerald-500 bg-emerald-600/20 text-white"
                          : "border-slate-700 bg-slate-950 text-white hover:border-slate-500"
                      }`}
                    >
                      <div className="text-sm font-semibold">{group.name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {group.count} kayıt / Zapisi
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                Henüz grup yok / Još nema grupa
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <button
              onClick={groupAllFiltered}
              className="flex min-h-[58px] items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-center font-medium text-white"
            >
              Tüm görünenleri bu gruba al / Dodaj sve prikazane u ovu grupu
            </button>

            <button
              onClick={groupSelectedRows}
              className="flex min-h-[58px] items-center justify-center rounded-2xl bg-indigo-600 px-4 py-3 text-center font-medium text-white"
            >
              Seçilileri bu gruba al / Dodaj odabrane u ovu grupu
            </button>

            <button
              onClick={addSelectedToGroup}
              className="flex min-h-[58px] items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-center font-medium text-white"
            >
              Seçileni gruba dahil et / Dodaj odabrane u grupu
            </button>

            <button
              onClick={removeSelectedFromGroup}
              className="flex min-h-[58px] items-center justify-center rounded-2xl bg-amber-600 px-4 py-3 text-center font-medium text-white"
            >
              Seçileni gruptan çıkar / Ukloni odabrane iz grupe
            </button>

            <button
              onClick={clearAllGroups}
              className="flex min-h-[58px] items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-center font-medium text-white"
            >
              Tüm grupları temizle / Očisti sve grupe
            </button>
          </div>
        </section>

        {selectedIds.length > 0 && (
          <section className="mb-8 rounded-3xl border border-emerald-700/40 bg-emerald-950/30 p-6 shadow-2xl shadow-black/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Odabrani zapisi / Seçili Kayıtlar: {selectedIds.length}
              </h2>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={clearSelection}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Očisti odabir / Seçimi Temizle
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {selectedRows.map((row) => {
                const isSaving = savingIds.includes(row.id);
                const groupValue = normalizeGroupName(row.dispatch_group);

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-emerald-700/30 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {row.customer_name || "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {row.product_name || "-"} • {row.quantity ?? 0} adet
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRow(row.id)}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
                      >
                        Ukloni / Kaldır
                      </button>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-400">
                      <div>Grupa / Grup: {groupValue || "-"}</div>
                      <div>
                        Metod / Yöntem: {getMethodLabel(row)}
                      </div>
                      <div>Datum / Tarih: {row.shipment_date || "-"}</div>
                      <div>
                        Adresa / Adres: {row.customer_address || "-"}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          updateSingleRow(
                            row.id,
                            {
                              payment_status: "Ödendi / Paid",
                            },
                            "Ödeme alındı / Plaćanje označeno kao primljeno"
                          )
                        }
                        disabled={isSaving || row.payment_status === "Ödendi / Paid"}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Ödeme Alındı / Paid
                      </button>

                      <button
                        onClick={() =>
                          updateSingleRow(
                            row.id,
                            {
                              shipment_status: "Teslim Edildi / Delivered",
                              delivery_status: "Teslim Edildi / Delivered",
                            },
                            "Teslim edildi / Označeno kao isporučeno"
                          )
                        }
                        disabled={isSaving}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Teslim Edildi / Delivered
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Grupe / Gruplar</h2>
              <p className="mt-1 text-sm text-slate-400">
                Sekcije isporuke po grupama, ruta i alati za kopiranje. /
                Grup bazlı sevkiyat düzeni, rota ve kopyalama araçları.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {groupSections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-slate-400">
                Filtreye uygun grup bulunamadı / Nema grupa za trenutni filter
              </div>
            ) : (
              groupSections.map((section) => {
                const allRows = [...section.vehicleRows, ...section.courierRows];
                const totalCount = allRows.length;
                const vehicleCount = section.vehicleRows.length;
                const courierCount = section.courierRows.length;
                const isOptimizing = optimizingGroup === section.groupName;
                const isCopied = copiedGroup === section.groupName;

                return (
                  <div
                    key={section.groupName}
                    className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70"
                  >
                    <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                            Grupa / Grup
                          </div>
                          <h3 className="mt-2 text-xl font-semibold text-white">
                            {section.groupName}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                            <span className="rounded-full border border-slate-700 px-3 py-1">
                              Ukupno / Toplam: {totalCount}
                            </span>
                            <span className="rounded-full border border-slate-700 px-3 py-1">
                              Araç / Vehicle: {vehicleCount}
                            </span>
                            <span className="rounded-full border border-slate-700 px-3 py-1">
                              Kurir / Kurye: {courierCount}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => setGroupNameInput(section.groupName)}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:border-slate-500"
                          >
                            Grubu hazırla / Učitaj grupu
                          </button>

                          <button
                            onClick={() => optimizeGroup(section.groupName)}
                            disabled={isOptimizing}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {isOptimizing
                              ? "Optimize Ediliyor... / Optimizing..."
                              : "Rota Optimize Et / Optimize Route"}
                          </button>

                          <button
                            onClick={() => copyGroupRoute(section.groupName)}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            {isCopied
                              ? "Kopyalandı / Kopirano"
                              : "Rotayı kopyala / Kopiraj rutu"}
                          </button>

                          <button
                            onClick={() => optimizeAndPrintGroup(section.groupName)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                          >
                            Optimize + Yazdır / Optimize + Print
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-6 p-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white">
                            Sopstveno vozilo / Kendi Araç
                          </h4>
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                            {vehicleCount} kayıt / Zapisi
                          </span>
                        </div>

                        <div className="space-y-3">
                          {section.vehicleRows.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-500">
                              Araç kaydı yok / Nema zapisa za vozilo
                            </div>
                          ) : (
                            section.vehicleRows.map((row) => {
                              const isSelected = selectedIds.includes(row.id);
                              const isSaving = savingIds.includes(row.id);

                              return (
                                <div
                                  key={row.id}
                                  onClick={() => toggleRow(row.id)}
                                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-600/10"
                                      : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                                  }`}
                                >
                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                                          Rota #{row.route_order ?? "-"}
                                        </span>
                                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                          Yükleme #{row.loading_order ?? "-"}
                                        </span>
                                      </div>

                                      <div className="mt-3 text-base font-semibold text-white">
                                        {row.customer_name || "-"}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-400">
                                        {row.product_name || "-"} • {row.quantity ?? 0} adet
                                      </div>
                                    </div>

                                    <div className="text-xs text-slate-400 lg:text-right">
                                      <div>
                                        Araç / Vehicle: {row.assigned_vehicle || "-"}
                                      </div>
                                      <div className="mt-1">
                                        Datum / Tarih: {row.shipment_date || "-"}
                                      </div>
                                      <div className="mt-1">
                                        Grad / Şehir: {row.city || "-"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                                    <div>Telefon / Telefon: {row.customer_phone || "-"}</div>
                                    <div>
                                      Plaćanje / Ödeme: {row.payment_status || "-"}
                                    </div>
                                    <div className="sm:col-span-2">
                                      Adresa / Adres: {row.customer_address || "-"}
                                    </div>
                                  </div>

                                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Datum isporuke / Sevkiyat Tarihi
                                      </div>
                                      <EnglishDatePicker
                                        value={formatDateForInput(row.shipment_date)}
                                        onChange={(value) =>
                                          updateField(row.id, "shipment_date", value)
                                        }
                                        placeholder="Odaberi datum / Tarih seç"
                                      />
                                    </div>

                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Metod / Yöntem
                                      </div>
                                      <select
                                        value={row.delivery_method || ""}
                                        onChange={(e) =>
                                          updateField(row.id, "delivery_method", e.target.value)
                                        }
                                        className="h-[56px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                                      >
                                        <option>Sopstveno vozilo / Kendi Araç</option>
                                        <option>Kurir / Kurye</option>
                                      </select>
                                    </div>

                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Režim rute / Rota Modu
                                      </div>
                                      <select
                                        value={row.route_mode || "Daleko → Blizu / Uzak → Yakın"}
                                        onChange={(e) =>
                                          updateField(row.id, "route_mode", e.target.value)
                                        }
                                        className="h-[56px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                                      >
                                        <option>Daleko → Blizu / Uzak → Yakın</option>
                                        <option>Blizu → Daleko / Yakın → Uzak</option>
                                        <option>Ručno / Manuel</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateSingleRow(
                                          row.id,
                                          {
                                            payment_status: "Ödendi / Paid",
                                          },
                                          "Ödeme alındı / Plaćanje označeno kao primljeno"
                                        );
                                      }}
                                      disabled={
                                        isSaving || row.payment_status === "Ödendi / Paid"
                                      }
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                                    >
                                      Ödeme Alındı / Paid
                                    </button>

                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateSingleRow(
                                          row.id,
                                          {
                                            shipment_status: "Teslim Edildi / Delivered",
                                            delivery_status: "Teslim Edildi / Delivered",
                                          },
                                          "Teslim edildi / Označeno kao isporučeno"
                                        );
                                      }}
                                      disabled={isSaving}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                                    >
                                      Teslim Edildi / Delivered
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-white">
                            Kurir / Kurye
                          </h4>
                          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                            {courierCount} kayıt / Zapisi
                          </span>
                        </div>

                        <div className="space-y-3">
                          {section.courierRows.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-500">
                              Kurye kaydı yok / Nema zapisa za kurira
                            </div>
                          ) : (
                            section.courierRows.map((row) => {
                              const isSelected = selectedIds.includes(row.id);
                              const isSaving = savingIds.includes(row.id);

                              return (
                                <div
                                  key={row.id}
                                  onClick={() => toggleRow(row.id)}
                                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-600/10"
                                      : "border-slate-800 bg-slate-950/70 hover:border-slate-600"
                                  }`}
                                >
                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-indigo-600/20 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                                          Rota #{row.route_order ?? "-"}
                                        </span>
                                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                                          Kurir / Kurye
                                        </span>
                                      </div>

                                      <div className="mt-3 text-base font-semibold text-white">
                                        {row.customer_name || "-"}
                                      </div>
                                      <div className="mt-1 text-sm text-slate-400">
                                        {row.product_name || "-"} • {row.quantity ?? 0} adet
                                      </div>
                                    </div>

                                    <div className="text-xs text-slate-400 lg:text-right">
                                      <div>
                                        Kurir / Kurye: {row.assigned_courier || "-"}
                                      </div>
                                      <div className="mt-1">
                                        Datum / Tarih: {row.shipment_date || "-"}
                                      </div>
                                      <div className="mt-1">
                                        Grad / Şehir: {row.city || "-"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                                    <div>Telefon / Telefon: {row.customer_phone || "-"}</div>
                                    <div>
                                      Plaćanje / Ödeme: {row.payment_status || "-"}
                                    </div>
                                    <div className="sm:col-span-2">
                                      Adresa / Adres: {row.customer_address || "-"}
                                    </div>
                                  </div>

                                  <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Datum isporuke / Sevkiyat Tarihi
                                      </div>
                                      <EnglishDatePicker
                                        value={formatDateForInput(row.shipment_date)}
                                        onChange={(value) =>
                                          updateField(row.id, "shipment_date", value)
                                        }
                                        placeholder="Odaberi datum / Tarih seç"
                                      />
                                    </div>

                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Metod / Yöntem
                                      </div>
                                      <select
                                        value={row.delivery_method || ""}
                                        onChange={(e) =>
                                          updateField(row.id, "delivery_method", e.target.value)
                                        }
                                        className="h-[56px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                                      >
                                        <option>Sopstveno vozilo / Kendi Araç</option>
                                        <option>Kurir / Kurye</option>
                                      </select>
                                    </div>

                                    <div
                                      className="flex flex-col justify-between"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <div className="mb-2 text-xs text-slate-400 tracking-wide">
                                        Režim rute / Rota Modu
                                      </div>
                                      <select
                                        value={row.route_mode || "Daleko → Blizu / Uzak → Yakın"}
                                        onChange={(e) =>
                                          updateField(row.id, "route_mode", e.target.value)
                                        }
                                        className="h-[56px] w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                                      >
                                        <option>Daleko → Blizu / Uzak → Yakın</option>
                                        <option>Blizu → Daleko / Yakın → Uzak</option>
                                        <option>Ručno / Manuel</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateSingleRow(
                                          row.id,
                                          {
                                            payment_status: "Ödendi / Paid",
                                          },
                                          "Ödeme alındı / Plaćanje označeno kao primljeno"
                                        );
                                      }}
                                      disabled={
                                        isSaving || row.payment_status === "Ödendi / Paid"
                                      }
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                                    >
                                      Ödeme Alındı / Paid
                                    </button>

                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        updateSingleRow(
                                          row.id,
                                          {
                                            shipment_status: "Teslim Edildi / Delivered",
                                            delivery_status: "Teslim Edildi / Delivered",
                                          },
                                          "Teslim edildi / Označeno kao isporučeno"
                                        );
                                      }}
                                      disabled={isSaving}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                                    >
                                      Teslim Edildi / Delivered
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Zapisi bez grupe / Grupsuz Kayıtlar</h2>
              <p className="mt-1 text-sm text-slate-400">
                Zapisi van grupa poredani su po prioritetu vozila i udaljenosti od showroom-a. /
                Grup dışındaki kayıtlar, araç öncelikli ve showroom mesafesine göre sıralanır.
              </p>
            </div>

            <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
              {ungroupedRows.length} kayıt / rows
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-950/80 text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Seç / Select</th>
                    <th className="px-4 py-3">Kupac / Müşteri</th>
                    <th className="px-4 py-3">Proizvod / Ürün</th>
                    <th className="px-4 py-3">Metod / Yöntem</th>
                    <th className="px-4 py-3">Datum isporuke / Sevkiyat Tarihi</th>
                    <th className="px-4 py-3">Režim rute / Rota Modu</th>
                    <th className="px-4 py-3">Udaljenost / Mesafe</th>
                    <th className="px-4 py-3">Status / Durum</th>
                    <th className="px-4 py-3">Akcija / İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                  {ungroupedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Grupsuz kayıt yok / Nema zapisa bez grupe
                      </td>
                    </tr>
                  ) : (
                    ungroupedRows.map((row) => {
                      const isSelected = selectedIds.includes(row.id);
                      const isSaving = savingIds.includes(row.id);

                      return (
                        <tr
                          key={row.id}
                          onClick={() => toggleRow(row.id)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? "bg-emerald-600/10"
                              : "hover:bg-slate-800/60"
                          }`}
                        >
                          <td className="px-4 py-4 align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRow(row.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500"
                            />
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="font-medium text-white">
                              {row.customer_name || "-"}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {row.customer_phone || "-"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {row.city || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="text-white">{row.product_name || "-"}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {row.quantity ?? 0} adet
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div
                              className="flex flex-col justify-center gap-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              
                              <select
                                value={row.delivery_method || (isVehicleRow(row) ? "Sopstveno vozilo / Kendi Araç" : "Kurir / Kurye")}
                                onChange={(event) =>
                                  updateField(row.id, "delivery_method", event.target.value)
                                }
                                className="min-h-[60px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                              >
                                <option>Sopstveno vozilo / Kendi Araç</option>
                                <option>Kurir / Kurye</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-white">
                            <div onClick={(event) => event.stopPropagation()}>
                              <EnglishDatePicker
                                value={formatDateForInput(row.shipment_date)}
                                onChange={(value) =>
                                  updateField(row.id, "shipment_date", value)
                                }
                                placeholder="Odaberi datum / Tarih seç"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-white">
                            <div onClick={(event) => event.stopPropagation()}>
                              <select
                                value={row.route_mode || "Daleko → Blizu / Uzak → Yakın"}
                                onChange={(event) =>
                                  updateField(row.id, "route_mode", event.target.value)
                                }
                                className="min-h-[60px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                              >
                                <option>Daleko → Blizu / Uzak → Yakın</option>
                                <option>Blizu → Daleko / Yakın → Uzak</option>
                                <option>Ručno / Manuel</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-white">
                            {formatDistance(row.showroom_distance)}
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="text-white">
                              {row.delivery_status || "-"}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {row.payment_status || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-middle">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateSingleRow(
                                    row.id,
                                    { payment_status: "Ödendi / Paid" },
                                    "Ödeme alındı / Plaćanje označeno kao primljeno"
                                  );
                                }}
                                disabled={
                                  isSaving || row.payment_status === "Ödendi / Paid"
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                              >
                                Ödeme Alındı / Paid
                              </button>

                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  updateSingleRow(
                                    row.id,
                                    {
                                      shipment_status: "Teslim Edildi / Delivered",
                                      delivery_status: "Teslim Edildi / Delivered",
                                    },
                                    "Teslim edildi / Označeno kao isporučeno"
                                  );
                                }}
                                disabled={isSaving}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                              >
                                Teslim Edildi / Delivered
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {loading && (
          <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit items-center gap-3 rounded-full border border-slate-700 bg-slate-950/95 px-4 py-2 text-sm text-white shadow-2xl">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            Sevkiyat verileri yükleniyor... / Podaci o isporuci se učitavaju...
          </div>
        )}
      </div>
    </div>
  );
}
