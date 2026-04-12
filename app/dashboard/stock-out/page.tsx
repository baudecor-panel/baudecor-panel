"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ProductGroupRelation =
  | {
      name?: string | null;
    }
  | {
      name?: string | null;
    }[]
  | null
  | undefined;

type Product = {
  id: string;
  name: string;
  stock: number;
  price: number;
  cost: number;
  opening_stock?: number | null;
  group_id?: string | null;
  group_name?: string;
  is_active?: boolean;
  product_groups?: ProductGroupRelation;
};

type ProductGroup = {
  id: string;
  name: string;
};

type StockMovement = {
  id: string;
  product_id: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  note?: string;
  created_at: string;
};

export default function StockOutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("Hasarlı / Damaged");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(true);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    await fetchGroups();
    await fetchProducts();
    await fetchMovements();
  }

  function getGroupNameFromRelation(relation?: ProductGroupRelation) {
    if (!relation) return "-";
    if (Array.isArray(relation)) {
      return relation[0]?.name || "-";
    }
    return relation.name || "-";
  }

  async function fetchGroups() {
    const { data, error } = await supabase
      .from("product_groups")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      alert("Grupe proizvoda nijesu učitane / Ürün grupları alınamadı");
      return;
    }

    setGroups((data || []) as ProductGroup[]);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, stock, price, cost, opening_stock, is_active, group_id, product_groups(name)"
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      alert("Proizvodi nijesu učitani / Ürünler alınamadı");
      return;
    }

    const normalized = ((data || []) as Product[]).map((product) => ({
      ...product,
      group_name: getGroupNameFromRelation(product.product_groups),
    }));

    setProducts(normalized);
  }

  async function fetchMovements() {
    setLoadingMovements(true);

    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Kretanja zaliha nijesu učitana / Stok hareketleri alınamadı");
      setLoadingMovements(false);
      return;
    }

    const stockOutRows = ((data || []) as StockMovement[]).filter(
      (m) =>
        m.movement_type === "Stock Out / Stok Çıkışı" ||
        m.movement_type === "Hasarlı / Damaged" ||
        m.movement_type === "Kayıp / Lost" ||
        m.movement_type === "Sayım Düzeltme / Adjustment" ||
        m.movement_type === "Showroom Kullanım / Showroom Use"
    );

    setMovements(stockOutRows);
    setLoadingMovements(false);
  }

  function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedProductId("");
  }

  const filteredProductsByGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return products.filter((product) => product.group_id === selectedGroupId);
  }, [products, selectedGroupId]);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || null;

  const selectedGroup =
    groups.find((g) => g.id === selectedGroupId) || null;

  async function handleSave() {
    if (!selectedGroupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (!selectedProductId) {
      alert("Odaberi proizvod / Lütfen ürün seç");
      return;
    }

    if (!quantity || quantity <= 0) {
      alert("Unesi ispravnu količinu / Lütfen geçerli adet gir");
      return;
    }

    if (!selectedProduct) {
      alert("Proizvod nije pronađen / Ürün bulunamadı");
      return;
    }

    if (!selectedProduct.group_id) {
      alert("Ovom proizvodu nije dodijeljena grupa / Bu ürüne grup atanmadı");
      return;
    }

    if (selectedProduct.group_id !== selectedGroupId) {
      alert("Odabrani proizvod se ne poklapa sa grupom / Seçilen ürün grup ile eşleşmiyor");
      return;
    }

    if (Number(selectedProduct.stock || 0) < Number(quantity)) {
      alert("Nema dovoljno zalihe / Yeterli stok yok");
      return;
    }

    setSaving(true);

    const qty = Number(quantity);

    const movementType =
      reason === "Hasarlı / Damaged" ||
      reason === "Kayıp / Lost" ||
      reason === "Sayım Düzeltme / Adjustment" ||
      reason === "Showroom Kullanım / Showroom Use"
        ? reason
        : "Stock Out / Stok Çıkışı";

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert([
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          movement_type: movementType,
          quantity: -qty,
          note: note || null,
        },
      ]);

    if (movementError) {
      setSaving(false);
      alert(
        "Zapis kretanja zaliha nije uspjelo / Stok hareket kaydı eklenemedi: " +
          movementError.message
      );
      return;
    }

    const { data: movementTotals, error: movementTotalError } = await supabase
      .from("stock_movements")
      .select("quantity")
      .eq("product_id", selectedProduct.id);

    if (movementTotalError) {
      setSaving(false);
      alert(
        "Ukupan iznos kretanja nije učitan / Hareket toplamı alınamadı: " +
          movementTotalError.message
      );
      return;
    }

    const totalMovement = (movementTotals || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const openingStock = Number(selectedProduct.opening_stock || 0);
    const newStock = openingStock + totalMovement;

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    setSaving(false);

    if (stockError) {
      alert("Ažuriranje zalihe nije uspjelo / Stok güncellenemedi: " + stockError.message);
      return;
    }

    alert("Izlaz zaliha zabilježen / Stok çıkışı kaydedildi ✅");

    setSelectedGroupId("");
    setSelectedProductId("");
    setQuantity(1);
    setReason("Hasarlı / Damaged");
    setNote("");

    await fetchProducts();
    await fetchMovements();
  }

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Izlaz zaliha / Stok Çıkışı
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Zabilježi smanjenja zaliha van prodaje. / Satış dışı stok düşüşlerini kaydet.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Novi izlaz zaliha / Yeni Stok Çıkışı
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Prvo odaberi grupu, zatim proizvod i smanji zalihu. / Önce grup seç, sonra ürün seç ve stoktan düş.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Grupa proizvoda / Ürün Grubu
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">Odaberi grupu / Grup seç</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Proizvod / Ürün
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={!selectedGroupId}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!selectedGroupId
                      ? "Prvo odaberi grupu / Önce grup seç"
                      : "Odaberi proizvod / Ürün seç"}
                  </option>
                  {filteredProductsByGroup.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Količina za oduzimanje / Düşülecek Adet
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Razlog / Sebep
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="Hasarlı / Damaged">Oštećeno / Hasarlı</option>
                  <option value="Kayıp / Lost">Izgubljeno / Kayıp</option>
                  <option value="Sayım Düzeltme / Adjustment">Korekcija / Sayım Düzeltme</option>
                  <option value="Showroom Kullanım / Showroom Use">Showroom upotreba / Showroom Kullanım</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Napomena / Not
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opciona napomena / İsteğe bağlı açıklama"
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Čuva se... / Kaydediliyor..."
                : "Smanji zalihu / Stoktan Düş"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Sažetak zaliha / Stok Özeti
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Trenutno stanje odabranog proizvoda. / Seçilen ürünün güncel durumu.
          </p>

          <div className="mt-6 space-y-4">
            <InfoCard
              title="Grupa / Grup"
              value={selectedGroup?.name || "-"}
            />
            <InfoCard
              title="Proizvod / Ürün"
              value={selectedProduct?.name || "-"}
            />
            <InfoCard
              title="Trenutna zaliha / Mevcut Stok"
              value={selectedProduct ? String(selectedProduct.stock) : "-"}
            />
            <InfoCard
              title="Nakon oduzimanja / Çıkış Sonrası"
              value={
                selectedProduct
                  ? String(Number(selectedProduct.stock || 0) - Number(quantity || 0))
                  : "-"
              }
              red
            />
            <InfoCard
              title="Razlog / Sebep"
              value={
                reason === "Hasarlı / Damaged"
                  ? "Oštećeno / Hasarlı"
                  : reason === "Kayıp / Lost"
                  ? "Izgubljeno / Kayıp"
                  : reason === "Sayım Düzeltme / Adjustment"
                  ? "Korekcija / Sayım Düzeltme"
                  : reason === "Showroom Kullanım / Showroom Use"
                  ? "Showroom upotreba / Showroom Kullanım"
                  : reason
              }
            />
            <InfoCard
              title="Prodajna cijena / Satış Fiyatı"
              value={
                selectedProduct
                  ? `€${Number(selectedProduct.price || 0).toFixed(2)}`
                  : "-"
              }
            />
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Istorija izlaza zaliha / Stok Çıkış Geçmişi
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Kretanja smanjenja zaliha van prodaje. / Satış dışı stok düşüş hareketleri.
          </p>
        </div>

        {loadingMovements ? (
          <div className="text-sm text-slate-400">Učitava se / Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Proizvod / Ürün</th>
                  <th className="py-3 text-left">Kretanje / İşlem</th>
                  <th className="py-3 text-center">Količina / Adet</th>
                  <th className="py-3 text-left">Napomena / Not</th>
                  <th className="py-3 text-center">Datum / Tarih</th>
                </tr>
              </thead>

              <tbody>
                {movements.slice(0, 20).map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-t border-slate-800 transition hover:bg-slate-800/30"
                  >
                    <td className="py-3">{movement.product_name || "-"}</td>
                    <td className="py-3">{movement.movement_type}</td>
                    <td className="py-3 text-center font-medium text-red-300">
                      {movement.quantity}
                    </td>
                    <td className="py-3">{movement.note || "-"}</td>
                    <td className="py-3 text-center text-slate-400">
                      {movement.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}

                {movements.length === 0 && (
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

function InfoCard({
  title,
  value,
  red,
}: {
  title: string;
  value: string;
  red?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-base font-medium ${red ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
