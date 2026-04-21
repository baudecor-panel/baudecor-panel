"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Sale = {
  id: string;
  customer_name?: string | null;
  product_name?: string | null;
  total?: number | null;
  profit?: number | null;
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

type Product = {
  id: string;
  name: string;
  price?: number | null;
  cost?: number | null;
  stock?: number | null;
  minimum_stock?: number | null;
  is_active?: boolean | null;
  group_id?: string | null;
  group_name?: string;
};

type ProductGroup = { id: string; name: string };

type Expense = {
  id: string;
  type: string;
  amount: number;
  note?: string;
  created_at: string;
};

type AlertItem = { text: string; type: "danger" | "warning" | "info" };
type RangeType = "today" | "week" | "month" | "year";
type TabType = "home" | "sales" | "dispatch" | "products" | "expenses" | "ai";
type ChatMessage = { role: "user" | "assistant"; content: string };

function getRangeStart(range: RangeType): string {
  const now = new Date();
  if (range === "today") return now.toISOString().slice(0, 10);
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return d.toISOString().slice(0, 10);
  }
  if (range === "month") return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return `${now.getFullYear()}-01-01`;
}

export default function MobilePage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aiAlerts, setAiAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("home");
  const [range, setRange] = useState<RangeType>("month");
  const [groupFilter, setGroupFilter] = useState("all");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
    fetchData();
    loadAiAlerts();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [
      { data: salesData },
      { data: dispatchData },
      { data: productData },
      { data: groupData },
      { data: expenseData },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id,customer_name,product_name,total,profit,sale_date,created_at,delivery_status,payment_status,city")
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id,customer_name,product_name,city,delivery_method,assigned_vehicle,assigned_courier,shipment_date,delivery_status")
        .or("delivery_status.is.null,delivery_status.neq.Teslim Edildi / Delivered")
        .or("delivery_status.is.null,delivery_status.neq.İade Edildi / Returned")
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id,name,price,cost,stock,minimum_stock,is_active,group_id,product_groups(name)")
        .order("name"),
      supabase.from("product_groups").select("id,name").order("name"),
      supabase.from("expenses").select("id,type,amount,note,created_at").order("created_at", { ascending: false }),
    ]);

    setSales((salesData || []) as Sale[]);
    setDispatches((dispatchData || []) as Dispatch[]);
    setExpenses((expenseData || []) as Expense[]);
    setGroups((groupData || []) as ProductGroup[]);
    setProducts(
      ((productData || []) as any[]).map((p) => ({
        ...p,
        group_name: p.product_groups?.name ?? "",
      }))
    );
    setLoading(false);
  }

  function loadAiAlerts() {
    try {
      const cached = localStorage.getItem("ai_alerts_cache");
      if (!cached) return;
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
    } catch {}
  }

  function inRange(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    const start = getRangeStart(range);
    const today = new Date().toISOString().slice(0, 10);
    return d >= start && d <= today;
  }

  const filteredSales = useMemo(
    () => sales.filter((s) => inRange(s.sale_date || s.created_at)),
    [sales, range]
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(e.created_at)),
    [expenses, range]
  );

  const revenue = filteredSales.reduce((s, x) => s + (x.total || 0), 0);
  const profit = filteredSales.reduce((s, x) => s + (x.profit || 0), 0);
  const expenseTotal = filteredExpenses.reduce((s, x) => s + (x.amount || 0), 0);
  const unpaidCount = filteredSales.filter((s) => s.payment_status === "Ödenmedi / Unpaid").length;
  const lowStockCount = products.filter(
    (p) => p.is_active !== false && (p.stock ?? 0) <= (p.minimum_stock ?? 0)
  ).length;

  const filteredProducts = useMemo(
    () => groupFilter === "all" ? products : products.filter((p) => p.group_id === groupFilter),
    [products, groupFilter]
  );

  function statusBadge(status?: string | null) {
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

  const rangeTabs: { key: RangeType; label: string }[] = [
    { key: "today", label: "Bugün" },
    { key: "week", label: "Hafta" },
    { key: "month", label: "Ay" },
    { key: "year", label: "Yıl" },
  ];

  async function sendChat(text?: string) {
    const content = (text ?? chatInput).trim();
    if (!content || chatLoading) return;
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setChatMessages([...newMessages, {
        role: "assistant",
        content: data.error ? `Hata: ${data.error}` : data.reply,
      }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "Bağlantı hatası, tekrar deneyin." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  const navTabs: { key: TabType; icon: string; label: string }[] = [
    { key: "home", icon: "⊞", label: "Özet" },
    { key: "sales", icon: "◎", label: "Satışlar" },
    { key: "dispatch", icon: "⊡", label: "Sevkiyat" },
    { key: "products", icon: "▦", label: "Ürünler" },
    { key: "expenses", icon: "◈", label: "Giderler" },
    { key: "ai", icon: "✦", label: "AI" },
  ];

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

      {/* Range filter — hidden on dispatch & products */}
      {tab !== "dispatch" && tab !== "products" && (
        <div className="flex gap-2 px-4 pt-3">
          {rangeTabs.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                range === r.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">Yükleniyor...</div>
        ) : (
          <>
            {/* HOME */}
            {tab === "home" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Satış" value={String(filteredSales.length)} sub="adet" color="text-white" />
                  <StatCard label="Ciro" value={`€${revenue.toFixed(0)}`} sub="gelir" color="text-emerald-400" />
                  <StatCard label="Kâr" value={`€${profit.toFixed(0)}`} sub="net" color="text-blue-400" />
                  <StatCard label="Gider" value={`€${expenseTotal.toFixed(0)}`} sub="harcama" color="text-red-400" />
                  <StatCard label="Sevkiyat" value={String(dispatches.length)} sub="bekliyor" color="text-orange-400" />
                  <StatCard label="Düşük Stok" value={String(lowStockCount)} sub="ürün" color={lowStockCount > 0 ? "text-yellow-400" : "text-slate-400"} />
                </div>

                {unpaidCount > 0 && (
                  <div className="rounded-2xl border border-red-500 bg-red-950/40 px-4 py-3">
                    <p className="text-sm font-semibold text-red-300">⚠ {unpaidCount} ödenmemiş sipariş</p>
                  </div>
                )}

                {aiAlerts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">AI Uyarılar</p>
                    <div className="space-y-2">
                      {aiAlerts.slice(0, 5).map((a, i) => (
                        <div key={i} className={`rounded-xl border px-3 py-2 text-sm ${alertColor(a.type)}`}>
                          {a.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Son Satışlar</p>
                  <div className="space-y-2">
                    {filteredSales.slice(0, 8).map((s) => (
                      <SaleCard key={s.id} s={s} statusBadge={statusBadge} />
                    ))}
                    {filteredSales.length === 0 && (
                      <p className="text-center text-slate-500 py-6">Bu dönemde satış yok</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SALES */}
            {tab === "sales" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
                  Satışlar ({filteredSales.length}) — €{revenue.toFixed(0)}
                </p>
                {filteredSales.map((s) => (
                  <SaleCard key={s.id} s={s} statusBadge={statusBadge} showProfit />
                ))}
                {filteredSales.length === 0 && (
                  <p className="text-center text-slate-500 py-10">Bu dönemde satış yok</p>
                )}
              </div>
            )}

            {/* DISPATCH */}
            {tab === "dispatch" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">
                  Bekleyen Sevkiyatlar ({dispatches.length})
                </p>
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
                        <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full mt-1 ${statusBadge(d.delivery_status)}`}>
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

            {/* PRODUCTS */}
            {tab === "products" && (
              <div className="space-y-3">
                {/* Group filter */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setGroupFilter("all")}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium ${groupFilter === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
                  >
                    Tümü
                  </button>
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGroupFilter(g.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium ${groupFilter === g.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Ürünler ({filteredProducts.length})
                </p>

                <div className="space-y-2">
                  {filteredProducts.map((p) => {
                    const isLow = (p.stock ?? 0) <= (p.minimum_stock ?? 0);
                    return (
                      <div key={p.id} className={`bg-slate-900 rounded-2xl border px-4 py-3 ${isLow ? "border-yellow-600" : "border-slate-800"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{p.name}</p>
                            {p.group_name && (
                              <p className="text-xs text-slate-500">{p.group_name}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-emerald-400">€{(p.price || 0).toFixed(0)}</p>
                            <p className={`text-xs font-medium ${isLow ? "text-yellow-400" : "text-slate-400"}`}>
                              Stok: {p.stock ?? 0}
                            </p>
                            {!p.is_active && (
                              <span className="text-[9px] text-red-400">Pasif</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-center text-slate-500 py-10">Ürün yok</p>
                  )}
                </div>
              </div>
            )}

            {/* AI CHAT */}
            {tab === "ai" && (
              <div className="flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
                <div className="flex-1 overflow-y-auto space-y-3 pb-2">
                  {chatMessages.length === 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Hızlı Sorular</p>
                      {[
                        "Bu ay satışlar nasıl gidiyor?",
                        "Kritik stok uyarıları var mı?",
                        "En kârlı ürün hangisi?",
                        "Bekleyen teslimatlar özeti",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => sendChat(q)}
                          className="w-full text-left bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-slate-800 text-slate-100 rounded-bl-sm"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-2 text-slate-400 text-sm">
                        <span className="animate-pulse">●●●</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>
                <div className="flex gap-2 pt-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder="Soru sor..."
                    className="flex-1 bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-blue-600 disabled:bg-slate-700 rounded-xl px-4 text-sm font-medium"
                  >
                    Gönder
                  </button>
                </div>
              </div>
            )}

            {/* EXPENSES */}
            {tab === "expenses" && (
              <div className="space-y-2">
                <div className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3 mb-3">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Toplam Gider</p>
                  <p className="text-2xl font-bold text-red-400">€{expenseTotal.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">{filteredExpenses.length} kayıt</p>
                </div>

                {filteredExpenses.map((e) => (
                  <div key={e.id} className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{e.type}</p>
                        {e.note && <p className="text-xs text-slate-400 truncate">{e.note}</p>}
                        <p className="text-xs text-slate-500">{e.created_at.slice(0, 10)}</p>
                      </div>
                      <p className="text-sm font-bold text-red-400 shrink-0">€{e.amount.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
                {filteredExpenses.length === 0 && (
                  <p className="text-center text-slate-500 py-10">Bu dönemde gider yok</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
        {navTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
              tab === t.key ? "text-blue-400" : "text-slate-500"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-3 border border-slate-800">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}

function SaleCard({
  s,
  statusBadge,
  showProfit,
}: {
  s: Sale;
  statusBadge: (status?: string | null) => string;
  showProfit?: boolean;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{s.customer_name || "—"}</p>
          <p className="text-xs text-slate-400 truncate">{s.product_name || "—"}</p>
          <p className="text-xs text-slate-500">{s.city || ""}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-emerald-400 text-sm">€{(s.total || 0).toFixed(0)}</p>
          {showProfit && s.profit != null && (
            <p className="text-xs text-blue-400">+€{s.profit.toFixed(0)}</p>
          )}
          <p className="text-[10px] text-slate-500">{(s.sale_date || s.created_at || "").slice(0, 10)}</p>
          <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full mt-1 ${statusBadge(s.delivery_status)}`}>
            {s.delivery_status?.split("/")[0].trim() || "Bekliyor"}
          </span>
        </div>
      </div>
    </div>
  );
}
