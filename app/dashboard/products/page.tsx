"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type ProizvodGroupRelation =
  | {
      name?: string | null;
    }
  | {
      name?: string | null;
    }[]
  | null
  | undefined;

type Proizvod = {
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
  product_groups?: ProizvodGroupRelation;
  default_supplier_id?: number | null;
  supplier_name?: string;
};

type ProizvodGroup = {
  id: string;
  name: string;
};

type Dobavljač = {
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

type ProizvodStockMeta = {
  movementCount: number;
  movementSaldo: number;
  lastMovementAt: string | null;
};

type ViewFilter = "active" | "inactive" | "all";
type StockFilter = "all" | "normal" | "critical" | "out";
type MaržaFilter = "all" | "profit" | "loss";

const EMPTY_STOCK_META: ProizvodStockMeta = {
  movementCount: 0,
  movementSaldo: 0,
  lastMovementAt: null,
};

export default function ProizvodsPage() {
  const [products, setProizvods] = useState<Proizvod[]>([]);
  const [groups, setGroups] = useState<ProizvodGroup[]>([]);
  const [suppliers, setDobavljačs] = useState<Dobavljač[]>([]);
  const [stockMetaMap, setStockMetaMap] = useState<Record<string, ProizvodStockMeta>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingDobavljačs, setLoadingDobavljačs] = useState(true);

  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("active");
  const [groupFilter, setGroupFilter] = useState("all");
  const [supplierFilter, setDobavljačFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [marginFilter, setMaržaFilter] = useState<MaržaFilter>("all");

  const [editingProizvodId, setEditingProizvodId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editTrošak, setEditTrošak] = useState(0);
  const [editGroupId, setEditGroupId] = useState("");
  const [editDobavljačId, setEditDobavljačId] = useState("");
  const [editMinimumStock, setEditMinimumStock] = useState(5);
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState("");

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedMovementProizvod, setSelectedMovementProizvod] = useState<Proizvod | null>(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [selectedKretanja, setSelectedKretanja] = useState<StockMovement[]>([]);

  useEffect(() => {
    initializePage();
  }, []);

  function getGroupNameFromRelation(relation?: ProizvodGroupRelation) {
    if (!relation) return "-";
    if (Array.isArray(relation)) {
      return relation[0]?.name || "-";
    }
    return relation.name || "-";
  }

  function getDobavljačNameById(supplierId?: number | null) {
    if (!supplierId) return "-";
    return suppliers.find((supplier) => supplier.id === supplierId)?.name || "-";
  }

  async function initializePage() {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchDobavljačs(), fetchProizvodsWithMeta()]);
    setLoading(false);
  }

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([fetchGroups(), fetchDobavljačs(), fetchProizvodsWithMeta()]);
    setRefreshing(false);
  }

  async function fetchGroups() {
    setLoadingGroups(true);

    const { data, error } = await supabase
      .from("product_groups")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      alert("Ürün grupları alınamadı / Proizvod groups could not be loaded");
      setLoadingGroups(false);
      return;
    }

    setGroups((data || []) as ProizvodGroup[]);
    setLoadingGroups(false);
  }

  async function fetchDobavljačs() {
    setLoadingDobavljačs(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, is_active")
      .order("name", { ascending: true });

    if (error) {
      alert("Tedarikçiler alınamadı / Dobavljačs could not be loaded");
      setLoadingDobavljačs(false);
      return;
    }

    setDobavljačs((data || []) as Dobavljač[]);
    setLoadingDobavljačs(false);
  }

  async function fetchProizvodsWithMeta() {
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
      alert("Ürünler alınamadı / Proizvods could not be loaded");
      return;
    }

    if (movementError) {
      alert("Kretanja zalihe nijesu učitana / Stok hareketleri alınamadı");
      return;
    }

    const normalizedProizvods = ((productData || []) as Proizvod[]).map((product) => ({
      ...product,
      group_name: getGroupNameFromRelation(product.product_groups),
      supplier_name: getDobavljačNameById(product.default_supplier_id),
      is_active: product.is_active ?? true,
      opening_stock: Number(product.opening_stock ?? 0),
      minimum_stock: Number(product.minimum_stock ?? 5),
    }));

    const nextStockMetaMap: Record<string, ProizvodStockMeta> = {};

    ((movementData || []) as StockMovement[]).forEach((movement) => {
      const productId = movement.product_id || "";
      if (!productId) return;

      const current = nextStockMetaMap[productId] || { ...EMPTY_STOCK_META };
      const quantity = Number(movement.quantity || 0);
      const createdAt = movement.created_at || null;

      const nextZadnjeMovementAt = !current.lastMovementAt
        ? createdAt
        : createdAt && createdAt > current.lastMovementAt
          ? createdAt
          : current.lastMovementAt;

      nextStockMetaMap[productId] = {
        movementCount: current.movementCount + 1,
        movementSaldo: current.movementSaldo + quantity,
        lastMovementAt: nextZadnjeMovementAt,
      };
    });

    setProizvods(normalizedProizvods);
    setStockMetaMap(nextStockMetaMap);
  }

  function startEdit(product: Proizvod) {
    setEditingProizvodId(product.id);
    setEditName(product.name || "");
    setEditPrice(Number(product.price || 0));
    setEditTrošak(Number(product.cost || 0));
    setEditGroupId(product.group_id || "");
    setEditDobavljačId(product.default_supplier_id ? String(product.default_supplier_id) : "");
    setEditMinimumStock(Number(product.minimum_stock || 5));
  }

  function cancelEdit() {
    setEditingProizvodId("");
    setEditName("");
    setEditPrice(0);
    setEditTrošak(0);
    setEditGroupId("");
    setEditDobavljačId("");
    setEditMinimumStock(5);
  }

  async function saveEdit() {
    if (!editingProizvodId) return;

    if (!editName.trim()) {
      alert("Unesi naziv proizvoda / Lütfen ürün adı gir");
      return;
    }

    if (!editGroupId) {
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (Number(editPrice) < 0) {
      alert("Unesi važeću prodajnu cijenu / Lütfen geçerli satış fiyatı gir");
      return;
    }

    if (Number(editTrošak) < 0) {
      alert("Unesi važeći trošak / Lütfen geçerli maliyet gir");
      return;
    }

    if (Number(editMinimumStock) < 0) {
      alert("Unesi važeću minimalnu zalihu / Lütfen geçerli minimum stok gir");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("products")
      .update({
        name: editName.trim(),
        price: Number(editPrice),
        cost: Number(editTrošak),
        group_id: editGroupId,
        default_supplier_id: editDobavljačId ? Number(editDobavljačId) : null,
        minimum_stock: Number(editMinimumStock),
      })
      .eq("id", editingProizvodId);

    setSavingEdit(false);

    if (error) {
      alert("Ürün güncellenemedi / Proizvod update failed: " + error.message);
      return;
    }

    alert("Ürün güncellendi / Proizvod updated ✅");

    cancelEdit();
    await fetchProizvodsWithMeta();
  }

  async function toggleAktivno(product: Proizvod) {
    const nextValue = !(product.is_active ?? true);

    const confirmText = nextValue
      ? "Ovaj proizvod će ponovo biti aktivan. Nastaviti? / Bu ürün tekrar aktif olacak. Devam edilsin mi?"
      : "Ovaj proizvod će biti pasiviziran. Stari zapisi ostaju, ali se ne bi trebalo koristiti u novim işlemler / Bu ürün pasife alınacak. Geçmiş kayıtlar korunur ama yeni işlemlerde kullanılmamalı. Devam edilsin mi?";

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

    await fetchProizvodsWithMeta();
  }

  async function canDeleteProizvod(product: Proizvod) {
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("id")
      .eq("product_name", product.name)
      .limit(1);

    if (salesError) {
      return {
        ok: false,
        reason: "Satış kontrolü yapılamadı / Prodajas check failed",
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

  async function deleteProizvod(product: Proizvod) {
    const firstConfirm = window.confirm(
      `Ovaj proizvod će biti obrisan: ${product.name}\n\nDa li si siguran? / Bu ürün silinecek.\n\nAre you sure?`
    );

    if (!firstConfirm) return;

    setActionLoadingId(product.id);

    const check = await canDeleteProizvod(product);

    if (!check.ok) {
      setActionLoadingId("");
      alert(check.reason);
      return;
    }

    const secondConfirm = window.confirm(
      `Izgleda da ovaj proizvod nikad nije korišćen i biće trajno obrisan.\n\n${product.name}\n\nNastaviti? / This product appears unused and will be permanently deleted.\n\nContinue?`
    );

    if (!secondConfirm) {
      setActionLoadingId("");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", product.id);

    setActionLoadingId("");

    if (error) {
      alert("Ürün silinemedi / Proizvod delete failed: " + error.message);
      return;
    }

    if (editingProizvodId === product.id) {
      cancelEdit();
    }

    alert("Ürün silindi / Proizvod deleted ✅");
    await fetchProizvodsWithMeta();
  }

  async function openMovementIstorija(product: Proizvod) {
    setSelectedMovementProizvod(product);
    setMovementModalOpen(true);
    setMovementLoading(true);
    setSelectedKretanja([]);

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

    setSelectedKretanja((data || []) as StockMovement[]);
  }

  function closeMovementIstorija() {
    setMovementModalOpen(false);
    setSelectedMovementProizvod(null);
    setSelectedKretanja([]);
    setMovementLoading(false);
  }

  function getProizvodStockMeta(productId: string) {
    return stockMetaMap[productId] || EMPTY_STOCK_META;
  }

  function getIzračunatoStock(product: Proizvod) {
    const openingStock = Number(product.opening_stock ?? 0);
    const movementSaldo = getProizvodStockMeta(product.id).movementSaldo;
    return openingStock + movementSaldo;
  }

  function getStockRazlika(product: Proizvod) {
    const recorded = Number(product.stock || 0);
    const calculated = getIzračunatoStock(product);
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

  const filteredProizvods = useMemo(() => {
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
          getIzračunatoStock(product),
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
  const rows = filteredProizvods.map((p) => {
    const recordedStock = Number(p.stock || 0);
    const calculatedStock = getIzračunatoStock(p);
    const openingStock = Number(p.opening_stock ?? 0);
    const cost = Number(p.cost || 0);
    const price = Number(p.price || 0);
    const margin = price - cost;
    const diff = recordedStock - calculatedStock;
    const stockMeta = getProizvodStockMeta(p.id);

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
      "Hareket Bakiyesi": stockMeta.movementSaldo,
      "Son Hareket": formatDateTime(stockMeta.lastMovementAt),
      "Aktiflik": (p.is_active ?? true) ? "Aktif" : "Pasif",
    };
  });

  const totalPočetna = rows.reduce((sum, row) => sum + Number(row["Açılış Stok"] || 0), 0);
  const totalZabilježeno = rows.reduce((sum, row) => sum + Number(row["Kayıtlı Stok"] || 0), 0);
  const totalIzračunato = rows.reduce((sum, row) => sum + Number(row["Hesaplanan Stok"] || 0), 0);
  const totalMinimum = rows.reduce((sum, row) => sum + Number(row["Minimum Stok"] || 0), 0);
  const totalRazlika = rows.reduce((sum, row) => sum + Number(row["Fark"] || 0), 0);
  const totalStockTrošak = rows.reduce((sum, row) => sum + Number(row["Stok Maliyeti (€)"] || 0), 0);
  const totalProdajaValue = rows.reduce((sum, row) => sum + Number(row["Satış Değeri (€)"] || 0), 0);
  const totalProfit = rows.reduce((sum, row) => sum + Number(row["Potansiyel Kâr (€)"] || 0), 0);
  const totalKretanja = rows.reduce((sum, row) => sum + Number(row["Hareket Sayısı"] || 0), 0);
  const totalMovementSaldo = rows.reduce((sum, row) => sum + Number(row["Hareket Bakiyesi"] || 0), 0);

  rows.push({
    "Grup": "",
    "Ürün": "TOPLAM",
    "Tedarikçi": "",
    "Açılış Stok": totalPočetna,
    "Kayıtlı Stok": totalZabilježeno,
    "Hesaplanan Stok": totalIzračunato,
    "Minimum Stok": totalMinimum,
    "Fark": totalRazlika,
    "Durum": "-",
    "Satış Fiyatı (€)": "",
    "Maliyet (€)": "",
    "Marj (€)": "",
    "Stok Maliyeti (€)": totalStockTrošak,
    "Satış Değeri (€)": totalProdajaValue,
    "Potansiyel Kâr (€)": totalProfit,
    "Hareket Sayısı": totalKretanja,
    "Hareket Bakiyesi": totalMovementSaldo,
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

  XLSX.utils.book_append_sheet(wb, ws, "Stvarna Zaliha");

  const viewSuffix =
    viewFilter === "active" ? "aktif" : viewFilter === "inactive" ? "pasif" : "tum";

  const groupSuffix =
    groupFilter === "all"
      ? "tum-gruplar"
      : (groups.find((group) => group.id === groupFilter)?.name || "grup")
          .toLowerCase()
          .replaceAll(" ", "-");

  XLSX.writeFile(wb, `stvarna-zaliha-${viewSuffix}-${groupSuffix}.xlsx`);
}

  const totalProizvods = products.length;

  const activeProizvodsCount = useMemo(() => {
    return products.filter((product) => (product.is_active ?? true) === true).length;
  }, [products]);

  const inactiveProizvodsCount = useMemo(() => {
    return products.filter((product) => (product.is_active ?? true) === false).length;
  }, [products]);

  const productsWithDobavljačCount = useMemo(() => {
    return products.filter((product) => !!product.default_supplier_id).length;
  }, [products]);

  const totalIzračunatoStock = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getIzračunatoStock(product), 0);
  }, [products, stockMetaMap]);

  const criticalStockCount = useMemo(() => {
    return products.filter((product) => {
      const calculatedStock = getIzračunatoStock(product);
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
      (product) => (product.is_active ?? true) === true && getIzračunatoStock(product) <= 0
    ).length;
  }, [products, stockMetaMap]);

  const totalInventoryTrošak = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getIzračunatoStock(product) * Number(product.cost || 0), 0);
  }, [products, stockMetaMap]);

  const totalInventoryProdajaValue = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true)
      .reduce((sum, product) => sum + getIzračunatoStock(product) * Number(product.price || 0), 0);
  }, [products, stockMetaMap]);

  const noMovementIstorijaCount = useMemo(() => {
    return products.filter((product) => getProizvodStockMeta(product.id).movementCount === 0).length;
  }, [products, stockMetaMap]);

  const mismatchCount = useMemo(() => {
    return products.filter((product) => getStockRazlika(product) !== 0).length;
  }, [products, stockMetaMap]);

  const filteredStockTotal = useMemo(() => {
    return filteredProizvods.reduce((sum, product) => sum + getIzračunatoStock(product), 0);
  }, [filteredProizvods, stockMetaMap]);

  const filteredPotentialProfit = useMemo(() => {
    return filteredProizvods.reduce((sum, product) => {
      const stock = getIzračunatoStock(product);
      const margin = Number(product.price || 0) - Number(product.cost || 0);
      return sum + stock * margin;
    }, 0);
  }, [filteredProizvods, stockMetaMap]);

  const filteredInventoryValue = useMemo(() => {
    return filteredProizvods.reduce((sum, product) => {
      return sum + getIzračunatoStock(product) * Number(product.price || 0);
    }, 0);
  }, [filteredProizvods, stockMetaMap]);

  const criticalProizvods = useMemo(() => {
    return products
      .filter((product) => {
        const calculatedStock = getIzračunatoStock(product);
        const minimumStock = Number(product.minimum_stock || 5);
        return (
          (product.is_active ?? true) === true &&
          calculatedStock > 0 &&
          calculatedStock <= minimumStock
        );
      })
      .sort((a, b) => getIzračunatoStock(a) - getIzračunatoStock(b));
  }, [products, stockMetaMap]);

  const outOfStockProizvods = useMemo(() => {
    return products
      .filter((product) => (product.is_active ?? true) === true && getIzračunatoStock(product) <= 0)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [products, stockMetaMap]);

  const movementModalSaldo = useMemo(() => {
    return selectedKretanja.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  }, [selectedKretanja]);

  const editingMarža = Number(editPrice || 0) - Number(editTrošak || 0);
  const selectedGroupName = groups.find((group) => group.id === editGroupId)?.name || "-";
  const selectedDobavljačName =
    suppliers.find((supplier) => String(supplier.id) === editDobavljačId)?.name || "-";

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            BAUDECOR SISTEM / BAUDECOR SİSTEM
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Proizvodi / Ürünler</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Ürünleri, gerçek stok görünümünü, marj yapısını, grup yapısını ve aktif/pasif durumunu yönet. /
            Upravljaj proizvodima, stvarnim stanjem zaliha, maržom, strukturom grupa i aktivnim/pasivnim statusom.
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

      {(criticalProizvods.length > 0 || outOfStockProizvods.length > 0) && (
        <section className="mb-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Upozorenje kritične zalihe / Kritik Stok Uyarısı</h2>
              <p className="mt-1 text-sm text-slate-300">
                Hesaplanan stok seviyesi düşük veya tükenmiş ürünler burada özetlenir. /
                Ovdje su sažeto prikazani proizvodi sa niskom zalihom i bez zalihe prema izračunatom stanju.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AlertPill label="Kritično / Kritik" value={String(criticalProizvods.length)} amber />
              <AlertPill label="Nema zalihe / Stok Yok" value={String(outOfStockProizvods.length)} red />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-300">Kritični proizvodi / Kritik Ürünler</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {criticalProizvods.length > 0 ? (
                  criticalProizvods.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => openMovementIstorija(product)}
                      className="rounded-xl border border-amber-400/20 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-900"
                    >
                      {product.name} · {getIzračunatoStock(product)} / Min {Number(product.minimum_stock || 5)}
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
                {outOfStockProizvods.length > 0 ? (
                  outOfStockProizvods.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => openMovementIstorija(product)}
                      className="rounded-xl border border-red-400/20 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-900"
                    >
                      {product.name} · {getIzračunatoStock(product)}
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
        <SummaryCard title="Ukupno proizvoda / Toplam Ürün" value={String(totalProizvods)} />
        <SummaryCard title="Aktivni proizvodi / Aktif Ürün" value={String(activeProizvodsCount)} />
        <SummaryCard title="Pasivni proizvodi / Pasif Ürün" value={String(inactiveProizvodsCount)} />
        <SummaryCard title="Proizvodi sa dobavljačem / Tedarikçili Ürün" value={String(productsWithDobavljačCount)} />
        <SummaryCard title="Stvarna zaliha / Gerçek Stok" value={String(totalIzračunatoStock)} />
        <SummaryCard title="Kritična zaliha / Kritik Stok" value={String(criticalStockCount)} amber />
        <SummaryCard title="Bez zalihe / Stoksuz" value={String(outOfStockCount)} red />
        <SummaryCard
          title="Trošak inventara / Envanter Maliyeti"
          value={`€${totalInventoryTrošak.toFixed(2)}`}
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
                  {loadingGroups ? "Grupe se učitavaju... / Grupe se učitavaju... / Gruplar yükleniyor..." : "Sve grupe / Tüm Gruplar"}
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
                onChange={(e) => setDobavljačFilter(e.target.value)}
                disabled={loadingDobavljačs}
                className="h-[56px] w-full min-w-0 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="all">
                  {loadingDobavljačs
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
                <option value="out">Nema zalihe / Stok Yok of Stock</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-[48px] items-end text-sm font-medium leading-5 text-slate-300">
                Filter marže / Marj Filtresi
              </label>
              <select
                value={marginFilter}
                onChange={(e) => setMaržaFilter(e.target.value as MaržaFilter)}
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
              value={String(filteredProizvods.length)}
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
              value={`€${totalInventoryProdajaValue.toFixed(2)}`}
            />
            <InfoCard
              title="Napomena / Not"
              value="Stvarna zaliha = opening_stock + stock_movements"
            />
          </div>
        </div>
      </section>

{editingProizvodId && (
        <section className="mb-8 rounded-3xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Uredi proizvod / Ürün Düzenle</h2>
            <p className="mt-1 text-sm text-slate-400">Ažuriraj odabrani proizvod / Seçili ürünü güncelle.</p>
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
                  <option value="">{loadingGroups ? "Grupe se učitavaju... / Grupe se učitavaju... / Gruplar yükleniyor..." : "Odaberi grupu / Grup seç"}</option>
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
                  value={editDobavljačId}
                  onChange={(e) => setEditDobavljačId(e.target.value)}
                  disabled={loadingDobavljačs}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {loadingDobavljačs
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">Trošak / Maliyet</label>
                  <input
                    type="number"
                    min={0}
                    value={editTrošak}
                    onChange={(e) => setEditTrošak(Number(e.target.value))}
                    className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Minimalna zaliha / Minimum Stok</label>
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
                  {savingEdit ? "Sačuvava se... / Kaydediliyor..." : "Ažuriraj / Güncelle"}
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
                value={`€${Number(editTrošak || 0).toFixed(2)}`}
              />
              <InfoCard
                title="Nova marža / Yeni Marj"
                value={`€${Number(editingMarža).toFixed(2)}`}
                green={editingMarža >= 0}
                red={editingMarža < 0}
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
              Prikaz stvarne zalihe prema početnoj zalihi + zbiru kretanja. /
              Stvarna zaliha prema početnoj zalihi i saldu kretanja.
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
        <div className="text-xs text-slate-500">Stock Trošak</div>
      </div>
    </th>

    <th className="px-4 py-4 text-center">
      <div className="min-w-[120px]">
        <div className="text-sm font-semibold text-slate-300">Satış Değeri</div>
        <div className="text-xs text-slate-500">Prodaja Value</div>
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
                {filteredProizvods.map((product) => {
                  const price = Number(product.price || 0);
                  const cost = Number(product.cost || 0);
                  const recordedStock = Number(product.stock || 0);
                  const openingStock = Number(product.opening_stock ?? 0);
                  const calculatedStock = getIzračunatoStock(product);
                  const diff = getStockRazlika(product);
                  const margin = price - cost;
                  const marginPercent = price > 0 ? (margin / price) * 100 : 0;
                  const stockProfit = calculatedStock * margin;
                  const isAktivno = product.is_active ?? true;
                  const busy = actionLoadingId === product.id;
                  const stockMeta = getProizvodStockMeta(product.id);
                  const stockTrošakValue = calculatedStock * cost;
                  const stockProdajaValue = calculatedStock * price;
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
                      <td className="py-3 text-center text-base">€{stockTrošakValue.toFixed(2)}</td>
                      <td className="py-3 text-center text-base">€{stockProdajaValue.toFixed(2)}</td>
                      <td className="py-3 text-center text-base font-semibold">{stockMeta.movementCount}</td>
                      <td className="py-3 text-center text-base">{stockMeta.movementSaldo}</td>
                      <td className="py-3 text-center text-base text-slate-300">
                        {formatDateTime(stockMeta.lastMovementAt)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => openMovementIstorija(product)}
                          className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-base font-medium text-violet-300 transition hover:bg-violet-500/20"
                        >
                          Hareketler / Kretanja
                        </button>
                      </td>
                      <td className="py-3 text-center">
                        <ActivityBadge isAktivno={isAktivno} />
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
                            onClick={() => toggleAktivno(product)}
                            disabled={busy}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                              isAktivno
                                ? "border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {busy
                              ? "Sačekaj... / Bekle..."
                              : isAktivno
                                ? "Pasiviziraj / Pasife Al"
                                : "Aktiviraj / Aktif Yap"}
                          </button>

                          <button
                            onClick={() => deleteProizvod(product)}
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

                {filteredProizvods.length === 0 && (
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
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stock Kretanja</p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  {selectedMovementProizvod?.name || "-"}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Grupa / Grup: {selectedMovementProizvod?.group_name || "-"}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <InfoCard
                  title="Açılış / Početna"
                  value={String(Number(selectedMovementProizvod?.opening_stock ?? 0))}
                />
                <InfoCard
                  title="Kayıtlı / Zabilježeno"
                  value={String(Number(selectedMovementProizvod?.stock || 0))}
                />
                <InfoCard
                  title="Kretanje / Hareket"
                  value={String(movementModalSaldo)}
                />
                <InfoCard
                  title="Hesaplanan / Izračunato"
                  value={String(
                    Number(selectedMovementProizvod?.opening_stock ?? 0) + movementModalSaldo
                  )}
                />
                <InfoCard
                  title="Minimum / Minimum"
                  value={String(Number(selectedMovementProizvod?.minimum_stock ?? 5))}
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto px-6 py-5">
              {movementLoading ? (
                <div className="text-sm text-slate-400">Kretanja se učitavaju / Hareketler yükleniyor...</div>
              ) : selectedKretanja.length === 0 ? (
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
                      {selectedKretanja.map((movement) => {
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
                onClick={closeMovementIstorija}
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

function ActivityBadge({ isAktivno }: { isAktivno: boolean }) {
  return isAktivno ? (
    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Aktif / Aktivno
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
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
