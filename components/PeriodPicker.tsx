"use client";

import { useState } from "react";
import { PeriodKey, PeriodSelection, quickRange } from "@/lib/period";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Danas / Bugün" },
  { key: "week", label: "Sedmica / Bu Hafta" },
  { key: "month", label: "Mjesec / Bu Ay" },
  { key: "year", label: "Godina / Bu Yıl" },
  { key: "custom", label: "📅 Datum / Tarih Seç" },
];

export default function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (next: PeriodSelection) => void;
}) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  function applyCustom(nextFrom = from, nextTo = to) {
    setFrom(nextFrom);
    setTo(nextTo);
    onChange({ key: "custom", from: nextFrom, to: nextTo });
  }

  return (
    <div className="flex flex-col items-stretch gap-3 md:items-end">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() =>
              opt.key === "custom" ? applyCustom() : onChange({ ...value, key: opt.key })
            }
            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
              value.key === opt.key
                ? "bg-blue-500 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.key === "custom" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyCustom();
          }}
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-blue-500/40 bg-slate-900 p-3"
        >
          <label className="grid gap-1 text-xs text-slate-400">
            Od / Başlangıç
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-400">
            Do / Bitiş
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["last7", "Son 7 gün"],
                ["last30", "Son 30 gün"],
                ["lastMonth", "Geçen ay"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const r = quickRange(kind);
                  applyCustom(r.from, r.to);
                }}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
          >
            Prikaži / Göster
          </button>
        </form>
      )}
    </div>
  );
}
