"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import * as XLSX from "xlsx";

type Customer = {
  id: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  note?: string | null;
  created_at: string;
};

type Sale = {
  id: string;
  order_id?: string | null;
  sale_date?: string | null;
  created_at: string;
  shipment_date?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_unit_price?: number | null;
  discount?: number | null;
  total: number;
  delivery_status?: string | null;
  shipment_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  commission_amount?: number | null;
  profit?: number | null;
  employee?: string | null;
  note?: string | null;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(customerId: string) {
    setLoading(true);

    const [{ data: customerData }, { data: salesData }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, address, city, note, created_at")
        .eq("id", customerId)
        .single(),
      supabase
        .from("sales")
        .select("id, order_id, sale_date, created_at, shipment_date, product_name, quantity, unit_price, final_unit_price, discount, total, delivery_status, shipment_status, payment_status, payment_method, commission_amount, profit, employee, note")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    if (!customerData) {
      alert("Müşteri bulunamadı / Kupac nije pronađen");
      router.push("/dashboard/customers");
      return;
    }

    setCustomer(customerData as Customer);
    setSales((salesData || []) as Sale[]);
    setLoading(false);
  }

  const stats = useMemo(() => {
    const totalSpent = sales.reduce((s, r) => s + Number(r.total || 0), 0);
    const totalProfit = sales.reduce((s, r) => s + Number(r.profit || 0), 0);
    const orderIds = new Set(sales.map((r) => r.order_id || `fb_${r.id}`));
    const delivered = sales.filter((r) => r.delivery_status === "Teslim Edildi / Delivered").length;
    const pending = sales.filter((r) => r.delivery_status === "Bekliyor / Pending").length;
    const cancelled = sales.filter((r) => r.delivery_status === "İptal / Cancelled").length;
    return { totalSpent, totalProfit, orderCount: orderIds.size, itemCount: sales.length, delivered, pending, cancelled };
  }, [sales]);

  const productStats = useMemo(() => {
    const map = new Map<string, { qty: number; total: number }>();
    sales.forEach((s) => {
      const key = s.product_name || "-";
      const curr = map.get(key) || { qty: 0, total: 0 };
      curr.qty += Number(s.quantity || 0);
      curr.total += Number(s.total || 0);
      map.set(key, curr);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [sales]);

  function exportToExcel() {
    if (!customer) return;
    const data = sales.map((s) => ({
      "Sipariş / Order": s.order_id || "-",
      "Tarih / Datum": s.sale_date || s.created_at?.slice(0, 10) || "-",
      "Sevkiyat / Isporuka": s.shipment_date || "-",
      "Ürün / Proizvod": s.product_name || "-",
      "Adet / Količina": s.quantity || 0,
      "Birim / Jedinica (€)": Number(s.final_unit_price ?? s.unit_price ?? 0).toFixed(2),
      "İndirim / Popust (€)": Number(s.discount || 0).toFixed(2),
      "Toplam / Ukupno (€)": Number(s.total || 0).toFixed(2),
      "Kâr / Dobit (€)": Number(s.profit || 0).toFixed(2),
      "Ödeme Yöntemi": s.payment_method || "-",
      "Teslim Durumu": s.delivery_status || "-",
      "Çalışan / Zaposleni": s.employee || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satış Geçmişi");
    XLSX.writeFile(wb, `musteri-${(customer.name || "detay").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) {
    return (
      <main className="flex-1 bg-slate-950 p-8 text-white">
        <div className="text-slate-400">Yükleniyor... / Učitava se...</div>
      </main>
    );
  }

  if (!customer) return null;

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/customers"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          ← Müşteriler / Kupci
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              MÜŞTERİ DETAYI / DETALJI KUPCA
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              {customer.name || "-"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
              {customer.phone && <span>📞 {customer.phone}</span>}
              {customer.address && <span>📍 {customer.address}{customer.city ? `, ${customer.city}` : ""}</span>}
              {customer.note && <span>📝 {customer.note}</span>}
              <span className="text-slate-600">Kayıt: {customer.created_at?.slice(0, 10)}</span>
            </div>
          </div>

          <button
            onClick={exportToExcel}
            disabled={sales.length === 0}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Excel İndir / Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Toplam Harcama / Ukupno" value={`€${stats.totalSpent.toFixed(2)}`} color="emerald" />
        <StatCard title="Toplam Kâr / Ukupna Dobit" value={`€${stats.totalProfit.toFixed(2)}`} color={stats.totalProfit >= 0 ? "emerald" : "red"} />
        <StatCard title="Sipariş Sayısı / Narudžbe" value={String(stats.orderCount)} />
        <StatCard title="Ürün Satırı / Stavke" value={String(stats.itemCount)} />
        <StatCard title="Teslim Edildi / Isporučeno" value={String(stats.delivered)} color="emerald" />
        <StatCard title="Bekliyor / Čeka" value={String(stats.pending)} color="amber" />
        <StatCard title="İptal / Otkazano" value={String(stats.cancelled)} color="red" />
      </div>

      {/* Product breakdown */}
      {productStats.length > 0 && (
        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="mb-4 text-lg font-semibold">Ürün Dağılımı / Raspored Proizvoda</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {productStats.map((p) => (
              <div key={p.name} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-sm font-medium text-white">{p.name}</p>
                <p className="mt-1 text-xs text-slate-400">{p.qty} adet · €{p.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sales table */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-6 text-lg font-semibold">
          Satış Geçmişi / Istorija Prodaje ({sales.length} kayıt)
        </h2>

        {sales.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 py-10 text-center text-slate-400">
            Satış kaydı bulunamadı / Nema zapisa prodaje
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 text-left">Tarih</th>
                  <th className="py-3 text-left">Sipariş</th>
                  <th className="py-3 text-left">Ürün</th>
                  <th className="py-3 text-center">Adet</th>
                  <th className="py-3 text-center">Birim €</th>
                  <th className="py-3 text-center">İndirim €</th>
                  <th className="py-3 text-center">Toplam €</th>
                  <th className="py-3 text-center">Kâr €</th>
                  <th className="py-3 text-center">Ödeme</th>
                  <th className="py-3 text-center">Sevkiyat</th>
                  <th className="py-3 text-center">Durum</th>
                  <th className="py-3 text-center">Çalışan</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const status = s.delivery_status || "-";
                  const statusColor =
                    status === "Teslim Edildi / Delivered"
                      ? "text-emerald-300"
                      : status === "İptal / Cancelled"
                      ? "text-red-300"
                      : "text-amber-300";

                  return (
                    <tr key={s.id} className="border-t border-slate-800 transition hover:bg-slate-900/60">
                      <td className="py-3 text-slate-300">{s.sale_date || s.created_at?.slice(0, 10) || "-"}</td>
                      <td className="py-3 text-xs text-slate-500">{s.order_id || "-"}</td>
                      <td className="py-3 font-medium">{s.product_name || "-"}</td>
                      <td className="py-3 text-center">{s.quantity}</td>
                      <td className="py-3 text-center">€{Number(s.final_unit_price ?? s.unit_price ?? 0).toFixed(2)}</td>
                      <td className="py-3 text-center text-amber-300">
                        {Number(s.discount || 0) > 0 ? `-€${Number(s.discount).toFixed(2)}` : "-"}
                      </td>
                      <td className="py-3 text-center font-semibold">€{Number(s.total || 0).toFixed(2)}</td>
                      <td className={`py-3 text-center font-semibold ${Number(s.profit || 0) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        €{Number(s.profit || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-center text-xs text-slate-400">
                        {s.payment_method === "Kredi Kartı / Credit Card"
                          ? "Kart"
                          : s.payment_method === "Banka Transferi / Bank Transfer"
                          ? "Havale"
                          : "Nakit"}
                      </td>
                      <td className="py-3 text-center text-slate-400">{s.shipment_date || "-"}</td>
                      <td className={`py-3 text-center text-xs font-medium ${statusColor}`}>
                        {status === "Teslim Edildi / Delivered"
                          ? "Teslim"
                          : status === "İptal / Cancelled"
                          ? "İptal"
                          : "Bekliyor"}
                      </td>
                      <td className="py-3 text-center text-slate-400">{s.employee || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color?: "emerald" | "amber" | "red";
}) {
  const textColor =
    color === "emerald"
      ? "text-emerald-300"
      : color === "amber"
      ? "text-amber-300"
      : color === "red"
      ? "text-red-300"
      : "text-white";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
