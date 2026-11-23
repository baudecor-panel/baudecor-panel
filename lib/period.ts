export type PeriodKey = "today" | "week" | "month" | "year" | "custom";
export type Bucket = "hour" | "day" | "week" | "month";

export type PeriodSelection = {
  key: PeriodKey;
  from: string; // YYYY-MM-DD, sadece "custom" için
  to: string;
};

export type Period = {
  key: PeriodKey;
  start: Date; // dahil
  end: Date; // hariç
  label: string;
  compareLabel: string;
  bucket: Bucket;
};

export type DateRange = { start: Date; end: Date };

export type ChartBucket = DateRange & { label: string };

export const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
export const MONTHS_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];
const WEEKDAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayCount(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS);
}

export function toInputDate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// "2026-11-23" gibi sadece tarih olan değerleri yerel saatle okur (UTC kaymasını önler)
export function parseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function inRange(d: Date | null, r: DateRange) {
  return !!d && d >= r.start && d < r.end;
}

function fmtDay(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtSpan(a: Date, b: Date) {
  if (a.getFullYear() !== b.getFullYear()) return `${fmtDay(a)} – ${fmtDay(b)}`;
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  if (a.getDate() === b.getDate()) return fmtDay(a);
  return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

export function defaultSelection(now = new Date()): PeriodSelection {
  const today = startOfDay(now);
  return {
    key: "month",
    from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toInputDate(today),
  };
}

export function getPeriod(sel: PeriodSelection, now = new Date()): Period {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  if (sel.key === "today") {
    return { key: "today", start: today, end: tomorrow, label: `Bugün · ${fmtDay(today)}`, compareLabel: "düne göre", bucket: "hour" };
  }

  if (sel.key === "week") {
    const start = addDays(today, -((today.getDay() + 6) % 7)); // pazartesi
    return { key: "week", start, end: tomorrow, label: `Bu hafta · ${fmtSpan(start, today)}`, compareLabel: "geçen haftaya göre", bucket: "day" };
  }

  if (sel.key === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { key: "month", start, end: tomorrow, label: `Bu ay · ${MONTHS[today.getMonth()]} ${today.getFullYear()}`, compareLabel: "geçen aya göre", bucket: "week" };
  }

  if (sel.key === "year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { key: "year", start, end: tomorrow, label: `Bu yıl · ${today.getFullYear()}`, compareLabel: "geçen yıla göre", bucket: "month" };
  }

  let from = parseDate(sel.from) || today;
  let to = parseDate(sel.to) || today;
  if (to < from) [from, to] = [to, from];
  const end = addDays(to, 1);
  const days = dayCount(from, end);
  const bucket: Bucket = days <= 1 ? "hour" : days <= 14 ? "day" : days <= 92 ? "week" : "month";

  return {
    key: "custom",
    start: from,
    end,
    label: `Seçilen tarih · ${fmtSpan(from, to)} (${days} gün)`,
    compareLabel: `önceki ${days} güne göre`,
    bucket,
  };
}

// Karşılaştırma dönemi: aynı uzunlukta bir önceki dönem
export function previousRange(p: Period): DateRange {
  const len = dayCount(p.start, p.end);

  if (p.key === "month") {
    const start = new Date(p.start.getFullYear(), p.start.getMonth() - 1, 1);
    const end = addDays(start, len);
    return { start, end: end > p.start ? p.start : end };
  }

  if (p.key === "year") {
    const start = new Date(p.start.getFullYear() - 1, 0, 1);
    const last = addDays(p.end, -1);
    return { start, end: addDays(new Date(start.getFullYear(), last.getMonth(), last.getDate()), 1) };
  }

  if (p.key === "week") {
    return { start: addDays(p.start, -7), end: addDays(p.end, -7) };
  }

  return { start: addDays(p.start, -len), end: p.start };
}

export function buildBuckets(p: Period): ChartBucket[] {
  const list: ChartBucket[] = [];

  if (p.bucket === "hour") {
    for (let h = 0; h < 24; h += 2) {
      const start = new Date(p.start);
      start.setHours(h);
      const end = new Date(p.start);
      end.setHours(h + 2);
      list.push({ start, end, label: String(h).padStart(2, "0") });
    }
    return list;
  }

  if (p.bucket === "day") {
    // "Bu hafta" her zaman pazartesi–pazar gösterilir; gelecek günler boş kalır
    const last = p.key === "week" ? addDays(p.start, 7) : p.end;
    for (let d = new Date(p.start); d < last; d = addDays(d, 1)) {
      const label = p.key === "week" ? WEEKDAYS_SHORT[(d.getDay() + 6) % 7] : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
      list.push({ start: d, end: addDays(d, 1), label });
    }
    return list;
  }

  if (p.bucket === "week") {
    for (let d = new Date(p.start); d < p.end; d = addDays(d, 7)) {
      const next = addDays(d, 7);
      const end = next < p.end ? next : p.end;
      const last = addDays(end, -1);
      const label =
        d.getMonth() === last.getMonth()
          ? d.getDate() === last.getDate()
            ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
            : `${d.getDate()}–${last.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
          : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}–${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
      list.push({ start: d, end, label });
    }
    return list;
  }

  const multiYear = p.start.getFullYear() !== addDays(p.end, -1).getFullYear();
  for (let d = new Date(p.start.getFullYear(), p.start.getMonth(), 1); d < p.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const start = d < p.start ? p.start : d;
    const end = next < p.end ? next : p.end;
    const label = multiYear ? `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MONTHS_SHORT[d.getMonth()];
    list.push({ start, end, label });
  }
  return list;
}

// Hızlı seçimler (Tarih seç paneli)
export function quickRange(kind: "last7" | "last30" | "lastMonth", now = new Date()) {
  const today = startOfDay(now);
  if (kind === "last7") return { from: toInputDate(addDays(today, -6)), to: toInputDate(today) };
  if (kind === "last30") return { from: toInputDate(addDays(today, -29)), to: toInputDate(today) };
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: toInputDate(start), to: toInputDate(end) };
}
