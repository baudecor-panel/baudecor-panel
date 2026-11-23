"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PeriodPicker from "@/components/PeriodPicker";
import { isOperatingExpense } from "@/lib/expenses";
import {
  buildBuckets,
  defaultSelection,
  getPeriod,
  inRange,
  parseDate,
  PeriodSelection,
  previousRange,
} from "@/lib/period";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Sale = {
  id: string;
  order_id?: string | null;
  sale_date?: string | null;
  created_at?: string | null;
  total: number | null;
  quantity: number | null;
  profit?: number | null;
  product_name: string | null;
  customer_name?: string | null;
  city?: string | null;
  delivery_status?: string | null;
  payment_status?: string | null;
  assigned_courier?: string | null;
};

type Product = {
  id: string;
  name: string;
  stock?: number | null;
  minimum_stock?: number | null;
  is_active?: boolean | null;
  unit?: string | null;
};

type Expense = {
  type?: string | null;
  amount: number;
  created_at: string;
};

type KasaEntry = {
  id: string;
  amount: number;
  type: "opening_balance" | "manual_in" | "manual_out";
  created_at: string;
};

const PAID = "Ödendi / Paid";
const DELIVERED = "Teslim Edildi / Delivered";
const CANCELLED = "İptal / Cancelled";

const eur = (n: number) =>
  "€" + n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
