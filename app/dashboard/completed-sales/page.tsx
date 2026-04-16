"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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
  opening_stock?: number | null;
};

export default function CompletedSalesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

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
      .select("id, order_id, customer_id, customer_name, customer_phone, customer_address, product_name, quantity, unit_price, discount, final_unit_price, total, city, sale_date, shipment_date, shipment_status, delivery_status, payment_status, assigned_vehicle, assigned_courier, employee, note, created_at")
      .eq("delivery_status", "Teslim Edildi / Delivered")
      .eq("payment_status", "Ödendi / Paid")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Greška / Hata: " + error.message);
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
      .select("id, name, stock, opening_stock")
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
    const { error } = await supabase.from("stock_movements").insert([
      {
        product_id: params.product.id,
        product_name: params.product.name,
        movement_type: params.movementType,
        quantity: params.quantity,
        note: params.note,
      },
    ]);

    if (error) {
      throw new Error(error.message);
    }
  }

  async function syncProductStock(product: Product) {
    const { data: movementsData, error: movementError } = await supabase
      .from("stock_movements")
      .select("quantity")
      .eq("product_id", product.id);

    if (movementError) {
      throw new Error(
        "Stok hareket toplamı alınamadı / Could not load stock movement totals: " +
          movementError.message
      );
    }

    const totalMovement = (movementsData || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const openingStock = Number(product.opening_stock || 0);
    const newStock = openingStock + totalMovement;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", product.id);

    if (updateError) {
      throw new Error(
        "Stok güncellenemedi / Stock update failed: " + updateError.message
      );
    }
  }

  async function handleReturn(row: Row) {
    const confirmed = window.confirm(
      `Ova prodaja će biti vraćena i zaliha će biti obnovljena.\n\nKupac: ${
        row.customer_name || "-"
      }\nProizvod: ${row.product_name || "-"}\nKoličina: ${
        row.quantity || 0
      }\n\nNastaviti? / Devam edilsin mi?`
    );

    if (!confirmed) return;

    const product = findProductByName(row.product_name);

    if (!product) {
      alert("Proizvod nije pronađen / Ürün bulunamadı");
      return;
    }

    setActionLoadingId(row.id);

    try {
      await updateStockMovementLog({
        product,
        movementType: "Povrat prodaje / Satış İade",
        quantity: Number(row.quantity || 0),
        note: `${row.customer_name || "-"} completed sales iade işlemi / završeni povrat prodaje`,
      });

      await syncProductStock(product);

      const { error: saleError } = await supabase
        .from("sales")
        .update({
          delivery_status: "İade Edildi / Returned",
          shipment_status: "İade Edildi / Returned",
          payment_status: "Bekliyor / Pending",
          note: `${row.note ? row.note + " | " : ""}Povrat izvršen / İade yapıldı`,
        })
        .eq("id", row.id);

      if (saleError) {
        throw new Error(
          "Prodaja nije ažurirana / Satış güncellenemedi: " + saleError.message
        );
      }

      alert("Povrat završen i zaliha vraćena / İade tamamlandı ve stok geri eklendi ✅");

      await fetchRows();
      await fetchProducts();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Povrat nije uspio / İade işlemi başarısız"
      );
    } finally {
      setActionLoadingId("");
    }
  }

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      result = result.filter((row) => (row.city || "").toLowerCase().includes(q));
    }

    if (dateFrom) {
      result = result.filter((row) => {
        const d = row.sale_date || row.created_at.slice(0, 10);
        return new Date(d) >= dateFrom;
      });
    }

    if (dateTo) {
      result = result.filter((row) => {
        const d = row.sale_date || row.created_at.slice(0, 10);
        return new Date(d) <= dateTo;
      });
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
  }, [rows, cityFilter, dateFrom, dateTo, search]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Završene prodaje / Tamamlanan Satışlar
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Isporučeni i plaćeni prodajni zapisi. Ovdje se rade retroaktivno filtriranje, pretraga i povrat. /
          Teslimatı ve ödemesi tamamlanmış satış kayıtları. Geriye dönük filtreleme, arama ve iade işlemleri buradan yapılır.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Pretraga / Arama
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müşteri, ürün, sipariş..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Grad / Şehir
            </label>
            <input
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              placeholder="Şehir..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Početni datum / Başlangıç
            </label>
            <DatePicker
              selected={dateFrom}
              onChange={(date: Date | null) => setDateFrom(date)}
              dateFormat="dd.MM.yyyy"
              placeholderText="Tarih seçin..."
              isClearable
              wrapperClassName="w-full"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Završni datum / Bitiş
            </label>
            <DatePicker
              selected={dateTo}
              onChange={(date: Date | null) => setDateTo(date)}
              dateFormat="dd.MM.yyyy"
              placeholderText="Tarih seçin..."
              isClearable
              wrapperClassName="w-full"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        {loading ? (
          <div className="text-slate-400">Učitava se / Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2200px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Narudžba / Sipariş</th>
                  <th className="py-3 text-left">Kupac / Müşteri</th>
                  <th className="py-3 text-left">Telefon / Telefon</th>
                  <th className="py-3 text-left">Adresa / Adres</th>
                  <th className="py-3 text-left">Grad / Şehir</th>
                  <th className="py-3 text-left">Proizvod / Ürün</th>
                  <th className="py-3 text-center">Količina / Adet</th>
                  <th className="py-3 text-center">Neto jedinica / Net Birim</th>
                  <th className="py-3 text-center">Ukupno / Toplam</th>
                  <th className="py-3 text-center">Datum prodaje / Satış Tarihi</th>
                  <th className="py-3 text-center">Datum isporuke / Sevkiyat Tarihi</th>
                  <th className="py-3 text-center">Isporuka / Teslimat</th>
                  <th className="py-3 text-center">Plaćanje / Ödeme</th>
                  <th className="py-3 text-center">Vozilo / Araç</th>
                  <th className="py-3 text-center">Kurir / Kurye</th>
                  <th className="py-3 text-center">Akcija / İşlem</th>
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
                      <td className="py-3 text-center">{row.delivery_status === "Teslim Edildi / Delivered" ? "Isporučeno / Teslim Edildi" : row.delivery_status === "İade Edildi / Returned" ? "Vraćeno / İade Edildi" : row.delivery_status || "-"}</td>
                      <td className="py-3 text-center">{row.payment_status === "Ödendi / Paid" ? "Plaćeno / Ödendi" : row.payment_status === "Bekliyor / Pending" ? "Čeka / Bekliyor" : row.payment_status || "-"}</td>
                      <td className="py-3 text-center">{row.assigned_vehicle || "-"}</td>
                      <td className="py-3 text-center">{row.assigned_courier || "-"}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleReturn(row)}
                          disabled={rowBusy}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {rowBusy ? "Sačekaj... / Bekle..." : "Povrat / İade"}
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
                      Nema zapisa / Kayıt yok
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
