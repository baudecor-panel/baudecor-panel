"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

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

  const [type, setType] = useState("Kira / Rent");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    setLoading(true);

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setExpenses(data);

    setLoading(false);
  }

  async function handleSave() {
    if (!type.trim()) {
      alert("Lütfen gider türü seç / Please select expense type");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Lütfen geçerli tutar gir / Please enter a valid amount");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("expenses").insert([
      {
        type,
        amount,
        note,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("Hata / Error: " + error.message);
      return;
    }

    alert("Gider kaydedildi / Expense saved ✅");

    setType("Kira / Rent");
    setAmount(0);
    setNote("");

    await fetchExpenses();
  }

  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const thisMonthExpense = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    return expenses.reduce((sum, e) => {
      const d = new Date(e.created_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        return sum + Number(e.amount || 0);
      }
      return sum;
    }, 0);
  }, [expenses]);

  return (
    <main className="flex-1 bg-slate-950 text-white p-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Giderler / Expenses
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          İşletme giderlerini kaydet ve takip et. / Record and track business expenses.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Gider Girişi / Expense Entry
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Yeni gider kaydı oluştur. / Create a new expense record.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Gider Türü / Expense Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              >
                <option>Kira / Rent</option>
                <option>Maaş / Salary</option>
                <option>Elektrik / Electricity</option>
                <option>İnternet / Internet</option>
                <option>Nakliye / Transport</option>
                <option>Reklam / Advertising</option>
                <option>Tamirat / Repair</option>
                <option>Vergi / Tax</option>
                <option>Diğer / Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Tutar / Amount
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
                Not / Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Gider açıklaması / Expense note"
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor... / Saving..." : "Kaydet / Save"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Gider Özeti / Expense Summary
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Genel gider görünümü. / Overall expense overview.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Toplam Gider / Total Expense
              </p>
              <p className="mt-2 text-2xl font-bold text-red-300">
                €{totalExpense.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Bu Ay / This Month
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                €{thisMonthExpense.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Kayıt Sayısı / Record Count
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {expenses.length}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Son Giderler / Recent Expenses
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            En son eklenen gider kayıtları. / Most recently added expense records.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">
            Yükleniyor / Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Tür / Type</th>
                  <th className="py-3 text-center">Tutar / Amount</th>
                  <th className="py-3 text-left">Not / Note</th>
                  <th className="py-3 text-center">Tarih / Date</th>
                </tr>
              </thead>

              <tbody>
                {expenses.slice(0, 15).map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t border-slate-800 transition hover:bg-slate-800/30"
                  >
                    <td className="py-3">{expense.type}</td>
                    <td className="py-3 text-center text-red-300 font-medium">
                      €{Number(expense.amount).toFixed(2)}
                    </td>
                    <td className="py-3">{expense.note || "-"}</td>
                    <td className="py-3 text-center text-slate-400">
                      {expense.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}

                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Kayıt yok / No expenses found
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