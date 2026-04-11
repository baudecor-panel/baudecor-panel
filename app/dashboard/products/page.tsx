"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
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
      alert("Ürün grupları alınamadı / Product groups could not be loaded");
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
      alert("Tedarikçiler alınamadı / Suppliers could not be loaded");
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
      alert("Ürünler alınamadı / Products could not be loaded");
      return;
    }

    if (movementError) {
      alert("Stok hareketleri alınamadı / Stock movements could not be loaded");
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
      alert("Lütfen ürün adı gir / Please enter product name");
      return;
    }

    if (!editGroupId) {
      alert("Lütfen ürün grubu seç / Please select product group");
      return;
    }

    if (Number(editPrice) < 0) {
      alert("Lütfen geçerli satış fiyatı gir / Please enter a valid sale price");
      return;
    }

    if (Number(editCost) < 0) {
      alert("Lütfen geçerli maliyet gir / Please enter a valid cost");
      return;
    }

    if (Number(editMinimumStock) < 0) {
      alert("Lütfen geçerli minimum stok gir / Please enter a valid minimum stock");
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
      alert("Ürün güncellenemedi / Product update failed: " + error.message);
      return;
    }

    alert("Ürün güncellendi / Product updated ✅");

    cancelEdit();
    await fetchProductsWithMeta();
  }

  async function toggleActive(product: Product) {
    const nextValue = !(product.is_active ?? true);

    const confirmText = nextValue
      ? "Bu ürün tekrar aktif olacak. Devam edilsin mi? / This product will be activated again. Continue?"
      : "Bu ürün pasife alınacak. Geçmiş kayıtlar korunur ama yeni işlemlerde kullanılmamalı. Devam edilsin mi? / This product will be archived. Historical records stay, but it should not be used in new operations. Continue?";

    const confirmed = window.confirm(confirmText);
    if (!confirmed) return;

    setActionLoadingId(product.id);

    const { error } = await supabase
      .from("products")
      .update({ is_active: nextValue })
      .eq("id", product.id);

    setActionLoadingId("");

    if (error) {
      alert("Durum güncellenemedi / Status update failed: " + error.message);
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
        reason: "Satış kontrolü yapılamadı / Sales check failed",
      };
    }

    if ((salesData || []).length > 0) {
      return {
        ok: false,
        reason:
          "Bu ürün satış kayıtlarında kullanıldığı için silinemez. Pasife alın. / This product cannot be deleted because it is used in sales records. Archive it instead.",
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
        reason: "Stok hareket kontrolü yapılamadı / Stock movement check failed",
      };
    }

    if ((movementData || []).length > 0) {
      return {
        ok: false,
        reason:
          "Bu ürün stok hareketlerinde kullanıldığı için silinemez. Pasife alın. / This product cannot be deleted because it is used in stock movements. Archive it instead.",
      };
    }

    return { ok: true, reason: "" };
  }

  async function deleteProduct(product: Product) {
    const firstConfirm = window.confirm(
      `Bu ürün silinecek: ${product.name}\n\nEmin misin? / This product will be deleted.\n\nAre you sure?`
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
      `Bu ürün hiç kullanılmamış görünüyor ve kalıcı olarak silinecek.\n\n${product.name}\n\nDevam edilsin mi? / This product appears unused and will be permanently deleted.\n\nContinue?`
    );

    if (!secondConfirm) {
      setActionLoadingId("");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", product.id);

    setActionLoadingId("");

    if (error) {
      alert("Ürün silinemedi / Product delete failed: " + error.message);
      return;
    }

    if (editingProductId === product.id) {
      cancelEdit();
    }

    alert("Ürün silindi / Product deleted ✅");
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
      alert("Hareket geçmişi alınamadı / Movement history could not be loaded");
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
      "Grup": p.group_name || "-",
      "Ürün": p.name,
      "Tedarikçi": p.supplier_name || "-",
      "Açılış Stok": openingStock,
      "Kayıtlı Stok": recordedStock,
      "Hesaplanan Stok": calculatedStock,
      "Minimum Stok": Number(p.minimum_stock || 5),
      "Fark": diff,
      "Durum":
        calculatedStock <= 0
          ? "Stok Yok"
          : calculatedStock <= Number(p.minimum_stock || 5)
          ? "Kritik"
          : "Normal",
      "Satış Fiyatı (€)": price,
      "Maliyet (€)": cost,
      "Marj (€)": margin,
      "Stok Maliyeti (€)": calculatedStock * cost,
      "Satış Değeri (€)": calculatedStock * price,
      "Potansiyel Kâr (€)": calculatedStock * margin,
      "Hareket Sayısı": stockMeta.movementCount,
      "Hareket Bakiyesi": stockMeta.movementBalance,
      "Son Hareket": formatDateTime(stockMeta.lastMovementAt),
      "Aktiflik": (p.is_active ?? true) ? "Aktif" : "Pasif",
    };
  });

  const totalOpening = rows.reduce((sum, row) => sum + Number(row["Açılış Stok"] || 0), 0);
  const totalRecorded = rows.reduce((sum, row) => sum + Number(row["Kayıtlı Stok"] || 0), 0);
  const totalCalculated = rows.reduce((sum, row) => sum + Number(row["Hesaplanan Stok"] || 0), 0);
  const totalMinimum = rows.reduce((sum, row) => sum + Number(row["Minimum Stok"] || 0), 0);
  const totalDiff = rows.reduce((sum, row) => sum + Number(row["Fark"] || 0), 0);
  const totalStockCost = rows.reduce((sum, row) => sum + Number(row["Stok Maliyeti (€)"] || 0), 0);
  const totalSaleValue = rows.reduce((sum, row) => sum + Number(row["Satış Değeri (€)"] || 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + Number(row["Potansiyel Kâr (€)"] || 0), 0);
  const totalMovements = rows.reduce((sum, row) => sum + Number(row["Hareket Sayısı"] || 0), 0);
  const totalMovementBalance = rows.reduce((sum, row) => sum + Number(row["Hareket Bakiyesi"] || 0), 0);

  rows.push({
    "Grup": "",
    "Ürün": "TOPLAM",
    "Tedarikçi": "",
    "Açılış Stok": totalOpening,
    "Kayıtlı Stok": totalRecorded,
    "Hesaplanan Stok": totalCalculated,
    "Minimum Stok": totalMinimum,
    "Fark": totalDiff,
    "Durum": "-",
    "Satış Fiyatı (€)": "",
    "Maliyet (€)": "",
    "Marj (€)": "",
    "Stok Maliyeti (€)": totalStockCost,
    "Satış Değeri (€)": totalSaleValue,
    "Potansiyel Kâr (€)": totalProfit,
    "Hareket Sayısı": totalMovements,
    "Hareket Bakiyesi": totalMovementBalance,
    "Son Hareket": "",
    "Aktiflik": "",
  } as any);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 18 }, // Grup
    { wch: 28 }, // Ürün
    { wch: 22 }, // Tedarikçi
    { wch: 14 }, // Açılış
    { wch: 14 }, // Kayıtlı
    { wch: 16 }, // Hesaplanan
    { wch: 14 }, // Minimum
    { wch: 10 }, // Fark
    { wch: 12 }, // Durum
    { wch: 15 }, // Satış
    { wch: 15 }, // Maliyet
    { wch: 12 }, // Marj
    { wch: 18 }, // Stok Maliyeti
    { wch: 18 }, // Satış Değeri
    { wch: 18 }, // Potansiyel Kâr
    { wch: 14 }, // Hareket Sayısı
    { wch: 16 }, // Hareket Bakiyesi
    { wch: 22 }, // Son Hareket
    { wch: 12 }, // Aktiflik
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

  XLSX.utils.book_append_sheet(wb, ws, "Gerçek Stok");

  const viewSuffix =
    viewFilter === "active" ? "aktif" : viewFilter === "inactive" ? "pasif" : "tum";

  const groupSuffix =
    groupFilter === "all"
      ? "tum-gruplar"
      : (groups.find((group) => group.id === groupFilter)?.name || "grup")
          .toLowerCase()
          .replaceAll(" ", "-");

  XLSX.writeFile(wb, `gercek-stok-${viewSuffix}-${groupSuffix}.xlsx`);
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
            BAUDECOR SYSTEM
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Ürünler / Products</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Ürünleri, gerçek stok görünümünü, marj yapısını, grup yapısını ve aktif/pasif durumunu yönet. /
            Manage products, real stock visibility, margin structure, group structure, and active/inactive status.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={refreshAll}
            disabled={refreshing || loading}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Yenileniyor... / Refreshing..." : "Verileri Yenile / Refresh Data"}
          </button>
          <button
            onClick={exportFilteredStock}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Gerçek Stok İndir / Export Real Stock
          </button>
        </div>
      </div>

      {(criticalProducts.length > 0 || outOfStockProducts.length > 0) && (
        <section className="mb-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Kritik Stok Uyarısı / Critical Stock Alert</h2>
              <p className="mt-1 text-sm text-slate-300">
                Hesaplanan stok seviyesi düşük veya tükenmiş ürünler burada özetlenir. /
                Low-stock and out-of-stock products based on calculated stock are summarized here.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AlertPill label="Kritik / Critical" value={String(criticalProducts.length)} amber />
              <AlertPill label="Stok Yok / Out" value={String(outOfStockProducts.length)} red />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-300">Kritik Ürünler / Critical Products</p>
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
                  <span className="text-sm text-slate-300">Kritik ürün yok / No critical products</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-300">Stoksuz Ürünler / Out of Stock Products</p>
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
                  <span className="text-sm text-slate-300">Stoksuz ürün yok / No out-of-stock products</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-10">
        <SummaryCard title="Toplam Ürün / Total Products" value={String(totalProducts)} />
        <SummaryCard title="Aktif Ürün / Active Products" value={String(activeProductsCount)} />
        <SummaryCard title="Pasif Ürün / Inactive Products" value={String(inactiveProductsCount)} />
        <SummaryCard title="Tedarikçili Ürün / With Supplier" value={String(productsWithSupplierCount)} />
        <SummaryCard title="Gerçek Stok / Real Stock" value={String(totalCalculatedStock)} />
        <SummaryCard title="Kritik Stok / Critical Stock" value={String(criticalStockCount)} amber />
        <SummaryCard title="Stoksuz / Out of Stock" value={String(outOfStockCount)} red />
        <SummaryCard
          title="Envanter Maliyeti / Inventory Cost"
          value={`€${totalInventoryCost.toFixed(2)}`}
        />
        <SummaryCard
          title="Potansiyel Kâr / Potential Profit"
          value={`€${filteredPotentialProfit.toFixed(2)}`}
          amber={filteredPotentialProfit < 0}
        />
        <SummaryCard
          title="Uyumsuz Kayıt / Mismatch"
          value={String(mismatchCount)}
          amber={mismatchCount > 0}
        />
      </div>

      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Arama / Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün, grup veya tedarikçi ara / Search product, group or supplier"
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Durum / Status
              </label>
              <select
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="active">Aktif / Active</option>
                <option value="inactive">Pasif / Inactive</option>
                <option value="all">Tümü / All</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Grup Filtresi / Group Filter
              </label>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                disabled={loadingGroups}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">
                  {loadingGroups ? "Gruplar yükleniyor..." : "Tüm gruplar / All groups"}
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
                Tedarikçi Filtresi / Supplier Filter
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                disabled={loadingSuppliers}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">
                  {loadingSuppliers
                    ? "Tedarikçiler yükleniyor..."
                    : "Tüm tedarikçiler / All suppliers"}
                </option>
                <option value="none">Tedarikçisiz / No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={String(supplier.id)}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Stok Filtresi / Stock Filter
              </label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="all">Tümü / All</option>
                <option value="normal">Normal</option>
                <option value="critical">Kritik / Critical</option>
                <option value="out">Stok Yok / Out of Stock</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Marj Filtresi / Margin Filter
              </label>
              <select
                value={marginFilter}
                onChange={(e) => setMarginFilter(e.target.value as MarginFilter)}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="all">Tümü / All</option>
                <option value="profit">Kârda / Profitable</option>
                <option value="loss">Ekside / Negative Margin</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard
              title="Filtreli Ürün / Filtered Products"
              value={String(filteredProducts.length)}
            />
            <InfoCard
              title="Filtreli Gerçek Stok / Filtered Real Stock"
              value={String(filteredStockTotal)}
            />
            <InfoCard
              title="Filtreli Satış Değeri / Filtered Sale Value"
              value={`€${filteredInventoryValue.toFixed(2)}`}
            />
            <InfoCard
              title="Potansiyel Kâr / Potential Profit"
              value={`€${filteredPotentialProfit.toFixed(2)}`}
              green={filteredPotentialProfit >= 0}
              red={filteredPotentialProfit < 0}
            />
            <InfoCard
              title="Toplam Satış Değeri / Total Sale Value"
              value={`€${totalInventorySaleValue.toFixed(2)}`}
            />
            <InfoCard
              title="Not / Note"
              value="Gerçek stok = opening_stock + stock_movements"
            />
          </div>
        </div>
      </section>

{editingProductId && (
        <section className="mb-8 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Ürün Düzenle / Edit Product</h2>
            <p className="mt-1 text-sm text-slate-400">Seçili ürünü güncelle. / Update the selected product.</p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Ürün Adı / Product Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Ürün Grubu / Product Group
                </label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  disabled={loadingGroups}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{loadingGroups ? "Gruplar yükleniyor..." : "Grup seç / Select group"}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Varsayılan Tedarikçi / Default Supplier
                </label>
                <select
                  value={editSupplierId}
                  onChange={(e) => setEditSupplierId(e.target.value)}
                  disabled={loadingSuppliers}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {loadingSuppliers
                      ? "Tedarikçiler yükleniyor..."
                      : "Tedarikçi seç (opsiyonel) / Select supplier (optional)"}
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
                    Satış Fiyatı / Sale Price
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">Maliyet / Cost</label>
                  <input
                    type="number"
                    min={0}
                    value={editCost}
                    onChange={(e) => setEditCost(Number(e.target.value))}
                    className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Minimum Stok / Minimum Stock</label>
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
                  {savingEdit ? "Kaydediliyor... / Saving..." : "Güncelle / Update"}
                </button>

                <button
                  onClick={cancelEdit}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
                >
                  İptal / Cancel
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <InfoCard title="Yeni Ürün Adı / New Product Name" value={editName || "-"} />
              <InfoCard title="Yeni Grup / New Group" value={selectedGroupName} />
              <InfoCard
                title="Yeni Satış Fiyatı / New Sale Price"
                value={`€${Number(editPrice || 0).toFixed(2)}`}
              />
              <InfoCard
                title="Yeni Maliyet / New Cost"
                value={`€${Number(editCost || 0).toFixed(2)}`}
              />
              <InfoCard
                title="Yeni Marj / New Margin"
                value={`€${Number(editingMargin).toFixed(2)}`}
                green={editingMargin >= 0}
                red={editingMargin < 0}
              />
              <InfoCard
                title="Yeni Minimum / New Minimum"
                value={String(Number(editMinimumStock || 0))}
              />
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Ürün Listesi / Product List</h2>
            <p className="mt-1 text-sm text-slate-400">
              Açılış stok + hareket toplamına göre gerçek stok görünümü. /
              Real stock view based on opening stock + movement balance.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Gerçek stok = opening_stock + movement balance
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Yükleniyor / Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[3550px] text-sm">
<thead className="text-slate-400">
  <tr className="border-b border-slate-800">

    <th className="px-4 py-4 text-left">
      <div className="min-w-[120px]">
        <div className="text-sm font-semibold text-slate-300">Grup</div>
        <div className="text-xs text-slate-500">Group</div>
      </div>
    </th>

    <th className="px-4 py-4 text-left">
      <div className="min-w-[180px]">
        <div className="text-sm font-semibold text-slate-300">Ürün</div>
        <div className="text-xs text-slate-500">Product</div>
      </div>
    </th>

    <th className="px-4 py-4 text-left">
      <div className="min-w-[180px]">
        <div className="text-sm font-semibold text-slate-300">Tedarikçi</div>
        <div className="text-xs text-slate-500">Supplier</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[110px]">
        <div className="text-sm font-semibold text-slate-300">Hesaplanan</div>
        <div className="text-xs text-slate-500">Calculated</div>
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
        <div className="text-xs text-slate-500">Sale</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[100px]">
        <div className="text-sm font-semibold text-slate-300">Maliyet</div>
        <div className="text-xs text-slate-500">Cost</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[90px]">
        <div className="text-sm font-semibold text-slate-300">Marj</div>
        <div className="text-xs text-slate-500">Margin</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[100px]">
        <div className="text-sm font-semibold text-slate-300">Marj %</div>
        <div className="text-xs text-slate-500">Margin %</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[120px]">
        <div className="text-sm font-semibold text-slate-300">Stok Kârı</div>
        <div className="text-xs text-slate-500">Stock Profit</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[90px]">
        <div className="text-sm font-semibold text-slate-300">Açılış</div>
        <div className="text-xs text-slate-500">Opening</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[90px]">
        <div className="text-sm font-semibold text-slate-300">Kayıtlı</div>
        <div className="text-xs text-slate-500">Recorded</div>
      </div>
    </th>



    <th className="px-4 py-4 text-center">
      <div className="min-w-[90px]">
        <div className="text-sm font-semibold text-slate-300">Fark</div>
        <div className="text-xs text-slate-500">Diff</div>
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
        <div className="text-xs text-slate-500">Stock Cost</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[120px]">
        <div className="text-sm font-semibold text-slate-300">Satış Değeri</div>
        <div className="text-xs text-slate-500">Sale Value</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[110px]">
        <div className="text-sm font-semibold text-slate-300">Hareket</div>
        <div className="text-xs text-slate-500">Movements</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[130px]">
        <div className="text-sm font-semibold text-slate-300">Bakiye</div>
        <div className="text-xs text-slate-500">Balance</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[130px]">
        <div className="text-sm font-semibold text-slate-300">Son Hareket</div>
        <div className="text-xs text-slate-500">Last</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[120px]">
        <div className="text-sm font-semibold text-slate-300">Geçmiş</div>
        <div className="text-xs text-slate-500">History</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[100px]">
        <div className="text-sm font-semibold text-slate-300">Durum</div>
        <div className="text-xs text-slate-500">Active</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[150px]">
        <div className="text-sm font-semibold text-slate-300">İşlemler</div>
        <div className="text-xs text-slate-500">Actions</div>
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
                      <td className={`py-3 text-center text-base font-semibold ${isOut ? "text-red-300" : isCritical ? "text-amber-300" : "text-white"}`}>
                        {calculatedStock}
                      </td>
                      <td className="py-3 text-center text-base text-blue-300 font-semibold">
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
                      <td className={`py-3 text-center text-base font-semibold ${diff === 0 ? "text-emerald-300" : "text-red-300"}`}>
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
                          Hareketler / Movements
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
                            Düzenle / Edit
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
                              ? "Bekle... / Wait..."
                              : isActive
                                ? "Pasife Al / Archive"
                                : "Aktif Yap / Activate"}
                          </button>

                          <button
                            onClick={() => deleteProduct(product)}
                            disabled={busy}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? "Bekle... / Wait..." : "Sil / Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={22} className="py-8 text-center text-slate-400">
                      Kayıt yok / No products found
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
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stock Movements</p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  {selectedMovementProduct?.name || "-"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Grup / Group: {selectedMovementProduct?.group_name || "-"}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <InfoCard
                  title="Açılış / Opening"
                  value={String(Number(selectedMovementProduct?.opening_stock ?? 0))}
                />
                <InfoCard
                  title="Kayıtlı / Recorded"
                  value={String(Number(selectedMovementProduct?.stock || 0))}
                />
                <InfoCard
                  title="Hareket / Movement"
                  value={String(movementModalBalance)}
                />
                <InfoCard
                  title="Hesaplanan / Calculated"
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
                <div className="text-sm text-slate-400">Hareketler yükleniyor / Loading movements...</div>
              ) : selectedMovements.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 py-10 text-center text-slate-400">
                  Hareket kaydı yok / No movement history found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="text-slate-400">
                      <tr className="border-b border-slate-800">
                        <th className="py-3 text-left">Tarih / Date</th>
                        <th className="py-3 text-left">Tür / Type</th>
                        <th className="py-3 text-center">Miktar / Quantity</th>
                        <th className="py-3 text-left">Not / Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMovements.map((movement) => {
                        const quantity = Number(movement.quantity || 0);
                        const positive = quantity > 0;
                        return (
                          <tr key={movement.id || `${movement.created_at}-${movement.note}`} className="border-t border-slate-800">
                            <td className="py-3 text-slate-300">{formatDateTime(movement.created_at)}</td>
                            <td className="py-3 text-white">{movement.movement_type || "-"}</td>
                            <td className={`py-3 text-center font-semibold ${positive ? "text-emerald-300" : "text-red-300"}`}>
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
                Kapat / Close
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
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
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
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-base font-medium ${color}`}>{value}</p>
    </div>
  );
}

function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        Stok Yok / Out
      </span>
    );
  }

  if (stock <= min) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
        Kritik / Critical
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Normal
    </span>
  );
}

function ActivityBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Aktif / Active
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
      Pasif / Inactive
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
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
