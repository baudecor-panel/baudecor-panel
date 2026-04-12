"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from "@/lib/supabase";

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
  group_id?: string | null;
  group_name?: string;
  is_active?: boolean;
  product_groups?: ProductGroupRelation;
};

type ProductGroup = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
  created_at: string;
};

type Sale = {
  id: string;
  order_id?: string | null;
  sale_date?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  final_unit_price?: number;
  total: number;
  unit_cost?: number;
  total_cost?: number;
  profit?: number;
  customer_id?: string | null;
  group_id?: string | null;
  group_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  employee: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  payment_status: string;
  delivery_status?: string;
  shipment_date?: string | null;
  shipment_status?: string;
  route_order?: number | null;
  loading_order?: number | null;
  shipment_note?: string | null;
  note?: string;
  created_at: string;
};

type GeocodeResult = {
  found: boolean;
  latitude: number | null;
  longitude: number | null;
  display_name: string | null;
};

type SimpleStatus =
  | "Bekliyor / Pending"
  | "Teslim Edildi / Delivered"
  | "İptal / Cancelled";

const MONTENEGRO_CITIES = [
  "Podgorica",
  "Budva",
  "Bar",
  "Ulcinj",
  "Kotor",
  "Tivat",
  "Herceg Novi",
  "Nikšić",
  "Cetinje",
  "Danilovgrad",
  "Bijelo Polje",
  "Berane",
  "Pljevlja",
  "Rožaje",
  "Mojkovac",
  "Kolašin",
  "Žabljak",
  "Plav",
  "Gusinje",
  "Andrijevica",
  "Petnjica",
  "Šavnik",
  "Plužine",
  "Tuzi",
] as const;

function getTodayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split("T")[0];
}

