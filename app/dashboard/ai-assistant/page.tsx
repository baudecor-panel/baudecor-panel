"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Memory = {
  id: string;
  category: string;
  key: string;
  value: string;
  updated_at: string;
};

const QUICK_QUESTIONS = [
  "Bu ay satışlar nasıl gidiyor?",
  "Hangi ürünleri daha çok satmalıyım?",
  "Kritik stok uyarıları var mı?",
  "En kârlı şehir hangisi?",
  "Bu ay giderler ne kadar?",
  "Hangi müşteri segmentine odaklanmalıyım?",
  "Bekleyen teslimatlar hakkında özet ver",
  "Genel strateji önerisi ver",
];

const MEMORY_CATEGORIES = [
  "işletme",
  "strateji",
  "müşteri",
  "ürün",
  "pazar",
  "tercih",
  "not",
];

async function buildClientContext(): Promise<string> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: sales },
    { data: products },
    { data: expenses },
    { data: customers },
  ] = await Promise.all([
    supabase.from("sales").select("total, profit, product_name, customer_name, city, delivery_status, payment_status, payment_method, sale_date, created_at, shipment_date").order("created_at", { ascending: false }).limit(40),
    supabase.from("products").select("name, stock, minimum_stock, price, cost, is_active"),
    supabase.from("expenses").select("type, amount, created_at").order("created_at", { ascending: false }).limit(15),
    supabase.from("customers").select("name, city, phone").order("created_at", { ascending: false }).limit(15),
  ]);

  const allSales = sales || [];
  const thisMonth = allSales.filter((s) => new Date(s.sale_date || s.created_at) >= new Date(thisMonthStart));
  const totalRevenue = allSales.reduce((s, r) => s + Number(r.total || 0), 0);
  const totalProfit = allSales.reduce((s, r) => s + Number(r.profit || 0), 0);
  const thisRevenue = thisMonth.reduce((s, r) => s + Number(r.total || 0), 0);
  const thisProfit = thisMonth.reduce((s, r) => s + Number(r.profit || 0), 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const pending = allSales.filter((s) => s.delivery_status === "Bekliyor / Pending");

  return `
=== GÜNCEL İŞLETME VERİSİ (${now.toLocaleDateString("tr-TR")}) ===

FİNANSAL ÖZET:
Toplam ciro: €${totalRevenue.toFixed(2)} | Toplam kâr: €${totalProfit.toFixed(2)}
Bu ay: €${thisRevenue.toFixed(2)} ciro, €${thisProfit.toFixed(2)} kâr
Toplam gider: €${totalExpenses.toFixed(2)}

ÜRÜNLER:
${(products || []).map((p) => {
  const s = !p.is_active ? "PASİF" : Number(p.stock) <= 0 ? "STOK YOK" : Number(p.stock) <= Number(p.minimum_stock || 5) ? "KRİTİK" : "OK";
  return `${p.name} | Stok:${p.stock} | €${p.price || 0} | [${s}]`;
}).join("\n") || "Veri yok"}

BEKLEYEN TESLİMATLAR (${pending.length}):
${pending.length === 0 ? "Yok" : pending.map((s) => {
  const overdue = s.shipment_date && new Date(s.shipment_date) < now ? " ⚠️GECİKMİŞ" : "";
  return `${s.customer_name} | ${s.product_name} | ${s.city || "-"}${overdue}`;
}).join("\n")}

SON 40 SATIŞ:
${allSales.map((s) => {
  const d = new Date(s.sale_date || s.created_at).toLocaleDateString("tr-TR");
  return `${d} | ${s.customer_name} | ${s.product_name} | €${Number(s.total||0).toFixed(0)} | ${s.payment_status||"-"}`;
}).join("\n") || "Veri yok"}

SON MÜŞTERİLER:
${(customers || []).map((c) => `${c.name} | ${c.city || "-"} | ${c.phone || "-"}`).join("\n") || "Veri yok"}

SON GİDERLER:
${(expenses || []).map((e) => `${new Date(e.created_at).toLocaleDateString("tr-TR")} | ${e.type} | €${Number(e.amount||0).toFixed(2)}`).join("\n") || "Veri yok"}
`.trim();
}

