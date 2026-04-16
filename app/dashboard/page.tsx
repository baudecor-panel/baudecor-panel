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
        text:
          "Broj narudžbi koje čekaju isporuku je visok / Teslimat bekleyen sipariş sayısı yüksek",
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
        text: `Prosječna vrijednost narudžbe / Ortalama sipariş değeri: €${averageOrderValue.toFixed(
          2
        )}`,
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
    if (value === "today") return "Danas / Bugün";
    if (value === "week") return "Ove sedmice / Bu Hafta";
    if (value === "month") return "Ovog mjeseca / Bu Ay";
    return "Ove godine / Bu Yıl";
  }

  function getStockLabel(level: StockAlertItem["level"]) {
    if (level === "out") return "Nema na stanju / Stok Yok";
    if (level === "critical") return "Kritično / Kritik";
    return "Nisko / Düşük";
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
            PREGLED UPRAVE / YÖNETİM GÖRÜNÜMÜ
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Kontrolna tabla / Kontrol Paneli
          </h1>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-400">
            Učitava se / Yükleniyor
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
      <div className="mb-4 flex justify-end gap-3">
        <button
          onClick={exportToExcel}
          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Excel İndir / Export ({filteredSales.length} kayıt)
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Odjava u toku / Çıkış yapılıyor" : "Odjava / Çıkış Yap"}
        </button>
      </div>

      <section className="relative mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(135deg,#0f172a_0%,#020617_55%,#111827_100%)] p-6 shadow-2xl shadow-black/40 md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.32em] text-cyan-200">
              PREGLED UPRAVE / YÖNETİM GÖRÜNÜMÜ
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl 2xl:text-6xl">
              Kontrolna tabla / Kontrol Paneli
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Pogledajte prodajne rezultate, pritisak profitabilnosti, rizik naplate i
              osjetljivost zaliha na jednom ekranu. Ova stranica je dizajnirana ne za
              operativni rad, već za brzo donošenje odluka na nivou uprave /
              Şirketin satış performansını, kârlılık baskısını, tahsilat riskini ve
              stok kırılganlığını tek ekranda gör. Bu sayfa operasyon yapmak için değil,
              yönetim seviyesinde hızlı karar almak için tasarlandı.
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
                label="Ukupan prihod / Toplam Ciro"
                value={`€${totalRevenue.toFixed(2)}`}
                helper="Prihod izabranog perioda / Seçili dönem geliri"
                tone="blue"
              />
              <HeroStatCard
                label="Ukupan profit / Toplam Kâr"
                value={`€${totalProfit.toFixed(2)}`}
                helper="Pregled bruto profitabilnosti / Brüt kârlılık görünümü"
                tone={totalProfit >= 0 ? "green" : "red"}
              />
              <HeroStatCard
                label="Narudžbe / Sipariş"
                value={String(totalOrders)}
                helper="Ukupan broj jedinstvenih narudžbi / Benzersiz sipariş toplamı"
                tone="slate"
              />
              <HeroStatCard
                label="Zdravlje zalihe / Stok Sağlığı"
                value={`%${stockHealthRate}`}
                helper="Udio proizvoda iznad minimalne zalihe / Minimum stok üstü ürün oranı"
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
              title="Stopa završetka / Tamamlanma Oranı"
              value={`%${completionRate}`}
              subtitle="Isporučene i plaćene narudžbe / Teslim + ödeme tamamlanan siparişler"
              tone={completionRate >= 70 ? "green" : completionRate >= 50 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Stopa otkazivanja / İptal Oranı"
              value={`%${cancellationRate}`}
              subtitle="Pritisak otkazivanja u periodu / Dönem içi iptal baskısı"
              tone={cancellationRate <= 10 ? "green" : cancellationRate <= 20 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Plaćanje na čekanju / Bekleyen Ödeme"
              value={`€${pendingPaymentsTotal.toFixed(2)}`}
              subtitle={`Udio u prihodu / Ciro payı: %${pendingPaymentRate}`}
              tone={pendingPaymentRate < 15 ? "green" : pendingPaymentRate < 30 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Zaostale isporuke / Teslimat Backlog"
              value={String(deliveryBacklog)}
              subtitle="Nezatvorene isporuke / Kapanmamış teslimatlar"
              tone={deliveryBacklog < 10 ? "green" : deliveryBacklog < 20 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Kritična zaliha / Kritik Stok"
              value={String(criticalStockCount)}
              subtitle="Na minimalnom nivou zalihe / Minimum stok seviyesinde"
              tone={criticalStockCount === 0 ? "green" : criticalStockCount <= 4 ? "amber" : "red"}
            />
            <ExecutiveMetric
              title="Proizvod bez zalihe / Stoksuz Ürün"
              value={String(outOfStockCount)}
              subtitle="Neposredan rizik gubitka prodaje / Doğrudan satış kaybı riski"
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
                PRIORITETNA UPOZORENJA / ÖNCELİKLİ UYARILAR
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Kritična upozorenja / Kritik Uyarılar
              </h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              {alerts.length} aktivnih signala / aktif sinyal
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-3 pr-1">
            {alerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-300">
                Sve je u redu / Her şey normal
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
                UVIDI ZA UPRAVU / YÖNETİM İÇGÖRÜLERİ
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Strateški uvidi / Stratejik Yorumlar
              </h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Sažetak za upravu / Yönetim özeti
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto grid gap-4 md:grid-cols-2 pr-1">
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

      <section className="mb-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr] xl:items-start">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
                ANALIZA PRIHODA / CİRO ANALİZİ
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Trend prodaje i profita / Satış ve Kâr Trendi
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Prikazuje kako se obim prodaje i profitabilnost zajedno kreću u izabranom periodu / Seçili dönemde satış hacmi ile kârlılığın birlikte nasıl hareket ettiğini gösterir.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Prosječna narudžba / Ortalama sipariş: €{averageOrderValue.toFixed(2)}
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
              PRITISAK ZALIHE / STOK BASKISI
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Rizik zalihe / Stok Riski
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Ovdje su istaknuti proizvodi koji mogu izazvati gubitak prodaje prema minimalnoj zalihi / Minimum stok eşiğine göre satış kaybı yaratabilecek ürünler burada öne çıkar.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MiniRiskCard
              title="Kritični proizvodi / Kritik Ürün"
              value={String(criticalStockCount)}
              helper="Na minimalnom nivou zalihe / Minimum stok seviyesinde"
              tone="amber"
            />
            <MiniRiskCard
              title="Bez zalihe / Stoksuz"
              value={String(outOfStockCount)}
              helper="Potrebna hitna intervencija / Acil müdahale gerekir"
              tone="red"
            />
            <MiniRiskCard
              title="Niska zaliha / Düşük Stok"
              value={String(lowStockCount)}
              helper="Zona bliskog rizika / Yakın risk alanı"
              tone="blue"
            />
            <MiniRiskCard
              title="Zdravlje zalihe / Stok Sağlığı"
              value={`%${stockHealthRate}`}
              helper="Opšte stanje proizvoda / Genel ürün sağlığı"
              tone={
                stockHealthRate >= 75
                  ? "green"
                  : stockHealthRate >= 50
                  ? "amber"
                  : "red"
              }
            />
          </div>

          <div className="mt-5 max-h-[260px] overflow-y-auto space-y-3 pr-1">
            {stockAlerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm font-semibold text-emerald-300">
                Nivo zalihe je zdrav / Stoklar normal
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
              label="Trošak inventara / Envanter Maliyeti"
              value={`€${inventoryCostValue.toFixed(2)}`}
            />
            <ValueStrip
              label="Vrijednost prodaje / Satış Değeri"
              value={`€${inventorySaleValue.toFixed(2)}`}
            />
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-6 xl:grid-cols-3">
        <PanelCard
          title="Sažetak profitabilnosti / Kârlılık Özeti"
          subtitle="Mevcut stok i struktura cijena prema prikazu profitabilnosti proizvoda / Mevcut stok ve fiyat yapısına göre ürün kârlılığı görünümü."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MiniRiskCard
              title="Potencijalni profit / Potansiyel Kâr"
              value={`€${totalPotentialProfit.toFixed(2)}`}
              helper="Očekivani profit iz postojeće zalihe / Stoktaki ürünlerden beklenen kâr"
              tone={totalPotentialProfit >= 0 ? "green" : "red"}
            />
            <MiniRiskCard
              title="Prosječna marža / Ortalama Marj"
              value={`%${averageMarginPercent.toFixed(1)}`}
              helper="Prosječna marža aktivnih proizvoda / Aktif ürünlerin ortalama marjı"
              tone={averageMarginPercent >= 25 ? "green" : averageMarginPercent >= 10 ? "amber" : "red"}
            />
            <MiniRiskCard
              title="Profitabilni proizvodi / Kârlı Ürün"
              value={String(profitableProductCount)}
              helper="Proizvodi sa pozitivnim jediničnim profitom / Birim kârı pozitif ürünler"
              tone="green"
            />
            <MiniRiskCard
              title="Proizvodi u gubitku / Zarardaki Ürün"
              value={String(losingProductCount)}
              helper="Proizvodi sa negativnim jediničnim profitom / Birim kârı negatif ürünler"
              tone={losingProductCount === 0 ? "green" : "red"}
            />
          </div>
        </PanelCard>

        <PanelCard
          title="Najprofitabilniji proizvodi / En Kârlı Ürünler"
          subtitle="Najjači proizvodi prema profitnom potencijalu zalihe / Stok kâr potansiyeline göre en güçlü ürünler."
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
                  subtitle={`Marža %${item.marginPercent.toFixed(1)} • Zaliha ${item.stock} / Marj %${item.marginPercent.toFixed(1)} • Stok ${item.stock}`}
                  value={`€${item.stockProfit.toFixed(2)}`}
                  valueClassName={item.stockProfit >= 0 ? "text-emerald-300" : "text-red-300"}
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Najslabija marža / En Zayıf Marj"
          subtitle="Proizvodi sa najnižim procentom marže / Marj yüzdesi en düşük ürünler."
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
                  subtitle={`Jedinični profit / Birim kâr: €${item.unitProfit.toFixed(2)}`}
                  value={`%${item.marginPercent.toFixed(1)}`}
                  valueClassName={item.marginPercent >= 0 ? "text-amber-300" : "text-red-300"}
                />
              ))
            )}
          </div>
        </PanelCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-5">
        <PanelCard
          title="Najbolji proizvodi / En İyi Ürünler"
          subtitle="Proizvodi koji u izabranom periodu donose najviše prihoda / Seçili dönemde en fazla ciro üreten ürünler."
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
                  subtitle="Doprinos prihodu / Ciro katkısı"
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-emerald-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Učinak po gradu / Şehir Performansı"
          subtitle="Gradovi sa najvećim prihodom / En yüksek ciroya sahip şehirler."
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
                  subtitle={`${item.count} narudžba / sipariş`}
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-violet-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Najbolji kupci / En İyi Müşteriler"
          subtitle="Kupci koji ostavljaju najviše prihoda / En fazla ciro bırakan müşteriler."
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
                  subtitle={`${item.orderCount} narudžba / sipariş`}
                  value={`€${item.total.toFixed(2)}`}
                  valueClassName="text-cyan-300"
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Najprofitabilniji kupci / En Karlı Müşteriler"
          subtitle="Poredano prema ukupnom profitu / Toplam kâra göre sıralama."
        >
          <div className="space-y-3">
            {topCustomersByProfit.length === 0 ? (
              <EmptyState />
            ) : (
              topCustomersByProfit.map((item, index) => (
                <RankRow
                  key={item.customer}
                  rank={index + 1}
                  title={item.customer}
                  subtitle={`${item.orderCount} narudžba / sipariş`}
                  value={`€${item.profit.toFixed(2)}`}
                  valueClassName={item.profit >= 0 ? "text-emerald-300" : "text-red-300"}
                />
              ))
            )}
          </div>
        </PanelCard>

        <PanelCard
          title="Nedavne prodaje / Son Satışlar"
          subtitle="Najnoviji zapisi prodaje u izabranom periodu / Seçili dönemdeki en son satış kayıtları."
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
                      {sale.product_name || "Nepoznato / Bilinmiyor"}
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
    <section className="flex flex-col rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20" style={{ height: "420px" }}>
      <h2 className="shrink-0 text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 mb-5 shrink-0 text-sm text-slate-400">{subtitle}</p>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {children}
      </div>
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
      Nema zapisa / Kayıt yok
    </div>
  );
}
