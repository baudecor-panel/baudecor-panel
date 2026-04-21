"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Sale = {
  id: string;
  customer_name?: string | null;
  product_name?: string | null;
  total?: number | null;
  sale_date?: string | null;
  created_at?: string | null;
  delivery_status?: string | null;
  payment_status?: string | null;
  city?: string | null;
};

type Dispatch = {
  id: string;
  customer_name?: string | null;
  product_name?: string | null;
  city?: string | null;
  delivery_method?: string | null;
  assigned_vehicle?: string | null;
  assigned_courier?: string | null;
  shipment_date?: string | null;
  delivery_status?: string | null;
};

type AlertItem = { text: string; type: "danger" | "warning" | "info" };

export default function MobilePage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [aiAlerts, setAiAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"home" | "sales" | "dispatch">("home");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
    fetchData();
    loadAiAlerts();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: salesData }, { data: dispatchData }] = await Promise.all([
      supabase
        .from("sales")
        .select("id,customer_name,product_name,total,sale_date,created_at,delivery_status,payment_status,city")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("sales")
        .select("id,customer_name,product_name,city,delivery_method,assigned_vehicle,assigned_courier,shipment_date,delivery_status")
        .or("delivery_status.is.null,delivery_status.neq.Teslim Edildi / Delivered")
        .or("delivery_status.is.null,delivery_status.neq.İade Edildi / Returned")
        .order("created_at", { ascending: false }),
    ]);
    setSales((salesData || []) as Sale[]);
    setDispatches((dispatchData || []) as Dispatch[]);
    setLoading(false);
  }

  function loadAiAlerts() {
    try {
      const cached = localStorage.getItem("ai_alerts_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        const today = new Date().toDateString();
        if (parsed.date === today && Array.isArray(parsed.alerts)) {
          setAiAlerts(
            parsed.alerts.map((t: string) => ({
              text: t,
              type: t.startsWith("🔴") ? "danger" : t.startsWith("🟡") ? "warning" : "info",
            }))
          );
        }
      }
    } catch {}
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => (s.sale_date || s.created_at || "").slice(0, 10) === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const pendingCount = dispatches.length;
  const unpaidCount = sales.filter((s) => s.payment_status === "Ödenmedi / Unpaid").length;

  function statusColor(status?: string | null) {
    if (!status) return "bg-slate-700 text-slate-300";
    if (status.includes("Teslim")) return "bg-emerald-900 text-emerald-300";
    if (status.includes("Yolda") || status.includes("Yükle")) return "bg-blue-900 text-blue-300";
    if (status.includes("İade")) return "bg-red-900 text-red-300";
    return "bg-slate-700 text-slate-300";
  }

  function alertColor(type: string) {
    if (type === "danger") return "border-red-500 bg-red-950/40 text-red-300";
    if (type === "warning") return "border-yellow-500 bg-yellow-950/40 text-yellow-300";
    return "border-blue-500 bg-blue-950/40 text-blue-300";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold tracking-wide">BAUDECOR</span>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.replace("/login"); }}
          className="text-xs text-slate-400 px-3 py-1 rounded-lg border border-slate-700"
        >
          Çıkış
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Yükleniyor...</div>
        ) : (
          <>
            {/* HOME TAB */}
            {tab === "home" && (
              <div className="space-y-4">
                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Bugün</p>
                    <p className="text-xl font-bold text-emerald-400">{todaySales.length}</p>
                    <p className="text-[10px] text-slate-500">satış</p>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Gelir</p>
                    <p className="text-xl font-bold text-blue-400">€{todayRevenue.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">bugün</p>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sevk.</p>
                    <p className="text-xl font-bold text-orange-400">{pendingCount}</p>
                    <p className="text-[10px] text-slate-500">bekliyor</p>
                  </div>
                </div>

                {unpaidCount > 0 && (
                  <div className="rounded-2xl border border-red-500 bg-red-950/40 px-4 py-3">
                    <p className="text-sm font-semibold text-red-300">⚠ {unpaidCount} ödenmemiş sipariş</p>
                  </div>
                )}

                {/* AI Alerts */}
                {aiAlerts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">AI Uyarılar</p>
                    <div className="space-y-2">
                      {aiAlerts.slice(0, 4).map((a, i) => (
                        <div key={i} className={`rounded-xl border px-3 py-2 text-sm ${alertColor(a.type)}`}>
                          {a.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent sales */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Son Satışlar</p>
                  <div className="space-y-2">
                    {sales.slice(0, 8).map((s) => (
                      <div key={s.id} className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{s.customer_name || "—"}</p>
                            <p className="text-xs text-slate-400 truncate">{s.product_name || "—"}</p>
                            <p className="text-xs text-slate-500">{s.city || ""}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-emerald-400 text-sm">€{(s.total || 0).toFixed(0)}</p>
                            <p className="text-[10px] text-slate-500">{(s.sale_date || s.created_at || "").slice(0, 10)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SALES TAB */}
            {tab === "sales" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Tüm Satışlar ({sales.length})</p>
                {sales.map((s) => (
                  <div key={s.id} className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.customer_name || "—"}</p>
                        <p className="text-xs text-slate-400 truncate">{s.product_name || "—"}</p>
                        <p className="text-xs text-slate-500">{s.city || ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-400 text-sm">€{(s.total || 0).toFixed(0)}</p>
                        <p className="text-[10px] text-slate-500">{(s.sale_date || s.created_at || "").slice(0, 10)}</p>
                        <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full mt-1 ${statusColor(s.delivery_status)}`}>
                          {s.delivery_status?.split("/")[0].trim() || "Bekliyor"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* DISPATCH TAB */}
            {tab === "dispatch" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Bekleyen Sevkiyatlar ({dispatches.length})</p>
                {dispatches.map((d) => (
                  <div key={d.id} className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{d.customer_name || "—"}</p>
                        <p className="text-xs text-slate-400 truncate">{d.product_name || "—"}</p>
                        <p className="text-xs text-slate-500">{d.city || ""}</p>
                        {(d.assigned_vehicle || d.assigned_courier) && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {d.assigned_vehicle || d.assigned_courier}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {d.shipment_date && (
                          <p className="text-[10px] text-slate-400">{d.shipment_date}</p>
                        )}
                        <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full mt-1 ${statusColor(d.delivery_status)}`}>
                          {d.delivery_status?.split("/")[0].trim() || "Bekliyor"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {dispatches.length === 0 && (
                  <p className="text-center text-slate-500 py-10">Bekleyen sevkiyat yok</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
        {(["home", "sales", "dispatch"] as const).map((t) => {
          const labels = { home: "Ana Sayfa", sales: "Satışlar", dispatch: "Sevkiyat" };
          const icons = { home: "⊞", sales: "◎", dispatch: "⊡" };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors ${
                tab === t ? "text-blue-400" : "text-slate-500"
              }`}
            >
              <span className="text-lg leading-none">{icons[t]}</span>
              <span>{labels[t]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
