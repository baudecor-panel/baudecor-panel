"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import * as XLSX from "xlsx";
import { EXPENSE_TYPES, isOperatingExpense, PURCHASE_EXPENSE_TYPE } from "../../../lib/expenses";
import PeriodPicker from "../../../components/PeriodPicker";
import { defaultSelection, getPeriod, inRange, parseDate, PeriodSelection } from "../../../lib/period";

type Expense = {
  id: string;
  type: string;
  amount: number;
  note?: string;
  created_at: string;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [type, setType] = useState("Zakup / Kira");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [selection, setSelection] = useState<PeriodSelection>(() => defaultSelection());
  const period = useMemo(() => getPeriod(selection), [selection]);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("expenses")
      .select("id, type, amount, note, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Troškovi nijesu učitani / Giderler alınamadı: " + error.message);
      setLoading(false);
      return;
    }

    setExpenses((data || []) as Expense[]);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Bu gider silinsin mi? / Obrisati ovaj trošak?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    setDeletingId(null);
    if (error) { alert("Silinemedi / Greška: " + error.message); return; }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleTypeChange(id: string, newType: string) {
    setUpdatingId(id);
    const { error } = await supabase.from("expenses").update({ type: newType }).eq("id", id);
    setUpdatingId(null);
    if (error) { alert("Güncellenemedi / Greška: " + error.message); return; }
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, type: newType } : e)));
  }

  async function handleSave() {
    if (!type.trim()) {
      alert("Odaberi tip troška / Lütfen gider türü seç");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Unesi ispravan iznos / Lütfen geçerli tutar gir");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("expenses").insert([
      {
        type,
        amount,
        note: note.trim() || null,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("Greška / Hata: " + error.message);
      return;
    }

    alert("Trošak je sačuvan / Gider kaydedildi ✅");

    setType("Zakup / Kira");
    setAmount(0);
    setNote("");

    await fetchExpenses();
  }

  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inRange(parseDate(e.created_at), period)),
    [expenses, period]
  );

  const periodTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const periodPurchases = useMemo(
    () =>
      filteredExpenses
        .filter((e) => !isOperatingExpense(e.type))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach((e) => map.set(e.type, (map.get(e.type) || 0) + Number(e.amount || 0)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  function exportToExcel() {
    const data = filteredExpenses.map((e) => ({
      "Tür / Tip": e.type,
      "Tutar / Iznos (€)": Number(e.amount).toFixed(2),
      "Not / Napomena": e.note || "-",
      "Tarih / Datum": e.created_at?.slice(0, 10) || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 36 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Giderler");
    XLSX.writeFile(wb, `giderler-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <main className="flex-1 bg-slate-950 text-white p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            BAUDECOR SISTEM / BAUDECOR SİSTEM
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Troškovi / Giderler
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Prati i evidentiraj troškove poslovanja. / İşletme giderlerini kaydet ve takip et.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 md:items-end">
        <PeriodPicker value={selection} onChange={setSelection} />
        <button
          onClick={exportToExcel}
          disabled={filteredExpenses.length === 0}
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Excel İndir / Export ({filteredExpenses.length} kayıt)
        </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Unos troška / Gider Girişi
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Kreiraj novi zapis troška. / Yeni gider kaydı oluştur.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Tip troška / Gider Türü
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              >
                {EXPENSE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {type === PURCHASE_EXPENSE_TYPE && (
                <p className="mt-2 text-xs text-amber-300">
                  Samo faktura za robu. Carinu i prevoz unesi posebno. / Sadece ürün alış faturası. Gümrük ve nakliyeyi ayrı gir.
                  Bu kayıt kasadan düşülür ama net kâra girmez (ürün maliyeti satışta zaten düşülüyor).
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Iznos / Tutar
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Örn: 250"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Napomena / Not
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opciona napomena / Gider açıklaması"
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Čuva se... / Kaydediliyor..." : "Sačuvaj / Kaydet"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Sažetak troškova / Gider Özeti
          </h2>
          <p className="mt-1 text-sm text-slate-400">{period.label}</p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Troškovi perioda / Dönem Gideri
              </p>
              <p className="mt-2 text-2xl font-bold text-red-300">
                €{periodTotal.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {filteredExpenses.length} kayıt
                {periodPurchases > 0 && ` · bunun €${periodPurchases.toFixed(2)} kadarı mal alımı (net kâra girmez)`}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Po tipu / Türe Göre
              </p>
              {byType.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">Bu dönemde gider yok</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {byType.map(([t, sum]) => (
                    <li key={t} className="flex justify-between gap-3">
                      <span className={isOperatingExpense(t) ? "text-slate-300" : "text-amber-300"}>{t}</span>
                      <span className="font-semibold tabular-nums">€{sum.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="px-1 text-xs text-slate-500">
              Tüm zamanlar: €{totalExpense.toFixed(2)} · {expenses.length} kayıt
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Troškovi perioda / Dönemin Giderleri
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {period.label} · Tip možeš promijeniti u tabeli. / Türü tablodan değiştirebilirsin.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">
            Učitava se / Yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Tip / Tür</th>
                  <th className="py-3 text-center">Iznos / Tutar</th>
                  <th className="py-3 text-left">Napomena / Not</th>
                  <th className="py-3 text-center">Datum / Tarih</th>
                  <th className="py-3 text-center">İşlem / Akcija</th>
                </tr>
              </thead>

              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t border-slate-800 transition hover:bg-slate-800/30"
                  >
                    <td className="py-3">
                      <select
                        value={expense.type}
                        disabled={updatingId === expense.id}
                        onChange={(e) => handleTypeChange(expense.id, e.target.value)}
                        className={`rounded-xl border bg-slate-950 px-2 py-1.5 text-sm outline-none transition focus:border-blue-500 disabled:opacity-50 ${
                          isOperatingExpense(expense.type) ? "border-slate-700 text-white" : "border-amber-500/40 text-amber-300"
                        }`}
                      >
                        {(EXPENSE_TYPES.includes(expense.type) ? EXPENSE_TYPES : [expense.type, ...EXPENSE_TYPES]).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-center text-red-300 font-medium">
                      €{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="py-3">{expense.note || "-"}</td>
                    <td className="py-3 text-center text-slate-400">
                      {expense.created_at?.slice(0, 10)}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        disabled={deletingId === expense.id}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
                      >
                        {deletingId === expense.id ? "..." : "Sil / Obriši"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
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
