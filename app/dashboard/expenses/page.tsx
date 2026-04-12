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
        note,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("Greška / Hata: " + error.message);
      return;
    }

    alert("Trošak je sačuvan / Gider kaydedildi ✅");

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
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Troškovi / Giderler
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Prati i evidentiraj troškove poslovanja. / İşletme giderlerini kaydet ve takip et.
        </p>
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
                <option>Kira / Rent</option>
                <option>Plata / Maaş</option>
                <option>Struja / Elektrik</option>
                <option>Internet / İnternet</option>
                <option>Transport / Nakliye</option>
                <option>Marketing / Reklam</option>
                <option>Popravka / Tamirat</option>
                <option>Porez / Vergi</option>
                <option>Ostalo / Diğer</option>
              </select>
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
          <p className="mt-1 text-sm text-slate-400">
            Opšti pregled troškova. / Genel gider görünümü.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Ukupni troškovi / Toplam Gider
              </p>
              <p className="mt-2 text-2xl font-bold text-red-300">
                €{totalExpense.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Ovaj mjesec / Bu Ay
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                €{thisMonthExpense.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Broj zapisa / Kayıt Sayısı
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
            Posljednji troškovi / Son Giderler
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Najnoviji unosi troškova. / En son eklenen gider kayıtları.
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
                </tr>
              </thead>

              <tbody>
                {expenses.slice(0, 15).map((expense) => (
                  <tr key={expense.id} className="border-t border-slate-800 hover:bg-slate-800/30">
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
