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

export default function NewProductPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [minimumStock, setMinimumStock] = useState(5);
  const [saving, setSaving] = useState(false);

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

  async function handleSave() {
    if (!name.trim()) {
      alert("Unesi naziv proizvoda / Lütfen ürün adı gir");
      return;
    }

    if (!groupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (price < 0 || cost < 0 || stock < 0 || minimumStock < 0) {
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
    setPrice(0);
    setCost(0);
    setStock(0);
    setMinimumStock(5);
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
                onChange={(e) => setGroupId(e.target.value)}
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
                  Prodajna cijena / Satış Fiyatı
                </label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400">
                  Trošak / Maliyet
                </label>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Početna zaliha / Başlangıç Stok
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
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
                onChange={(e) => setMinimumStock(Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
              />
              <p className="mt-2 text-xs text-slate-500">
                Ova vrijednost je granica kritične zalihe. Dashboard ve ürünler ekranı bu
                limite göre uyarı verir. /
                Bu değer kritik stok sınırıdır. Dashboard ve ürünler ekranı bu
                limite göre uyarı verir.
              </p>
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
