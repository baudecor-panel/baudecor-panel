"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

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
  price: number;
  cost: number;
  stock: number;
  opening_stock?: number | null;
  minimum_stock?: number | null;
  group_id?: string | null;
  group_name?: string;
  is_active?: boolean;
  product_groups?: ProductGroupRelation;
  default_supplier_id?: number | null;
  supplier_name?: string;
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
  id?: string;
  product_id?: string | null;
  product_name?: string | null;
  movement_type?: string | null;
  quantity?: number | null;
  note?: string | null;
  created_at?: string | null;
};

type ProductStockMeta = {
  movementCount: number;
  movementBalance: number;
  lastMovementAt: string | null;
};

type ViewFilter = "active" | "inactive" | "all";
type StockFilter = "all" | "normal" | "critical" | "out";
type MarginFilter = "all" | "profit" | "loss";

const EMPTY_STOCK_META: ProductStockMeta = {
  movementCount: 0,
  movementBalance: 0,
  lastMovementAt: null,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockMetaMap, setStockMetaMap] = useState<Record<string, ProductStockMeta>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active");
  const [groupFilter, setGroupFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [marginFilter, setMarginFilter] = useState<MarginFilter>("all");

  const [editingProductId, setEditingProductId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editCost, setEditCost] = useState(0);
  const [editGroupId, setEditGroupId] = useState("");
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editMinimumStock, setEditMinimumStock] = useState(5);
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState("");

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedMovementProduct, setSelectedMovementProduct] = useState<Product | null>(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [selectedMovements, setSelectedMovements] = useState<StockMovement[]>([]);

  useEffect(() => {
    initializePage();
  }, []);

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

  async function initializePage() {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchSuppliers(), fetchProductsWithMeta()]);
    setLoading(false);
  }

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([fetchGroups(), fetchSuppliers(), fetchProductsWithMeta()]);
    setRefreshing(false);
  }

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
      .order("name", { ascending: true });

    if (error) {
      alert("Dobavljači nijesu učitani / Tedarikçiler alınamadı");
      setLoadingSuppliers(false);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
    setLoadingSuppliers(false);
  }

  async function fetchProductsWithMeta() {
    const [
      { data: productData, error: productError },
      { data: movementData, error: movementError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, price, cost, stock, opening_stock, minimum_stock, is_active, group_id, default_supplier_id, product_groups(name)"
        )
        .order("name", { ascending: true }),
      supabase.from("stock_movements").select("product_id, quantity, created_at"),
    ]);

    if (productError) {
      alert("Proizvodi nijesu učitani / Ürünler alınamadı");
      return;
    }

    if (movementError) {
      alert("Kretanja zalihe nijesu učitana / Stok hareketleri alınamadı");
      return;
    }

    const normalizedProducts = ((productData || []) as Product[]).map((product) => ({
      ...product,
      group_name: getGroupNameFromRelation(product.product_groups),
      supplier_name: getSupplierNameById(product.default_supplier_id),
      is_active: product.is_active ?? true,
      opening_stock: Number(product.opening_stock ?? 0),
      minimum_stock: Number(product.minimum_stock ?? 5),
    }));

    const nextStockMetaMap: Record<string, ProductStockMeta> = {};

    ((movementData || []) as StockMovement[]).forEach((movement) => {
      const productId = movement.product_id || "";
      if (!productId) return;

      const current = nextStockMetaMap[productId] || { ...EMPTY_STOCK_META };
      const quantity = Number(movement.quantity || 0);
      const createdAt = movement.created_at || null;

      const nextLastMovementAt = !current.lastMovementAt
        ? createdAt
        : createdAt && createdAt > current.lastMovementAt
          ? createdAt
          : current.lastMovementAt;

      nextStockMetaMap[productId] = {
        movementCount: current.movementCount + 1,
        movementBalance: current.movementBalance + quantity,
        lastMovementAt: nextLastMovementAt,
      };
    });

    setProducts(normalizedProducts);
    setStockMetaMap(nextStockMetaMap);
  }

  function startEdit(product: Product) {
    setEditingProductId(product.id);
    setEditName(product.name || "");
    setEditPrice(Number(product.price || 0));
    setEditCost(Number(product.cost || 0));
    setEditGroupId(product.group_id || "");
    setEditSupplierId(product.default_supplier_id ? String(product.default_supplier_id) : "");
    setEditMinimumStock(Number(product.minimum_stock || 5));
  }

  function cancelEdit() {
    setEditingProductId("");
    setEditName("");
    setEditPrice(0);
    setEditCost(0);
    setEditGroupId("");
    setEditSupplierId("");
    setEditMinimumStock(5);
  }

  async function saveEdit() {
    if (!editingProductId) return;

    if (!editName.trim()) {
      alert("Unesi naziv proizvoda / Lütfen ürün adı gir");
      return;
    }

    if (!editGroupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (Number(editPrice) < 0) {
      alert("Unesi ispravnu prodajnu cijenu / Lütfen geçerli satış fiyatı gir");
      return;
    }

    if (Number(editCost) < 0) {
      alert("Unesi ispravan trošak / Lütfen geçerli maliyet gir");
      return;
    }

    if (Number(editMinimumStock) < 0) {
      alert("Unesi ispravnu minimalnu zalihu / Lütfen geçerli minimum stok gir");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("products")
      .update({
        name: editName.trim(),
        price: Number(editPrice),
        cost: Number(editCost),
        group_id: editGroupId,
        default_supplier_id: editSupplierId ? Number(editSupplierId) : null,
        minimum_stock: Number(editMinimumStock),
      })
      .eq("id", editingProductId);

    setSavingEdit(false);

    if (error) {
      alert("Proizvod nije ažuriran / Ürün güncellenemedi: " + error.message);
      return;
    }

    alert("Proizvod je ažuriran / Ürün güncellendi ✅");

    cancelEdit();
    await fetchProductsWithMeta();
  }

  async function toggleActive(product: Product) {
    const nextValue = !(product.is_active ?? true);

    const confirmText = nextValue
      ? "Ovaj proizvod će ponovo biti aktivan. Da li želiš nastaviti? / Bu ürün tekrar aktif olacak. Devam edilsin mi?"
      : "Ovaj proizvod će biti pasiviziran. Stari zapisi ostaju, ali ne bi trebalo da se koristi u novim işlemler. Da li želiš nastaviti? / Bu ürün pasife alınacak. Geçmiş kayıtlar korunur ama yeni işlemlerde kullanılmamalı. Devam edilsin mi?";

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    setActionLoadingId(product.id);

    const { error } = await supabase
      .from("products")
      .update({ is_active: nextValue })
      .eq("id", product.id);

    setActionLoadingId("");

    if (error) {
      alert("Status nije ažuriran / Durum güncellenemedi: " + error.message);
      return;
    }

    await fetchProductsWithMeta();
  }

  async function canDeleteProduct(product: Product) {
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id")
      .eq("product_name", product.name)
      .limit(1);

    if (salesError) {
      return {
        ok: false,
        reason: "Provjera prodaje nije uspjela / Satış kontrolü yapılamadı",
      };
    }

    if ((salesData || []).length > 0) {
      return {
        ok: false,
        reason:
          "Ovaj proizvod se ne može obrisati jer se koristi u prodajnim zapisima. Pasiviziraj ga / Bu ürün satış kayıtlarında kullanıldığı için silinemez. Pasife alın.",
      };
    }

    const { data: movementData, error: movementError } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("product_id", product.id)
      .limit(1);

    if (movementError) {
      return {
        ok: false,
        reason: "Provjera kretanja zalihe nije uspjela / Stok hareket kontrolü yapılamadı",
      };
    }

    if ((movementData || []).length > 0) {
      return {
        ok: false,
        reason:
          "Ovaj proizvod se ne može obrisati jer se koristi u kretanjima zalihe. Pasiviziraj ga / Bu ürün stok hareketlerinde kullanıldığı için silinemez. Pasife alın.",
      };
    }

    return { ok: true, reason: "" };
  }

  async function deleteProduct(product: Product) {
    const firstConfirm = window.confirm(
      `Ovaj proizvod će biti obrisan: ${product.name}\n\nDa li si siguran? / Bu ürün silinecek.\n\nEmin misin?`
    );

    if (!firstConfirm) return;

    setActionLoadingId(product.id);

    const check = await canDeleteProduct(product);

    if (!check.ok) {
      setActionLoadingId("");
      alert(check.reason);
      return;
    }

    const secondConfirm = window.confirm(
      `Izgleda da ovaj proizvod nikada nije korišćen i biće trajno obrisan.\n\n${product.name}\n\nDa li želiš nastaviti? / Bu ürün hiç kullanılmamış görünüyor ve kalıcı olarak silinecek.\n\nDevam edilsin mi?`
    );

    if (!secondConfirm) {
      setActionLoadingId("");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", product.id);

    setActionLoadingId("");

    if (error) {
      alert("Proizvod nije obrisan / Ürün silinemedi: " + error.message);
      return;
    }

    if (editingProductId === product.id) {
      cancelEdit();
    }

    alert("Proizvod je obrisan / Ürün silindi ✅");
    await fetchProductsWithMeta();
  }

  async function openMovementHistory(product: Product) {
    setSelectedMovementProduct(product);
    setMovementModalOpen(true);
    setMovementLoading(true);
    setSelectedMovements([]);

    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, product_id, product_name, movement_type, quantity, note, created_at")
      .eq("product_id", product.id)
      .order("created_at", { ascending: false });

    setMovementLoading(false);

    if (error) {
      alert("Istorija kretanja nije učitana / Hareket geçmişi alınamadı");
      return;
    }

    setSelectedMovements((data || []) as StockMovement[]);
  }

  function closeMovementHistory() {
    setMovementModalOpen(false);
    setSelectedMovementProduct(null);
    setSelectedMovements([]);
    setMovementLoading(false);
  }

  function getProductStockMeta(productId: string) {
    return stockMetaMap[productId] || EMPTY_STOCK_META;
  }

  function getCalculatedStock(product: Product) {
    const openingStock = Number(product.opening_stock ?? 0);
    const movementBalance = getProductStockMeta(product.id).movementBalance;
    return openingStock + movementBalance;
  }

  function getStockDiff(product: Product) {
    const recorded = Number(product.stock || 0);
    const calculated = getCalculatedStock(product);
    return recorded - calculated;
  }

  function getStockStatus(stock: number, minimumStock: number): StockFilter {
    if (stock <= 0) return "out";
    if (stock <= minimumStock) return "critical";
    return "normal";
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("tr-TR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products
      .filter((product) => {
        const active = product.is_active ?? true;
        if (viewFilter === "active") return active;
        if (viewFilter === "inactive") return !active;
        return true;
      })
      .filter((product) => {
        if (groupFilter === "all") return true;
        return product.group_id === groupFilter;
      })
      .filter((product) => {
        if (supplierFilter === "all") return true;
        if (supplierFilter === "none") return !product.default_supplier_id;
        return String(product.default_supplier_id || "") === supplierFilter;
      })
      .filter((product) => {
        if (stockFilter === "all") return true;
        return getStockStatus(
          getCalculatedStock(product),
          Number(product.minimum_stock || 5)
        ) === stockFilter;
      })
      .filter((product) => {
        const margin = Number(product.price || 0) - Number(product.cost || 0);
        if (marginFilter === "profit") return margin >= 0;
        if (marginFilter === "loss") return margin < 0;
        return true;
      })
      .filter((product) => {
        const productName = (product.name || "").toLowerCase();
        const groupName = (product.group_name || "").toLowerCase();
        const supplierName = (product.supplier_name || "").toLowerCase();
        return productName.includes(q) || groupName.includes(q) || supplierName.includes(q);
      });
  }, [products, search, viewFilter, groupFilter, supplierFilter, stockFilter, marginFilter, stockMetaMap, suppliers]);

  function exportFilteredStock() {
    const rows = filteredProducts.map((p) => {
      const recordedStock = Number(p.stock || 0);
      const calculatedStock = getCalculatedStock(p);
      const openingStock = Number(p.opening_stock ?? 0);
      const cost = Number(p.cost || 0);
      const price = Number(p.price || 0);
      const margin = price - cost;
      const diff = recordedStock - calculatedStock;
      const stockMeta = getProductStockMeta(p.id);

      return {
        "Grupa": p.group_name || "-",
        "Proizvod": p.name,
        "Dobavljač": p.supplier_name || "-",
        "Početna zaliha": openingStock,
        "Zabilježena zaliha": recordedStock,
        "Izračunata zaliha": calculatedStock,
        "Minimalna zaliha": Number(p.minimum_stock || 5),
        "Razlika": diff,
        "Status":
          calculatedStock <= 0
            ? "Nema zalihe / Stok Yok"
            : calculatedStock <= Number(p.minimum_stock || 5)
            ? "Kritično / Kritik"
            : "Normalno / Normal",
        "Prodajna cijena (€)": price,
        "Trošak (€)": cost,
        "Marža (€)": margin,
        "Trošak zalihe (€)": calculatedStock * cost,
        "Prodajna vrijednost (€)": calculatedStock * price,
        "Potencijalna dobit (€)": calculatedStock * margin,
        "Broj kretanja": stockMeta.movementCount,
        "Saldo kretanja": stockMeta.movementBalance,
        "Zadnje kretanje": formatDateTime(stockMeta.lastMovementAt),
        "Aktivnost": (p.is_active ?? true) ? "Aktivno / Aktif" : "Pasivno / Pasif",
      };
    });

    const totalOpening = rows.reduce((sum, row) => sum + Number(row["Početna zaliha"] || 0), 0);
    const totalRecorded = rows.reduce((sum, row) => sum + Number(row["Zabilježena zaliha"] || 0), 0);
    const totalCalculated = rows.reduce((sum, row) => sum + Number(row["Izračunata zaliha"] || 0), 0);
    const totalMinimum = rows.reduce((sum, row) => sum + Number(row["Minimalna zaliha"] || 0), 0);
    const totalDiff = rows.reduce((sum, row) => sum + Number(row["Razlika"] || 0), 0);
    const totalStockCost = rows.reduce((sum, row) => sum + Number(row["Trošak zalihe (€)"] || 0), 0);
    const totalSaleValue = rows.reduce((sum, row) => sum + Number(row["Prodajna vrijednost (€)"] || 0), 0);
    const totalProfit = rows.reduce((sum, row) => sum + Number(row["Potencijalna dobit (€)"] || 0), 0);
    const totalMovements = rows.reduce((sum, row) => sum + Number(row["Broj kretanja"] || 0), 0);
    const totalMovementBalance = rows.reduce((sum, row) => sum + Number(row["Saldo kretanja"] || 0), 0);

    rows.push({
      "Grupa": "",
      "Proizvod": "UKUPNO / TOPLAM",
      "Dobavljač": "",
      "Početna zaliha": totalOpening,
      "Zabilježena zaliha": totalRecorded,
      "Izračunata zaliha": totalCalculated,
      "Minimalna zaliha": totalMinimum,
      "Razlika": totalDiff,
      "Status": "-",
      "Prodajna cijena (€)": "",
      "Trošak (€)": "",
      "Marža (€)": "",
      "Trošak zalihe (€)": totalStockCost,
      "Prodajna vrijednost (€)": totalSaleValue,
      "Potencijalna dobit (€)": totalProfit,
      "Broj kretanja": totalMovements,
      "Saldo kretanja": totalMovementBalance,
      "Zadnje kretanje": "",
      "Aktivnost": "",
    } as any);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 22 },
      { wch: 12 },
    ];

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    ws["!autofilter"] = {
      ref: ws["!ref"] || "A1",
    };

    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const headerFill = "1E293B";
    const headerFont = "FFFFFF";
    const totalFill = "D9EAF7";
    const totalFont = "111827";
    const borderColor = "94A3B8";

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        font: { bold: true, color: { rgb: headerFont } },
        fill: { fgColor: { rgb: headerFill } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: borderColor } },
          bottom: { style: "thin", color: { rgb: borderColor } },
          left: { style: "thin", color: { rgb: borderColor } },
          right: { style: "thin", color: { rgb: borderColor } },
        },
      };
    }

    for (let row = 1; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!ws[cellAddress]) continue;

        const isTotalRow = row === range.e.r;

        ws[cellAddress].s = {
          font: isTotalRow ? { bold: true, color: { rgb: totalFont } } : {},
          fill: isTotalRow ? { fgColor: { rgb: totalFill } } : undefined,
          alignment: {
            horizontal: col <= 2 ? "left" : "center",
            vertical: "center",
          },
          border: {
            top: { style: "thin", color: { rgb: borderColor } },
            bottom: { style: "thin", color: { rgb: borderColor } },
            left: { style: "thin", color: { rgb: borderColor } },
            right: { style: "thin", color: { rgb: borderColor } },
          },
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, "Stvarna Zaliha");

    const viewSuffix =
      viewFilter === "active" ? "aktivno" : viewFilter === "inactive" ? "pasivno" : "sve";

    const groupSuffix =
      groupFilter === "all"
        ? "sve-grupe"
        : (groups.find((group) => group.id === groupFilter)?.name || "grupa")
            .toLowerCase()
            .replaceAll(" ", "-");

    XLSX.writeFile(wb, `stvarna-zaliha-${viewSuffix}-${groupSuffix}.xlsx`);
  }

  const totalProducts = products.length;

  const activeProductsCount = useMemo(() => {
    return products.filter((product) => (product.is_active ?? true) === true).length;
  }, [products]);

  const inactiveProductsCount = useMemo(() => {
    return products.filter((product) => (product.is_active ?? true) === false).length;
  }, [products]);

  const productsWithSupplierCount = useMemo(() => {
    return products.filter((product) => !!product.default_supplier_id).length;
  }, [products]);

  const totalCalculatedStock = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getCalculatedStock(product), 0);
  }, [products, stockMetaMap]);

  const criticalStockCount = useMemo(() => {
    return products.filter((product) => {
      const calculatedStock = getCalculatedStock(product);
      const minimumStock = Number(product.minimum_stock || 5);
      return (
        (product.is_active ?? true) === true &&
        calculatedStock > 0 &&
        calculatedStock <= minimumStock
      );
    }).length;
  }, [products, stockMetaMap]);

  const outOfStockCount = useMemo(() => {
    return products.filter(
      (product) => (product.is_active ?? true) === true && getCalculatedStock(product) <= 0
    ).length;
  }, [products, stockMetaMap]);

  const totalInventoryCost = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getCalculatedStock(product) * Number(product.cost || 0), 0);
  }, [products, stockMetaMap]);

  const totalInventorySaleValue = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getCalculatedStock(product) * Number(product.price || 0), 0);
  }, [products, stockMetaMap]);

  const noMovementHistoryCount = useMemo(() => {
    return products.filter((product) => getProductStockMeta(product.id).movementCount === 0).length;
  }, [products, stockMetaMap]);

  const mismatchCount = useMemo(() => {
    return products.filter((product) => getStockDiff(product) !== 0).length;
  }, [products, stockMetaMap]);

  const filteredStockTotal = useMemo(() => {
    return filteredProducts.reduce((sum, product) => sum + getCalculatedStock(product), 0);
  }, [filteredProducts, stockMetaMap]);

  const filteredPotentialProfit = useMemo(() => {
    return filteredProducts.reduce((sum, product) => {
      const stock = getCalculatedStock(product);
      const margin = Number(product.price || 0) - Number(product.cost || 0);
      return sum + stock * margin;
    }, 0);
  }, [filteredProducts, stockMetaMap]);

  const filteredInventoryValue = useMemo(() => {
    return filteredProducts.reduce((sum, product) => {
      return sum + getCalculatedStock(product) * Number(product.price || 0);
    }, 0);
  }, [filteredProducts, stockMetaMap]);

  const criticalProducts = useMemo(() => {
    return products
      .filter((product) => {
        const calculatedStock = getCalculatedStock(product);
        const minimumStock = Number(product.minimum_stock || 5);
        return (
          (product.is_active ?? true) === true &&
          calculatedStock > 0 &&
          calculatedStock <= minimumStock
        );
      })
      .sort((a, b) => getCalculatedStock(a) - getCalculatedStock(b));
  }, [products, stockMetaMap]);

  const outOfStockProducts = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true && getCalculatedStock(product) <= 0)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [products, stockMetaMap]);

  const movementModalBalance = useMemo(() => {
    return selectedMovements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  }, [selectedMovements]);

  const editingMargin = Number(editPrice || 0) - Number(editCost || 0);
  const selectedGroupName = groups.find((group) => group.id === editGroupId)?.name || "-";
  const selectedSupplierName =
    suppliers.find((supplier) => String(supplier.id) === editSupplierId)?.name || "-";

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            BAUDECOR SISTEM / BAUDECOR SİSTEM
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Proizvodi / Ürünler</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Upravljaj proizvodima, stvarnim prikazom zaliha, strukturom marže, strukturom grupa i aktivnim/pasivnim statusom. /
            Ürünleri, gerçek stok görünümü, marj yapısı, grup yapısı ve aktif/pasif durumuyla yönet.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={refreshAll}
            disabled={refreshing || loading}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Osvježava se... / Yenileniyor..." : "Osvježi podatke / Verileri Yenile"}
          </button>
          <button
            onClick={exportFilteredStock}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Preuzmi stvarni stok / Gerçek Stok İndir
          </button>
        </div>
      </div>

      {(criticalProducts.length > 0 || outOfStockProducts.length > 0) && (
        <section className="mb-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Upozorenje kritične zalihe / Kritik Stok Uyarısı</h2>
              <p className="mt-1 text-sm text-slate-300">
                Ovdje su sažeti proizvodi čiji je izračunati nivo zalihe nizak ili je zaliha potrošena. /
                Hesaplanan stok seviyesi düşük veya tükenmiş ürünler burada özetlenir.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AlertPill label="Kritično / Kritik" value={String(criticalProducts.length)} amber />
              <AlertPill label="Nema zalihe / Stok Yok" value={String(outOfStockProducts.length)} red />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-300">Kritični proizvodi / Kritik Ürünler</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {criticalProducts.length > 0 ? (
                  criticalProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => openMovementHistory(product)}
                      className="rounded-xl border border-amber-400/20 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-900"
                    >
                      {product.name} · {getCalculatedStock(product)} / Min {Number(product.minimum_stock || 5)}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-300">Nema kritičnih proizvoda / Kritik ürün yok</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-300">Proizvodi bez zalihe / Stoksuz Ürünler</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {outOfStockProducts.length > 0 ? (
                  outOfStockProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => openMovementHistory(product)}
                      className="rounded-xl border border-red-400/20 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-900"
                    >
                      {product.name} · {getCalculatedStock(product)}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-slate-300">Nema proizvoda bez zalihe / Stoksuz ürün yok</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-10">
        <SummaryCard title="Ukupno proizvoda / Toplam Ürün" value={String(totalProducts)} />
        <SummaryCard title="Aktivni proizvodi / Aktif Ürün" value={String(activeProductsCount)} />
        <SummaryCard title="Pasivni proizvodi / Pasif Ürün" value={String(inactiveProductsCount)} />
        <SummaryCard title="Proizvodi sa dobavljačem / Tedarikçili Ürün" value={String(productsWithSupplierCount)} />
        <SummaryCard title="Stvarna zaliha / Gerçek Stok" value={String(totalCalculatedStock)} />
        <SummaryCard title="Kritična zaliha / Kritik Stok" value={String(criticalStockCount)} amber />
        <SummaryCard title="Bez zalihe / Stoksuz" value={String(outOfStockCount)} red />
        <SummaryCard
          title="Trošak inventara / Envanter Maliyeti"
          value={`€${totalInventoryCost.toFixed(2)}`}
        />
        <SummaryCard
          title="Potencijalna dobit / Potansiyel Kâr"
          value={`€${filteredPotentialProfit.toFixed(2)}`}
          amber={filteredPotentialProfit < 0}
        />
        <SummaryCard
          title="Neusklađen zapis / Uyumsuz Kayıt"
          value={String(mismatchCount)}
          amber={mismatchCount > 0}
        />
      </div>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Pretraga / Arama
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pretraži proizvod, grupu ili dobavljača / Ürün, grup veya tedarikçi ara"
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Status / Durum
              </label>
              <select
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="active">Aktivno / Aktif</option>
                <option value="inactive">Pasivno / Pasif</option>
                <option value="all">Sve / Tümü</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Filter grupe / Grup Filtresi
              </label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                disabled={loadingGroups}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">
                  {loadingGroups ? "Grupe se učitavaju... / Gruplar yükleniyor..." : "Sve grupe / Tüm Gruplar"}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Filter dobavljača / Tedarikçi Filtresi
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                disabled={loadingSuppliers}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">
                  {loadingSuppliers
                    ? "Dobavljači se učitavaju... / Tedarikçiler yükleniyor..."
                    : "Svi dobavljači / Tüm Tedarikçiler"}
                </option>
                <option value="none">Bez dobavljača / Tedarikçisiz</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Filter zalihe / Stok Filtresi
              </label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="all">Sve / Tümü</option>
                <option value="normal">Normalno / Normal</option>
                <option value="critical">Kritično / Kritik</option>
                <option value="out">Nema zalihe / Stok Yok</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Filter marže / Marj Filtresi
              </label>
              <select
                value={marginFilter}
                onChange={(e) => setMarginFilter(e.target.value as MarginFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="all">Sve / Tümü</option>
                <option value="profit">U dobiti / Kârda</option>
                <option value="loss">U minusu / Ekside</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard
              title="Filtrirani proizvodi / Filtreli Ürün"
              value={String(filteredProducts.length)}
            />
            <InfoCard
              title="Filtrirana stvarna zaliha / Filtreli Gerçek Stok"
              value={String(filteredStockTotal)}
            />
            <InfoCard
              title="Filtrirana prodajna vrijednost / Filtreli Satış Değeri"
              value={`€${filteredInventoryValue.toFixed(2)}`}
            />
            <InfoCard
              title="Potencijalna dobit / Potansiyel Kâr"
              value={`€${filteredPotentialProfit.toFixed(2)}`}
              green={filteredPotentialProfit >= 0}
              red={filteredPotentialProfit < 0}
            />
            <InfoCard
              title="Ukupna prodajna vrijednost / Toplam Satış Değeri"
              value={`€${totalInventorySaleValue.toFixed(2)}`}
            />
            <InfoCard
              title="Napomena / Not"
              value="Stvarna zaliha = opening_stock + stock_movements"
            />
          </div>
        </div>
      </section>
{editingProductId && (
  <section className="mb-8 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-2xl shadow-black/20">
    <div className="mb-6">
      <h2 className="text-lg font-semibold">Uredi proizvod / Ürün Düzenle</h2>
      <p className="mt-1 text-sm text-slate-400">
        Ažuriraj odabrani proizvod. / Seçili ürünü güncelle.
      </p>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Naziv proizvoda / Ürün Adı
          </label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Grupa proizvoda / Ürün Grubu
          </label>
          <select
            value={editGroupId}
            onChange={(e) => setEditGroupId(e.target.value)}
            disabled={loadingGroups}
            className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Podrazumijevani dobavljač / Varsayılan Tedarikçi
          </label>
          <select
            value={editSupplierId}
            onChange={(e) => setEditSupplierId(e.target.value)}
            disabled={loadingSuppliers}
            className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Prodajna cijena / Satış Fiyatı
            </label>
            <input
              type="number"
              min={0}
              value={editPrice}
              onChange={(e) => setEditPrice(Number(e.target.value))}
              className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Trošak / Maliyet
            </label>
            <input
              type="number"
              min={0}
              value={editCost}
              onChange={(e) => setEditCost(Number(e.target.value))}
              className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Minimalna zaliha / Minimum Stok
            </label>
            <input
              type="number"
              min={0}
              value={editMinimumStock}
              onChange={(e) => setEditMinimumStock(Number(e.target.value))}
              className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={saveEdit}
            disabled={savingEdit}
            className="rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingEdit ? "Čuva se... / Kaydediliyor..." : "Ažuriraj / Güncelle"}
          </button>

          <button
            onClick={cancelEdit}
            className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Otkaži / İptal
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <InfoCard title="Novi naziv proizvoda / Yeni Ürün Adı" value={editName || "-"} />
        <InfoCard title="Nova grupa / Yeni Grup" value={selectedGroupName} />
        <InfoCard
          title="Nova prodajna cijena / Yeni Satış Fiyatı"
          value={`€${Number(editPrice || 0).toFixed(2)}`}
        />
        <InfoCard
          title="Novi trošak / Yeni Maliyet"
          value={`€${Number(editCost || 0).toFixed(2)}`}
        />
        <InfoCard
          title="Nova marža / Yeni Marj"
          value={`€${Number(editingMargin).toFixed(2)}`}
          green={editingMargin >= 0}
          red={editingMargin < 0}
        />
        <InfoCard
          title="Novi minimum / Yeni Minimum"
          value={String(Number(editMinimumStock || 0))}
        />
      </div>
    </div>
  </section>
)}

<section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
  <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
    <div>
      <h2 className="text-lg font-semibold">Lista proizvoda / Ürün Listesi</h2>
      <p className="mt-1 text-sm text-slate-400">
        Prikaz stvarne zalihe prema početnoj zalihi i ukupnim kretanjima. /
        Gerçek stok görünümü başlangıç stokuna ve toplam hareketlere göre gösterilir.
      </p>
    </div>
    <div className="text-xs text-slate-500">
      Stvarna zaliha = opening_stock + stock_movements
    </div>
  </div>

  {loading ? (
    <div className="text-sm text-slate-400">Učitava se / Yükleniyor...</div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[3550px] text-sm">
        <thead className="text-slate-400">
          <tr className="border-b border-slate-800">
            <th className="px-4 py-4 text-left">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Grup</div>
                <div className="text-xs text-slate-500">Grupa</div>
              </div>
            </th>

            <th className="px-4 py-4 text-left">
              <div className="min-w-[180px]">
                <div className="text-sm font-semibold text-slate-300">Ürün</div>
                <div className="text-xs text-slate-500">Proizvod</div>
              </div>
            </th>

            <th className="px-4 py-4 text-left">
              <div className="min-w-[180px]">
                <div className="text-sm font-semibold text-slate-300">Tedarikçi</div>
                <div className="text-xs text-slate-500">Dobavljač</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[110px]">
                <div className="text-sm font-semibold text-slate-300">Hesaplanan</div>
                <div className="text-xs text-slate-500">Izračunato</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[90px]">
                <div className="text-sm font-semibold text-slate-300">Min</div>
                <div className="text-xs text-slate-500">Minimum</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[100px]">
                <div className="text-sm font-semibold text-slate-300">Satış</div>
                <div className="text-xs text-slate-500">Prodaja</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[100px]">
                <div className="text-sm font-semibold text-slate-300">Maliyet</div>
                <div className="text-xs text-slate-500">Trošak</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[90px]">
                <div className="text-sm font-semibold text-slate-300">Marj</div>
                <div className="text-xs text-slate-500">Marža</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[100px]">
                <div className="text-sm font-semibold text-slate-300">Marj %</div>
                <div className="text-xs text-slate-500">Marža %</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Stok Kârı</div>
                <div className="text-xs text-slate-500">Dobit iz zalihe</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[90px]">
                <div className="text-sm font-semibold text-slate-300">Açılış</div>
                <div className="text-xs text-slate-500">Početna</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[90px]">
                <div className="text-sm font-semibold text-slate-300">Kayıtlı</div>
                <div className="text-xs text-slate-500">Zabilježeno</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[90px]">
                <div className="text-sm font-semibold text-slate-300">Fark</div>
                <div className="text-xs text-slate-500">Razlika</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Durum</div>
                <div className="text-xs text-slate-500">Status</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Stok Maliyeti</div>
                <div className="text-xs text-slate-500">Trošak zalihe</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Satış Değeri</div>
                <div className="text-xs text-slate-500">Prodajna vrijednost</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[110px]">
                <div className="text-sm font-semibold text-slate-300">Hareket</div>
                <div className="text-xs text-slate-500">Kretanja</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[130px]">
                <div className="text-sm font-semibold text-slate-300">Bakiye</div>
                <div className="text-xs text-slate-500">Saldo</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[130px]">
                <div className="text-sm font-semibold text-slate-300">Son Hareket</div>
                <div className="text-xs text-slate-500">Zadnje</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[120px]">
                <div className="text-sm font-semibold text-slate-300">Geçmiş</div>
                <div className="text-xs text-slate-500">Istorija</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[100px]">
                <div className="text-sm font-semibold text-slate-300">Durum</div>
                <div className="text-xs text-slate-500">Aktivno</div>
              </div>
            </th>

            <th className="px-4 py-4 text-center">
              <div className="min-w-[150px]">
                <div className="text-sm font-semibold text-slate-300">İşlemler</div>
                <div className="text-xs text-slate-500">Akcije</div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          {filteredProducts.map((product) => {
            const price = Number(product.price || 0);
            const cost = Number(product.cost || 0);
            const recordedStock = Number(product.stock || 0);
            const openingStock = Number(product.opening_stock ?? 0);
            const calculatedStock = getCalculatedStock(product);
            const diff = getStockDiff(product);
            const margin = price - cost;
            const marginPercent = price > 0 ? (margin / price) * 100 : 0;
            const stockProfit = calculatedStock * margin;
            const isActive = product.is_active ?? true;
            const busy = actionLoadingId === product.id;
            const stockMeta = getProductStockMeta(product.id);
            const stockCostValue = calculatedStock * cost;
            const stockSaleValue = calculatedStock * price;
            const minimumStock = Number(product.minimum_stock || 5);
            const isCritical = calculatedStock > 0 && calculatedStock <= minimumStock;
            const isOut = calculatedStock <= 0;

            return (
              <tr
                key={product.id}
                className={`border-t border-slate-800 transition hover:bg-slate-800/30 ${
                  isOut ? "bg-red-500/5" : isCritical ? "bg-amber-500/5" : ""
                }`}
              >
                <td className="py-3 text-base text-white">{product.group_name || "-"}</td>
                <td className="py-3 text-base font-semibold text-white">{product.name}</td>
                <td className="py-3 text-base text-slate-300">{product.supplier_name || "-"}</td>
                <td
                  className={`py-3 text-center text-base font-semibold ${
                    isOut ? "text-red-300" : isCritical ? "text-amber-300" : "text-white"
                  }`}
                >
                  {calculatedStock}
                </td>
                <td className="py-3 text-center text-base font-semibold text-blue-300">
                  {minimumStock}
                </td>
                <td className="py-3 text-center text-base">€{price.toFixed(2)}</td>
                <td className="py-3 text-center text-base">€{cost.toFixed(2)}</td>
                <td
                  className={`py-3 text-center text-base font-semibold ${
                    margin >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  €{margin.toFixed(2)}
                </td>
                <td
                  className={`py-3 text-center text-base font-semibold ${
                    marginPercent >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  %{marginPercent.toFixed(1)}
                </td>
                <td
                  className={`py-3 text-center text-base font-semibold ${
                    stockProfit >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  €{stockProfit.toFixed(2)}
                </td>
                <td className="py-3 text-center text-base">{openingStock}</td>
                <td className="py-3 text-center text-base text-slate-300">{recordedStock}</td>
                <td
                  className={`py-3 text-center text-base font-semibold ${
                    diff === 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {diff}
                </td>
                <td className="py-3 text-center">
                  <StockBadge stock={calculatedStock} min={minimumStock} />
                </td>
                <td className="py-3 text-center text-base">€{stockCostValue.toFixed(2)}</td>
                <td className="py-3 text-center text-base">€{stockSaleValue.toFixed(2)}</td>
                <td className="py-3 text-center text-base font-semibold">{stockMeta.movementCount}</td>
                <td className="py-3 text-center text-base">{stockMeta.movementBalance}</td>
                <td className="py-3 text-center text-base text-slate-300">
                  {formatDateTime(stockMeta.lastMovementAt)}
                </td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => openMovementHistory(product)}
                    className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-base font-medium text-violet-300 transition hover:bg-violet-500/20"
                  >
                    Kretanja / Hareketler
                  </button>
                </td>
                <td className="py-3 text-center">
                  <ActivityBadge isActive={isActive} />
                </td>
                <td className="py-3 text-center">
                  <div className="flex flex-nowrap justify-center gap-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(product)}
                      className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                    >
                      Uredi / Düzenle
                    </button>

                    <button
                      onClick={() => toggleActive(product)}
                      disabled={busy}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                          : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {busy
                        ? "Sačekaj... / Bekle..."
                        : isActive
                        ? "Pasiviziraj / Pasife Al"
                        : "Aktiviraj / Aktif Yap"}
                    </button>

                    <button
                      onClick={() => deleteProduct(product)}
                      disabled={busy}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? "Sačekaj... / Bekle..." : "Obriši / Sil"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={22} className="py-8 text-center text-slate-400">
                Nema zapisa / Kayıt yok
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}
</section>
{movementModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
      <div className="flex flex-col gap-4 border-b border-slate-800 px-6 py-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            KRETANJA ZALIHE / STOK HAREKETLERİ
          </p>
          <h3 className="mt-2 text-2xl font-bold text-white">
            {selectedMovementProduct?.name || "-"}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Grupa / Grup: {selectedMovementProduct?.group_name || "-"}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <InfoCard
            title="Početna / Açılış"
            value={String(Number(selectedMovementProduct?.opening_stock ?? 0))}
          />
          <InfoCard
            title="Zabilježeno / Kayıtlı"
            value={String(Number(selectedMovementProduct?.stock || 0))}
          />
          <InfoCard
            title="Kretanje / Hareket"
            value={String(movementModalBalance)}
          />
          <InfoCard
            title="Izračunato / Hesaplanan"
            value={String(
              Number(selectedMovementProduct?.opening_stock ?? 0) + movementModalBalance
            )}
          />
          <InfoCard
            title="Minimum / Minimum"
            value={String(Number(selectedMovementProduct?.minimum_stock ?? 5))}
          />
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto px-6 py-5">
        {movementLoading ? (
          <div className="text-sm text-slate-400">
            Kretanja se učitavaju / Hareketler yükleniyor...
          </div>
        ) : selectedMovements.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 py-10 text-center text-slate-400">
            Nema istorije kretanja / Hareket kaydı yok
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Datum / Tarih</th>
                  <th className="py-3 text-left">Tip / Tür</th>
                  <th className="py-3 text-center">Količina / Miktar</th>
                  <th className="py-3 text-left">Napomena / Not</th>
                </tr>
              </thead>
              <tbody>
                {selectedMovements.map((movement) => {
                  const quantity = Number(movement.quantity || 0);
                  const positive = quantity > 0;

                  return (
                    <tr
                      key={movement.id || `${movement.created_at}-${movement.note}`}
                      className="border-t border-slate-800"
                    >
                      <td className="py-3 text-slate-300">
                        {formatDateTime(movement.created_at)}
                      </td>
                      <td className="py-3 text-white">{movement.movement_type || "-"}</td>
                      <td
                        className={`py-3 text-center font-semibold ${
                          positive ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {positive ? `+${quantity}` : quantity}
                      </td>
                      <td className="py-3 text-slate-300">{movement.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-slate-800 px-6 py-4">
        <button
          onClick={closeMovementHistory}
          className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          Zatvori / Kapat
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}

function SummaryCard({
  title,
  value,
  amber,
  red,
}: {
  title: string;
  value: string;
  amber?: boolean;
  red?: boolean;
}) {
  const color = red ? "text-red-300" : amber ? "text-amber-300" : "text-white";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-base font-medium ${color}`}>{value}</p>
    </div>
  );
}

function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        Nema zalihe / Stok Yok
      </span>
    );
  }

  if (stock <= min) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
        Kritično / Kritik
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Normalno / Normal
    </span>
  );
}

function ActivityBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Aktivno / Aktif
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
      Pasivno / Pasif
    </span>
  );
}

function AlertPill({
  label,
  value,
  amber,
  red,
}: {
  label: string;
  value: string;
  amber?: boolean;
  red?: boolean;
}) {
  const classes = red
    ? "border-red-500/20 bg-red-500/10 text-red-300"
    : amber
    ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
    : "border-slate-700 bg-slate-900 text-white";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${classes}`}>
      <p className="text-xs tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
