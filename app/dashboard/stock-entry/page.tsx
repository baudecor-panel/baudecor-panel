"use client";

import { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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
  parent_product_id?: string | null;
  accessory_type?: string | null;
  parent_name?: string;
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
  const [quantity, setQuantity] = useState<number | "">("");
  const [purchaseCost, setPurchaseCost] = useState<number | "">("");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [reversingId, setReversingId] = useState("");

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
      alert("Grupe proizvoda nijesu učitane / Ürün grupları alınamadı");
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
      alert("Dobavljači nijesu učitani / Tedarikçiler alınamadı");
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
        "id, name, stock, price, cost, opening_stock, is_active, group_id, default_supplier_id, parent_product_id, accessory_type, product_groups(name)"
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      alert("Proizvodi nijesu učitani / Ürünler alınamadı");
      return;
    }

    const raw = ((data || []) as Product[]).map((product) => ({
      ...product,
      group_name: getGroupNameFromRelation(product.product_groups),
    }));

    const normalized = raw.map((product) => ({
      ...product,
      parent_name: product.parent_product_id
        ? raw.find((p) => p.id === product.parent_product_id)?.name || "-"
        : undefined,
    }));

    setProducts(normalized);
  }

  async function syncProductStock(productId: string) {
    const { data: movementsData, error: movementError } = await supabase
      .from("stock_movements")
      .select("quantity")
      .eq("product_id", productId);

    if (movementError) {
      throw new Error(
        "Stok hareket toplamı alınamadı / Could not load stock movement totals: " +
          movementError.message
      );
    }

    const product = products.find((p) => p.id === productId);
    const openingStock = Number(product?.opening_stock ?? 0);

    const totalMovement = (movementsData || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const newStock = openingStock + totalMovement;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", productId);

    if (updateError) {
      throw new Error(
        "Stok güncellenemedi / Stock update failed: " + updateError.message
      );
    }
  }

  async function handleReverseMovement(movement: StockMovement) {
    const confirmed = window.confirm(
      `Bu hareket geri alınacak.\n\nÜrün: ${movement.product_name}\nMiktar: +${movement.quantity}\n\nDevam edilsin mi? / Nastaviti?`
    );
    if (!confirmed) return;

    setReversingId(movement.id);

    try {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert([
          {
            product_id: movement.product_id,
            product_name: movement.product_name,
            movement_type: "Geri Alma / Reversal",
            quantity: -movement.quantity,
            note: `Geri alma: ${movement.movement_type} (${movement.created_at?.slice(0, 10)})`,
          },
        ]);

      if (movementError) {
        throw new Error(movementError.message);
      }

      await syncProductStock(movement.product_id);

      alert("Hareket geri alındı / Kretanje je poništeno ✅");
      await fetchMovements();
      await fetchProducts();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Geri alma başarısız / Poništavanje neuspješno"
      );
    } finally {
      setReversingId("");
    }
  }

  async function fetchMovements() {
    setLoadingMovements(true);

    const { data, error } = await supabase
      .from("stock_movements")
      .select(
        "id, product_id, product_name, movement_type, quantity, note, created_at, supplier_id, unit_purchase_cost, document_no, document_date"
      )
      .eq("movement_type", "Unos zaliha / Stok Girişi")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Kretanja zaliha nijesu učitana / Stok hareketleri alınamadı");
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
      setPurchaseCost(product.cost ? Number(product.cost) : "");
      setSelectedSupplierId(
        product.default_supplier_id ? String(product.default_supplier_id) : ""
      );
    } else {
      setPurchaseCost("");
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
      .filter(
        (movement) =>
          movement.product_id === selectedProductId &&
          movement.movement_type === "Unos zaliha / Stok Girişi"
      )
      .slice(0, 8);
  }, [movements, selectedProductId]);

  async function handleSave() {
    if (!selectedGroupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (!selectedProductId) {
      alert("Odaberi proizvod / Lütfen ürün seç");
      return;
    }

    if (!selectedSupplierId) {
      alert("Odaberi dobavljača / Lütfen tedarikçi seç");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
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
      alert(
        "Odabrani proizvod se ne poklapa sa grupom / Seçilen ürün grup ile eşleşmiyor"
      );
      return;
    }

    if (Number(purchaseCost) < 0) {
      alert("Kupovna cijena mora biti 0 ili veća / Alış fiyatı 0 veya daha büyük olmalı");
      return;
    }

    setSaving(true);

    const currentStockValue = Number(selectedProduct.stock || 0);
    const currentCostValue = Number(selectedProduct.cost || 0);
    const addedQuantityValue = Number(quantity || 0);
    const addedCostValue = Number(purchaseCost || 0);

    const newStock = currentStockValue + addedQuantityValue;
    const newWeightedCost =
      newStock > 0
        ? (currentStockValue * currentCostValue + addedQuantityValue * addedCostValue) / newStock
        : 0;

    const roundedWeightedCost = Number(newWeightedCost.toFixed(2));

    const movementNoteParts = [
      note?.trim() || "",
      `Dobavljač / Tedarikçi: ${selectedSupplier?.name || "-"}`,
      `Kupovna cijena / Alış fiyatı: €${addedCostValue.toFixed(2)}`,
      `Novi prosječni trošak / Yeni ortalama maliyet: €${roundedWeightedCost.toFixed(2)}`,
      documentNo.trim() ? `Broj dokumenta / Belge no: ${documentNo.trim()}` : "",
      documentDate ? `Datum dokumenta / Belge tarihi: ${documentDate.toISOString().slice(0, 10)}` : "",
    ].filter(Boolean);

    try {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert([
          {
            product_id: selectedProduct.id,
            product_name: selectedProduct.name,
            movement_type: "Unos zaliha / Stok Girişi",
            quantity: addedQuantityValue,
            note: movementNoteParts.join(" | "),
            supplier_id: Number(selectedSupplierId),
            unit_purchase_cost: addedCostValue,
            document_no: documentNo.trim() || null,
            document_date: documentDate || null,
          },
        ]);

      if (movementError) {
        throw new Error(
          "Stok hareket kaydı eklenemedi / Movement log failed: " + movementError.message
        );
      }

      await syncProductStock(selectedProduct.id);

      const { error: costError } = await supabase
        .from("products")
        .update({ cost: roundedWeightedCost })
        .eq("id", selectedProduct.id);

      if (costError) {
        throw new Error(
          "Maliyet güncellenemedi / Cost update failed: " + costError.message
        );
      }

      alert(
        "Zaliha dodata, dobavljač zabilježen i trošak ažuriran / Stok eklendi, tedarikçi kaydedildi ve maliyet güncellendi ✅"
      );
    } catch (error) {
      setSaving(false);
      alert(error instanceof Error ? error.message : "Stok girişi başarısız");
      return;
    }

    setSaving(false);

    setSelectedGroupId("");
    setSelectedProductId("");
    setSelectedSupplierId("");
    setQuantity("");
    setPurchaseCost("");
    setDocumentNo("");
    setDocumentDate(null);
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
          Unos zaliha / Stok Girişi
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Dodaj novu zalihu postojećim aktivnim proizvodima, obavezno zabilježi dobavljača i prati istoriju troškova. / Mevcut aktif ürünlere yeni stok ekle, tedarikçiyi zorunlu kaydet ve maliyet geçmişini takip et.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Novi unos zaliha / Yeni Stok Girişi
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Prvo odaberi grupu, zatim proizvod; nakon toga povećaj zalihu uz dobavljača i podatke o kupovini. / Önce grup, sonra ürün seç; ardından tedarikçi ve alış bilgileriyle stoğu artır.
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
                  onChange={(e) => handleProductChange(e.target.value)}
                  disabled={!selectedGroupId}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!selectedGroupId
                      ? "Prvo odaberi grupu / Önce grup seç"
                      : "Odaberi proizvod / Ürün seç"}
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
                Dobavljač / Tedarikçi
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                disabled={!selectedProductId || loadingSuppliers}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {!selectedProductId
                    ? "Prvo odaberi proizvod / Önce ürün seç"
                    : loadingSuppliers
                    ? "Dobavljači se učitavaju... / Tedarikçiler yükleniyor..."
                    : "Odaberi dobavljača / Tedarikçi seç"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Ovo polje je obavezno. Radi praćenja prethodnih kupovina, firma se bilježi pri svakom unosu zaliha. / Bu alan zorunludur. Geçmiş alım takibi için her stok girişinde firma kaydedilir.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Količina za dodavanje / Eklenecek Adet
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  placeholder="0"
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Kupovna cijena / Alış Fiyatı
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={purchaseCost}
                  placeholder="0.00"
                  onChange={(e) => setPurchaseCost(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Broj dokumenta / Belge No
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
                  Datum dokumenta / Belge Tarihi
                </label>
                <DatePicker
                  selected={documentDate}
                  onChange={(date: Date | null) => setDocumentDate(date)}
                  dateFormat="dd.MM.yyyy"
                  placeholderText="Tarih seçin..."
                  isClearable
                  wrapperClassName="w-full"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Napomena / Not
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opciona napomena / İsteğe bağlı not"
                rows={4}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Čuva se... / Kaydediliyor..." : "Dodaj u zalihu / Stoğa Ekle"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Sažetak zaliha / Stok Özeti
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Trenutno stanje odabranog proizvoda i unosa kupovine. / Seçilen ürünün ve alım girişinin mevcut durumu.
          </p>

          <div className="mt-6 space-y-4">
            <InfoCard title="Grupa / Grup" value={selectedGroupData?.name || "-"} />
            <InfoCard title="Proizvod / Ürün" value={selectedProduct?.name || "-"} />
            {selectedProduct?.parent_product_id && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                <p className="text-xs uppercase tracking-wide text-violet-400">
                  Aksesuar / Accessory
                </p>
                <p className="mt-1 text-sm font-medium text-white">
                  ↳ {selectedProduct.parent_name || "-"}
                </p>
                {selectedProduct.accessory_type && (
                  <p className="mt-0.5 text-xs text-violet-300">{selectedProduct.accessory_type}</p>
                )}
              </div>
            )}
            <InfoCard title="Dobavljač / Tedarikçi" value={selectedSupplier?.name || "-"} />
            <InfoCard
              title="Trenutna zaliha / Mevcut Stok"
              value={selectedProduct ? String(selectedProduct.stock) : "-"}
            />
            <InfoCard
              title="Nova zaliha / Yeni Stok"
              value={selectedProduct ? String(newStockPreview) : "-"}
              green
            />
            <InfoCard
              title="Prodajna cijena / Satış Fiyatı"
              value={
                selectedProduct
                  ? `€${Number(selectedProduct.price || 0).toFixed(2)}`
                  : "-"
              }
            />
            <InfoCard
              title="Trenutni trošak / Mevcut Maliyet"
              value={
                selectedProduct
                  ? `€${Number(selectedProduct.cost || 0).toFixed(2)}`
                  : "-"
              }
            />
            <InfoCard
              title="Početna zaliha / Açılış Stoku"
              value={selectedProduct ? String(currentOpeningStock) : "-"}
            />
            <InfoCard
              title="Nova kupovna cijena / Yeni Alış"
              value={`€${Number(purchaseCost || 0).toFixed(2)}`}
            />
            <InfoCard
              title="Novi prosječni trošak / Yeni Ortalama Maliyet"
              value={
                selectedProduct
                  ? `€${Number(weightedAverageCostPreview || 0).toFixed(2)}`
                  : "-"
              }
              green
            />
            <InfoCard
              title="Broj dokumenta / Belge No"
              value={documentNo || "-"}
            />
            <InfoCard
              title="Datum dokumenta / Belge Tarihi"
              value={documentDate ? documentDate.toLocaleDateString("tr-TR") : "-"}
            />
          </div>
        </aside>
      </div>

      <section className="mt-10 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Istorija troškova / Maliyet Geçmişi
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Posljednji unosi zaliha prikazuju se zajedno sa dobavljačem i kupovnim troškom. / Son stok girişleri, tedarikçi ve alış maliyetleriyle birlikte gösterilir.
          </p>
        </div>

        {loadingMovements ? (
          <div className="text-sm text-slate-400">
            Učitava se / Yükleniyor...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Proizvod / Ürün</th>
                  <th className="py-3 text-left">Kretanje / İşlem</th>
                  <th className="py-3 text-left">Dobavljač / Tedarikçi</th>
                  <th className="py-3 text-center">Količina / Adet</th>
                  <th className="py-3 text-center">Kupovina / Alış</th>
                  <th className="py-3 text-left">Broj dok. / Belge No</th>
                  <th className="py-3 text-center">Datum dok. / Belge Tarihi</th>
                  <th className="py-3 text-left">Napomena / Not</th>
                  <th className="py-3 text-center">Datum unosa / Kayıt Tarihi</th>
                  <th className="py-3 text-center">İşlem / Akcija</th>
                </tr>
              </thead>

              <tbody>
                {movements.slice(0, 30).map((movement) => {
                  const isReversing = reversingId === movement.id;
                  return (
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
                    <td className="py-3 text-center">
                      <button
                        onClick={() => handleReverseMovement(movement)}
                        disabled={isReversing || !!reversingId}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isReversing ? "..." : "Geri Al / Poništi"}
                      </button>
                    </td>
                  </tr>
                  );
                })}

                {movements.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Nema zapisa / Kayıt yok
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
              Posljednje kupovine odabranog proizvoda / Seçili Ürün Son Alımlar
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Posljednji unosi za odabrani proizvod. / Seçili ürüne ait son girişler.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Dobavljač / Tedarikçi</th>
                  <th className="py-3 text-center">Količina / Adet</th>
                  <th className="py-3 text-center">Kupovina / Alış</th>
                  <th className="py-3 text-left">Broj dok. / Belge No</th>
                  <th className="py-3 text-center">Datum dok. / Belge Tarihi</th>
                  <th className="py-3 text-center">Datum unosa / Kayıt Tarihi</th>
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
