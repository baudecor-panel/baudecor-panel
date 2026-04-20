"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type DispatchRow = {
  id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  product_name?: string;
  quantity?: number;
  delivery_status?: string;
  delivery_method?: string;
  shipment_date?: string | null;
  shipment_status?: string;
  route_order?: number | null;
  loading_order?: number | null;
  shipment_note?: string | null;
  route_mode?: string | null;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  dispatch_group?: string | null;
  city?: string;
  created_at: string;
};

export default function DispatchPrintPage() {
  return (
    <Suspense fallback={<DispatchPrintLoading />}>
      <DispatchPrintContent />
    </Suspense>
  );
}

function DispatchPrintLoading() {
  return (
    <main className="min-h-screen bg-white p-8 text-black">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 border-b border-black pb-4">
          <h1 className="text-3xl font-bold">Sevkiyat Listesi / Dispatch List</h1>
          <p className="mt-2 text-sm">Yükleniyor / Loading...</p>
        </div>
      </div>
    </main>
  );
}

function DispatchPrintContent() {
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  const dateFilter = searchParams.get("date") || "";
  const methodFilter = searchParams.get("method") || "all";
  const search = searchParams.get("search") || "";
  const cityFilter = searchParams.get("city") || "";
  const vehicleFilter = searchParams.get("vehicle") || "";
  const courierFilter = searchParams.get("courier") || "";
  const groupFilter = searchParams.get("group") || "";

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as DispatchRow[]);
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    let result = rows.filter(
      (r) =>
        r.delivery_status !== "Teslim Edildi / Delivered" &&
        r.delivery_status !== "İade Edildi / Returned"
    );

    if (dateFilter) {
      result = result.filter((r) => (r.shipment_date || "") === dateFilter);
    }

    if (methodFilter !== "all") {
      result = result.filter((r) => {
        if (isVehicleMethod(methodFilter)) return isVehicleMethod(r.delivery_method);
        if (isCourierMethod(methodFilter)) return isCourierMethod(r.delivery_method);
        return r.delivery_method === methodFilter;
      });
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
      result = result.filter((r) =>
        (r.dispatch_group || "").toLowerCase().includes(q)
      );
    }

    const q = search.trim().toLowerCase();

    if (!q) return result;

    return result.filter((r) => {
      return (
        (r.customer_name || "").toLowerCase().includes(q) ||
        (r.customer_phone || "").toLowerCase().includes(q) ||
        (r.customer_address || "").toLowerCase().includes(q) ||
        (r.product_name || "").toLowerCase().includes(q) ||
        (r.city || "").toLowerCase().includes(q) ||
        (r.assigned_vehicle || "").toLowerCase().includes(q) ||
        (r.assigned_courier || "").toLowerCase().includes(q) ||
        (r.dispatch_group || "").toLowerCase().includes(q)
      );
    });
  }, [
    rows,
    dateFilter,
    methodFilter,
    search,
    cityFilter,
    vehicleFilter,
    courierFilter,
    groupFilter,
  ]);

  function isVehicleMethod(method?: string) {
    return (
      method === "Kendi Araç / Own Vehicle" ||
      method === "Sopstveno vozilo / Kendi Araç"
    );
  }

  function isCourierMethod(method?: string) {
    return method === "Kurye / Courier" || method === "Kurir / Kurye";
  }

  function sortByRoute(a: DispatchRow, b: DispatchRow) {
    const routeA = a.route_order ?? 9999;
    const routeB = b.route_order ?? 9999;
    if (routeA !== routeB) return routeA - routeB;
    return (a.loading_order ?? 9999) - (b.loading_order ?? 9999);
  }

  const ownVehicleRows = [...filteredRows]
    .filter((r) => isVehicleMethod(r.delivery_method))
    .sort(sortByRoute);

  const courierRows = [...filteredRows]
    .filter((r) => isCourierMethod(r.delivery_method))
    .sort(sortByRoute);

  const headerVehicle =
    vehicleFilter ||
    ownVehicleRows.find((r) => r.assigned_vehicle)?.assigned_vehicle ||
    courierRows.find((r) => r.assigned_vehicle)?.assigned_vehicle ||
    "Tümü / All";

  const headerCourier =
    courierFilter ||
    ownVehicleRows.find((r) => r.assigned_courier)?.assigned_courier ||
    courierRows.find((r) => r.assigned_courier)?.assigned_courier ||
    "Tümü / All";

  const headerGroup =
    groupFilter ||
    ownVehicleRows.find((r) => r.dispatch_group)?.dispatch_group ||
    courierRows.find((r) => r.dispatch_group)?.dispatch_group ||
    "Tümü / All";

  return (
    <main className="min-h-screen bg-white p-8 text-black">
      <div className="mb-8 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white"
        >
          Yazdır / Print
        </button>
      </div>

      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 border-b border-black pb-4">
          <h1 className="text-3xl font-bold">Sevkiyat Listesi / Dispatch List</h1>
          <p className="mt-2 text-sm">Tarih / Date: {dateFilter || "Tümü / All"}</p>
          <p className="text-sm">
            Yöntem / Method: {methodFilter === "all" ? "Tümü / All" : methodFilter}
          </p>
          <p className="text-sm">Şehir / City: {cityFilter || "Tümü / All"}</p>
          <p className="text-sm">Araç / Vehicle: {headerVehicle || "Tümü / All"}</p>
          <p className="text-sm">Kurye / Courier: {headerCourier || "Tümü / All"}</p>
          <p className="text-sm">Grup / Dispatch Group: {headerGroup || "Tümü / All"}</p>
        </div>

        {loading ? (
          <div>Yükleniyor / Loading...</div>
        ) : (
          <div className="space-y-10">
            <PrintSection
              title="Kendi Araç / Own Vehicle"
              rows={ownVehicleRows}
              showRoute
            />

            <PrintSection
              title="Kurye / Courier"
              rows={courierRows}
              showRoute
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function PrintSection({
  title,
  rows,
  showRoute,
}: {
  title: string;
  rows: DispatchRow[];
  showRoute: boolean;
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-black px-3 py-2 text-left">Müşteri / Customer</th>
            <th className="border border-black px-3 py-2 text-left">Telefon / Phone</th>
            <th className="border border-black px-3 py-2 text-left">Şehir / City</th>
            <th className="border border-black px-3 py-2 text-left">Adres / Address</th>
            <th className="border border-black px-3 py-2 text-left">Ürün / Product</th>
            <th className="border border-black px-3 py-2 text-center">Adet / Qty</th>
            <th className="border border-black px-3 py-2 text-left">Araç / Vehicle</th>
            <th className="border border-black px-3 py-2 text-left">Kurye / Courier</th>
            <th className="border border-black px-3 py-2 text-left">Grup / Group</th>

            {showRoute && (
              <>
                <th className="border border-black px-3 py-2 text-center">
                  Teslimat Sırası / Route Order
                </th>
                <th className="border border-black px-3 py-2 text-center">
                  Yükleme Sırası / Loading Order
                </th>
              </>
            )}

            <th className="border border-black px-3 py-2 text-left">Not / Note</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border border-black px-3 py-2">
                {row.customer_name || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.customer_phone || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.city || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.customer_address || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.product_name || "-"}
              </td>
              <td className="border border-black px-3 py-2 text-center">
                {row.quantity || 0}
              </td>
              <td className="border border-black px-3 py-2">
                {row.assigned_vehicle || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.assigned_courier || "-"}
              </td>
              <td className="border border-black px-3 py-2">
                {row.dispatch_group || "-"}
              </td>

              {showRoute && (
                <>
                  <td className="border border-black px-3 py-2 text-center">
                    {row.route_order ?? "-"}
                  </td>
                  <td className="border border-black px-3 py-2 text-center">
                    {row.loading_order ?? "-"}
                  </td>
                </>
              )}

              <td className="border border-black px-3 py-2">
                {row.shipment_note || "-"}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={showRoute ? 12 : 10}
                className="border border-black px-3 py-6 text-center"
              >
                Kayıt yok / No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
