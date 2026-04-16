"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  ComposedChart,
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
};

type Product = {
  id: string;
  name: string;
  cost: number | null;
  price?: number | null;
  stock?: number | null;
  minimum_stock?: number | null;
  is_active?: boolean | null;
};

type RangeType = "today" | "week" | "month" | "year";

type AlertItem = {
  text: string;
  type: "danger" | "warning" | "info";
};

type StockAlertItem = {
  name: string;
  stock: number;
  minimumStock: number;
  level: "out" | "critical" | "low";
};

type InsightItem = {
  title: string;
  text: string;
  tone: "danger" | "warning" | "positive" | "neutral";
};

export default function DashboardPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [range, setRange] = useState<RangeType>("month");
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [
      { data: salesData, error: salesError },
      { data: productData, error: productError },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, order_id, sale_date, created_at, total, quantity, profit, product_name, customer_name, city, delivery_status, payment_status"
        ),
      supabase
        .from("products")
        .select("id, name, cost, price, stock, minimum_stock, is_active"),
    ]);

    if (salesError) {
      alert("Prodaje nijesu učitane / Satışlar alınamadı: " + salesError.message);
    }

    if (productError) {
      alert("Proizvodi nijesu učitani / Ürünler alınamadı: " + productError.message);
    }

    setSales((salesData || []) as Sale[]);
    setProducts((productData || []) as Product[]);
    setLoading(false);
  }

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLoggingOut(false);
      alert("Odjava nije uspjela / Çıkış yapılamadı: " + error.message);
      return;
    }

    router.push("/login");
  }

  function filterByDate(data: Sale[]) {
    const now = new Date();

    return data.filter((sale) => {
      const rawDate = sale.sale_date || sale.created_at || "";
      const date = new Date(rawDate);

      if (Number.isNaN(date.getTime())) return false;

      if (range === "today") {
        return date.toDateString() === now.toDateString();
      }

      if (range === "week") {
        const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      }

      if (range === "month") {
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }

      if (range === "year") {
        return date.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }

  const filteredSales = useMemo(() => filterByDate(sales), [sales, range]);

  const activeProducts = useMemo(() => {
    return products.filter((product) => (product.is_active ?? true) === true);
  }, [products]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [filteredSales]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) => sum + Number(sale.profit || 0),
      0
    );
  }, [filteredSales]);

  const totalOrders = useMemo(() => {
    return new Set(
      filteredSales.map((sale) => sale.order_id || `fallback_${sale.id}`)
    ).size;
  }, [filteredSales]);

  const activeOrders = useMemo(() => {
    return new Set(
      filteredSales
        .filter(
          (sale) =>
            sale.delivery_status !== "Teslim Edildi / Delivered" ||
            sale.payment_status !== "Ödendi / Paid"
        )
        .map((sale) => sale.order_id || `fallback_${sale.id}`)
    ).size;
  }, [filteredSales]);

  const completedOrders = useMemo(() => {
    return new Set(
      filteredSales
        .filter(
          (sale) =>
            sale.delivery_status === "Teslim Edildi / Delivered" &&
            sale.payment_status === "Ödendi / Paid"
        )
        .map((sale) => sale.order_id || `fallback_${sale.id}`)
    ).size;
  }, [filteredSales]);

  const pendingPaymentsTotal = useMemo(() => {
    return filteredSales
      .filter((sale) => sale.payment_status !== "Ödendi / Paid")
      .reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [filteredSales]);

  const cancelledOrders = useMemo(() => {
    return new Set(
      filteredSales
        .filter((sale) => sale.delivery_status === "İptal / Cancelled")
        .map((sale) => sale.order_id || `fallback_${sale.id}`)
    ).size;
  }, [filteredSales]);

  const averageOrderValue = useMemo(() => {
    if (totalOrders === 0) return 0;
    return totalRevenue / totalOrders;
  }, [totalRevenue, totalOrders]);

  const deliveryBacklog = useMemo(() => {
    return new Set(
      sales
        .filter((sale) => sale.delivery_status !== "Teslim Edildi / Delivered")
        .map((sale) => sale.order_id || `fallback_${sale.id}`)
    ).size;
  }, [sales]);

  const completionRate = useMemo(() => {
    if (totalOrders === 0) return 0;
    return Math.round((completedOrders / totalOrders) * 100);
  }, [completedOrders, totalOrders]);

  const cancellationRate = useMemo(() => {
    if (totalOrders === 0) return 0;
    return Math.round((cancelledOrders / totalOrders) * 100);
  }, [cancelledOrders, totalOrders]);

  const pendingPaymentRate = useMemo(() => {
    if (totalRevenue === 0) return 0;
    return Math.round((pendingPaymentsTotal / totalRevenue) * 100);
  }, [pendingPaymentsTotal, totalRevenue]);

  const chartData = useMemo(() => {
    const map = new Map<string, { sales: number; profit: number }>();

    filteredSales.forEach((sale) => {
      const rawDate = sale.sale_date || sale.created_at || "";
      const key = rawDate.slice(5, 10) || rawDate.slice(0, 10) || "N/A";

      if (!map.has(key)) {
        map.set(key, { sales: 0, profit: 0 });
      }

      const current = map.get(key)!;
      current.sales += Number(sale.total || 0);
      current.profit += Number(sale.profit || 0);
    });

    return Array.from(map.entries()).map(([date, values]) => ({
      date,
      sales: Number(values.sales.toFixed(2)),
      profit: Number(values.profit.toFixed(2)),
    }));
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();

    filteredSales.forEach((sale) => {
      const name = sale.product_name || "Nepoznato / Bilinmiyor";
      map.set(name, (map.get(name) || 0) + Number(sale.total || 0));
    });

    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  const recentSales = useMemo(() => {
    return [...filteredSales]
      .sort((a, b) =>
        String(b.sale_date || b.created_at || "").localeCompare(
          String(a.sale_date || a.created_at || "")
        )
      )
      .slice(0, 6);
  }, [filteredSales]);

  const cityStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();

    filteredSales.forEach((sale) => {
      const city = sale.city || "Nepoznato / Bilinmiyor";

      if (!map.has(city)) {
        map.set(city, { total: 0, count: 0 });
      }

      const current = map.get(city)!;
      current.total += Number(sale.total || 0);
      current.count += 1;
    });

    return Array.from(map.entries())
      .map(([city, values]) => ({
        city,
        total: values.total,
        count: values.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  const customerStats = useMemo(() => {
    const map = new Map<string, { total: number; orderSet: Set<string> }>();

    filteredSales.forEach((sale) => {
      const customer = sale.customer_name || "Nepoznato / Bilinmiyor";
      const orderKey = sale.order_id || `fallback_${sale.id}`;

      if (!map.has(customer)) {
        map.set(customer, { total: 0, orderSet: new Set<string>() });
      }

      const current = map.get(customer)!;
      current.total += Number(sale.total || 0);
      current.orderSet.add(orderKey);
    });

    return Array.from(map.entries())
      .map(([customer, values]) => ({
        customer,
        total: values.total,
        orderCount: values.orderSet.size,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [filteredSales]);

  const topCustomersByProfit = useMemo(() => {
    const map = new Map<string, { profit: number; orderSet: Set<string> }>();

    filteredSales.forEach((sale) => {
      const customer = sale.customer_name || "Nepoznato / Bilinmiyor";
      const orderKey = sale.order_id || `fallback_${sale.id}`;

      if (!map.has(customer)) {
        map.set(customer, { profit: 0, orderSet: new Set<string>() });
      }

      const current = map.get(customer)!;
      current.profit += Number(sale.profit || 0);
      current.orderSet.add(orderKey);
    });

    return Array.from(map.entries())
      .map(([customer, values]) => ({
        customer,
        profit: values.profit,
        orderCount: values.orderSet.size,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [filteredSales]);

  const productProfitStats = useMemo(() => {
    return activeProducts
      .map((product) => {
        const price = Number(product.price ?? 0);
        const cost = Number(product.cost ?? 0);
        const stock = Number(product.stock ?? 0);
        const unitProfit = price - cost;
        const marginPercent = price > 0 ? (unitProfit / price) * 100 : 0;
        const stockProfit = unitProfit * stock;

        return {
          name: product.name || "Nepoznato / Bilinmiyor",
          price,
          cost,
          stock,
          unitProfit,
          marginPercent,
          stockProfit,
        };
      })
      .sort((a, b) => b.stockProfit - a.stockProfit);
  }, [activeProducts]);

  const profitableProductCount = useMemo(() => {
    return productProfitStats.filter((item) => item.unitProfit > 0).length;
  }, [productProfitStats]);

  const losingProductCount = useMemo(() => {
    return productProfitStats.filter((item) => item.unitProfit < 0).length;
  }, [productProfitStats]);

  const totalPotentialProfit = useMemo(() => {
    return productProfitStats.reduce((sum, item) => sum + item.stockProfit, 0);
  }, [productProfitStats]);

  const topProfitableProducts = useMemo(() => {
    return productProfitStats.slice(0, 5);
  }, [productProfitStats]);

  const worstMarginProducts = useMemo(() => {
    return [...productProfitStats]
      .sort((a, b) => a.marginPercent - b.marginPercent)
      .slice(0, 5);
  }, [productProfitStats]);

  const averageMarginPercent = useMemo(() => {
    if (productProfitStats.length === 0) return 0;
    return (
      productProfitStats.reduce((sum, item) => sum + item.marginPercent, 0) /
      productProfitStats.length
    );
  }, [productProfitStats]);

  const stockAlerts = useMemo(() => {
    return activeProducts
      .map((product) => {
        const stock = Number(product.stock ?? 0);
        const minimumStock = Number(product.minimum_stock ?? 5);
        let level: StockAlertItem["level"] | null = null;

        if (stock <= 0) level = "out";
        else if (stock <= minimumStock) level = "critical";
        else if (stock <= minimumStock * 2) level = "low";

        if (!level) return null;

        return {
          name: product.name || "Nepoznato / Bilinmiyor",
          stock,
          minimumStock,
          level,
        } satisfies StockAlertItem;
      })
      .filter((item): item is StockAlertItem => item !== null)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);
  }, [activeProducts]);

  const criticalStockCount = useMemo(() => {
    return activeProducts.filter((product) => {
      const stock = Number(product.stock ?? 0);
      const minimumStock = Number(product.minimum_stock ?? 5);
      return stock > 0 && stock <= minimumStock;
    }).length;
  }, [activeProducts]);

  const outOfStockCount = useMemo(() => {
    return activeProducts.filter((product) => Number(product.stock ?? 0) <= 0).length;
  }, [activeProducts]);

  const lowStockCount = useMemo(() => {
    return stockAlerts.filter((item) => item.level === "low").length;
  }, [stockAlerts]);

  const inventorySaleValue = useMemo(() => {
    return activeProducts.reduce((sum, product) => {
      return sum + Number(product.stock ?? 0) * Number(product.price ?? 0);
    }, 0);
  }, [activeProducts]);

  const inventoryCostValue = useMemo(() => {
    return activeProducts.reduce((sum, product) => {
      return sum + Number(product.stock ?? 0) * Number(product.cost ?? 0);
    }, 0);
  }, [activeProducts]);

  const stockHealthRate = useMemo(() => {
    if (activeProducts.length === 0) return 0;
    const healthy = activeProducts.filter((product) => {
      const stock = Number(product.stock ?? 0);
      const minimumStock = Number(product.minimum_stock ?? 5);
      return stock > minimumStock;
    }).length;

    return Math.round((healthy / activeProducts.length) * 100);
  }, [activeProducts]);

  const alerts = useMemo(() => {
    const list: AlertItem[] = [];

    if (filteredSales.length === 0) {
      list.push({
        text: "Nema prodaje u izabranom periodu / Seçili dönemde satış yok",
        type: "danger",
      });
    }

    const cancelCount = filteredSales.filter(
      (sale) => sale.delivery_status === "İptal / Cancelled"
    ).length;

    const cancelRate =
      filteredSales.length > 0 ? cancelCount / filteredSales.length : 0;

    if (cancelRate > 0.3) {
      list.push({
        text: "Visoka stopa otkazivanja / İptal oranı yüksek",
        type: "warning",
      });
    }

    if (pendingPaymentsTotal > 1000) {
      list.push({
        text: "Iznos čekajućih uplata je visok / Bekleyen ödeme yüksek",
        type: "warning",
      });
    }

    if (deliveryBacklog > 20) {
      list.push({
        text: "Broj narudžbi koje čekaju isporuku je visok / Teslimat bekleyen sipariş sayısı yüksek",
        type: "info",
      });
    }

    if (stockAlerts.some((item) => item.level === "out")) {
      list.push({
        text: "Otkriven je proizvod bez zalihe / Stoğu biten ürün var",
        type: "danger",
      });
    }

    if (stockAlerts.some((item) => item.level === "critical")) {
      list.push({
        text: "Otkriven je proizvod na kritičnom nivou zalihe / Kritik stok seviyesinde ürün var",
        type: "warning",
      });
    }

    if (stockAlerts.length > 0) {
      list.push({
        text: "Proizvode sa niskom zalihom treba pratiti / Düşük stoklu ürünler izlenmeli",
        type: "info",
      });
    }

    return list.slice(0, 6);
  }, [filteredSales, pendingPaymentsTotal, deliveryBacklog, stockAlerts]);

  const insights = useMemo(() => {
    const list: InsightItem[] = [];

    if (totalRevenue > 0 && totalProfit <= 0) {
      list.push({
        title: "Pritisak na profit / Kâr Baskısı",
        text: "Prodaja postoji, ali je profitabilnost perioda slaba. Treba pregledati cijene ili strukturu troškova / Satış var ancak dönem kârlılığı zayıf. Fiyatlama veya maliyet yapısı gözden geçirilmeli.",
        tone: "danger",
      });
    }

    if (pendingPaymentRate >= 30) {
      list.push({
        title: "Rizik naplate / Tahsilat Riski",
        text: "Važan dio prihoda još nije naplaćen. Novčani tok može biti pod pritiskom / Cironun önemli bölümü henüz tahsil edilmemiş durumda. Nakit akışı baskı altında olabilir.",
        tone: "warning",
      });
    }

    if (criticalStockCount + outOfStockCount >= 5) {
      list.push({
        title: "Pritisak zalihe / Stok Baskısı",
        text: "Više proizvoda je na minimalnom nivou zalihe ili je potpuno potrošeno. Rizik gubitka prodaje raste / Birden fazla ürün minimum stok seviyesinde veya tamamen tükenmiş. Satış kaybı riski artıyor.",
        tone: "danger",
      });
    }

    if (completionRate >= 70 && cancellationRate <= 10) {
      list.push({
        title: "Operativna snaga / Operasyon Gücü",
        text: "Stopa završetka je snažna, a stopa otkazivanja pod kontrolom. Kvalitet operacija izgleda zdravo / Tamamlanma oranı güçlü ve iptal oranı kontrollü. Operasyon kalitesi sağlıklı görünüyor.",
        tone: "positive",
      });
    }

    if (averageOrderValue > 0 && totalOrders > 0) {
      list.push({
        title: "Kvalitet korpe / Sepet Kalitesi",
        text: `Prosječna vrijednost narudžbe / Ortalama sipariş değeri: €${averageOrderValue.toFixed(2)}`,
        tone: "neutral",
      });
    }

    if (list.length === 0) {
      list.push({
        title: "Uravnotežen prikaz / Dengeli Görünüm",
        text: "U izabranom periodu nema pretjerano negativnih signala. Ipak, treba pratiti ravnotežu plaćanja, zalihe i isporuke / Seçili dönemde aşırı negatif sinyal görünmüyor. Yine de ödeme, stok ve teslimat dengesi izlenmeli.",
        tone: "neutral",
      });
    }

    return list.slice(0, 4);
  }, [
    totalRevenue,
    totalProfit,
    pendingPaymentRate,
    criticalStockCount,
    outOfStockCount,
    completionRate,
    cancellationRate,
    averageOrderValue,
    totalOrders,
  ]);

  function exportToExcel() {
    const data = filteredSales.map((sale) => ({
      "Sipariş / Order": sale.order_id || "-",
      "Tarih / Datum": sale.sale_date || sale.created_at?.slice(0, 10) || "-",
      "Müşteri / Kupac": sale.customer_name || "-",
      "Şehir / Grad": sale.city || "-",
      "Ürün / Proizvod": sale.product_name || "-",
      "Adet / Količina": sale.quantity ?? 0,
      "Toplam / Ukupno (€)": Number(sale.total || 0),
      "Kâr / Profit (€)": Number(sale.profit || 0),
      "Teslimat / Isporuka": sale.delivery_status || "-",
      "Ödeme / Plaćanje": sale.payment_status || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Satışlar");

    const colWidths = [
      { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 14 },
      { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
      { wch: 22 }, { wch: 18 },
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `baudecor-satis-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function getRangeLabel(value: RangeType) {
    if (value === "today") return "Bugün";
    if (value === "week") return "Bu Hafta";
    if (value === "month") return "Bu Ay";
    return "Bu Yıl";
  }

  function getStockDot(level: StockAlertItem["level"]) {
    if (level === "out") return "bg-red-400";
    if (level === "critical") return "bg-amber-400";
    return "bg-cyan-400";
  }

  function getStockText(level: StockAlertItem["level"]) {
    if (level === "out") return "text-red-300";
    if (level === "critical") return "text-amber-300";
    return "text-cyan-300";
  }

  function getStockLabel(level: StockAlertItem["level"]) {
    if (level === "out") return "Stok Yok";
    if (level === "critical") return "Kritik";
    return "Düşük";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#030712] p-8 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.4em] text-amber-500/60">BAUDECOR</div>
          <div className="text-2xl font-black tracking-tight text-white">Yükleniyor...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030712] px-6 py-8 text-white md:px-10">

      {/* ── HEADER ── */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-amber-500/70">
            BAUDECOR · YÖNETİM PANELİ
          </p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-white md:text-4xl">
            Kontrol Paneli
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1">
            {(["today", "week", "month", "year"] as RangeType[]).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  range === item
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {getRangeLabel(item)}
              </button>
            ))}
          </div>
          <button
            onClick={exportToExcel}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Excel ({filteredSales.length})
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:text-white disabled:opacity-50"
          >
            {loggingOut ? "Çıkılıyor..." : "Çıkış"}
          </button>
        </div>
      </div>

      {/* ── KPI KARTI SATIRI ── */}
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard
          label="Toplam Ciro"
          value={`€${totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Dönem geliri"
          accent="amber"
        />
        <KpiCard
          label="Toplam Kâr"
          value={`€${totalProfit.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="Brüt kârlılık"
          accent={totalProfit >= 0 ? "green" : "red"}
        />
        <KpiCard
          label="Sipariş"
          value={String(totalOrders)}
          sub={`${activeOrders} aktif · ${completedOrders} tamamlandı`}
          accent="blue"
        />
        <KpiCard
          label="Stok Sağlığı"
          value={`%${stockHealthRate}`}
          sub="Min. stok üstü ürün oranı"
          accent={stockHealthRate >= 75 ? "green" : stockHealthRate >= 50 ? "amber" : "red"}
        />
      </div>

      {/* ── OPERASYON METRİKLERİ ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricPill label="Tamamlanma" value={`%${completionRate}`} tone={completionRate >= 70 ? "green" : completionRate >= 50 ? "amber" : "red"} />
        <MetricPill label="İptal Oranı" value={`%${cancellationRate}`} tone={cancellationRate <= 10 ? "green" : cancellationRate <= 20 ? "amber" : "red"} />
        <MetricPill label="Bekleyen Ödeme" value={`€${pendingPaymentsTotal.toFixed(0)}`} tone={pendingPaymentRate < 15 ? "green" : pendingPaymentRate < 30 ? "amber" : "red"} />
        <MetricPill label="Teslimat Backlog" value={String(deliveryBacklog)} tone={deliveryBacklog < 10 ? "green" : deliveryBacklog < 20 ? "amber" : "red"} />
        <MetricPill label="Kritik Stok" value={String(criticalStockCount)} tone={criticalStockCount === 0 ? "green" : criticalStockCount <= 4 ? "amber" : "red"} />
        <MetricPill label="Stoksuz Ürün" value={String(outOfStockCount)} tone={outOfStockCount === 0 ? "green" : "red"} />
      </div>

      {/* ── UYARILAR + İÇGÖRÜLER ── */}
      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <LuxCard label="ÖNCELİKLİ UYARILAR" title="Kritik Uyarılar" badge={`${alerts.length} sinyal`}>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm font-semibold text-emerald-300">
                Her şey normal
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                    alert.type === "danger"
                      ? "border-red-500/20 bg-red-500/[0.07] text-red-300"
                      : alert.type === "warning"
                      ? "border-amber-500/20 bg-amber-500/[0.07] text-amber-300"
                      : "border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-300"
                  }`}
                >
                  <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    alert.type === "danger" ? "bg-red-400" : alert.type === "warning" ? "bg-amber-400" : "bg-cyan-400"
                  }`} />
                  {alert.text}
                </div>
              ))
            )}
          </div>
        </LuxCard>

        <LuxCard label="STRATEJİK YORUMLAR" title="Yönetim İçgörüleri" badge="Özet">
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  insight.tone === "danger"
                    ? "border-red-500/20 bg-red-500/[0.07]"
                    : insight.tone === "warning"
                    ? "border-amber-500/20 bg-amber-500/[0.07]"
                    : insight.tone === "positive"
                    ? "border-emerald-500/20 bg-emerald-500/[0.07]"
                    : "border-cyan-500/20 bg-cyan-500/[0.07]"
                }`}
              >
                <p className={`text-xs font-bold ${
                  insight.tone === "danger" ? "text-red-400" : insight.tone === "warning" ? "text-amber-400" : insight.tone === "positive" ? "text-emerald-400" : "text-cyan-400"
                }`}>{insight.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-300">{insight.text}</p>
              </div>
            ))}
          </div>
        </LuxCard>
      </div>

      {/* ── GRAFİK (TAM GENİŞLİK) ── */}
      <div className="mb-5 rounded-3xl border border-white/[0.07] bg-slate-900/40 p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/70">CİRO ANALİZİ</p>
            <h2 className="mt-1 text-xl font-bold text-white">Satış ve Kâr Trendi</h2>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-6 rounded-full bg-blue-400" />
              Ciro
            </span>
            <span className="flex items-center gap-2">
              <span className="h-[3px] w-6 rounded-full bg-emerald-400" />
              Kâr
            </span>
            <span className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 font-semibold text-slate-300">
              Ort. sipariş: €{averageOrderValue.toFixed(2)}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.6} />
            <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
            <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1117",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "12px",
              }}
            />
            <Area type="monotone" dataKey="sales" fill="rgba(96,165,250,0.08)" stroke="transparent" />
            <Line type="monotone" dataKey="sales" stroke="#60a5fa" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="profit" stroke="#34d399" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── STOK RİSKİ ── */}
      <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <LuxCard label="STOK BASKISI" title="Stok Riski">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Kritik Ürün" value={String(criticalStockCount)} tone={criticalStockCount === 0 ? "green" : "amber"} />
            <MiniStat label="Stoksuz" value={String(outOfStockCount)} tone={outOfStockCount === 0 ? "green" : "red"} />
            <MiniStat label="Düşük Stok" value={String(lowStockCount)} tone="blue" />
            <MiniStat label="Stok Sağlığı" value={`%${stockHealthRate}`} tone={stockHealthRate >= 75 ? "green" : stockHealthRate >= 50 ? "amber" : "red"} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Envanter Maliyeti</p>
              <p className="mt-1.5 text-base font-black text-white">€{inventoryCostValue.toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Satış Değeri</p>
              <p className="mt-1.5 text-base font-black text-white">€{inventorySaleValue.toFixed(0)}</p>
            </div>
          </div>
        </LuxCard>

        <LuxCard label="STOK ALARMASI" title="Ürün Stok Durumu">
          {stockAlerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm font-semibold text-emerald-300">
              Stok seviyeleri normal
            </div>
          ) : (
            <div className="space-y-2">
              {stockAlerts.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${getStockDot(item.level)}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                      <p className={`text-xs ${getStockText(item.level)}`}>{getStockLabel(item.level)} · Min {item.minimumStock}</p>
                    </div>
                  </div>
                  <p className={`ml-4 text-lg font-black ${getStockText(item.level)}`}>{item.stock}</p>
                </div>
              ))}
            </div>
          )}
        </LuxCard>
      </div>

      {/* ── KÂRLILIK PANELLERİ ── */}
      <div className="mb-5 grid gap-4 xl:grid-cols-3">
        <LuxCard label="KÂRLILIK" title="Kârlılık Özeti">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Potansiyel Kâr" value={`€${totalPotentialProfit.toFixed(0)}`} tone={totalPotentialProfit >= 0 ? "green" : "red"} />
            <MiniStat label="Ort. Marj" value={`%${averageMarginPercent.toFixed(1)}`} tone={averageMarginPercent >= 25 ? "green" : averageMarginPercent >= 10 ? "amber" : "red"} />
            <MiniStat label="Kârlı Ürün" value={String(profitableProductCount)} tone="green" />
            <MiniStat label="Zararlı Ürün" value={String(losingProductCount)} tone={losingProductCount === 0 ? "green" : "red"} />
          </div>
        </LuxCard>

        <LuxCard label="EN KARLI ÜRÜNLER" title="Stok Kâr Potansiyeli">
          <div className="space-y-2">
            {topProfitableProducts.length === 0 ? <EmptyRow /> : topProfitableProducts.map((item, i) => (
              <RankItem key={item.name} rank={i + 1} name={item.name} sub={`Marj %${item.marginPercent.toFixed(1)} · Stok ${item.stock}`} value={`€${item.stockProfit.toFixed(0)}`} valueClass={item.stockProfit >= 0 ? "text-emerald-300" : "text-red-300"} />
            ))}
          </div>
        </LuxCard>

        <LuxCard label="EN ZAYIF MARJ" title="Marj Uyarısı">
          <div className="space-y-2">
            {worstMarginProducts.length === 0 ? <EmptyRow /> : worstMarginProducts.map((item, i) => (
              <RankItem key={item.name} rank={i + 1} name={item.name} sub={`Birim kâr: €${item.unitProfit.toFixed(2)}`} value={`%${item.marginPercent.toFixed(1)}`} valueClass={item.marginPercent >= 0 ? "text-amber-300" : "text-red-300"} />
            ))}
          </div>
        </LuxCard>
      </div>

      {/* ── ALT PANELLER ── */}
      <div className="grid gap-4 xl:grid-cols-5">
        <LuxCard label="EN İYİ ÜRÜNLER" title="Ciro Katkısı">
          <div className="space-y-2">
            {topProducts.length === 0 ? <EmptyRow /> : topProducts.map((item, i) => (
              <RankItem key={item.name} rank={i + 1} name={item.name} sub="Ciro katkısı" value={`€${item.total.toFixed(0)}`} valueClass="text-emerald-300" />
            ))}
          </div>
        </LuxCard>

        <LuxCard label="ŞEHİR PERFORMANSI" title="Şehre Göre Ciro">
          <div className="space-y-2">
            {cityStats.length === 0 ? <EmptyRow /> : cityStats.map((item, i) => (
              <RankItem key={item.city} rank={i + 1} name={item.city} sub={`${item.count} sipariş`} value={`€${item.total.toFixed(0)}`} valueClass="text-violet-300" />
            ))}
          </div>
        </LuxCard>

        <LuxCard label="EN İYİ MÜŞTERİLER" title="Ciro Bazında">
          <div className="space-y-2">
            {customerStats.length === 0 ? <EmptyRow /> : customerStats.map((item, i) => (
              <RankItem key={item.customer} rank={i + 1} name={item.customer} sub={`${item.orderCount} sipariş`} value={`€${item.total.toFixed(0)}`} valueClass="text-cyan-300" />
            ))}
          </div>
        </LuxCard>

        <LuxCard label="EN KARLI MÜŞTERİLER" title="Kâr Bazında">
          <div className="space-y-2">
            {topCustomersByProfit.length === 0 ? <EmptyRow /> : topCustomersByProfit.map((item, i) => (
              <RankItem key={item.customer} rank={i + 1} name={item.customer} sub={`${item.orderCount} sipariş`} value={`€${item.profit.toFixed(0)}`} valueClass={item.profit >= 0 ? "text-emerald-300" : "text-red-300"} />
            ))}
          </div>
        </LuxCard>

        <LuxCard label="SON SATIŞLAR" title="Güncel Kayıtlar">
          <div className="space-y-2">
            {recentSales.length === 0 ? <EmptyRow /> : recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{sale.product_name || "—"}</p>
                  <p className="truncate text-xs text-slate-500">{sale.customer_name || "—"} · {sale.sale_date || sale.created_at?.slice(0, 10) || "—"}</p>
                </div>
                <p className="ml-3 shrink-0 text-sm font-bold text-blue-300">€{Number(sale.total || 0).toFixed(0)}</p>
              </div>
            ))}
          </div>
        </LuxCard>
      </div>

    </main>
  );
}

// ── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: {
  label: string;
  value: string;
  sub: string;
  accent: "amber" | "green" | "red" | "blue";
}) {
  const ring = {
    amber: "border-amber-500/20 bg-amber-500/[0.06]",
    green: "border-emerald-500/20 bg-emerald-500/[0.06]",
    red:   "border-red-500/20 bg-red-500/[0.06]",
    blue:  "border-blue-500/20 bg-blue-500/[0.06]",
  };
  const dot = {
    amber: "bg-amber-400",
    green: "bg-emerald-400",
    red:   "bg-red-400",
    blue:  "bg-blue-400",
  };
  const val = {
    amber: "text-amber-300",
    green: "text-emerald-300",
    red:   "text-red-300",
    blue:  "text-blue-300",
  };

  return (
    <div className={`rounded-2xl border p-5 ${ring[accent]}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot[accent]}`} />
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">{label}</p>
      </div>
      <p className={`mt-3 text-3xl font-black tracking-tight ${val[accent]}`}>{value}</p>
      <p className="mt-1.5 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function MetricPill({ label, value, tone }: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    green: "border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-300",
    amber: "border-amber-500/15 bg-amber-500/[0.05] text-amber-300",
    red:   "border-red-500/15 bg-red-500/[0.05] text-red-300",
    blue:  "border-blue-500/15 bg-blue-500/[0.05] text-blue-300",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${styles[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-60">{label}</p>
      <p className="mt-1.5 text-xl font-black">{value}</p>
    </div>
  );
}

function LuxCard({ label, title, badge, children }: {
  label: string;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-slate-900/40 p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-500/60">{label}</p>
          <h2 className="mt-1 text-base font-bold text-white">{title}</h2>
        </div>
        {badge && (
          <span className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-400">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    green: "text-emerald-300",
    amber: "text-amber-300",
    red:   "text-red-300",
    blue:  "text-blue-300",
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1.5 text-xl font-black ${styles[tone]}`}>{value}</p>
    </div>
  );
}

function RankItem({ rank, name, sub, value, valueClass }: {
  rank: number;
  name: string;
  sub: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="min-w-0 flex items-center gap-3">
        <span className="shrink-0 text-[10px] font-black text-slate-600">#{rank}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
      </div>
      <p className={`ml-3 shrink-0 text-sm font-bold ${valueClass || "text-white"}`}>{value}</p>
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-xs text-slate-500">
      Kayıt yok
    </div>
  );
}
