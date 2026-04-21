import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY .env.local dosyasında tanımlı değil");
  return new Anthropic({ apiKey });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 5 dakika cache
let contextCache: { data: string; timestamp: number; date: string } | null = null;

function isCacheValid(): boolean {
  if (!contextCache) return false;
  return Date.now() - contextCache.timestamp < 5 * 60 * 1000;
}

async function fetchMemory(): Promise<string> {
  try {
    const { data } = await supabase
      .from("ai_memory")
      .select("category, key, value")
      .order("category");

    if (!data || data.length === 0) return "";

    const grouped = new Map<string, string[]>();
    data.forEach((m) => {
      const list = grouped.get(m.category) || [];
      list.push(`- ${m.key}: ${m.value}`);
      grouped.set(m.category, list);
    });

    let result = "\n=== KALICI HAFIZA / ÖĞRENILEN BİLGİLER ===\n";
    grouped.forEach((items, category) => {
      result += `\n[${category.toUpperCase()}]\n${items.join("\n")}\n`;
    });
    return result;
  } catch {
    return "";
  }
}

async function fetchContext() {
  if (isCacheValid()) return contextCache!.data;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const [
    { data: salesAll },
    { data: salesThisMonth },
    { data: salesLastMonth },
    { data: products },
    { data: expenses },
    { data: customers },
    { data: suppliers },
    { data: stockMovements },
    { data: productGroups },
  ] = await Promise.all([
    supabase.from("sales").select("id, order_id, total, profit, quantity, product_name, customer_name, city, delivery_status, payment_method, payment_status, commission_amount, created_at, sale_date, shipment_date, discount, final_unit_price").order("created_at", { ascending: false }),
    supabase.from("sales").select("total, profit, quantity, product_name, customer_name, city, delivery_status, payment_method").gte("created_at", thisMonthStart),
    supabase.from("sales").select("total, profit, quantity, product_name, customer_name").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
    supabase.from("products").select("name, stock, minimum_stock, price, cost, is_active, group_id"),
    supabase.from("expenses").select("type, amount, note, created_at").order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name, city, phone, email, address, created_at").order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name, contact_name, city, country, phone, email, note"),
    supabase.from("stock_movements").select("product_name, movement_type, quantity, note, created_at").order("created_at", { ascending: false }),
    supabase.from("product_groups").select("id, name"),
  ]);

  const pendingShipments = (salesAll || []).filter((s) => s.delivery_status === "Bekliyor / Pending").sort((a, b) => {
    if (!a.shipment_date) return 1;
    if (!b.shipment_date) return -1;
    return new Date(a.shipment_date).getTime() - new Date(b.shipment_date).getTime();
  });

  // Revenue stats
  const totalRevenue = (salesAll || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const totalProfit = (salesAll || []).reduce((s, r) => s + Number(r.profit || 0), 0);
  const thisMonthRevenue = (salesThisMonth || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const thisMonthProfit = (salesThisMonth || []).reduce((s, r) => s + Number(r.profit || 0), 0);
  const lastMonthRevenue = (salesLastMonth || []).reduce((s, r) => s + Number(r.total || 0), 0);
  const lastMonthProfit = (salesLastMonth || []).reduce((s, r) => s + Number(r.profit || 0), 0);
  const revenueChange = lastMonthRevenue > 0 ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1) : "N/A";

  // Expenses totals
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const thisMonthExpenses = (expenses || []).filter((e) => new Date(e.created_at) >= new Date(thisMonthStart)).reduce((s, e) => s + Number(e.amount || 0), 0);

  // Payment methods
  const paymentMethods = new Map<string, number>();
  (salesAll || []).forEach((s) => {
    const method = s.payment_method || "Nakit / Cash";
    paymentMethods.set(method, (paymentMethods.get(method) || 0) + Number(s.total || 0));
  });

  // Profit margin
  const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0";
  const thisMonthMargin = thisMonthRevenue > 0 ? ((thisMonthProfit / thisMonthRevenue) * 100).toFixed(1) : "0";

  const montenegroContext = `
=== KARADAĞ (MONTENEGRO) PİYASA BİLGİSİ ===

COĞRAFİ VE EKONOMİK BAĞLAM:
- Karadağ nüfusu ~620.000, Podgorica başkent (~180.000 nüfus)
- AB üyelik sürecinde, Euro kullanıyor
- Ekonomi turizm, inşaat ve gayrimenkule çok bağımlı
- Yabancı yatırımcılar (Ruslar, Türkler, Körfez vatandaşları) çok lüks mülk alıyor

SEZONSAL DURUM (Şu an: ${now.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}):
- Yaz sezonu (Haziran-Eylül): Budva, Kotor, Tivat, Bar, Herceg Novi'de turizm patlaması
  → Bu dönem kıyı şehirlerinde villa/daire dekorasyon talebi zirve yapar
  → Otel renovasyonları, yazlık döşeme siparişleri artar
- Kış sezonu (Ekim-Mart): İç şehirlerde (Podgorica, Nikšić) yerel halk alımları ağırlıklı
  → İnşaat/tadilat sezonunun başlangıcı — malzeme siparişleri artar
- İlkbahar (Mart-Mayıs): Yaz öncesi hazırlık, en yoğun teslimat dönemi

ŞEHİR KARAKTERİSTİKLERİ:
- Podgorica: En büyük pazar, sabit müşteri tabanı, orta-üst segment
- Budva: Turizm ve lüks gayrimenkul merkezi, en yüksek metrekare fiyatları
- Kotor: UNESCO mirası, butik otel ve villa yoğunluğu, premium segment
- Tivat: Porto Montenegro marina, çok uluslu ve lüks profil
- Bar: Liman şehri, karma profil, büyüyen rezidans sektörü
- Herceg Novi: Emekli ve yabancı yerleşimci yoğun
- Nikšić: İkinci büyük şehir, yerel ve sanayi profil
- Kolašin/Žabljak: Kış turizmi, dağ evi/chalet segmenti

REKABET VE PAZAR:
- Yerel rakipler genellikle küçük aile işletmesi
- İtalyan ve Türk mobilya/dekor ürünleri tercih görüyor
- Fiyat hassasiyeti yüksek ama kalite talebi artıyor
- Online satış henüz gelişmemiş — showroom deneyimi kritik
- Proje bazlı satış (otel, rezidans) yüksek hacimli fırsat

BÜYÜME FIRSATLARI:
- Porto Montenegro ve Lustica Bay gibi mega projeler devam ediyor
- Karadağ'da yabancı mülk alımı artıyor → yabancı dil bilen satış avantajı
- B2B: İnşaat firmaları, mimarlar, iç mimar büroları ile ortaklık
- Dijital katalog/Instagram ile Podgorica dışına ulaşım
`;

  const result = `
SEN: Baudecor showroom'unun özel AI danışmanısın. Karadağ (Montenegro) pazarında faaliyet gösteren bir iç mekan/dekorasyon/döşeme showroom'u için çalışıyorsun. Verileri gerçekçi yorumla, Karadağ piyasa dinamiklerini dikkate al, somut ve uygulanabilir öneriler ver. Yanıtların kısa, net ve aksiyona dönük olsun. Aşağıda programın TÜM verisi mevcut — hiçbir kayıt atlanmamıştır.

DİL KURALI: Kullanıcı hangi dilde yazıyorsa o dilde yanıt ver. Türkçe yazıyorsa Türkçe, Karadağca/Sırpça yazıyorsa Karadağca yanıt ver.

${montenegroContext}

=== GÜNCEL İŞLETME VERİSİ (${now.toLocaleDateString("tr-TR")}) ===

--- FİNANSAL ÖZET ---
Toplam ciro: €${totalRevenue.toFixed(2)} | Toplam kâr: €${totalProfit.toFixed(2)} | Kâr marjı: %${profitMargin}
Bu ay: €${thisMonthRevenue.toFixed(2)} ciro, €${thisMonthProfit.toFixed(2)} kâr, %${thisMonthMargin} marj
Geçen ay: €${lastMonthRevenue.toFixed(2)} ciro, €${lastMonthProfit.toFixed(2)} kâr
Aylık değişim: %${revenueChange}
Toplam gider: €${totalExpenses.toFixed(2)} | Bu ay gider: €${thisMonthExpenses.toFixed(2)}
Ödeme yöntemleri: ${Array.from(paymentMethods.entries()).map(([m, t]) => `${m}: €${t.toFixed(0)}`).join(" | ")}

--- MÜŞTERİLER (toplam ${(customers || []).length} kişi — son 20) ---
${(customers || []).slice(0, 20).map((c) => `${c.name} | ${c.city || "-"} | ${c.phone || "-"}`).join("\n") || "Veri yok"}

--- TÜM ÜRÜNLER VE STOK ---
${(products || []).map((p) => {
    const group = (productGroups || []).find((g) => g.id === p.group_id)?.name || "-";
    const status = !p.is_active ? "PASİF" : Number(p.stock) <= 0 ? "STOK YOK" : Number(p.stock) <= Number(p.minimum_stock || 5) ? "KRİTİK STOK" : "OK";
    return `${p.name} | Grup: ${group} | Stok: ${p.stock} | Fiyat: €${p.price || 0} | Maliyet: €${p.cost || 0} | [${status}]`;
  }).join("\n") || "Veri yok"}

--- ÜRÜN GRUPLARI ---
${(productGroups || []).map((g) => g.name).join(", ") || "Veri yok"}

--- TEDARİKÇİLER ---
${(suppliers || []).map((s) => `${s.name} | ${s.city || "-"}, ${s.country || "-"} | ${s.contact_name || "-"} | ${s.phone || "-"}`).join("\n") || "Veri yok"}

--- SEVKİYAT: BEKLEYEN TESLİMATLAR (${pendingShipments.length} adet) ---
${pendingShipments.length === 0 ? "Bekleyen teslimat yok" : pendingShipments.map((s) => {
    const date = s.shipment_date ? new Date(s.shipment_date).toLocaleDateString("tr-TR") : "Tarihsiz";
    const overdue = s.shipment_date && new Date(s.shipment_date) < now ? " ⚠️GECİKMİŞ" : "";
    return `${s.customer_name} | ${s.product_name} | ${s.city || "-"} | ${date}${overdue} | €${Number(s.total || 0).toFixed(0)}`;
  }).join("\n")}

--- SON 50 SATIŞ (toplam ${(salesAll || []).length} kayıt) ---
${(salesAll || []).slice(0, 50).map((s) => {
    const date = new Date(s.sale_date || s.created_at).toLocaleDateString("tr-TR");
    return `${date} | ${s.customer_name} | ${s.product_name} | €${Number(s.total || 0).toFixed(0)} kâr:€${Number(s.profit || 0).toFixed(0)} | ${s.delivery_status || "-"} | ${s.payment_status || "-"}`;
  }).join("\n") || "Veri yok"}

--- GİDERLER (toplam ${(expenses || []).length} kayıt — son 20) ---
${(expenses || []).slice(0, 20).map((e) => {
    const date = new Date(e.created_at).toLocaleDateString("tr-TR");
    return `${date} | ${e.type} | €${Number(e.amount || 0).toFixed(2)}${e.note ? " | " + e.note : ""}`;
  }).join("\n") || "Veri yok"}

--- STOK HAREKETLERİ (son 30 kayıt) ---
${(stockMovements || []).slice(0, 30).map((m) => {
    const date = new Date(m.created_at).toLocaleDateString("tr-TR");
    return `${date} | ${m.product_name} | ${m.movement_type} | ${m.quantity} adet`;
  }).join("\n") || "Veri yok"}

--- BUGÜNKÜ AKTİVİTE (${now.toLocaleDateString("tr-TR")}) ---
${(() => {
    const todayStr = now.toISOString().slice(0, 10);
    const todaySales = (salesAll || []).filter((s) => (s.sale_date || s.created_at || "").slice(0, 10) === todayStr);
    const todayExpenses = (expenses || []).filter((e) => (e.created_at || "").slice(0, 10) === todayStr);
    const todayMovements = (stockMovements || []).filter((m) => (m.created_at || "").slice(0, 10) === todayStr);
    const todayCustomers = (customers || []).filter((c) => (c.created_at || "").slice(0, 10) === todayStr);
    const lines: string[] = [];
    if (todaySales.length > 0) {
      lines.push(`Satışlar (${todaySales.length} adet, toplam €${todaySales.reduce((s, x) => s + Number(x.total || 0), 0).toFixed(0)}):`);
      todaySales.forEach((s) => lines.push(`  • ${s.customer_name} | ${s.product_name} | €${Number(s.total || 0).toFixed(0)} | ${s.payment_status || "-"}`));
    }
    if (todayExpenses.length > 0) {
      lines.push(`Giderler (${todayExpenses.length} adet):`);
      todayExpenses.forEach((e) => lines.push(`  • ${e.type} | €${Number(e.amount || 0).toFixed(0)}${e.note ? " | " + e.note : ""}`));
    }
    if (todayMovements.length > 0) {
      lines.push(`Stok hareketleri (${todayMovements.length} adet):`);
      todayMovements.forEach((m) => lines.push(`  • ${m.product_name} | ${m.movement_type} | ${m.quantity} adet${m.note ? " | " + m.note : ""}`));
    }
    if (todayCustomers.length > 0) {
      lines.push(`Yeni müşteriler (${todayCustomers.length} adet):`);
      todayCustomers.forEach((c) => lines.push(`  • ${c.name} | ${c.city || "-"}`));
    }
    return lines.length > 0 ? lines.join("\n") : "Bugün henüz işlem yapılmadı.";
  })()}
`.trim();

  contextCache = { data: result, timestamp: Date.now(), date: new Date().toDateString() };
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, alertMode, extractMode, clientContext } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
      alertMode?: boolean;
      extractMode?: boolean;
      clientContext?: string;
    };

    const memory = await fetchMemory();
    const systemPrompt = clientContext
      ? `Sen Baudecor showroom'unun AI danışmanısın. Karadağ pazarında iç mekan/dekorasyon showroom'u. Somut ve kısa yanıtlar ver.\n\nDİL KURALI: Kullanıcı hangi dilde yazıyorsa o dilde yanıt ver.\n\n${clientContext}`
      : await fetchContext();
    const fullPrompt = systemPrompt + memory;

    if (alertMode) {
      const response = await getAnthropic().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: fullPrompt,
        messages: [
          {
            role: "user",
            content: "Verilere bakarak bu hafta için 3 kritik uyarı/öneri üret. Her madde iki satır: önce Karadağca (Crnogorski), sonra Türkçe (Türkçe) aynı bilgiyi ver. Her madde emoji ile başlasın. Format:\n🔴 [Karadağca metin]\n   [Türkçe metin]\n\nSadece 3 madde yaz, başlık ekleme.",
          },
        ],
      });
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return NextResponse.json({ reply: text });
    }

    if (extractMode) {
      const conversation = (messages || []).map((m) => `${m.role === "user" ? "Kullanıcı" : "AI"}: ${m.content}`).join("\n");
      const response = await getAnthropic().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: "Sen bir bilgi çıkarma asistanısın. Verilen sohbetten kalıcı olarak hatırlanmaya değer bilgileri çıkar. Sadece geçerli JSON dizisi döndür, başka hiçbir şey yazma.",
        messages: [
          {
            role: "user",
            content: `Aşağıdaki sohbetten kalıcı olarak hatırlanması gereken tüm bilgileri çıkar. Çalışanlar, müşteriler, ürünler, stratejiler, tercihler, işletme hakkında söylenen her şey dahil. Her madde: {"category": "işletme|strateji|müşteri|ürün|pazar|tercih|not", "key": "kisa_baslik", "value": "tam içerik"}. Sadece JSON dizisi döndür, [ ile başla ] ile bitir, başka hiçbir şey yazma.\n\nSohbet:\n${conversation}`,
          },
        ],
      });
      const raw = response.content[0].type === "text" ? response.content[0].text : "";
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        const items = JSON.parse(match ? match[0] : cleaned);
        return NextResponse.json({ items: Array.isArray(items) ? items : [] });
      } catch {
        return NextResponse.json({ items: [] });
      }
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "Mesaj boş" }, { status: 400 });
    }

    // Anthropic requires messages to start with "user" role
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === -1) {
      return NextResponse.json({ error: "Mesaj boş" }, { status: 400 });
    }
    const anthropicMessages = messages.slice(firstUserIdx);

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: fullPrompt,
      messages: anthropicMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ reply: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
