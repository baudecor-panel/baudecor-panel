"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type KasaEntry = {
  id: string;
  amount: number;
  type: "opening_balance" | "manual_in" | "manual_out";
  note: string | null;
  entry_date: string;
  created_at: string;
};

type Sale = {
  id: string;
  total: number;
  created_at: string;
};

type Expense = {
  id: string;
  amount: number;
  created_at: string;
};

type Toast = { message: string; type: "success" | "error" | "warning" } | null;

function getTodayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

const TYPE_LABEL: Record<KasaEntry["type"], string> = {
  opening_balance: "Açılış Bakiyesi / Početni saldo",
  manual_in: "Nakit Girişi / Gotovinski ulaz",
  manual_out: "Nakit Çıkışı / Gotovinski izlaz",
};

export default function KasaPage() {
  const [entries, setEntries] = useState<KasaEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [entryType, setEntryType] = useState<KasaEntry["type"]>("opening_balance");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [entryDate, setEntryDate] = useState(getTodayDate());

  function showToast(message: string, type: Toast["type"] = "success") {
    setToast({ message, type: type ?? "success" });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);

    const [{ data: entriesData }, { data: salesData }, { data: expensesData }] =
      await Promise.all([
        supabase
          .from("kasa_entries")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("sales")
          .select("id, total, created_at")
          .eq("payment_status", "Ödendi / Paid"),
        supabase.from("expenses").select("id, amount, created_at"),
      ]);

    setEntries((entriesData || []) as KasaEntry[]);
    setSales((salesData || []) as Sale[]);
    setExpenses((expensesData || []) as Expense[]);
    setLoading(false);
  }

  const latestOpening = useMemo(
    () => entries.find((e) => e.type === "opening_balance") ?? null,
    [entries]
  );

  const kasaCalc = useMemo(() => {
    if (!latestOpening) {
      return { openingAmount: 0, salesIncome: 0, expensesTotal: 0, manualIn: 0, manualOut: 0, current: 0 };
    }

    const cutoff = latestOpening.created_at;

    const salesIncome = sales
      .filter((s) => s.created_at >= cutoff)
      .reduce((sum, s) => sum + Number(s.total || 0), 0);

    const expensesTotal = expenses
      .filter((e) => e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const manualIn = entries
      .filter((e) => e.type === "manual_in" && e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const manualOut = entries
      .filter((e) => e.type === "manual_out" && e.created_at >= cutoff)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const current = Number(latestOpening.amount) + salesIncome - expensesTotal + manualIn - manualOut;

    return { openingAmount: Number(latestOpening.amount), salesIncome, expensesTotal, manualIn, manualOut, current };
  }, [latestOpening, sales, expenses, entries]);

  async function handleSave() {
    const parsed = parseFloat(amount.replace(",", "."));

    if (!parsed || parsed <= 0) {
      showToast("Geçerli bir tutar girin / Unesite validan iznos", "warning");
      return;
    }

    if (!entryDate) {
      showToast("Tarih seçin / Odaberite datum", "warning");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("kasa_entries").insert([{
      amount: parsed,
      type: entryType,
      note: note.trim() || null,
      entry_date: entryDate,
    }]);

    setSaving(false);

    if (error) {
      showToast("Kayıt yapılamadı / Greška pri čuvanju: " + error.message, "error");
      return;
    }

    const messages: Record<KasaEntry["type"], string> = {
      opening_balance: "Açılış bakiyesi kaydedildi ✅",
      manual_in: "Nakit girişi kaydedildi ✅",
      manual_out: "Nakit çıkışı kaydedildi ✅",
    };

    showToast(messages[entryType], "success");
    setAmount("");
    setNote("");
    setEntryDate(getTodayDate());
    await fetchAll();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Bu kayıt silinsin mi? / Obrisati ovaj zapis?");
    if (!confirmed) return;

    const { error } = await supabase.from("kasa_entries").delete().eq("id", id);

    if (error) {
      showToast("Silinemedi / Nije obrisano: " + error.message, "error");
      return;
    }

    showToast("Silindi ✅", "success");
    await fetchAll();
  }

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className={`pointer-events-auto max-w-lg w-full mx-4 rounded-2xl px-12 py-8 shadow-2xl text-center text-xl font-semibold ${
            toast.type === "success" ? "bg-emerald-600 text-white" :
            toast.type === "error"   ? "bg-red-600 text-white" :
                                       "bg-yellow-500 text-slate-900"
          }`}>
            {toast.type === "success" && <span className="mr-2">✓</span>}
            {toast.type === "error"   && <span className="mr-2">✕</span>}
            {toast.type === "warning" && <span className="mr-2">⚠</span>}
            {toast.message}
          </div>
        </div>
      )}

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Kasa / Kasa</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Şirketin nakit para takibi. Önce açılış bakiyesi girin; sonrasındaki satış gelirleri ve
          giderler otomatik hesaplanır. / Praćenje gotovine. Unesite početni saldo — prodaje i
          troškovi se računaju automatski.
        </p>
      </div>

      {loading ? (
        <div className="text-slate-400">Yükleniyor / Učitava se...</div>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[1fr_1.5fr]">
          {/* Form */}
          <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
            <h2 className="mb-6 text-lg font-semibold">Kasa Kaydı / Unos u kasu</h2>

            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Kayıt Türü / Vrsta unosa
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as KasaEntry["type"])}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="opening_balance">Açılış Bakiyesi / Početni saldo</option>
                  <option value="manual_in">Nakit Girişi / Gotovinski ulaz</option>
                  <option value="manual_out">Nakit Çıkışı / Gotovinski izlaz</option>
                </select>
                {entryType === "opening_balance" && (
                  <p className="mt-1.5 text-xs text-amber-400">
                    Bu tarihten itibaren satışlar ve giderler otomatik hesaba katılır. /
                    Od ovog datuma prodaje i troškovi se računaju automatski.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Tutar / Iznos (€)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Tarih / Datum
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Not / Napomena (opsiyonel)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Açıklama / Opis"
                  rows={2}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-2 rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : "Kaydet / Sačuvaj"}
              </button>
            </div>
          </section>

          {/* Sağ panel */}
          <div className="flex flex-col gap-6">
            {/* Güncel Kasa */}
            <div className={`rounded-3xl border p-6 shadow-2xl shadow-black/20 ${
              kasaCalc.current >= 0
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950"
                : "border-red-500/30 bg-gradient-to-br from-red-500/10 via-slate-900 to-slate-950"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Güncel Kasa Durumu / Trenutno stanje kase
              </p>

              {latestOpening ? (
                <>
                  <p className={`mt-3 text-5xl font-bold ${kasaCalc.current >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    €{kasaCalc.current.toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Son açılış: {latestOpening.entry_date} ·{" "}
                    {new Date(latestOpening.created_at).toLocaleString("tr-TR")}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-xs text-slate-400">Açılış Bakiyesi / Početni saldo</p>
                      <p className="mt-1 font-semibold text-white">
                        €{kasaCalc.openingAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-xs text-slate-400">Satış Geliri / Prihod</p>
                      <p className="mt-1 font-semibold text-emerald-300">
                        +€{kasaCalc.salesIncome.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                      <p className="text-xs text-slate-400">Giderler / Troškovi</p>
                      <p className="mt-1 font-semibold text-red-300">
                        -€{kasaCalc.expensesTotal.toFixed(2)}
                      </p>
                    </div>
                    {(kasaCalc.manualIn > 0 || kasaCalc.manualOut > 0) && (
                      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                        <p className="text-xs text-slate-400">Manuel Hareketler / Ručne</p>
                        <p className="mt-1 font-semibold text-blue-300">
                          {kasaCalc.manualIn > 0 && `+€${kasaCalc.manualIn.toFixed(2)}`}
                          {kasaCalc.manualIn > 0 && kasaCalc.manualOut > 0 && " / "}
                          {kasaCalc.manualOut > 0 && `-€${kasaCalc.manualOut.toFixed(2)}`}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Henüz açılış bakiyesi girilmedi. Sol taraftan "Açılış Bakiyesi" seçip tutarı
                  girin. / Početni saldo još nije unesen.
                </p>
              )}
            </div>

            {/* Kayıt Geçmişi */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
              <h3 className="mb-4 text-base font-semibold">Kayıt Geçmişi / Istorija unosa</h3>

              {entries.length === 0 ? (
                <p className="text-sm text-slate-400">Henüz kayıt yok / Nema zapisa</p>
              ) : (
                <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                        entry.type === "opening_balance"
                          ? "border-blue-500/20 bg-blue-500/10"
                          : entry.type === "manual_in"
                          ? "border-emerald-500/20 bg-emerald-500/10"
                          : "border-red-500/20 bg-red-500/10"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-white">
                          {entry.type === "manual_out" ? "-" : "+"}€
                          {Number(entry.amount).toFixed(2)}
                          <span className="ml-2 text-xs text-slate-400">
                            {TYPE_LABEL[entry.type]}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {entry.entry_date}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="ml-4 text-xs text-red-400 transition hover:text-red-300"
                      >
                        Sil / Briši
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
