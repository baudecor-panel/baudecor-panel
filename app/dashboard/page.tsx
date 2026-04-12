"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  LineChart,
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

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*");

    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*");

    if (salesError) {
      console.error("Sales fetch error:", salesError);
    }

    if (productError) {
      console.error("Products fetch error:", productError);
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
      alert("Çıkış yapılamadı / Logout failed: " + error.message);
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

  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();

    products.forEach((product) => {
      if (product.name) {
        map.set(product.name, Number(product.cost || 0));
      }
    });

    return map;
  }, [products]);

  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  }, [filteredSales]);

  const totalProfit = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const productName = sale.product_name || "";
      const cost = productCostMap.get(productName) || 0;
      return sum + (Number(sale.total || 0) - cost * Number(sale.quantity || 0));
    }, 0);
  }, [filteredSales, productCostMap]);

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

      const productName = sale.product_name || "";
      const cost = productCostMap.get(productName) || 0;
      const profit =
        Number(sale.total || 0) - cost * Number(sale.quantity || 0);

      if (!map.has(key)) {
        map.set(key, { sales: 0, profit: 0 });
      }

      const current = map.get(key)!;
      current.sales += Number(sale.total || 0);
      current.profit += profit;
    });

    return Array.from(map.entries()).map(([date, values]) => ({
      date,
      sales: Number(values.sales.toFixed(2)),
      profit: Number(values.profit.toFixed(2)),
    }));
  }, [filteredSales, productCostMap]);

  const topProducts = useMemo(() => {
    const map = new Map<string, number>();

    filteredSales.forEach((sale) => {
      const name = sale.product_name || "Bilinmiyor / Unknown";
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
      const city = sale.city || "Bilinmiyor / Unknown";

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
      const customer = sale.customer_name || "Bilinmiyor / Unknown";
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
          name: product.name || "Bilinmiyor / Unknown",
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
          name: product.name || "Bilinmiyor / Unknown",
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
        text: "Seçili dönemde satış yok / No sales in selected period",
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
        text: "İptal oranı yüksek / High cancellation rate",
        type: "warning",
      });
    }

    if (pendingPaymentsTotal > 1000) {
      list.push({
        text: "Bekleyen ödeme yüksek / Pending payments are high",
        type: "warning",
      });
    }

    if (deliveryBacklog > 20) {
      list.push({
        text: "Teslimat bekleyen sipariş sayısı yüksek / Delivery backlog is high",
        type: "info",
      });
    }

    if (stockAlerts.some((item) => item.level === "out")) {
      list.push({
        text: "Stoğu biten ürün var / Out of stock product detected",
        type: "danger",
      });
    }

    if (stockAlerts.some((item) => item.level === "critical")) {
      list.push({
        text: "Kritik stok seviyesinde ürün var / Critical stock level detected",
        type: "warning",
      });
    }

    if (stockAlerts.length > 0) {
      list.push({
        text: "Düşük stoklu ürünler izlenmeli / Low-stock products should be monitored",
        type: "info",
      });
    }

    return list.slice(0, 6);
  }, [filteredSales, pendingPaymentsTotal, deliveryBacklog, stockAlerts]);

  const insights = useMemo(() => {
    const list: InsightItem[] = [];

    if (totalRevenue > 0 && totalProfit <= 0) {
      list.push({
        title: "Kâr Baskısı / Margin Pressure",
        text: "Satış var ancak dönem kârlılığı zayıf. Fiyatlama veya maliyet yapısı gözden geçirilmeli.",
        tone: "danger",
      });
    }

    if (pendingPaymentRate >= 30) {
      list.push({
        title: "Tahsilat Riski / Collection Risk",
        text: "Cironun önemli bölümü henüz tahsil edilmemiş durumda. Nakit akışı baskı altında olabilir.",
        tone: "warning",
      });
    }

    if (criticalStockCount + outOfStockCount >= 5) {
      list.push({
        title: "Stok Baskısı / Stock Pressure",
        text: "Birden fazla ürün minimum stok seviyesinde veya tamamen tükenmiş. Satış kaybı riski artıyor.",
        tone: "danger",
      });
    }

    if (completionRate >= 70 && cancellationRate <= 10) {
      list.push({
        title: "Operasyon Gücü / Operational Strength",
        text: "Tamamlanma oranı güçlü ve iptal oranı kontrollü. Operasyon kalitesi sağlıklı görünüyor.",
        tone: "positive",
      });
    }

    if (averageOrderValue > 0 && totalOrders > 0) {
      list.push({
        title: "Sepet Kalitesi / Basket Quality",
        text: `Ortalama sipariş değeri €${averageOrderValue.toFixed(
          2
        )}. Üst segment satış performansı bu metrikten izlenebilir.`,
        tone: "neutral",
      });
    }

    if (list.length === 0) {
      list.push({
        title: "Dengeli Görünüm / Balanced View",
        text: "Seçili dönemde aşırı negatif sinyal görünmüyor. Yine de ödeme, stok ve teslimat dengesi izlenmeli.",
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

  function getRangeLabel(value: RangeType) {
    if (value === "today") return "Bugün / Today";
    if (value === "week") return "Bu Hafta / This Week";
    if (value === "month") return "Bu Ay / This Month";
    return "Bu Yıl / This Year";
  }

  function getStockLabel(level: StockAlertItem["level"]) {
    if (level === "out") return "Stok Yok / Out of Stock";
    if (level === "critical") return "Kritik / Critical";
    return "Düşük / Low";
  }

  function getStockClass(level: StockAlertItem["level"]) {
    if (level === "out") return "text-red-300";
    if (level === "critical") return "text-amber-300";
    return "text-cyan-300";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
        <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            BAUDECOR EXECUTIVE VIEW
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Kontrol Paneli / Dashboard
          </h1>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-400">
            Yükleniyor / Loading...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Çıkış yapılıyor... / Logging out..." : "Çıkış Yap / Logout"}
        </button>
      </div>

      <section className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(135deg,#0f172a_0%,#020617_55%,#111827_100%)] p-6 shadow-2xl shadow-black/40 md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
              BAUDECOR EXECUTIVE VIEW
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl 2xl:text-6xl">
              Kontrol Paneli / Dashboard
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Şirketin satış performansını, kârlılık baskısını, tahsilat riskini ve
              stok kırılganlığını tek ekranda gör. Bu sayfa operasyon yapmaktan çok,
              yönetim seviyesinde hızlı karar aldırmak için tasarlandı.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {(["today", "week", "month", "year"] as RangeType[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setRange(item)}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                    range === item
                      ? "bg-white text-slate-950 shadow-lg shadow-white/10"
                      : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {getRangeLabel(item)}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HeroStatCard
                label="Toplam Ciro / Total Revenue"
                value={`€${totalRevenue.toFixed(2)}`}
                helper="Seçili dönem geliri / Revenue for selected period"
                tone="blue"
              />
              <HeroStatCard
                label="Toplam Kâr / Total Profit"
                value={`€${totalProfit.toFixed(2)}`}
                helper="Brüt kârlılık görünümü / Gross profit view"
                tone={totalProfit >= 0 ? "green" : "red"}
              />
              <HeroStatCard
                label="Sipariş / Orders"
                value={String(totalOrders)}
                helper="Benzersiz sipariş toplamı / Unique order count"
                tone="slate"
              />
              <HeroStatCard
                label="Stok Sağlığı / Stock Health"
                value={`%${stockHealthRate}`}
                helper="Minimum stok üstü ürün oranı / Share of products above minimum stock"
                tone={
                  stockHealthRate >= 75
                    ? "green"
                    : stockHealthRate >= 50
                    ? "amber"
                    : "red"
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ExecutiveMetric
              title="Tamamlanma Oranı / Completion Rate"
              value={`%${completionRate}`}
              subtitle="Teslim + ödeme tamamlanan siparişler / Delivered and paid orders"
              tone={completionRate >= 70 ? "green" : completionRate >= 50 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="İptal Oranı / Cancellation Rate"
              value={`%${cancellationRate}`}
              subtitle="Dönem içi iptal baskısı / Cancellation pressure in period"
              tone={cancellationRate <= 10 ? "green" : cancellationRate <= 20 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Bekleyen Ödeme / Pending Payment"
              value={`€${pendingPaymentsTotal.toFixed(2)}`}
              subtitle={`Cironun %${pendingPaymentRate}'i`}
              tone={pendingPaymentRate < 15 ? "green" : pendingPaymentRate < 30 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Teslimat Backlog / Delivery Backlog"
              value={String(deliveryBacklog)}
              subtitle="Kapanmamış teslimatlar / Undelivered orders"
              tone={deliveryBacklog < 10 ? "green" : deliveryBacklog < 20 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Kritik Stok / Critical Stock"
              value={String(criticalStockCount)}
              subtitle="Minimum stok seviyesinde / At minimum stock"
              tone={criticalStockCount === 0 ? "green" : criticalStockCount <= 4 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Stoksuz Ürün / Out of Stock"
              value={String(outOfStockCount)}
              subtitle="Doğrudan satış kaybı riski / Immediate lost-sales risk"
              tone={outOfStockCount === 0 ? "green" : "red"}
            />
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-red-500/20 bg-gradient-to-br from-red-500/10 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-200/80">
                PRIORITY ALERTS
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Kritik Uyarılar / Alerts
              </h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {alerts.length} aktif sinyal / active signals
            </div>
          </div>

          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-300">
                Her şey normal / All good
              </div>
            ) : (
              alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border px-4 py-4 text-sm font-semibold ${
                    alert.type === "danger"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : alert.type === "warning"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                      : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  }`}
                >
                  {alert.text}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                CEO INSIGHTS
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Stratejik Yorumlar / Strategic Insights
              </h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Yönetim özeti / Executive summary
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight, index) => (
              <InsightPanel
                key={`${insight.title}-${index}`}
                title={insight.title}
                text={insight.text}
                tone={insight.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                REVENUE INTELLIGENCE
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Satış ve Kâr Trendi / Sales & Profit Trend
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Seçili dönemde satış hacmi ile kârlılığın birlikte nasıl hareket ettiğini gösterir. / Shows how sales volume and profitability move together in the selected period.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Ortalama sipariş / Average order: €{averageOrderValue.toFixed(2)}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #334155",
                  borderRadius: "16px",
                  color: "#fff",
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                fill="rgba(59,130,246,0.18)"
                stroke="transparent"
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#60a5fa"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#34d399"
                strokeWidth={3}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200/80">
              STOCK PRESSURE
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Stok Riski / Stock Risk
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Minimum stok eşiğine göre satış kaybı yaratabilecek ürünler burada öne çıkar. / Products that may create lost-sales risk based on minimum stock are highlighted here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MiniRiskCard
              title="Kritik Ürün / Critical Items"
              value={String(criticalStockCount)}
              helper="Minimum stok seviyesinde / At minimum stock"
              tone="amber"
            />
            <MiniRiskCard
              title="Stoksuz / Out of Stock"
              value={String(outOfStockCount)}
              helper="Acil müdahale gerekir / Immediate action needed"
              tone="red"
            />
            <MiniRiskCard
              title="Düşük Stok / Low Stock"
              value={String(lowStockCount)}
              helper="Yakın risk alanı / Near-risk zone"
              tone="blue"
            />
            <MiniRiskCard
              title="Stok Sağlığı"
              value={`%${stockHealthRate}`}
              helper="Genel ürün sağlığı / Overall product health"
              tone={
                stockHealthRate >= 75
                  ? "green"
                  : stockHealthRate >= 50
                  ? "amber"
                  : "red"
              }
            />
          </div>

          <div className="mt-5 space-y-3">
            {stockAlerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-300">
                Stoklar normal / Stock levels are healthy
              </div>
            ) : (
              stockAlerts.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{item.name}</p>
                    <p className={`mt-1 text-sm ${getStockClass(item.level)}`}>
                      {getStockLabel(item.level)} • Min {item.minimumStock}
                    </p>
                  </div>
                  <p className={`ml-4 text-xl font-black ${getStockClass(item.level)}`}>
                    {item.stock}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ValueStrip
              label="Envanter Maliyeti / Inventory Cost"
              value={`€${inventoryCostValue.toFixed(2)}`}
            />
            <ValueStrip
              label="Satış Değeri / Sale Value"
              value={`€${inventorySaleValue.toFixed(2)}`}
            />
          </div>
        </div>
      </section>


      <section className="mb-8 grid gap-6 xl:grid-cols-3">
        <PanelCard
          title="Kârlılık Özeti / Profitability Summary"
          subtitle="Mevcut stok ve fiyat yapısına göre ürün kârlılığı görünümü."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniRiskCard
              title="Potansiyel Kâr / Potential Profit"
              value={`€${totalPotentialProfit.toFixed(2)}`}
              helper="Stoktaki ürünlerden beklenen kâr / Expected profit from current stock"
              tone={totalPotentialProfit >= 0 ? "green" : "red"}
            />
            <MiniRiskCard
              title="Ortalama Marj / Average Margin"
              value={`%${averageMarginPercent.toFixed(1)}`}
              helper="Aktif ürünlerin ortalama marjı / Average margin across active products"
              tone={averageMarginPercent >= 25 ? "green" : averageMarginPercent >= 10 ? "amber" : "red"}
            />
            <MiniRiskCard
              title="Kârlı Ürün / Profitable Products"
              value={String(profitableProductCount)}
              helper="Birim kârı pozitif ürünler / Products with positive unit profit"
              tone="green"
            />
            <MiniRiskCard
              title="Zarardaki Ürün / Loss-making Products"
              value={String(losingProductCount)}
              helper="Birim kârı negatif ürünler / Products with negative unit profit"
              tone={losingProductCount === 0 ? "green" : "red"}
            />
          </div>
        </PanelCard>

        <PanelCard
          title="En Kârlı Ürünler / Most Profitable Products"
          subtitle="Stok kâr potansiyeline göre en güçlü ürünler."
        >
          <div className="space-y-3">
            {topProfitableProducts.length === 0 ? (
              <EmptyState />
            ) : (
              topProfitableProducts.map((item, index) => (
                <RankRow
                  key={item.name}
                  rank={index + 1}
                  title={item.name}
                  subtitle={`Marj %${item.marginPercent.toFixed(1)} • Stok ${item.stock}`}
                  value={`€${item.stockProfit.toFixed(2)}`}
                  valueClassName={item.stockProfit >= 0 ? "text-emerald-300" : "text-red-300"}
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="En Zayıf Marj / Weakest Margins"
          subtitle="Marj yüzdesi en düşük ürünler."
        >
          <div className="space-y-3">
            {worstMarginProducts.length === 0 ? (
              <EmptyState />
            ) : (
              worstMarginProducts.map((item, index) => (
                <RankRow
                  key={item.name}
                  rank={index + 1}
                  title={item.name}
                  subtitle={`Birim kâr / Unit profit: €${item.unitProfit.toFixed(2)}`}
                  value={`%${item.marginPercent.toFixed(1)}`}
                  valueClassName={item.marginPercent >= 0 ? "text-amber-300" : "text-red-300"}
                />
              ))
            )}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-4">
        <PanelCard
          title="En İyi Ürünler / Top Products"
          subtitle="Seçili dönemde en fazla ciro üreten ürünler."
        >
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <EmptyState />
            ) : (
              topProducts.map((item, index) => (
                <RankRow
                  key={item.name}
                  rank={index + 1}
                  title={item.name}
                  subtitle="Ciro katkısı"
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-emerald-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Şehir Performansı / City Performance"
          subtitle="En yüksek ciroya sahip şehirler."
        >
          <div className="space-y-3">
            {cityStats.length === 0 ? (
              <EmptyState />
            ) : (
              cityStats.map((item, index) => (
                <RankRow
                  key={item.city}
                  rank={index + 1}
                  title={item.city}
                  subtitle={`${item.count} sipariş / orders`}
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-violet-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="En İyi Müşteriler / Top Customers"
          subtitle="En fazla ciro bırakan müşteriler."
        >
          <div className="space-y-3">
            {customerStats.length === 0 ? (
              <EmptyState />
            ) : (
              customerStats.map((item, index) => (
                <RankRow
                  key={item.customer}
                  rank={index + 1}
                  title={item.customer}
                  subtitle={`${item.orderCount} sipariş / orders`}
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-cyan-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Son Satışlar / Recent Sales"
          subtitle="Seçili dönemdeki en son satış kayıtları."
        >
          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <EmptyState />
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {sale.product_name || "Bilinmiyor / Unknown"}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-400">
                      {sale.customer_name || "-"} •{" "}
                      {sale.sale_date || sale.created_at?.slice(0, 10) || "-"}
                    </p>
                  </div>
                  <p className="ml-4 text-base font-bold text-blue-300">
                    €{Number(sale.total || 0).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </PanelCard>
      </section>
    </main>
  );
}

function HeroStatCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "green" | "amber" | "red" | "slate";
}) {
  const styles = {
    blue: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-200",
    slate: "border-white/10 bg-white/5 text-slate-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-80">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm opacity-80">{helper}</p>
    </div>
  );
}

function ExecutiveMetric({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: "green" | "amber" | "red" | "blue" | "slate";
}) {
  const styles = {
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-200",
    blue: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    slate: "border-white/10 bg-white/5 text-slate-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-80">
        {title}
      </p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm opacity-80">{subtitle}</p>
    </div>
  );
}

function InsightPanel({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "danger" | "warning" | "positive" | "neutral";
}) {
  const styles = {
    danger: "border-red-500/20 bg-red-500/10 text-red-200",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    positive: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    neutral: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6 opacity-90">{text}</p>
    </div>
  );
}

function MiniRiskCard({
  title,
  value,
  helper,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-200",
    blue: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-80">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm opacity-80">{helper}</p>
    </div>
  );
}

function ValueStrip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 mb-5 text-sm text-slate-400">{subtitle}</p>
      {children}
    </section>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  value,
  valueClassName,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          #{rank}
        </p>
        <p className="truncate font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <p className={`ml-4 text-base font-bold ${valueClassName || "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-6 text-sm text-slate-400">
      Kayıt yok / No records
    </div>
  );
}
