"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ProductGroup = {
  id: string;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
  is_active?: boolean | null;
};

type ParentProduct = {
  id: string;
  name: string;
};

export default function NewProductPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parentProducts, setParentProducts] = useState<ParentProduct[]>([]);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingParentProducts, setLoadingParentProducts] = useState(true);

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [cost, setCost] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [minimumStock, setMinimumStock] = useState<number | "">(5);
  const [isAccessory, setIsAccessory] = useState(false);
  const [parentProductId, setParentProductId] = useState("");
  const [accessoryType, setAccessoryType] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ price: number; reason: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchGroups();
    fetchSuppliers();
  }, []);

  async function fetchGroups() {
    setLoadingGroups(true);

    const { data, error } = await supabase
      .from("product_groups")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      alert("Grupe proizvoda nijesu učitane / Ürün grupları alınamadı");
      setLoadingGroups(false);
      return;
    }

    setGroups((data || []) as ProductGroup[]);
    setLoadingGroups(false);
  }

  async function fetchSuppliers() {
    setLoadingSuppliers(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      alert("Dobavljači nijesu učitani / Tedarikçiler alınamadı");
      setLoadingSuppliers(false);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
    setLoadingSuppliers(false);
  }

  async function fetchParentProducts(filterGroupId: string) {
    if (!filterGroupId) {
      setParentProducts([]);
      return;
    }

    setLoadingParentProducts(true);

    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .eq("is_active", true)
      .eq("group_id", filterGroupId)
      .is("parent_product_id", null)
      .order("name", { ascending: true });

    if (error) {
      setLoadingParentProducts(false);
      return;
    }

    setParentProducts((data || []) as ParentProduct[]);
    setLoadingParentProducts(false);
  }

  async function checkDuplicateName(productName: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .ilike("name", productName.trim())
      .limit(1);

    if (error) {
      return { exists: false };
    }

    return { exists: (data || []).length > 0 };
  }

  async function fetchAiPriceSuggestion() {
    if (!name.trim() || !cost) {
      alert("Fiyat önerisi için ürün adı ve maliyet girilmeli.");
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const groupName = groups.find((g) => g.id === groupId)?.name || "";
      const supplierName = suppliers.find((s) => String(s.id) === supplierId)?.name || "";
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Yeni ürün fiyat önerisi:\nÜrün adı: ${name}\nGrup: ${groupName || "-"}\nTedarikçi: ${supplierName || "-"}\nMaliyet: €${cost}\n\nBu ürün için Karadağ pazarında uygun satış fiyatı öner. Yanıtı SADECE şu JSON formatında ver, başka hiçbir şey yazma. "reason" alanını önce Karadağca sonra Türkçe yaz, aralarına " / " koy:\n{"price": 150, "reason": "Karadağca gerekçe / Türkçe gerekçe"}`,
            },
          ],
          priceMode: true,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        try {
          const cleaned = data.reply.replace(/```json|```/g, "").trim();
          const match = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(match ? match[0] : cleaned);
          if (parsed.price && parsed.reason) {
            setAiSuggestion({ price: Number(parsed.price), reason: parsed.reason });
          }
        } catch {
          alert("AI yanıtı işlenemedi.");
        }
      }
    } catch {
      alert("AI bağlantı hatası.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Unesi naziv proizvoda / Lütfen ürün adı gir");
      return;
    }

    if (!groupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (Number(price) < 0 || Number(cost) < 0 || Number(stock) < 0 || Number(minimumStock) < 0) {
      alert(
        "Cijena, zaliha veya minimum stok nijesu ispravni / Fiyat, stok veya minimum stok geçersiz"
      );
      return;
    }

    setSaving(true);

    const duplicate = await checkDuplicateName(name);

    if (duplicate.exists) {
      setSaving(false);
      alert(
        "Bu isimde bir ürün zaten var!\nLütfen farklı isim kullan. / A product with this name already exists!"
      );
      return;
    }

    const initialStock = Number(stock);

    if (isAccessory && !parentProductId) {
      setSaving(false);
      alert("Aksesuar ürün için üst ürün seçmelisin / Za accessory proizvod odaberi nadređeni proizvod");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        name: name.trim(),
        group_id: groupId,
        default_supplier_id: supplierId ? Number(supplierId) : null,
        price: Number(price),
        cost: Number(cost),
        stock: initialStock,
        opening_stock: initialStock,
        minimum_stock: Number(minimumStock),
        is_active: true,
        parent_product_id: isAccessory && parentProductId ? parentProductId : null,
        accessory_type: isAccessory && accessoryType.trim() ? accessoryType.trim() : null,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("Proizvod eklenemedi / Ürün eklenemedi: " + error.message);
      return;
    }

    alert("Proizvod eklendi / Ürün eklendi ✅");

    setName("");
    setGroupId("");
    setSupplierId("");
    setPrice("");
    setCost("");
    setStock("");
    setMinimumStock("");
    setIsAccessory(false);
    setParentProductId("");
    setAccessoryType("");
  }

  const selectedGroupName = useMemo(() => {
    return groups.find((group) => group.id === groupId)?.name || "-";
  }, [groups, groupId]);

  const selectedSupplierName = useMemo(() => {
    return (
      suppliers.find((supplier) => String(supplier.id) === supplierId)?.name || "-"
    );
  }, [suppliers, supplierId]);

  const margin = Number(price) - Number(cost);
  const initialStockValue = Number(stock || 0);
  const initialInventoryCost = initialStockValue * Number(cost || 0);
  const initialInventorySaleValue = initialStockValue * Number(price || 0);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          Novi proizvod / Yeni Ürün
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Dodaj novi proizvod u sistem. Početna zaliha se čuva kao opening_stock.
          Podrazumijevani dobavljač ubrzava buduće unose zaliha. /
          Sisteme yeni ürün ekle. Açılış stoku opening stock olarak kaydedilir.
          Varsayılan tedarikçi seçimi gelecekte stok girişlerinde hız sağlar.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="grid gap-4">
            <div>
              <label className="text-sm text-slate-400">
                Naziv proizvoda / Ürün Adı
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Grupa proizvoda / Ürün Grubu
              </label>
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setParentProductId("");
                  fetchParentProducts(e.target.value);
                }}
                disabled={loadingGroups}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {loadingGroups
                    ? "Grupe se učitavaju... / Gruplar yükleniyor..."
                    : "Odaberi grupu / Grup seç"}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              {!loadingGroups && groups.length === 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Još nema grupa. Önce veritabanına grup eklemelisin. /
                  Henüz grup yok. Önce veritabanına grup eklemelisin.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Podrazumijevani dobavljač / Varsayılan Tedarikçi
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={loadingSuppliers}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {loadingSuppliers
                    ? "Dobavljači se učitavaju... / Tedarikçiler yükleniyor..."
                    : "Odaberi dobavljača (opciono) / Tedarikçi seç (opsiyonel)"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>

              {!loadingSuppliers && suppliers.length === 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Još nema aktivnih dobavljača. Önce Tedarikçiler ekranından firma
                  ekleyebilirsin. /
                  Henüz aktif tedarikçi yok. Önce Tedarikçiler ekranından firma
                  ekleyebilirsin.
                </p>
              )}

              <p className="mt-2 text-xs text-slate-500">
                Ovo polje nije obavezno. Ürünün ana tedarikçisini tanımlamak için
                kullanılır. Gerçek alım yapılan firma stok girişinde ayrıca
                seçilecek. /
                Bu alan zorunlu değil. Ürünün ana tedarikçisini tanımlamak için
                kullanılır. Gerçek alım yapılan firma stok girişinde ayrıca
                seçilecek.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">
                  Trošak / Maliyet
                </label>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  placeholder="0"
                  onChange={(e) => { setCost(e.target.value === "" ? "" : Number(e.target.value)); setAiSuggestion(null); }}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400">
                  Prodajna cijena / Satış Fiyatı
                </label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  placeholder="0"
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* AI Fiyat Önerisi */}
            <div>
              <button
                type="button"
                onClick={fetchAiPriceSuggestion}
                disabled={aiLoading || !name.trim() || !cost}
                className="flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {aiLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    AI analizira... / AI analiz ediyor...
                  </>
                ) : (
                  <>🤖 AI Prijedlog cijene / AI Fiyat Önerisi</>
                )}
              </button>

              {aiSuggestion && (
                <div className="mt-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-400 uppercase tracking-wider">AI Prijedlog / AI Önerisi</p>
                      <p className="mt-1 text-2xl font-bold text-white">€{aiSuggestion.price.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-400">{aiSuggestion.reason}</p>
                      {Number(cost) > 0 && (
                        <p className="mt-1 text-xs text-emerald-400">
                          Marža / Marj: €{(aiSuggestion.price - Number(cost)).toFixed(2)} (%{(((aiSuggestion.price - Number(cost)) / aiSuggestion.price) * 100).toFixed(0)})
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrice(aiSuggestion.price)}
                      className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
                    >
                      Primijeni / Uygula
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Početna zaliha / Başlangıç Stok
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                placeholder="0"
                onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                Ova vrijednost se čuva kao opening_stock. Sistem uyumu için
                products.stock alanına da aynı değer yazılır. /
                Bu değer opening_stock olarak kaydedilir. Sistem uyumu için
                products.stock alanına da aynı değer yazılır.
              </p>
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Minimalna zaliha / Minimum Stok
              </label>
              <input
                type="number"
                min={0}
                value={minimumStock}
                placeholder="5"
                onChange={(e) => setMinimumStock(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <p className="mt-2 text-xs text-slate-500">
                Ova vrijednost je granica kritične zalihe. Dashboard ve ürünler ekranı bu
                limite göre uyarı verir. /
                Bu değer kritik stok sınırıdır. Dashboard ve ürünler ekranı bu
                limite göre uyarı verir.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Aksesuar / Aksesuar Ürün
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Bu ürün başka bir ürünün aksesuarıysa (profil, bağlantı parçası vb.) etkinleştir. /
                    Aktiviraj ako je ovaj proizvod accessory drugog proizvoda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAccessory(!isAccessory);
                    setParentProductId("");
                    setAccessoryType("");
                  }}
                  className={`relative h-7 w-14 rounded-full transition-colors ${
                    isAccessory ? "bg-blue-600" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      isAccessory ? "left-8" : "left-1"
                    }`}
                  />
                </button>
              </div>

              {isAccessory && (
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="text-sm text-slate-400">
                      Üst Ürün / Nadređeni Proizvod
                    </label>
                    <select
                      value={parentProductId}
                      onChange={(e) => setParentProductId(e.target.value)}
                      disabled={loadingParentProducts}
                      className="mt-2 h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {loadingParentProducts
                          ? "Yükleniyor... / Učitava se..."
                          : "Üst ürün seç / Odaberi nadređeni proizvod"}
                      </option>
                      {parentProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-400">
                      Aksesuar Türü / Tip Accessorya
                    </label>
                    <input
                      value={accessoryType}
                      onChange={(e) => setAccessoryType(e.target.value)}
                      placeholder="Başlangıç Profili / Bitiş Profili / Köşe Profili..."
                      className="mt-2 h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      İsteğe bağlı. Örn: Başlangıç Profili, Bitiş Profili, Köşe, vb. /
                      Opciono. Npr: Početni profil, Završni profil, Ugaoni...
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={
                saving ||
                loadingGroups ||
                groups.length === 0 ||
                loadingSuppliers
              }
              className="mt-4 rounded-2xl bg-blue-600 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Čuva se... / Kaydediliyor..." : "Sačuvaj / Kaydet"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold">Sažetak / Özet</h2>

          <div className="mt-6 space-y-4">
            <InfoCard title="Proizvod / Ürün" value={name || "-"} />
            <InfoCard title="Grupa / Grup" value={selectedGroupName} />
            <InfoCard
              title="Dobavljač / Tedarikçi"
              value={selectedSupplierName}
            />
            <InfoCard title="Cijena / Fiyat" value={`€${Number(price).toFixed(2)}`} />
            <InfoCard title="Trošak / Maliyet" value={`€${Number(cost).toFixed(2)}`} />
            <InfoCard
              title="Marža / Marj"
              value={`€${Number(margin).toFixed(2)}`}
              green={margin >= 0}
              red={margin < 0}
            />
            <InfoCard
              title="Početna zaliha / Başlangıç Stok"
              value={String(initialStockValue)}
            />
            <InfoCard
              title="Minimalna zaliha / Minimum Stok"
              value={String(Number(minimumStock || 0))}
            />
            <InfoCard
              title="Početni trošak / Açılış Maliyeti"
              value={`€${initialInventoryCost.toFixed(2)}`}
            />
            <InfoCard
              title="Početna prodajna vrijednost / Açılış Satış Değeri"
              value={`€${initialInventorySaleValue.toFixed(2)}`}
            />
            <InfoCard
              title="Aksesuar / Accessory"
              value={isAccessory ? "Evet / Da" : "Hayır / Ne"}
            />
            {isAccessory && (
              <>
                <InfoCard
                  title="Üst Ürün / Nadređeni"
                  value={parentProducts.find((p) => p.id === parentProductId)?.name || "-"}
                />
                <InfoCard
                  title="Aksesuar Türü / Tip"
                  value={accessoryType || "-"}
                />
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  value,
  green,
  red,
}: {
  title: string;
  value: string;
  green?: boolean;
  red?: boolean;
}) {
  const color = green ? "text-emerald-300" : red ? "text-red-300" : "text-white";

  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-1 text-lg ${color}`}>{value}</p>
    </div>
  );
}