function parseDateString(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function SalesPage() {
  const formSectionRef = useRef<HTMLElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSales, setLoadingSales] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [prefillMode, setPrefillMode] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [listPrice, setListPrice] = useState(0);
  const [discount, setDiscount] = useState(0);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [employee, setEmployee] = useState("");
  const [city, setCity] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Ödendi / Paid");
  const [simpleStatus, setSimpleStatus] =
    useState<SimpleStatus>("Bekliyor / Pending");
  const [saleDate, setSaleDate] = useState(getTodayDate());
  const [shipmentDate, setShipmentDate] = useState<Date | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    initializePage();
    setSaleDate(getTodayDate());
  }, []);

  async function initializePage() {
    await fetchGroups();
    await fetchProducts();
    await fetchCustomers();
    await fetchSales();
  }

  function getGroupNameFromRelation(relation?: ProductGroupRelation) {
    if (!relation) return "-";
    if (Array.isArray(relation)) {
      return relation[0]?.name || "-";
    }
    return relation.name || "-";
  }

  function getSimpleStatusFromSale(sale: Sale): SimpleStatus {
    if (
      sale.delivery_status === "Teslim Edildi / Delivered" ||
      sale.shipment_status === "Teslim Edildi / Delivered"
    ) {
      return "Teslim Edildi / Delivered";
    }

    if (
      sale.delivery_status === "İptal / Cancelled" ||
      sale.shipment_status === "İptal / Cancelled"
    ) {
      return "İptal / Cancelled";
    }

    return "Bekliyor / Pending";
  }

  function getStatusPayload(status: SimpleStatus) {
    if (status === "Teslim Edildi / Delivered") {
      return {
        delivery_status: "Teslim Edildi / Delivered",
        shipment_status: "Teslim Edildi / Delivered",
      };
    }

    if (status === "İptal / Cancelled") {
      return {
        delivery_status: "İptal / Cancelled",
        shipment_status: "İptal / Cancelled",
      };
    }

    return {
      delivery_status: "Bekliyor / Pending",
      shipment_status: "Planlandı / Planned",
    };
  }

  function getDisplaySaleDate(sale: Sale) {
    return sale.sale_date || sale.created_at?.slice(0, 10) || "-";
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
      .select(
        "id, name, price, cost, stock, opening_stock, is_active, group_id, product_groups(name)"
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

  async function fetchCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Müşteriler alınamadı / Customers could not be loaded");
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function fetchSales() {
    setLoadingSales(true);

    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadingSales(false);
      alert("Satışlar alınamadı / Sales could not be loaded");
      return;
    }

    const salesData = ((data || []) as Sale[]).map((sale) => ({
      ...sale,
      group_name: "-",
    }));

    const { data: groupData } = await supabase
      .from("product_groups")
      .select("id, name")
      .order("name", { ascending: true });

    const groupMap = new Map<string, string>();
    (groupData || []).forEach((group: ProductGroup) => {
      groupMap.set(group.id, group.name);
    });

    const normalizedSales = salesData.map((sale) => ({
      ...sale,
      group_name: sale.group_id ? groupMap.get(sale.group_id) || "-" : "-",
    }));

    setSales(normalizedSales);
    setLoadingSales(false);
  }

  function handleCustomerSelect(customerId: string) {
    setSelectedCustomerId(customerId);

    if (!customerId) {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCity("");
      return;
    }

    const customer = customers.find((item) => item.id === customerId);

    if (!customer) return;

    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
    setCity(customer.city || "");
  }

  function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedProductId("");
    setListPrice(0);
    setDiscount(0);
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId);

    const product = products.find((p) => p.id === productId);
    if (product) {
      setListPrice(Number(product.price));
      setDiscount(0);
    } else {
      setListPrice(0);
      setDiscount(0);
    }
  }

  function handleAddProductToOrder(sale: Sale) {
    setActiveOrderId(sale.order_id || "");
    setSelectedCustomerId(sale.customer_id || "");
    setCustomerName(sale.customer_name || "");
    setCustomerPhone(sale.customer_phone || "");
    setCustomerAddress(sale.customer_address || "");
    setCity(sale.city || "");
    setSaleDate(getTodayDate());
    setShipmentDate(parseDateString(sale.shipment_date));
    setSimpleStatus(getSimpleStatusFromSale(sale));
    setPaymentStatus(sale.payment_status || "Ödendi / Paid");
    setEmployee(sale.employee || "");
    setNote(sale.note || "");

    setSelectedGroupId("");
    setSelectedProductId("");
    setQuantity(1);
    setListPrice(0);
    setDiscount(0);

    setPrefillMode(true);

    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function clearForm() {
    setActiveOrderId("");
    setSelectedCustomerId("");
    setSelectedGroupId("");
    setSelectedProductId("");
    setQuantity(1);
    setListPrice(0);
    setDiscount(0);

    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");

    setEmployee("");
    setCity("");
    setPaymentStatus("Ödendi / Paid");
    setSimpleStatus("Bekliyor / Pending");
    setSaleDate(getTodayDate());
    setShipmentDate(null);
    setNote("");
    setPrefillMode(false);
  }

  async function geocodeAddress(address: string, cityName: string) {
    const trimmedAddress = address.trim();
    const trimmedCity = cityName.trim();

    if (!trimmedAddress || !trimmedCity) {
      return {
        found: false,
        latitude: null,
        longitude: null,
        display_name: null,
      } satisfies GeocodeResult;
    }

    try {
      const url = new URL("/api/geocode", window.location.origin);
      url.searchParams.set("address", trimmedAddress);
      url.searchParams.set("city", trimmedCity);

      const response = await fetch(url.toString(), {
        method: "GET",
      });

      if (!response.ok) {
        return {
          found: false,
          latitude: null,
          longitude: null,
          display_name: null,
        } satisfies GeocodeResult;
      }

      const data = (await response.json()) as GeocodeResult;

      return {
        found: Boolean(data.found),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        display_name: data.display_name ?? null,
      } satisfies GeocodeResult;
    } catch (error) {
      console.error("Geocoding failed:", error);

      return {
        found: false,
        latitude: null,
        longitude: null,
        display_name: null,
      } satisfies GeocodeResult;
    }
  }

  function findProductByName(productName: string) {
    return products.find((product) => product.name === productName) || null;
  }

  function canDeleteSale(sale: Sale) {
    if (sale.delivery_status === "Teslim Edildi / Delivered") return false;
    if (sale.shipment_status === "Yüklendi / Loaded") return false;
    if (sale.shipment_status === "Yolda / On Route") return false;
    if (sale.shipment_status === "Teslim Edildi / Delivered") return false;
    return true;
  }

  async function updateStockMovementLog(params: {
    product: Product;
    movementType: string;
    quantity: number;
    note: string;
  }) {
    const { error } = await supabase.from("stock_movements").insert([
      {
        product_id: params.product.id,
        product_name: params.product.name,
        movement_type: params.movementType,
        quantity: params.quantity,
        note: params.note,
      },
    ]);

    if (error) {
      throw new Error(error.message);
    }
  }

  async function syncProductStock(product: Product) {
    const { data: movementsData, error: movementError } = await supabase
      .from("stock_movements")
      .select("quantity")
      .eq("product_id", product.id);

    if (movementError) {
      throw new Error(
        "Stok hareket toplamı alınamadı / Could not load stock movement totals: " +
          movementError.message
      );
    }

    const totalMovement = (movementsData || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const openingStock = Number(product.opening_stock || 0);
    const newStock = openingStock + totalMovement;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", product.id);

    if (updateError) {
      throw new Error(
        "Stok güncellenemedi / Stock update failed: " + updateError.message
      );
    }

    return newStock;
  }

  async function handleDeleteSale(sale: Sale) {
    if (!canDeleteSale(sale)) {
      alert(
        "Bu satış silinemez. Teslim edilmiş veya sevkiyata çıkmış kayıtlar silinemez. / This sale cannot be deleted. Delivered or shipped records cannot be deleted."
      );
      return;
    }

    const confirmed = window.confirm(
      `Bu satış silinecek ve stok geri eklenecek.\n\nÜrün: ${sale.product_name}\nAdet: ${sale.quantity}\nMüşteri: ${sale.customer_name || "-"}\n\nDevam edilsin mi? / Continue?`
    );

    if (!confirmed) return;

    setActionLoadingId(sale.id);

    try {
      const product = findProductByName(sale.product_name);

      if (product) {
        await updateStockMovementLog({
          product,
          movementType: "Sale Delete Return / Satış Silme İade",
          quantity: Number(sale.quantity || 0),
          note: `${sale.customer_name || "-"} satış silme iadesi / Sale delete return`,
        });

        await syncProductStock(product);
      }

      const { error: deleteError } = await supabase
        .from("sales")
        .delete()
        .eq("id", sale.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      alert(
        "Satış silindi ve stok geri eklendi / Sale deleted and stock restored ✅"
      );

      await fetchProducts();
      await fetchSales();
      await fetchCustomers();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Satış silinemedi / Sale delete failed"
      );
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleQuantityUpdate(sale: Sale, rawValue: string) {
    const newQty = Number(rawValue);

    if (!newQty || newQty <= 0) {
      alert("Adet 1 veya daha büyük olmalı / Quantity must be 1 or greater");
      await fetchSales();
      return;
    }

    if (newQty === Number(sale.quantity)) return;

    const product = findProductByName(sale.product_name);

    if (!product) {
      alert("Ürün bulunamadı / Product not found");
      await fetchSales();
      return;
    }

    setActionLoadingId(sale.id);

    const oldQty = Number(sale.quantity || 0);
    const diff = newQty - oldQty;

    try {
      if (diff > 0 && Number(product.stock || 0) < diff) {
        throw new Error("Yeterli stok yok / Not enough stock");
      }

      await updateStockMovementLog({
        product,
        movementType: "Sale Quantity Update / Satış Adet Güncelleme",
        quantity: -diff,
        note: `${sale.customer_name || "-"} adet değişimi: ${oldQty} → ${newQty}`,
      });

      await syncProductStock(product);

      const unit = Number(sale.final_unit_price ?? sale.unit_price ?? 0);
      const newTotal = Number(newQty) * unit;

      const { error: saleError } = await supabase
        .from("sales")
        .update({
          quantity: newQty,
          total: newTotal,
        })
        .eq("id", sale.id);

      if (saleError) {
        throw new Error(
          "Satış güncellenemedi / Sale update failed: " + saleError.message
        );
      }

      alert("Adet güncellendi / Quantity updated ✅");

      await fetchProducts();
      await fetchSales();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Adet güncellenemedi / Quantity update failed"
      );
      await fetchSales();
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleAddressUpdate(sale: Sale, newAddress: string) {
    const trimmed = newAddress.trim();

    if (trimmed === (sale.customer_address || "").trim()) return;

    setActionLoadingId(sale.id);

    const geocode = await geocodeAddress(trimmed, sale.city || "");

    const { error } = await supabase
      .from("sales")
      .update({
        customer_address: trimmed,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      })
      .eq("id", sale.id);

    setActionLoadingId("");

    if (error) {
      alert("Adres güncellenemedi / Address update failed: " + error.message);
      return;
    }

    if (sale.customer_id) {
      await supabase
        .from("customers")
        .update({
          address: trimmed,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
        })
        .eq("id", sale.customer_id);
    }

    if (!geocode.found && trimmed && (sale.city || "").trim()) {
      alert(
        "Adres güncellendi ama koordinat bulunamadı / Address updated but coordinates were not found"
      );
    } else {
      alert("Adres güncellendi / Address updated ✅");
    }

    await fetchSales();
    await fetchCustomers();
  }

  async function handleCityUpdate(sale: Sale, newCity: string) {
    const trimmed = newCity.trim();

    if (trimmed === (sale.city || "").trim()) return;

    setActionLoadingId(sale.id);

    const geocode = await geocodeAddress(sale.customer_address || "", trimmed);

    const { error } = await supabase
      .from("sales")
      .update({
        city: trimmed,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      })
      .eq("id", sale.id);

    setActionLoadingId("");

    if (error) {
      alert("Şehir güncellenemedi / City update failed: " + error.message);
      return;
    }

    if (sale.customer_id) {
      await supabase
        .from("customers")
        .update({
          city: trimmed,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
        })
        .eq("id", sale.customer_id);
    }

    if (!geocode.found && trimmed && (sale.customer_address || "").trim()) {
      alert(
        "Şehir güncellendi ama koordinat bulunamadı / City updated but coordinates were not found"
      );
    } else {
      alert("Şehir güncellendi / City updated ✅");
    }

    await fetchSales();
    await fetchCustomers();
  }

  async function handlePhoneUpdate(sale: Sale, newPhone: string) {
    const trimmed = newPhone.trim();

    if (trimmed === (sale.customer_phone || "").trim()) return;

    setActionLoadingId(sale.id);

    const { error } = await supabase
      .from("sales")
      .update({
        customer_phone: trimmed,
      })
      .eq("id", sale.id);

    setActionLoadingId("");

    if (error) {
      alert("Telefon güncellenemedi / Phone update failed: " + error.message);
      return;
    }

    if (sale.customer_id) {
      await supabase
        .from("customers")
        .update({
          phone: trimmed,
        })
        .eq("id", sale.customer_id);
    }

    alert("Telefon güncellendi / Phone updated ✅");
    await fetchSales();
    await fetchCustomers();
  }

  async function handleSimpleStatusUpdate(sale: Sale, newStatus: SimpleStatus) {
    const current = getSimpleStatusFromSale(sale);
    if (current === newStatus) return;

    setActionLoadingId(sale.id);

    const payload = getStatusPayload(newStatus);

    const { error } = await supabase
      .from("sales")
      .update(payload)
      .eq("id", sale.id);

    setActionLoadingId("");

    if (error) {
      alert("Durum güncellenemedi / Status update failed: " + error.message);
      return;
    }

    alert("Durum güncellendi / Status updated ✅");
    await fetchSales();
  }  async function handleProductReplace(
    sale: Sale,
    newProductName: string,
    forcedGroupId?: string | null
  ) {
    const oldProduct = findProductByName(sale.product_name);
    const newProduct =
      products.find(
        (product) =>
          product.name === newProductName &&
          (forcedGroupId ? product.group_id === forcedGroupId : true)
      ) || findProductByName(newProductName);

    if (!newProduct) {
      alert("Yeni ürün bulunamadı / New product not found");
      await fetchSales();
      return;
    }

    if (
      sale.product_name === newProductName &&
      sale.group_id === newProduct.group_id
    ) {
      return;
    }

    setActionLoadingId(sale.id);

    const qty = Number(sale.quantity || 0);

    try {
      if (Number(newProduct.stock || 0) < qty) {
        throw new Error(
          "Yeni üründe yeterli stok yok / Not enough stock for new product"
        );
      }

      if (oldProduct) {
        await updateStockMovementLog({
          product: oldProduct,
          movementType: "Sale Product Change Return / Satış Ürün Değişim İade",
          quantity: qty,
          note: `${sale.customer_name || "-"} ürün değişimi eski ürün iadesi`,
        });

        await syncProductStock(oldProduct);
      }

      await updateStockMovementLog({
        product: newProduct,
        movementType: "Sale Product Change / Satış Ürün Değişim",
        quantity: -qty,
        note: `${sale.customer_name || "-"} ürün değişimi yeni ürün düşümü`,
      });

      await syncProductStock(newProduct);

      const newUnitPrice = Number(newProduct.price || 0);
      const currentDiscount = Number(sale.discount || 0);
      const newFinalUnitPrice = Math.max(newUnitPrice - currentDiscount, 0);
      const newTotal = newFinalUnitPrice * qty;

      const { error: saleError } = await supabase
        .from("sales")
        .update({
          product_name: newProduct.name,
          group_id: newProduct.group_id || null,
          unit_price: newUnitPrice,
          final_unit_price: newFinalUnitPrice,
          total: newTotal,
        })
        .eq("id", sale.id);

      if (saleError) {
        throw new Error(
          "Satış ürün değişimi başarısız / Sale product replacement failed: " +
            saleError.message
        );
      }

      alert("Ürün değiştirildi / Product replaced ✅");

      await fetchProducts();
      await fetchSales();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Ürün değiştirilemedi / Product replacement failed"
      );
      await fetchProducts();
      await fetchSales();
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleSaleGroupUpdate(sale: Sale, newGroupId: string) {
    if (!newGroupId) {
      alert("Lütfen grup seç / Please select a group");
      return;
    }

    const currentGroupProducts = products.filter(
      (product) => product.group_id === newGroupId
    );

    if (currentGroupProducts.length === 0) {
      alert(
        "Bu grupta aktif ürün yok / There are no active products in this group"
      );
      return;
    }

    const sameProductInNewGroup = currentGroupProducts.find(
      (product) => product.name === sale.product_name
    );

    if (sameProductInNewGroup) {
      setActionLoadingId(sale.id);

      const { error } = await supabase
        .from("sales")
        .update({
          group_id: newGroupId,
        })
        .eq("id", sale.id);

      setActionLoadingId("");

      if (error) {
        alert("Grup güncellenemedi / Group update failed: " + error.message);
        return;
      }

      alert("Grup güncellendi / Group updated ✅");
      await fetchSales();
      return;
    }

    const firstProduct = currentGroupProducts[0];

    const confirmed = window.confirm(
      `Seçilen mevcut ürün bu grupta yok.\n\nYeni grup: ${
        groups.find((g) => g.id === newGroupId)?.name || "-"
      }\nYeni ürün: ${firstProduct.name}\n\nÜrün otomatik değiştirilsin mi? / Automatically replace product?`
    );

    if (!confirmed) return;

    await handleProductReplace(sale, firstProduct.name, newGroupId);
  }

  const filteredSales = useMemo(() => {
    return sales.filter(
      (s) =>
        s.delivery_status !== "Teslim Edildi / Delivered" ||
        s.payment_status !== "Ödendi / Paid"
    );
  }, [sales]);

  const groupedSales = useMemo(() => {
    const map = new Map<string, Sale[]>();

    filteredSales.forEach((sale) => {
      const key =
        sale.order_id ||
        `fallback_${sale.customer_id || sale.customer_name || ""}_${
          sale.shipment_date || ""
        }_${sale.created_at || ""}`;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(sale);
    });

    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        items: [...items].sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }))
      .sort((a, b) => {
        const aDate = a.items[0]?.created_at || "";
        const bDate = b.items[0]?.created_at || "";
        return bDate.localeCompare(aDate);
      });
  }, [filteredSales]);

  const filteredProductsByGroup = useMemo(() => {
    if (!selectedGroupId) return [];
    return products.filter((product) => product.group_id === selectedGroupId);
  }, [products, selectedGroupId]);

  const selectedGroupData = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId]
  );

  const selectedProductData = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const selectedGroupName = selectedGroupData?.name || "-";
  const selectedProductName = selectedProductData?.name || "-";
  const finalUnitPrice = Math.max(Number(listPrice) - Number(discount), 0);
  const total = Number(quantity) * Number(finalUnitPrice);
  const estimatedProfit = selectedProductData
    ? (Number(finalUnitPrice) - Number(selectedProductData.cost)) *
      Number(quantity)
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

    if (!customerName.trim()) {
      alert("Lütfen müşteri adı gir / Please enter customer name");
      return;
    }

    if (!employee.trim()) {
      alert("Lütfen çalışan adı gir / Please enter employee name");
      return;
    }

    if (!city.trim()) {
      alert("Lütfen şehir seç / Please select a city");
      return;
    }

    if (!shipmentDate) {
      alert("Lütfen sevkiyat tarihi gir / Please enter shipment date");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);

    if (!product) {
      alert("Ürün bulunamadı / Product not found");
      return;
    }

    if (!product.group_id) {
      alert("Bu ürüne grup atanmadı / This product has no group assigned");
      return;
    }

    if (product.group_id !== selectedGroupId) {
      alert(
        "Seçilen ürün grup ile eşleşmiyor / Selected product does not match the selected group"
      );
      return;
    }

    if (quantity <= 0) {
      alert("Adet 1 veya daha büyük olmalı / Quantity must be 1 or greater");
      return;
    }

    if (product.stock < quantity) {
      alert("Yeterli stok yok! / Not enough stock!");
      return;
    }

    setSaving(true);

    try {
      const geocode = await geocodeAddress(customerAddress, city);

      let finalCustomerId = selectedCustomerId || "";

      if (finalCustomerId) {
        const { error: customerUpdateError } = await supabase
          .from("customers")
          .update({
            name: customerName,
            phone: customerPhone,
            address: customerAddress,
            city,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
          })
          .eq("id", finalCustomerId);

        if (customerUpdateError) {
          throw new Error(
            "Müşteri güncellenemedi / Customer update failed: " +
              customerUpdateError.message
          );
        }
      } else {
        const { data: createdCustomer, error: customerInsertError } =
          await supabase
            .from("customers")
            .insert([
              {
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
                city,
                latitude: geocode.latitude,
                longitude: geocode.longitude,
              },
            ])
            .select("id")
            .single();

        if (customerInsertError) {
          throw new Error(
            "Müşteri kaydedilemedi / Customer insert failed: " +
              customerInsertError.message
          );
        }

        finalCustomerId = createdCustomer?.id || "";
      }

      const finalOrderId =
        activeOrderId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`);

      const statusPayload = getStatusPayload(simpleStatus);
      const today = getTodayDate();
      const formattedShipmentDate = shipmentDate.toISOString().split("T")[0];

      const unitCost = Number(product.cost || 0);
      const totalCost = unitCost * Number(quantity);
      const profit = Number(total) - totalCost;

      const { error: insertError } = await supabase.from("sales").insert([
        {
          order_id: finalOrderId,
          customer_id: finalCustomerId || null,
          sale_date: today,
          product_name: product.name,
          group_id: product.group_id,
          quantity,
          unit_price: listPrice,
          discount,
          final_unit_price: finalUnitPrice,
          total,
          unit_cost: unitCost,
          total_cost: totalCost,
          profit: profit,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          employee,
          city,
          latitude: geocode.latitude,
          longitude: geocode.longitude,
          payment_status: paymentStatus,
          delivery_status: statusPayload.delivery_status,
          shipment_date: formattedShipmentDate,
          shipment_status: statusPayload.shipment_status,
          note,
        },
      ]);

      if (insertError) {
        throw new Error("Hata / Error: " + insertError.message);
      }

      await updateStockMovementLog({
        product,
        movementType: "Sale / Satış",
        quantity: -Number(quantity),
        note:
          note?.trim() ||
          `${customerName} müşterisine satış / Sale to ${customerName}`,
      });

      await syncProductStock(product);

      if (!geocode.found && customerAddress.trim() && city.trim()) {
        alert(
          "Satış kaydedildi / Sale saved ✅\n\nAdres koordinatı bulunamadı. Daha sonra düzenlenebilir. / Address coordinates could not be found. They can be added later."
        );
      } else {
        alert("Satış kaydedildi / Sale saved ✅");
      }

      clearForm();

      await fetchProducts();
      await fetchSales();
      await fetchCustomers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Satış kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Satış / Sales
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Showroom satış girişlerinin yapılacağı ana kayıt ekranı. / Main entry
          screen for showroom sales registration.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section
          ref={formSectionRef}
          className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20"
        >
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Satış Girişi / Sales Entry</h2>
              <p className="mt-1 text-sm text-slate-400">
                Önce müşteri, sonra ürün grubu, sonra ürün seç. / Select customer
                first, then product group, then product.
              </p>
            </div>

            {prefillMode && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                <p className="text-sm font-medium text-blue-300">
                  Aynı siparişe yeni ürün ekleme modu aktif. / Add product to same
                  order mode is active.
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Order ID: {activeOrderId || "-"}
                </p>
                <button
                  onClick={clearForm}
                  className="mt-2 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-800"
                >
                  Formu Temizle / Clear Form
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Müşteri Seç / Select Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="">
                  Müşteri seç veya yeni gir / Select customer or enter new
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {(customer.name || "-") + " - " + (customer.phone || "-")}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-slate-500">Grup / Group</p>
                  <p className="mt-1 font-semibold text-white">
                    {selectedGroupName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Stok / Stock</p>
                  <p className="mt-1 font-semibold text-white">
                    {selectedProductData ? Number(selectedProductData.stock) : 0}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Maliyet / Cost</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(selectedProductData?.cost || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Adet / Quantity
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
                  Liste Fiyatı / List Price
                </label>
                <input
                  type="number"
                  min={0}
                  value={listPrice}
                  onChange={(e) => setListPrice(Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  İndirim / Discount
                </label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-slate-500">Liste / List</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(listPrice).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Net Birim / Final Unit</p>
                  <p className="mt-1 font-semibold text-emerald-300">
                    €{Number(finalUnitPrice).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Toplam / Total</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(total).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Tahmini Kâr / Estimated Profit</p>
                  <p className="mt-1 font-semibold text-amber-300">
                    €{Number(estimatedProfit).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Müşteri / Customer
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Telefon / Phone
                </label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+90 555 000 00 00"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Adres / Address
              </label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Müşteri adresi / Customer address"
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Çalışan / Employee
                </label>
                <input
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  placeholder="Örn: Marko"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Şehir / City
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">Şehir seç / Select city</option>
                  {MONTENEGRO_CITIES.map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Sevkiyat Tarihi / Shipment Date
                </label>
                <DatePicker
                  selected={shipmentDate}
                  onChange={(date: Date | null) => setShipmentDate(date)}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Tarih seç / Select date"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                  calendarClassName="baudecor-datepicker"
                  popperClassName="baudecor-datepicker-popper z-50"
                  wrapperClassName="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Durum / Status
                </label>
                <select
                  value={simpleStatus}
                  onChange={(e) => setSimpleStatus(e.target.value as SimpleStatus)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option>Bekliyor / Pending</option>
                  <option>Teslim Edildi / Delivered</option>
                  <option>İptal / Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Ödeme Durumu / Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option>Ödendi / Paid</option>
                <option>Bekliyor / Pending</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Not / Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Satış notu / Sale note"
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor... / Saving..." : "Satışı Kaydet / Save Sale"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">Özet / Summary</h2>

          <div className="mt-6 space-y-4">
            <InfoCard
              title="Aktif Sipariş / Active Order"
              value={activeOrderId ? "Mevcut siparişe ekleniyor" : "Yeni sipariş"}
            />
            <InfoCard
              title="Seçili Müşteri / Selected Customer"
              value={customerName || "-"}
            />
            <InfoCard title="Şehir / City" value={city || "-"} />
            <InfoCard title="Satış Tarihi / Sale Date" value={saleDate || "-"} />
            <InfoCard title="Grup / Group" value={selectedGroupName} />
            <InfoCard title="Ürün / Product" value={selectedProductName} />
            <InfoCard title="Adet / Quantity" value={String(quantity)} />
            <InfoCard
              title="Net Birim / Final Unit"
              value={`€${Number(finalUnitPrice).toFixed(2)}`}
              green
            />
            <InfoCard title="Toplam / Total" value={`€${Number(total).toFixed(2)}`} />
            <InfoCard
              title="Tahmini Kâr / Estimated Profit"
              value={`€${Number(estimatedProfit).toFixed(2)}`}
              amber
            />
          </div>
        </aside>
      </div>

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Aktif Satış Listesi / Active Sales List
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Teslim edilmemiş veya ödemesi tamamlanmamış satışların sipariş bazlı
            gruplanmış görünümü. / Order-grouped view of undelivered or unpaid sales.
          </p>
        </div>

        {loadingSales ? (
          <div className="text-sm text-slate-400">Yükleniyor / Loading...</div>
        ) : (
          <div className="space-y-8">
            {groupedSales.map((groupBlock, groupIndex) => {
              const group = groupBlock.items;
              const first = group[0];
              const totalOrder = group.reduce(
                (sum, s) => sum + Number(s.total || 0),
                0
              );

              return (
                <div
                  key={`${groupBlock.key}-${groupIndex}`}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-2xl shadow-black/20"
                >
                  <div className="border-b border-slate-800 bg-slate-800/70 px-6 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                            Sipariş / Order
                          </span>
                          <span className="text-xs text-slate-400">
                            {first.order_id || "-"}
                          </span>
                        </div>

                        <h3 className="text-xl font-semibold text-white">
                          {first.customer_name || "-"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          Telefon / Phone: {first.customer_phone || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Adres / Address: {first.customer_address || "-"} /{" "}
                          {first.city || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Satış Tarihi / Sale Date: {getDisplaySaleDate(first)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Sevkiyat Tarihi / Shipment Date: {first.shipment_date || "-"}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 md:items-end">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-right">
                          <p className="text-xs uppercase tracking-wide text-emerald-300">
                            Sipariş Toplamı / Order Total
                          </p>
                          <p className="mt-2 text-2xl font-bold text-emerald-300">
                            €{totalOrder.toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => handleAddProductToOrder(first)}
                          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                          + Ürün Ekle / Add Product
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[2600px] text-sm">
                      <thead className="text-slate-400">
                        <tr className="border-b border-slate-800">
                          <th className="py-3 text-left">Müşteri / Customer</th>
                          <th className="py-3 text-left">Telefon / Phone</th>
                          <th className="py-3 text-left">Şehir / City</th>
                          <th className="py-3 text-left">Adres / Address</th>
                          <th className="py-3 text-left">Satış Tarihi / Sale Date</th>
                          <th className="py-3 text-left">Kayıt Tarihi / Record Date</th>
                          <th className="py-3 text-left">Grup / Group</th>
                          <th className="py-3 text-left">Ürün / Product</th>
                          <th className="py-3 text-center">Adet / Qty</th>
                          <th className="py-3 text-center">Net Birim / Final Unit</th>
                          <th className="py-3 text-center">İndirim / Discount</th>
                          <th className="py-3 text-center">Toplam / Total</th>
                          <th className="py-3 text-center">Maliyet / Cost</th>
                          <th className="py-3 text-center">Kâr / Profit</th>
                          <th className="py-3 text-center">Ödeme / Payment</th>
                          <th className="py-3 text-center">Durum / Status</th>
                          <th className="py-3 text-center">Sevkiyat / Shipment Date</th>
                          <th className="py-3 text-center">İşlemler / Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {group.map((sale) => {
                          const rowBusy = actionLoadingId === sale.id;
                          const filteredProductsForSaleGroup = products.filter(
                            (product) => product.group_id === sale.group_id
                          );

                          return (
                            <tr
                              key={sale.id}
                              className="border-t border-slate-800 transition hover:bg-slate-800/30"
                            >
                              <td className="py-3">{sale.customer_name || "-"}</td>

                              <td className="py-3">
                                <input
                                  defaultValue={sale.customer_phone || ""}
                                  onBlur={(e) =>
                                    handlePhoneUpdate(sale, e.target.value)
                                  }
                                  className="w-[140px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                />
                              </td>

                              <td className="py-3">
                                <select
                                  defaultValue={sale.city || ""}
                                  onBlur={(e) =>
                                    handleCityUpdate(sale, e.target.value)
                                  }
                                  className="w-[150px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                >
                                  <option value="">Şehir seç / Select city</option>
                                  {MONTENEGRO_CITIES.map((cityName) => (
                                    <option key={cityName} value={cityName}>
                                      {cityName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="py-3">
                                <input
                                  defaultValue={sale.customer_address || ""}
                                  onBlur={(e) =>
                                    handleAddressUpdate(sale, e.target.value)
                                  }
                                  className="w-[260px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                />
                              </td>

                              <td className="py-3">{getDisplaySaleDate(sale)}</td>
                              <td className="py-3">{sale.created_at?.slice(0, 10)}</td>

                              <td className="py-3">
                                <select
                                  value={sale.group_id || ""}
                                  onChange={(e) =>
                                    handleSaleGroupUpdate(sale, e.target.value)
                                  }
                                  className="w-[170px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                >
                                  <option value="">Grup seç / Select group</option>
                                  {groups.map((groupItem) => (
                                    <option key={groupItem.id} value={groupItem.id}>
                                      {groupItem.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className="py-3">
                                <select
                                  value={sale.product_name}
                                  onChange={(e) =>
                                    handleProductReplace(
                                      sale,
                                      e.target.value,
                                      sale.group_id || null
                                    )
                                  }
                                  className="w-[190px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                >
                                  {filteredProductsForSaleGroup.length > 0 ? (
                                    filteredProductsForSaleGroup.map((product) => (
                                      <option key={product.id} value={product.name}>
                                        {product.name}
                                      </option>
                                    ))
                                  ) : (
                                    <option value={sale.product_name}>
                                      {sale.product_name}
                                    </option>
                                  )}
                                </select>
                              </td>

                              <td className="py-3 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  defaultValue={sale.quantity}
                                  onBlur={(e) =>
                                    handleQuantityUpdate(sale, e.target.value)
                                  }
                                  className="w-[70px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-white"
                                />
                              </td>

                              <td className="py-3 text-center">
                                €
                                {Number(
                                  sale.final_unit_price ?? sale.unit_price ?? 0
                                ).toFixed(2)}
                              </td>

                              <td className="py-3 text-center text-amber-300">
                                €{Number(sale.discount ?? 0).toFixed(2)}
                              </td>

                              <td className="py-3 text-center font-medium">
                                €{Number(sale.total).toFixed(2)}
                              </td>

                              <td className="py-3 text-center text-slate-300">
                                €{Number(sale.total_cost || 0).toFixed(2)}
                              </td>

                              <td className={`py-3 text-center font-semibold ${
                                Number(sale.profit || 0) >= 0 ? "text-emerald-300" : "text-red-300"
                              }`}>
                                €{Number(sale.profit || 0).toFixed(2)}
                              </td>

                              <td className="py-3 text-center">
                                {sale.payment_status || "-"}
                              </td>

                              <td className="py-3 text-center">
                                <select
                                  value={getSimpleStatusFromSale(sale)}
                                  onChange={(e) =>
                                    handleSimpleStatusUpdate(
                                      sale,
                                      e.target.value as SimpleStatus
                                    )
                                  }
                                  className="w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-white"
                                >
                                  <option>Bekliyor / Pending</option>
                                  <option>Teslim Edildi / Delivered</option>
                                  <option>İptal / Cancelled</option>
                                </select>
                              </td>

                              <td className="py-3 text-center">
                                {sale.shipment_date || "-"}
                              </td>

                              <td className="py-3 text-center">
                                <div className="flex flex-wrap justify-center gap-2">
                                  <button
                                    onClick={() => handleDeleteSale(sale)}
                                    disabled={rowBusy || !canDeleteSale(sale)}
                                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {rowBusy ? "Bekle... / Wait..." : "Sil / Delete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {groupedSales.length === 0 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/50 py-8 text-center text-slate-400">
                Aktif kayıt yok / No active sales found
              </div>
            )}
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
  amber,
}: {
  title: string;
  value: string;
  green?: boolean;
  amber?: boolean;
}) {
  const color = green
    ? "text-emerald-300"
    : amber
    ? "text-amber-300"
    : "text-white";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 text-base font-medium ${color}`}>{value}</p>
    </div>
  );
}