export default function AiAssistantPage() {
  const [tab, setTab] = useState<"chat" | "memory">("chat");
  const [clientContext, setClientContext] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Merhaba! Ben Baudecor AI asistanınım. Satışlarınız, stoklarınız, müşterileriniz ve giderleriniz hakkında sorularınızı yanıtlayabilirim. Nasıl yardımcı olabilirim?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Memory tab state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memLoading, setMemLoading] = useState(false);
  const [newCategory, setNewCategory] = useState(MEMORY_CATEGORIES[0]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("tümü");

  useEffect(() => {
    buildClientContext().then(setClientContext).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (tab === "memory") loadMemories();
  }, [tab]);

  async function loadMemories() {
    setMemLoading(true);
    try {
      const res = await fetch("/api/ai-memory");
      const data = await res.json();
      setMemories(data.memories || []);
    } finally {
      setMemLoading(false);
    }
  }

  async function saveMemory() {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/ai-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory, key: newKey.trim(), value: newValue.trim() }),
      });
      setNewKey("");
      setNewValue("");
      await loadMemories();
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(id: string) {
    await fetch("/api/ai-memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function sendMessage(text?: string) {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    const userMessage: Message = { role: "user", content: userText };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          clientContext: clientContext || undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Hata oluştu, tekrar deneyin." },
        ]);
      } else {
        const updatedMessages = [...newMessages, { role: "assistant" as const, content: data.reply }];
        setMessages(updatedMessages);
        // Arka planda sessizce öğren
        autoLearn(updatedMessages.filter((m) => m.role === "user" || m.role === "assistant").slice(1));
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bağlantı hatası, tekrar deneyin." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function autoLearn(chatMessages: Message[]) {
    if (chatMessages.length < 2) return;
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, extractMode: true }),
      });
      const data = await res.json();
      const items: { category: string; key: string; value: string }[] = data.items || [];
      if (items.length === 0) return;
      await Promise.all(
        items.map((item) =>
          fetch("/api/ai-memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          })
        )
      );
      if (tab === "memory") loadMemories();
    } catch {
      // sessizce geç
    }
  }

  async function extractAndSave() {
    const chatMessages = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(1);
    if (chatMessages.length < 2) return;
    setExtracting(true);
    setExtractResult(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages, extractMode: true }),
      });
      const data = await res.json();
      const items: { category: string; key: string; value: string }[] = data.items || [];
      if (items.length === 0) {
        setExtractResult("Kaydedilecek kalıcı bilgi bulunamadı.");
        return;
      }
      await Promise.all(
        items.map((item) =>
          fetch("/api/ai-memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          })
        )
      );
      setExtractResult(`${items.length} bilgi hafızaya kaydedildi: ${items.map((i) => i.key).join(", ")}`);
      if (tab === "memory") loadMemories();
    } catch {
      setExtractResult("Kaydetme sırasında hata oluştu.");
    } finally {
      setExtracting(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content: "Sohbet temizlendi. Nasıl yardımcı olabilirim?",
      },
    ]);
  }

  const allCategories = ["tümü", ...Array.from(new Set(memories.map((m) => m.category)))];
  const filteredMemories =
    filterCategory === "tümü" ? memories : memories.filter((m) => m.category === filterCategory);

  return (
    <main className="flex h-[calc(100vh-64px)] flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              BAUDECOR AI
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              AI Asistan / AI Asistent
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Gerçek verilerinize bakarak satış, stok ve strateji önerileri üretir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "chat" && (
              <>
                <button
                  onClick={extractAndSave}
                  disabled={extracting || messages.length < 3}
                  className="rounded-xl border border-emerald-700/50 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {extracting ? "Kaydediliyor..." : "Hafızana Kaydet"}
                </button>
                <button
                  onClick={clearChat}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  Temizle
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("chat")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === "chat"
                ? "bg-blue-600 text-white"
                : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Sohbet
          </button>
          <button
            onClick={() => setTab("memory")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === "memory"
                ? "bg-blue-600 text-white"
                : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Hafıza ({memories.length})
          </button>
        </div>

        {/* Quick questions (chat tab only) */}
        {tab === "chat" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat Tab */}
      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-slate-800 bg-slate-900/80 text-slate-200"
                    }`}
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold">
                      Sen
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                    AI
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {extractResult && (
            <div className="rounded-2xl border border-emerald-700/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {extractResult}
            </div>
          )}

          <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-slate-800 px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Soru sor... (Enter ile gönder, Shift+Enter yeni satır)"
                  rows={2}
                  className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 placeholder:text-slate-600"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gönder
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Gerçek verilerinize bakarak yanıt üretir · Claude Haiku · Her mesaj API kredisi kullanır
              </p>
            </div>
          </div>
        </>
      )}

      {/* Memory Tab */}
      {tab === "memory" && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Add new memory */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-white">Yeni Hafıza Ekle</h3>
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    {MEMORY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Başlık / Konu</label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="ör: favori_tedarikçi"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs text-slate-500">İçerik</label>
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="ör: İtalyan deri koltuk tedarikçisi Arredo SpA ile çalışıyoruz, minimum sipariş 5 adet"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={saveMemory}
                disabled={saving || !newKey.trim() || !newValue.trim()}
                className="mt-3 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>

            {/* Filter */}
            {memories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterCategory(c)}
                    className={`rounded-xl px-3 py-1 text-xs font-medium transition ${
                      filterCategory === c
                        ? "bg-blue-600 text-white"
                        : "border border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Memory list */}
            {memLoading ? (
              <div className="text-center text-sm text-slate-500">Yükleniyor...</div>
            ) : filteredMemories.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center">
                <p className="text-sm text-slate-500">Henüz hafıza kaydı yok.</p>
                <p className="mt-1 text-xs text-slate-600">
                  AI&apos;ya öğretmek istediğiniz bilgileri yukarıdan ekleyin.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMemories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {m.category}
                        </span>
                        <span className="text-sm font-medium text-white">{m.key}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300" style={{ whiteSpace: "pre-wrap" }}>
                        {m.value}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(m.updated_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-600 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