const orderKey = (s: Sale) => s.order_id || `fallback_${s.id}`;
const saleDate = (s: Sale) => parseDate(s.sale_date || s.created_at);

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [kasaEntries, setKasaEntries] = useState<KasaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<PeriodSelection>(() => defaultSelection());

  async function fetchData() {
    setLoading(true);

    const [
      { data: salesData, error: salesError },
      { data: productData, error: productError },
      { data: expenseData },
      { data: kasaData },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, order_id, sale_date, created_at, total, quantity, profit, product_name, customer_name, city, delivery_status, payment_status, assigned_courier"
        ),
      supabase.from("products").select("id, name, stock, minimum_stock, is_active, unit"),
      supabase.from("expenses").select("type, amount, created_at"),
      supabase
        .from("kasa_entries")
        .select("id, amount, type, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (salesError) alert("Prodaje nijesu učitane / Satışlar alınamadı: " + salesError.message);
    if (productError) alert("Proizvodi nijesu učitani / Ürünler alınamadı: " + productError.message);

    setSales((salesData || []) as Sale[]);
    setProducts((productData || []) as Product[]);
    setExpenses((expenseData || []) as Expense[]);
    setKasaEntries((kasaData || []) as KasaEntry[]);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const period = useMemo(() => getPeriod(selection), [selection]);
  const prev = useMemo(() => previousRange(period), [period]);

  const periodSales = useMemo(
    () => sales.filter((s) => inRange(saleDate(s), period)),
    [sales, period]
  );

  const revenue = useMemo(
    () => periodSales.reduce((sum, s) => sum + Number(s.total || 0), 0),
    [periodSales]
  );

  const prevRevenue = useMemo(
    () =>
      sales
        .filter((s) => inRange(saleDate(s), prev))
        .reduce((sum, s) => sum + Number(s.total || 0), 0),
    [sales, prev]
  );

  const revenueChange = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

  const grossProfit = useMemo(
    () => periodSales.reduce((sum, s) => sum + Number(s.profit || 0), 0),
    [periodSales]
  );

  const periodExpenses = useMemo(() => {
    const rows = expenses.filter((e) => inRange(parseDate(e.created_at), period));
    const operating = rows.filter((e) => isOperatingExpense(e.type));
    return {
      total: operating.reduce((sum, e) => sum + Number(e.amount || 0), 0),
      count: operating.length,
      purchases: rows
        .filter((e) => !isOperatingExpense(e.type))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    };
  }, [expenses, period]);

  const netProfit = grossProfit - periodExpenses.total;

  const orderCount = useMemo(() => new Set(periodSales.map(orderKey)).size, [periodSales]);

  // Güncel durumlar: seçili dönemden bağımsız
  const kasaBalance = useMemo(() => {
    const latestOpening = kasaEntries.find((e) => e.type === "opening_balance");
    if (!latestOpening) return null;

    const cutoff = latestOpening.created_at;
    const salesIncome = sales
      .filter((s) => s.payment_status === PAID && s.created_at && s.created_at >= cutoff)
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    const expensesTotal = expenses
      .filter((e) => e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const manualIn = kasaEntries
      .filter((e) => e.type === "manual_in" && e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const manualOut = kasaEntries
      .filter((e) => e.type === "manual_out" && e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return Number(latestOpening.amount) + salesIncome - expensesTotal + manualIn - manualOut;
  }, [kasaEntries, sales, expenses]);

  const unpaid = useMemo(() => {
    const rows = sales.filter((s) => s.payment_status !== PAID && s.delivery_status !== CANCELLED);
    return {
      total: rows.reduce((sum, s) => sum + Number(s.total || 0), 0),
      orders: new Set(rows.map(orderKey)).size,
    };
  }, [sales]);

  const stockIssues = useMemo(() => {
    return products
      .filter((p) => (p.is_active ?? true) === true)
      .map((p) => ({
        name: p.name,
        stock: Number(p.stock ?? 0),
        min: Number(p.minimum_stock ?? 5),
        unit: p.unit === "m2" ? "m²" : "adet",
      }))
      .filter((p) => p.stock <= p.min)
      .sort((a, b) => a.stock - b.stock);
  }, [products]);

  const pendingDeliveries = useMemo(() => {
    const rows = sales.filter((s) => s.delivery_status !== DELIVERED && s.delivery_status !== CANCELLED);
    const cities = new Map<string, number>();
    rows.forEach((s) => {
      if (s.city) cities.set(s.city, (cities.get(s.city) || 0) + 1);
    });
    const topCity = Array.from(cities.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { orders: new Set(rows.map(orderKey)).size, topCity };
  }, [sales]);

  const courierPending = useMemo(() => {
    const rows = sales.filter(
      (s) =>
        s.assigned_courier &&
        s.assigned_courier.trim() !== "" &&
        s.payment_status !== PAID &&
        s.delivery_status !== CANCELLED
    );
    const byCourier = new Map<string, number>();
    rows.forEach((s) => {
      const name = s.assigned_courier!.trim();
      byCourier.set(name, (byCourier.get(name) || 0) + Number(s.total || 0));
    });
    return {
      total: rows.reduce((sum, s) => sum + Number(s.total || 0), 0),
      orders: new Set(rows.map(orderKey)).size,
      byCourier: Array.from(byCourier.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [sales]);

  const chartData = useMemo(() => {
    const buckets = buildBuckets(period).map((b) => ({ ...b, sales: 0, profit: 0 }));
    periodSales.forEach((s) => {
      // Saatlik görünümde saat bilgisi created_at'te; sale_date sadece tarih tutuyor
      const d = period.bucket === "hour" ? parseDate(s.created_at) || saleDate(s) : saleDate(s);
      const b = buckets.find((x) => inRange(d, x));
      if (!b) return;
      b.sales += Number(s.total || 0);
      b.profit += Number(s.profit || 0);
    });
    return buckets.map((b) => ({
      label: b.label,
      sales: Number(b.sales.toFixed(2)),
      profit: Number(b.profit.toFixed(2)),
    }));
  }, [periodSales, period]);

  const unitByName = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(p.name, p.unit === "m2" ? "m²" : "adet"));
    return map;
  }, [products]);

  const recentSales = useMemo(
    () =>
      [...periodSales]
        .sort((a, b) =>
          String(b.sale_date || b.created_at || "").localeCompare(String(a.sale_date || a.created_at || ""))
        )
        .slice(0, 5),
    [periodSales]
  );

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    periodSales.forEach((s) => {
      const name = s.product_name || "Nepoznato / Bilinmiyor";
      map.set(name, (map.get(name) || 0) + Number(s.total || 0));
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodSales]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <h1 className="text-2xl font-bold">Kontrolna tabla / Panel</h1>
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
          Učitava se / Yükleniyor
        </div>
      </main>
    );
  }

  return (
    <main className="grid gap-5 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Kontrolna tabla / Panel</h1>
          <p className="mt-1 text-sm text-slate-400">{period.label}</p>
        </div>
        <PeriodPicker value={selection} onChange={setSelection} />
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="Prihod / Ciro"
          value={eur(revenue)}
          helper={
            revenueChange === null ? (
              `${orderCount} sipariş`
            ) : (
              <>
                <span className={revenueChange >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {revenueChange >= 0 ? "▲" : "▼"} %{Math.abs(revenueChange)}
                </span>{" "}
                {period.compareLabel}
              </>
            )
          }
        />
        <Kpi
          label="Troškovi / Giderler"
          value={eur(periodExpenses.total)}
          valueClassName={periodExpenses.total > 0 ? "text-red-300" : undefined}
          helper={
            (periodExpenses.count === 0 ? "Bu dönemde gider yok" : `${periodExpenses.count} gider kaydı`) +
            (periodExpenses.purchases > 0 ? ` · ayrıca mal alımı ${eur(periodExpenses.purchases)}` : "")
          }
          href="/dashboard/expenses"
        />
        <Kpi
          label="Neto profit / Net Kâr"
          value={eur(netProfit)}
          valueClassName={netProfit < 0 ? "text-red-300" : "text-emerald-300"}
          helper={`Ciro − maliyet ${eur(revenue - grossProfit)} − giderler`}
        />
        <Kpi
          label="Kasa / Kasa"
          value={kasaBalance === null ? "—" : eur(kasaBalance)}
          valueClassName={kasaBalance !== null && kasaBalance < 0 ? "text-red-300" : undefined}
          helper={kasaBalance === null ? "Açılış bakiyesi girilmedi" : "Nakit + banka · güncel"}
          href="/dashboard/kasa"
        />
        <Kpi
          label="Na čekanju / Bekleyen Tahsilat"
          value={eur(unpaid.total)}
          helper={
            unpaid.orders === 0 ? (
              "Bekleyen ödeme yok"
            ) : (
              <span className="text-amber-400">{unpaid.orders} sipariş ödenmedi</span>
            )
          }
          href="/dashboard/sales"
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold">
          Za danas / Bugün İlgilenilecekler
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <TodoItem
            href="/dashboard/products"
            tone={stockIssues.length === 0 ? "ok" : stockIssues.some((p) => p.stock <= 0) ? "bad" : "warn"}
            title={stockIssues.length === 0 ? "Stoklar normal" : `${stockIssues.length} ürün kritik stokta`}
            detail={
              stockIssues.length === 0
                ? "Minimum stok altında ürün yok"
                : `${stockIssues[0].name} · ${qty(stockIssues[0].stock)} ${stockIssues[0].unit} kaldı`
            }
          />
          <TodoItem
            href="/dashboard/dispatch"
            tone={pendingDeliveries.orders === 0 ? "ok" : "warn"}
            title={
              pendingDeliveries.orders === 0
                ? "Bekleyen teslimat yok"
                : `${pendingDeliveries.orders} teslimat bekliyor`
            }
            detail={
              pendingDeliveries.orders === 0
                ? "Tüm siparişler teslim edildi"
                : pendingDeliveries.topCity
                ? `En çok: ${pendingDeliveries.topCity}`
                : "Sevkiyat sayfasında gör"
            }
          />
          <TodoItem
            href="/dashboard/dispatch"
            tone={courierPending.total === 0 ? "ok" : "info"}
            title={courierPending.total === 0 ? "Kuryede para yok" : `Kuryede ${eur(courierPending.total)}`}
            detail={
              courierPending.total === 0
                ? "Tüm kurye ödemeleri alındı"
                : courierPending.byCourier
                    .slice(0, 2)
                    .map(([name, amount]) => `${name} ${eur(amount)}`)
                    .join(" · ") + ` · ${courierPending.orders} sipariş`
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Prodaja i profit / Satış ve Kâr</h2>
          <div className="flex gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> Ciro
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Kâr
            </span>
          </div>
        </div>
        <div className="mt-3 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={56}
                tickFormatter={(v: number) => (v >= 1000 ? `€${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}k` : `€${v}`)}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                formatter={(v, name) => [eur(Number(v)), name === "sales" ? "Ciro" : "Kâr"]}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  color: "#fff",
                }}
              />
              <Bar dataKey="sales" fill="#3b82f6" radius={[5, 5, 0, 0]} maxBarSize={40} />
              <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold">Nedavne prodaje / Son Satışlar</h2>
          {recentSales.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-t border-slate-800">
                      <td className="py-2.5 pr-2">
                        <div className="font-medium">{s.product_name || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {[s.customer_name, s.city].filter(Boolean).join(" · ") || "-"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 text-right text-slate-300">
                        {qty(Number(s.quantity || 0))} {unitByName.get(s.product_name || "") || "adet"}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 text-right font-semibold">
                        {eur(Number(s.total || 0))}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            s.payment_status === PAID
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {s.payment_status === PAID ? "Ödendi" : "Bekliyor"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/dashboard/sales" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
            Sve prodaje / Tüm satışlar ›
          </Link>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold">Najbolji proizvodi / En Çok Satanlar</h2>
          {topProducts.length === 0 ? (
            <Empty />
          ) : (
            <ol className="grid gap-3">
              {topProducts.map((p, i) => (
                <li key={p.name} className="grid grid-cols-[20px_1fr_auto] items-center gap-x-2 text-sm">
                  <span className="text-slate-500">{i + 1}</span>
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold tabular-nums">{eur(p.total)}</span>
                  <span />
                  <div className="col-span-2 h-1.5 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${topProducts[0].total > 0 ? (p.total / topProducts[0].total) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Link href="/dashboard/reports" className="text-sm font-semibold text-blue-300 hover:text-blue-200">
            Detaljni izvještaji / Detaylı raporlar ›
          </Link>
        </section>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  helper,
  href,
  valueClassName,
}: {
  label: string;
  value: string;
  helper: React.ReactNode;
  href?: string;
  valueClassName?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-2xl font-bold tabular-nums md:text-3xl ${valueClassName || "text-white"}`}>{value}</p>
      <p className="text-xs text-slate-500">{helper}</p>
    </>
  );
  const cls = "grid gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-slate-700`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function TodoItem({
  href,
  tone,
  title,
  detail,
}: {
  href: string;
  tone: "ok" | "warn" | "bad" | "info";
  title: string;
  detail: string;
}) {
  const dot = { ok: "bg-emerald-400", warn: "bg-amber-400", bad: "bg-red-400", info: "bg-blue-400" }[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 transition hover:border-slate-700"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
      <span className="ml-auto text-slate-500">›</span>
    </Link>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-6 text-sm text-slate-400">
      Bu dönemde kayıt yok / Nema zapisa
    </div>
  );
}
