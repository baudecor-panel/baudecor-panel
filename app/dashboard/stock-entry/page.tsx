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
  default_supplier_id?: number | null;
};

type ProductGroup = {
  id: string;
  name: string;
};

type Supplier = {
  id: number;
  name: string;
  is_active?: boolean | null;
};

type StockMovement = {
  id: string;
  product_id: string;
  product_name: string;
  movement_type: string;
  quantity: number;
  note?: string | null;
  created_at: string;
  supplier_id?: number | null;
  unit_purchase_cost?: number | null;
  document_no?: string | null;
  document_date?: string | null;
};

export default function StockEntryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    await Promise.all([
      fetchGroups(),
      fetchSuppliers(),
      fetchProducts(),
      fetchMovements(),
    ]);
  }

  function getGroupNameFromRelation(relation?: ProductGroupRelation) {
    if (!relation) return "-";
    if (Array.isArray(relation)) {
      return relation[0]?.name || "-";
    }
    return relation.name || "-";
  }

  function getSupplierNameById(supplierId?: number | null) {
    if (!supplierId) return "-";
    return suppliers.find((supplier) => supplier.id === supplierId)?.name || "-";
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

  async function fetchSuppliers() {
    setLoadingSuppliers(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      alert("Tedarikçiler alınamadı / Suppliers could not be loaded");
      setLoadingSuppliers(false);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
    setLoadingSuppliers(false);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, stock, price, cost, opening_stock, is_active, group_id, default_supplier_id, product_groups(name)"
      )
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
      .select(
        "id, product_id, product_name, movement_type, quantity, note, created_at, supplier_id, unit_purchase_cost, document_no, document_date"
      )
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
    setSelectedSupplierId("");
    setPurchaseCost(0);
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);

    const product = products.find((p) => p.id === productId);
    if (product) {
      setPurchaseCost(Number(product.cost || 0));
      setSelectedSupplierId(
        product.default_supplier_id ? String(product.default_supplier_id) : ""
      );
    } else {
      setPurchaseCost(0);
      setSelectedSupplierId("");
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

  const selectedSupplier =
    suppliers.find((supplier) => String(supplier.id) === selectedSupplierId) || null;

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

  const recentPurchaseHistory = useMemo(() => {
    if (!selectedProductId) return [];
    return movements
      .filter((movement) => movement.product_id === selectedProductId)
      .slice(0, 8);
  }, [movements, selectedProductId]);

  async function handleSave() {
    if (!selectedGroupId) {
      alert("Lütfen ürün grubu seç / Please select a product group");
      return;
    }

    if (!selectedProductId) {
      alert("Lütfen ürün seç / Please select a product");
      return;
    }

    if (!selectedSupplierId) {
      alert("Lütfen tedarikçi seç / Please select a supplier");
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
      alert(
        "Seçilen ürün grup ile eşleşmiyor / Selected product does not match the selected group"
      );
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
      `Tedarikçi / Supplier: ${selectedSupplier?.name || "-"}`,
      `Alış fiyatı / Purchase cost: €${addedCostValue.toFixed(2)}`,
      `Yeni ortalama maliyet / New average cost: €${roundedWeightedCost.toFixed(2)}`,
      documentNo.trim() ? `Belge no / Document no: ${documentNo.trim()}` : "",
      documentDate ? `Belge tarihi / Document date: ${documentDate}` : "",
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
          supplier_id: Number(selectedSupplierId),
          unit_purchase_cost: addedCostValue,
          document_no: documentNo.trim() || null,
          document_date: documentDate || null,
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

    alert(
      "Stok eklendi, tedarikçi kaydedildi ve maliyet güncellendi / Stock added, supplier logged and cost updated ✅"
    );

    setSelectedGroupId("");
    setSelectedProductId("");
    setSelectedSupplierId("");
    setQuantity(1);
    setPurchaseCost(0);
    setDocumentNo("");
    setDocumentDate("");
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
          Mevcut aktif ürünlere yeni stok ekle, tedarikçiyi zorunlu kaydet ve maliyet
          geçmişini takip et. / Add new stock to active products, require supplier
          logging and track purchase cost history.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Yeni Stok Girişi / New Stock Entry
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Önce grup, sonra ürün seç; ardından tedarikçi ve alış bilgileriyle stoğu artır. /
              Select group first, then product, then increase stock with supplier and purchase details.
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

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Tedarikçi / Supplier
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                disabled={!selectedProductId || loadingSuppliers}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {!selectedProductId
                    ? "Önce ürün seç / Select product first"
                    : loadingSuppliers
                    ? "Tedarikçiler yükleniyor... / Loading suppliers..."
                    : "Tedarikçi seç / Select supplier"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Bu alan zorunludur. Geçmiş alım takibi için her stok girişinde firma kaydedilir. /
                This field is required. Supplier is logged on every stock entry for historical purchase tracking.
              </p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Belge No / Document No
                </label>
                <input
                  value={documentNo}
                  onChange={(e) => setDocumentNo(e.target.value)}
                  placeholder="Fatura / İrsaliye no"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Belge Tarihi / Document Date
                </label>
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
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
            Seçilen ürünün ve alım girişinin mevcut durumu. / Current status of the selected
            product and purchase entry.
          </p>

          <div className="mt-6 space-y-4">
            <InfoCard title="Grup / Group" value={selectedGroupData?.name || "-"} />
            <InfoCard title="Ürün / Product" value={selectedProduct?.name || "-"} />
            <InfoCard title="Tedarikçi / Supplier" value={selectedSupplier?.name || "-"} />
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
            <InfoCard
              title="Belge No / Document No"
              value={documentNo || "-"}
            />
            <InfoCard
              title="Belge Tarihi / Document Date"
              value={documentDate || "-"}
            />
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Maliyet Geçmişi / Cost History
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Son stok girişleri, tedarikçi ve alış maliyetleriyle birlikte gösterilir. /
            Recent stock entries are shown together with supplier and purchase cost.
          </p>
        </div>

        {loadingMovements ? (
          <div className="text-sm text-slate-400">
            Yükleniyor / Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Ürün / Product</th>
                  <th className="py-3 text-left">İşlem / Movement</th>
                  <th className="py-3 text-left">Tedarikçi / Supplier</th>
                  <th className="py-3 text-center">Adet / Quantity</th>
                  <th className="py-3 text-center">Alış / Purchase</th>
                  <th className="py-3 text-left">Belge No / Doc No</th>
                  <th className="py-3 text-center">Belge Tarihi / Doc Date</th>
                  <th className="py-3 text-left">Not / Note</th>
                  <th className="py-3 text-center">Kayıt Tarihi / Created</th>
                </tr>
              </thead>

              <tbody>
                {movements.slice(0, 30).map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-t border-slate-800 transition hover:bg-slate-800/30"
                  >
                    <td className="py-3">{movement.product_name || "-"}</td>
                    <td className="py-3">{movement.movement_type}</td>
                    <td className="py-3">{getSupplierNameById(movement.supplier_id) || "-"}</td>
                    <td className="py-3 text-center font-medium text-emerald-300">
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </td>
                    <td className="py-3 text-center">
                      {movement.unit_purchase_cost !== null &&
                      movement.unit_purchase_cost !== undefined
                        ? `€${Number(movement.unit_purchase_cost).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="py-3">{movement.document_no || "-"}</td>
                    <td className="py-3 text-center">{movement.document_date || "-"}</td>
                    <td className="py-3">{movement.note || "-"}</td>
                    <td className="py-3 text-center text-slate-400">
                      {movement.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}

                {movements.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Kayıt yok / No stock movements found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProduct && recentPurchaseHistory.length > 0 && (
        <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Seçili Ürün Son Alımlar / Selected Product Recent Purchases
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Seçili ürüne ait son girişler. / Recent entries for the selected product.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Tedarikçi / Supplier</th>
                  <th className="py-3 text-center">Adet / Quantity</th>
                  <th className="py-3 text-center">Alış / Purchase</th>
                  <th className="py-3 text-left">Belge No / Doc No</th>
                  <th className="py-3 text-center">Belge Tarihi / Doc Date</th>
                  <th className="py-3 text-center">Kayıt Tarihi / Created</th>
                </tr>
              </thead>
              <tbody>
                {recentPurchaseHistory.map((movement) => (
                  <tr key={movement.id} className="border-t border-slate-800">
                    <td className="py-3">{getSupplierNameById(movement.supplier_id)}</td>
                    <td className="py-3 text-center">{movement.quantity}</td>
                    <td className="py-3 text-center">
                      {movement.unit_purchase_cost !== null &&
                      movement.unit_purchase_cost !== undefined
                        ? `€${Number(movement.unit_purchase_cost).toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="py-3">{movement.document_no || "-"}</td>
                    <td className="py-3 text-center">{movement.document_date || "-"}</td>
                    <td className="py-3 text-center text-slate-400">
                      {movement.created_at?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
