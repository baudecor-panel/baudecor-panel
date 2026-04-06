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

export default function StockEntryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchaseCost, setPurchaseCost] = useState(0);
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
      alert("Ürün grupları alınamadı / Product groups could not be loaded");
      return;
    }

    setGroups((data || []) as ProductGroup[]);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock, price, cost, opening_stock, is_active, group_id, product_groups(name)")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      alert("Ürünler alınamadı / Products could not be loaded");
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
      alert("Stok hareketleri alınamadı / Stock movements could not be loaded");
      setLoadingMovements(false);
      return;
    }

    setMovements((data || []) as StockMovement[]);
    setLoadingMovements(false);
  }

  function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedProductId("");
    setPurchaseCost(0);
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);

    const product = products.find((p) => p.id === productId);
    if (product) {
      setPurchaseCost(Number(product.cost || 0));
    } else {
      setPurchaseCost(0);
    }
  }

  const filteredProductsByGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return products.filter((product) => product.group_id === selectedGroupId);
  }, [products, selectedGroupId]);

  const selectedGroupData = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || null;

  const currentStock = Number(selectedProduct?.stock || 0);
  const currentCost = Number(selectedProduct?.cost || 0);
  const currentOpeningStock = Number(selectedProduct?.opening_stock || 0);
  const addedQuantity = Number(quantity || 0);
  const addedCost = Number(purchaseCost || 0);
  const newStockPreview = selectedProduct ? currentStock + addedQuantity : 0;

  const weightedAverageCostPreview =
    selectedProduct && currentStock + addedQuantity > 0
      ? (
          (currentStock * currentCost + addedQuantity * addedCost) /
          (currentStock + addedQuantity)
        )
      : 0;

  async function handleSave() {
    if (!selectedGroupId) {
      alert("Lütfen ürün grubu seç / Please select a product group");
      return;
    }

    if (!selectedProductId) {
      alert("Lütfen ürün seç / Please select a product");
      return;
    }

    if (!quantity || quantity <= 0) {
      alert("Lütfen geçerli adet gir / Please enter a valid quantity");
      return;
    }

    if (!selectedProduct) {
      alert("Ürün bulunamadı / Product not found");
      return;
    }

    if (!selectedProduct.group_id) {
      alert("Bu ürüne grup atanmadı / This product has no group assigned");
      return;
    }

    if (selectedProduct.group_id !== selectedGroupId) {
      alert("Seçilen ürün grup ile eşleşmiyor / Selected product does not match the selected group");
      return;
    }

    if (purchaseCost < 0) {
      alert("Alış fiyatı 0 veya daha büyük olmalı / Purchase cost must be 0 or greater");
      return;
    }

    setSaving(true);

    const currentStockValue = Number(selectedProduct.stock || 0);
    const currentCostValue = Number(selectedProduct.cost || 0);
    const currentOpeningStockValue = Number(selectedProduct.opening_stock || 0);
    const addedQuantityValue = Number(quantity || 0);
    const addedCostValue = Number(purchaseCost || 0);

    const newStock = currentStockValue + addedQuantityValue;
    const newWeightedCost =
      newStock > 0
        ? (
            (currentStockValue * currentCostValue +
              addedQuantityValue * addedCostValue) /
            newStock
          )
        : 0;

    const roundedWeightedCost = Number(newWeightedCost.toFixed(2));

    const { error: stockError } = await supabase
      .from("products")
      .update({
        stock: newStock,
        cost: roundedWeightedCost,
        opening_stock: currentOpeningStockValue,
      })
      .eq("id", selectedProduct.id);

    if (stockError) {
      setSaving(false);
      alert("Stok güncellenemedi / Stock update failed: " + stockError.message);
      return;
    }

    const movementNoteParts = [
      note?.trim() || "",
      `Alış fiyatı / Purchase cost: €${addedCostValue.toFixed(2)}`,
      `Yeni ortalama maliyet / New average cost: €${roundedWeightedCost.toFixed(2)}`,
    ].filter(Boolean);

    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert([
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          movement_type: "Stock Entry / Stok Girişi",
          quantity: addedQuantityValue,
          note: movementNoteParts.join(" | "),
        },
      ]);

    setSaving(false);

    if (movementError) {
      alert(
        "Stok hareket kaydı eklenemedi / Stock movement log failed: " +
          movementError.message
      );
      return;
    }

    alert("Stok eklendi ve maliyet güncellendi / Stock added and cost updated ✅");

    setSelectedGroupId("");
    setSelectedProductId("");
    setQuantity(1);
    setPurchaseCost(0);
    setNote("");

    await fetchProducts();
    await fetchMovements();
  }

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Stok Girişi / Stock Entry
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Mevcut aktif ürünlere yeni stok ekle ve hareket geçmişini takip et. / Add
          new stock to active products and track movement history.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Yeni Stok Girişi / New Stock Entry
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Önce grup, sonra ürün seç; ardından stoğu artır. / Select group
              first, then product, then increase stock.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Ürün Grubu / Product Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">Grup seç / Select group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Ürün / Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  disabled={!selectedGroupId}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!selectedGroupId
                      ? "Önce grup seç / Select group first"
                      : "Ürün seç / Select product"}
                  </option>
                  {filteredProductsByGroup.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Eklenecek Adet / Quantity to Add
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
                  Alış Fiyatı / Purchase Cost
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Not / Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="İsteğe bağlı not / Optional note"
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor... / Saving..." : "Stoğa Ekle / Add to Stock"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Stok Özeti / Stock Summary
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Seçilen ürünün mevcut durumu. / Current status of the selected
            product.
          </p>

          <div className="mt-6 space-y-4">
            <InfoCard
              title="Grup / Group"
              value={selectedGroupData?.name || "-"}
            />
            <InfoCard
              title="Ürün / Product"
              value={selectedProduct?.name || "-"}
            />
            <InfoCard
              title="Mevcut Stok / Current Stock"
              value={selectedProduct ? String(selectedProduct.stock) : "-"}
            />
            <InfoCard
              title="Yeni Stok / New Stock"
              value={selectedProduct ? String(newStockPreview) : "-"}
              green
            />
            <InfoCard
              title="Satış Fiyatı / Sale Price"
              value={
                selectedProduct
                  ? `€${Number(selectedProduct.price || 0).toFixed(2)}`
                  : "-"
              }
            />
            <InfoCard
              title="Mevcut Maliyet / Current Cost"
              value={
                selectedProduct
                  ? `€${Number(selectedProduct.cost || 0).toFixed(2)}`
                  : "-"
              }
            />
            <InfoCard
              title="Açılış Stoku / Opening Stock"
              value={selectedProduct ? String(currentOpeningStock) : "-"}
            />
            <InfoCard
              title="Yeni Alış / New Purchase Cost"
              value={`€${Number(purchaseCost || 0).toFixed(2)}`}
            />
            <InfoCard
              title="Yeni Ortalama Maliyet / New Average Cost"
              value={
                selectedProduct
                  ? `€${Number(weightedAverageCostPreview || 0).toFixed(2)}`
                  : "-"
              }
              green
            />
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Stok Hareketleri / Stock Movements
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Son stok giriş ve hareket kayıtları. / Recent stock entry and
            movement records.
          </p>
        </div>

        {loadingMovements ? (
          <div className="text-sm text-slate-400">
            Yükleniyor / Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Ürün / Product</th>
                  <th className="py-3 text-left">İşlem / Movement</th>
                  <th className="py-3 text-center">Adet / Quantity</th>
                  <th className="py-3 text-left">Not / Note</th>
                  <th className="py-3 text-center">Tarih / Date</th>
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
                    <td className="py-3 text-center font-medium text-emerald-300">
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
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
                      Kayıt yok / No stock movements found
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
  green,
}: {
  title: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p
        className={`mt-2 text-base font-medium ${
          green ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}