"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Row = {
  id: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  product_name?: string | null;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  final_unit_price?: number;
  total?: number;
  city?: string | null;
  sale_date?: string | null;
  shipment_date?: string | null;
  shipment_status?: string | null;
  delivery_status?: string | null;
  payment_status?: string | null;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  employee?: string | null;
  note?: string | null;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  stock: number;
};

export default function CompletedSalesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    await Promise.all([fetchRows(), fetchProducts()]);
  }

  async function fetchRows() {
    setLoading(true);

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("delivery_status", "Teslim Edildi / Delivered")
      .eq("payment_status", "Ödendi / Paid")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Hata / Error: " + error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data || []) as Row[]);
    setLoading(false);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock")
      .order("name", { ascending: true });

    if (error) {
      return;
    }

    setProducts((data || []) as Product[]);
  }

  function findProductByName(productName?: string | null) {
    if (!productName) return null;
    return products.find((product) => product.name === productName) || null;
  }

  async function updateStockMovementLog(params: {
    product: Product;
    movementType: string;
    quantity: number;
    note: string;
  }) {
    await supabase.from("stock_movements").insert([
      {
        product_id: params.product.id,
        product_name: params.product.name,
        movement_type: params.movementType,
        quantity: params.quantity,
        note: params.note,
      },
    ]);
  }

  async function handleReturn(row: Row) {
    const confirmed = window.confirm(
      `Bu satış iade edilecek ve stok geri eklenecek.\n\nMüşteri: ${
        row.customer_name || "-"
      }\nÜrün: ${row.product_name || "-"}\nAdet: ${
        row.quantity || 0
      }\n\nDevam edilsin mi? / Continue?`
    );

    if (!confirmed) return;

    const product = findProductByName(row.product_name);

    if (!product) {
      alert("Ürün bulunamadı / Product not found");
      return;
    }

    setActionLoadingId(row.id);

    const newStock = Number(product.stock || 0) + Number(row.quantity || 0);

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", product.id);

    if (stockError) {
      setActionLoadingId("");
      alert("Stok geri eklenemedi / Stock restore failed: " + stockError.message);
      return;
    }

    await updateStockMovementLog({
      product,
      movementType: "Sale Return / Satış İade",
      quantity: Number(row.quantity || 0),
      note: `${row.customer_name || "-"} completed sales iade işlemi / completed sales return`,
    });

    const { error: saleError } = await supabase
      .from("sales")
      .update({
        delivery_status: "İade Edildi / Returned",
        shipment_status: "İade Edildi / Returned",
        payment_status: "Bekliyor / Pending",
        note: `${row.note ? row.note + " | " : ""}İade yapıldı / Returned`,
      })
      .eq("id", row.id);

    setActionLoadingId("");

    if (saleError) {
      alert("Satış güncellenemedi / Sale update failed: " + saleError.message);
      return;
    }

    alert("İade tamamlandı ve stok geri eklendi / Return completed and stock restored ✅");

    await fetchRows();
    await fetchProducts();
  }

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (paymentFilter !== "all") {
      result = result.filter((row) => row.payment_status === paymentFilter);
    }

    if (deliveryFilter !== "all") {
      result = result.filter((row) => row.delivery_status === deliveryFilter);
    }

    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      result = result.filter((row) => (row.city || "").toLowerCase().includes(q));
    }

    if (dateFrom) {
      result = result.filter((row) => (row.sale_date || row.created_at.slice(0, 10)) >= dateFrom);
    }

    if (dateTo) {
      result = result.filter((row) => (row.sale_date || row.created_at.slice(0, 10)) <= dateTo);
    }

    const q = search.trim().toLowerCase();

    if (!q) return result;

    return result.filter((row) => {
      return (
        (row.order_id || "").toLowerCase().includes(q) ||
        (row.customer_name || "").toLowerCase().includes(q) ||
        (row.customer_phone || "").toLowerCase().includes(q) ||
        (row.customer_address || "").toLowerCase().includes(q) ||
        (row.product_name || "").toLowerCase().includes(q) ||
        (row.city || "").toLowerCase().includes(q) ||
        (row.employee || "").toLowerCase().includes(q)
      );
    });
  }, [rows, paymentFilter, deliveryFilter, cityFilter, dateFrom, dateTo, search]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Tamamlanan Satışlar / Completed Sales
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Teslimatı ve ödemesi tamamlanmış satış kayıtları. Geriye dönük filtreleme,
          arama ve iade işlemleri buradan yapılır. / Completed sales where delivery
          and payment are both finished.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Ara / Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sipariş, müşteri, telefon, ürün..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Şehir / City
            </label>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Şehir..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Ödeme / Payment
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="all">Tümü / All</option>
              <option value="Ödendi / Paid">Ödendi / Paid</option>
              <option value="Bekliyor / Pending">Bekliyor / Pending</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Durum / Status
            </label>
            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            >
              <option value="all">Tümü / All</option>
              <option value="Teslim Edildi / Delivered">Teslim Edildi / Delivered</option>
              <option value="İade Edildi / Returned">İade Edildi / Returned</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Başlangıç Tarihi / Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Bitiş Tarihi / Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        {loading ? (
          <div className="text-slate-400">Yükleniyor / Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Sipariş / Order</th>
                  <th className="py-3 text-left">Müşteri / Customer</th>
                  <th className="py-3 text-left">Telefon / Phone</th>
                  <th className="py-3 text-left">Adres / Address</th>
                  <th className="py-3 text-left">Şehir / City</th>
                  <th className="py-3 text-left">Proizvod / Ürün</th>
                  <th className="py-3 text-center">Adet / Qty</th>
                  <th className="py-3 text-center">Net Birim / Final Unit</th>
                  <th className="py-3 text-center">Toplam / Total</th>
                  <th className="py-3 text-center">Satış Tarihi / Sale Date</th>
                  <th className="py-3 text-center">Sevkiyat Tarihi / Shipment Date</th>
                  <th className="py-3 text-center">Teslimat / Delivery</th>
                  <th className="py-3 text-center">Ödeme / Payment</th>
                  <th className="py-3 text-center">Araç / Vehicle</th>
                  <th className="py-3 text-center">Kurye / Courier</th>
                  <th className="py-3 text-center">İşlem / Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const rowBusy = actionLoadingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/30"
                    >
                      <td className="py-3">{row.order_id || "-"}</td>
                      <td className="py-3">{row.customer_name || "-"}</td>
                      <td className="py-3">{row.customer_phone || "-"}</td>
                      <td className="py-3">{row.customer_address || "-"}</td>
                      <td className="py-3">{row.city || "-"}</td>
                      <td className="py-3">{row.product_name || "-"}</td>
                      <td className="py-3 text-center">{row.quantity || 0}</td>
                      <td className="py-3 text-center">
                        €{Number(row.final_unit_price ?? row.unit_price ?? 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-center font-medium">
                        €{Number(row.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        {row.sale_date || row.created_at?.slice(0, 10) || "-"}
                      </td>
                      <td className="py-3 text-center">{row.shipment_date || "-"}</td>
                      <td className="py-3 text-center">{row.delivery_status || "-"}</td>
                      <td className="py-3 text-center">{row.payment_status || "-"}</td>
                      <td className="py-3 text-center">{row.assigned_vehicle || "-"}</td>
                      <td className="py-3 text-center">{row.assigned_courier || "-"}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleReturn(row)}
                          disabled={rowBusy}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {rowBusy ? "Bekle... / Wait..." : "İade / Return"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={16}
                      className="py-8 text-center text-slate-400"
                    >
                      Kayıt yok / No records
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
