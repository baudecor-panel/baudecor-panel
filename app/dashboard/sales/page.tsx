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
  payment_method?: string | null;
  commission_rate?: number | null;
  commission_amount?: number | null;
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
  const [paymentMethod, setPaymentMethod] = useState("Nakit / Cash");
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
      alert("Grupe proizvoda nijesu učitane / Ürün grupları alınamadı");
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
      alert("Proizvodi nijesu učitani / Ürünler alınamadı");
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
      .select("id, name, phone, address, city, latitude, longitude, note, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Kupci nijesu učitani / Müşteriler alınamadı");
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function fetchSales() {
    setLoadingSales(true);

    const { data, error } = await supabase
      .from("sales")
      .select("id, order_id, sale_date, product_name, quantity, unit_price, discount, final_unit_price, total, unit_cost, total_cost, profit, customer_id, group_id, customer_name, customer_phone, customer_address, employee, city, latitude, longitude, payment_status, payment_method, commission_rate, commission_amount, delivery_status, shipment_date, shipment_status, route_order, loading_order, shipment_note, note, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadingSales(false);
      alert("Prodaje nijesu učitane / Satışlar alınamadı");
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
    setPaymentMethod(sale.payment_method || "Nakit / Cash");
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
    setPaymentMethod("Nakit / Cash");
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
        "Ova prodaja se ne može obrisati. Isporučeni ili poslati zapisi se ne mogu brisati / Bu satış silinemez. Teslim edilmiş veya sevkiyata çıkmış kayıtlar silinemez."
      );
      return;
    }

    const confirmed = window.confirm(
      `Ova prodaja će biti obrisana i zaliha će biti vraćena.\n\nProizvod: ${sale.product_name}\nKoličina: ${sale.quantity}\nKupac: ${sale.customer_name || "-"}\n\nNastaviti? / Devam edilsin mi?`
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
        "Prodaja je obrisana i zaliha je vraćena / Satış silindi ve stok geri eklendi ✅"
      );

      await fetchProducts();
      await fetchSales();
      await fetchCustomers();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Prodaja nije obrisana / Satış silinemedi"
      );
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleQuantityUpdate(sale: Sale, rawValue: string) {
    const newQty = Number(rawValue);

    if (!newQty || newQty <= 0) {
      alert("Količina mora biti 1 ili veća / Adet 1 veya daha büyük olmalı");
      await fetchSales();
      return;
    }

    if (newQty === Number(sale.quantity)) return;

    const product = findProductByName(sale.product_name);

    if (!product) {
      alert("Proizvod nije pronađen / Ürün bulunamadı");
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
      const unitCost = Number(sale.unit_cost || 0);
      const newTotalCost = unitCost * newQty;
      const newProfit = newTotal - newTotalCost;

      const { error: saleError } = await supabase
        .from("sales")
        .update({
          quantity: newQty,
          total: newTotal,
          total_cost: newTotalCost,
          profit: newProfit,
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
      alert("Adresa nije ažurirana / Adres güncellenemedi: " + error.message);
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
        "Adresa je ažurirana ali koordinate nijesu pronađene / Adres güncellendi ama koordinat bulunamadı"
      );
    } else {
      alert("Adresa je ažurirana / Adres güncellendi ✅");
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
      alert("Grad nije ažuriran / Şehir güncellenemedi: " + error.message);
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
        "Grad je ažuriran ali koordinate nijesu pronađene / Şehir güncellendi ama koordinat bulunamadı"
      );
    } else {
      alert("Grad je ažuriran / Şehir güncellendi ✅");
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
      alert("Telefon nije ažuriran / Telefon güncellenemedi: " + error.message);
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

    alert("Telefon je ažuriran / Telefon güncellendi ✅");
    await fetchSales();
    await fetchCustomers();
  }

  async function handleSimpleStatusUpdate(sale: Sale, newStatus: SimpleStatus) {
    const current = getSimpleStatusFromSale(sale);
    if (current === newStatus) return;

    setActionLoadingId(sale.id);

    try {
      const product = findProductByName(sale.product_name);
      const qty = Number(sale.quantity || 0);

      if (product && qty > 0) {
        const goingCancelled =
          newStatus === "İptal / Cancelled" && current !== "İptal / Cancelled";
        const leavingCancelled =
          newStatus !== "İptal / Cancelled" && current === "İptal / Cancelled";

        if (goingCancelled) {
          await updateStockMovementLog({
            product,
            movementType: "Satış İptal / Sale Cancel",
            quantity: qty,
            note: `${sale.customer_name || "-"} satış iptali - stok iadesi`,
          });
          await syncProductStock(product);
        } else if (leavingCancelled) {
          await updateStockMovementLog({
            product,
            movementType: "Sale / Satış",
            quantity: -qty,
            note: `${sale.customer_name || "-"} iptal geri alındı - stok düşümü`,
          });
          await syncProductStock(product);
        }
      }

      const payload = getStatusPayload(newStatus);

      const { error } = await supabase
        .from("sales")
        .update(payload)
        .eq("id", sale.id);

      if (error) {
        throw new Error("Status nije ažuriran / Durum güncellenemedi: " + error.message);
      }

      alert("Status je ažuriran / Durum güncellendi ✅");
      await fetchSales();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "İşlem başarısız / Operacija neuspješna"
      );
    } finally {
      setActionLoadingId("");
    }
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
      alert("Novi proizvod nije pronađen / Yeni ürün bulunamadı");
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
          "Nema dovoljno zalihe za novi proizvod / Yeni üründe yeterli stok yok"
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
          "Promjena proizvoda u prodaji nije uspjela / Satış ürün değişimi başarısız: " +
            saleError.message
        );
      }

      alert("Proizvod je promijenjen / Ürün değiştirildi ✅");

      await fetchProducts();
      await fetchSales();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Proizvod nije promijenjen / Ürün değiştirilemedi"
      );
      await fetchProducts();
      await fetchSales();
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleSaleGroupUpdate(sale: Sale, newGroupId: string) {
    if (!newGroupId) {
      alert("Odaberi grupu / Lütfen grup seç");
      return;
    }

    const currentGroupProducts = products.filter(
      (product) => product.group_id === newGroupId
    );

    if (currentGroupProducts.length === 0) {
      alert(
        "U ovoj grupi nema aktivnih proizvoda / Bu grupta aktif ürün yok"
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
        alert("Grupa nije ažurirana / Grup güncellenemedi: " + error.message);
        return;
      }

      alert("Grupa je ažurirana / Grup güncellendi ✅");
      await fetchSales();
      return;
    }

    const firstProduct = currentGroupProducts[0];

    const confirmed = window.confirm(
      `Odabrani trenutni proizvod ne postoji u ovoj grupi.\n\nNova grupa: ${
        groups.find((g) => g.id === newGroupId)?.name || "-"
      }\nNovi proizvod: ${firstProduct.name}\n\nDa li proizvod treba automatski zamijeniti? / Ürün otomatik değiştirilsin mi?`
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

  const customerProfitStats = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number; profit: number }>();

    sales.forEach((s) => {
      const key = s.customer_name || "Bilinmiyor / Unknown";
      if (!map.has(key)) {
        map.set(key, { revenue: 0, cost: 0, profit: 0 });
      }
      const curr = map.get(key)!;
      curr.revenue += Number(s.total || 0);
      curr.cost += Number(s.total_cost || 0);
      curr.profit += Number(s.profit || 0);
    });

    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.profit - a.profit);
  }, [sales]);

  const topCustomers = useMemo(() => customerProfitStats.slice(0,5), [customerProfitStats]);
  const worstCustomers = useMemo(() => [...customerProfitStats].filter(c => c.profit < 0).sort((a,b)=>a.profit-b.profit).slice(0,5), [customerProfitStats]);

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
      alert("Odaberi grupu proizvoda / Lütfen ürün grubu seç");
      return;
    }

    if (!selectedProductId) {
      alert("Odaberi proizvod / Lütfen ürün seç");
      return;
    }

    if (!customerName.trim()) {
      alert("Unesi ime kupca / Lütfen müşteri adı gir");
      return;
    }

    if (!employee.trim()) {
      alert("Unesi ime zaposlenog / Lütfen çalışan adı gir");
      return;
    }

    if (!city.trim()) {
      alert("Odaberi grad / Lütfen şehir seç");
      return;
    }

    if (!shipmentDate) {
      alert("Unesi datum isporuke / Lütfen sevkiyat tarihi gir");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);

    if (!product) {
      alert("Proizvod nije pronađen / Ürün bulunamadı");
      return;
    }

    if (!product.group_id) {
      alert("Ovom proizvodu nije dodijeljena grupa / Bu ürüne grup atanmadı");
      return;
    }

    if (product.group_id !== selectedGroupId) {
      alert(
        "Odabrani proizvod se ne podudara sa grupom / Seçilen ürün grup ile eşleşmiyor"
      );
      return;
    }

    if (quantity <= 0) {
      alert("Količina mora biti 1 ili veća / Adet 1 veya daha büyük olmalı");
      return;
    }

    if (product.stock < quantity) {
      alert("Nema dovoljno zalihe / Yeterli stok yok!");
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
            "Kupac nije ažuriran / Müşteri güncellenemedi: " +
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
            "Kupac nije sačuvan / Müşteri kaydedilemedi: " +
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
      const commissionRate = paymentMethod === "Kredi Kartı / Credit Card" ? 3 : 0;
      const commissionAmount = Number(((Number(total) * commissionRate) / 100).toFixed(2));
      const profit = Number(total) - totalCost - commissionAmount;

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
          payment_method: paymentMethod,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
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
        throw new Error("Greška / Hata: " + insertError.message);
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
          "Prodaja je sačuvana / Satış kaydedildi ✅\n\nKoordinate adrese nijesu pronađene. Mogu se kasnije urediti / Adres koordinatı bulunamadı. Daha sonra düzenlenebilir."
        );
      } else {
        alert("Prodaja je sačuvana / Satış kaydedildi ✅");
      }

      clearForm();

      await fetchProducts();
      await fetchSales();
      await fetchCustomers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Prodaja nije sačuvana");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Prodaja / Satış
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Glavni ekran za unos prodaje u showroom-u. / Showroom satış girişlerinin yapılacağı ana kayıt ekranı.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section
          ref={formSectionRef}
          className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20"
        >
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Unos prodaje / Satış Girişi</h2>
              <p className="mt-1 text-sm text-slate-400">
                Prvo odaberi kupca, zatim grupu proizvoda, pa proizvod. / Önce müşteri, sonra ürün grubu, sonra ürün seç.
              </p>
            </div>

            {prefillMode && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                <p className="text-sm font-medium text-blue-300">
                  Aktivan je režim dodavanja novog proizvoda u istu narudžbu. / Aynı siparişe yeni ürün ekleme modu aktif.
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Order ID: {activeOrderId || "-"}
                </p>
                <button
                  onClick={clearForm}
                  className="mt-2 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white transition hover:bg-slate-800"
                >
                  Očisti formu / Formu Temizle
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Odaberi kupca / Müşteri Seç
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="">
                  Kupca odaberi ili unesi novog / Müşteri seç veya yeni gir
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

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-slate-500">Grupa / Grup</p>
                  <p className="mt-1 font-semibold text-white">
                    {selectedGroupName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Zaliha / Stok</p>
                  <p className="mt-1 font-semibold text-white">
                    {selectedProductData ? Number(selectedProductData.stock) : 0}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Trošak / Maliyet</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(selectedProductData?.cost || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Količina / Adet
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
                  Kataloška cijena / Liste Fiyatı
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
                  Popust / İndirim
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
                  <p className="text-slate-500">Lista / Liste</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(listPrice).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Neto jedinica / Net Birim</p>
                  <p className="mt-1 font-semibold text-emerald-300">
                    €{Number(finalUnitPrice).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Ukupno / Toplam</p>
                  <p className="mt-1 font-semibold text-white">
                    €{Number(total).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Procijenjena dobit / Tahmini Kâr</p>
                  <p className="mt-1 font-semibold text-amber-300">
                    €{Number(estimatedProfit).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Kupac / Müşteri
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
                  Telefon / Telefon
                </label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+382 XX XXX XXX"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Adresa / Adres
              </label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Adresa kupca / Müşteri adresi"
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Zaposleni / Çalışan
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
                  Grad / Şehir
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">Odaberi grad / Şehir seç</option>
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
                  Datum isporuke / Sevkiyat Tarihi
                </label>
                <DatePicker
                  selected={shipmentDate}
                  onChange={(date: Date | null) => setShipmentDate(date)}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Odaberi datum / Tarih seç"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                  calendarClassName="baudecor-datepicker"
                  popperClassName="baudecor-datepicker-popper z-50"
                  wrapperClassName="w-full"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Status / Durum
                </label>
                <select
                  value={simpleStatus}
                  onChange={(e) => setSimpleStatus(e.target.value as SimpleStatus)}
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="Bekliyor / Pending">Čeka / Bekliyor</option>
                  <option value="Teslim Edildi / Delivered">Isporučeno / Teslim Edildi</option>
                  <option value="İptal / Cancelled">Otkazano / İptal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Status plaćanja / Ödeme Durumu
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="Ödendi / Paid">Plaćeno / Ödendi</option>
                <option value="Bekliyor / Pending">Čeka / Bekliyor</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Način plaćanja / Ödeme Yöntemi
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              >
                <option value="Nakit / Cash">Gotovina / Nakit</option>
                <option value="Kredi Kartı / Credit Card">Kreditna kartica / Kredi Kartı (%3)</option>
                <option value="Banka Transferi / Bank Transfer">Bankovni transfer / Banka Havalesi</option>
              </select>
              {paymentMethod === "Kredi Kartı / Credit Card" && (
                <p className="mt-1.5 text-xs text-amber-400">
                  %3 banka komisyonu kârdan düşülecek / 3% banka komisija biće odbijena od dobiti
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Napomena / Not
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Napomena o prodaji / Satış notu"
                rows={3}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 rounded-2xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Čuva se... / Kaydediliyor..." : "Sačuvaj prodaju / Satışı Kaydet"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">Sažetak / Özet</h2>

          <div className="mt-6 space-y-4">
            <InfoCard
              title="Aktivna narudžba / Aktif Sipariş"
              value={activeOrderId ? "Dodaje se postojećoj narudžbi" : "Nova narudžba"}
            />
            <InfoCard
              title="Odabrani kupac / Seçili Müşteri"
              value={customerName || "-"}
            />
            <InfoCard title="Grad / Şehir" value={city || "-"} />
            <InfoCard title="Datum prodaje / Satış Tarihi" value={saleDate || "-"} />
            <InfoCard title="Grupa / Grup" value={selectedGroupName} />
            <InfoCard title="Proizvod / Ürün" value={selectedProductName} />
            <InfoCard title="Količina / Adet" value={String(quantity)} />
            <InfoCard
              title="Neto jedinica / Net Birim"
              value={`€${Number(finalUnitPrice).toFixed(2)}`}
              green
            />
            <InfoCard title="Ukupno / Toplam" value={`€${Number(total).toFixed(2)}`} />
            <InfoCard
              title="Procijenjena dobit / Tahmini Kâr"
              value={`€${Number(estimatedProfit).toFixed(2)}`}
              amber
            />
          </div>
        </aside>
      </div>

      
      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Najprofitabilniji kupci / En Kârlı Müşteriler</h3>
          {topCustomers.map((c, i) => (
            <div key={i} className="flex justify-between text-sm mb-2">
              <span>{c.name}</span>
              <span className={c.profit>=0 ? "text-emerald-300":"text-red-300"}>
                €{c.profit.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Kupci u minusu / Zarardaki Müşteriler</h3>
          {worstCustomers.map((c, i) => (
            <div key={i} className="flex justify-between text-sm mb-2">
              <span>{c.name}</span>
              <span className={c.profit>=0 ? "text-emerald-300":"text-red-300"}>
                €{c.profit.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

<section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Lista aktivne prodaje / Aktif Satış Listesi
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Grupisani prikaz po narudžbi za prodaje koje nijesu isporučene ili plaćene. / Teslim edilmemiş veya ödemesi tamamlanmamış satışların sipariş bazlı gruplanmış görünümü.
          </p>
        </div>

        {loadingSales ? (
          <div className="text-sm text-slate-400">Učitava se / Yükleniyor...</div>
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
                            Narudžba / Sipariş
                          </span>
                          <span className="text-xs text-slate-400">
                            {first.order_id || "-"}
                          </span>
                        </div>

                        <h3 className="text-xl font-semibold text-white">
                          {first.customer_name || "-"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          Telefon / Telefon: {first.customer_phone || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Adresa / Adres: {first.customer_address || "-"} /{" "}
                          {first.city || "-"}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Datum prodaje / Satış Tarihi: {getDisplaySaleDate(first)}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Datum isporuke / Sevkiyat Tarihi: {first.shipment_date || "-"}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 md:items-end">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-right">
                          <p className="text-xs uppercase tracking-wide text-emerald-300">
                            Ukupno narudžbe / Sipariş Toplamı
                          </p>
                          <p className="mt-2 text-2xl font-bold text-emerald-300">
                            €{totalOrder.toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => handleAddProductToOrder(first)}
                          className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                        >
                          + Dodaj proizvod / Ürün Ekle
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[2600px] text-sm">
                      <thead className="text-slate-400">
                        <tr className="border-b border-slate-800">
                          <th className="py-3 text-left">Kupac / Müşteri</th>
                          <th className="py-3 text-left">Telefon / Telefon</th>
                          <th className="py-3 text-left">Grad / Şehir</th>
                          <th className="py-3 text-left">Adresa / Adres</th>
                          <th className="py-3 text-left">Datum prodaje / Satış Tarihi</th>
                          <th className="py-3 text-left">Datum unosa / Kayıt Tarihi</th>
                          <th className="py-3 text-left">Grupa / Grup</th>
                          <th className="py-3 text-left">Proizvod / Ürün</th>
                          <th className="py-3 text-center">Količina / Adet</th>
                          <th className="py-3 text-center">Neto jedinica / Net Birim</th>
                          <th className="py-3 text-center">Popust / İndirim</th>
                          <th className="py-3 text-center">Ukupno / Toplam</th>
                          <th className="py-3 text-center">Trošak / Maliyet</th>
                          <th className="py-3 text-center">Dobit / Kâr</th>
                          <th className="py-3 text-center">Način plaćanja / Ödeme Yöntemi</th>
                          <th className="py-3 text-center">Plaćanje / Ödeme</th>
                          <th className="py-3 text-center">Status / Durum</th>
                          <th className="py-3 text-center">Isporuka / Sevkiyat Tarihi</th>
                          <th className="py-3 text-center">Akcije / İşlemler</th>
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
                                  <option value="">Odaberi grad / Şehir seç</option>
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
                                  <option value="">Odaberi grupu / Grup seç</option>
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
                                {Number(sale.commission_amount || 0) > 0 && (
                                  <div className="text-xs font-normal text-amber-400">
                                    Kom: -€{Number(sale.commission_amount).toFixed(2)}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 text-center text-slate-300">
                                {sale.payment_method === "Kredi Kartı / Credit Card"
                                  ? "Kart / Kartica"
                                  : sale.payment_method === "Banka Transferi / Bank Transfer"
                                  ? "Havale / Transfer"
                                  : "Nakit / Gotovina"}
                              </td>

                              <td className="py-3 text-center">
                                {sale.payment_status === "Ödendi / Paid"
  ? "Plaćeno / Ödendi"
  : sale.payment_status === "Bekliyor / Pending"
  ? "Čeka / Bekliyor"
  : sale.payment_status || "-"}
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
                                  <option value="Bekliyor / Pending">Čeka / Bekliyor</option>
                                  <option value="Teslim Edildi / Delivered">Isporučeno / Teslim Edildi</option>
                                  <option value="İptal / Cancelled">Otkazano / İptal</option>
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
                                    {rowBusy ? "Sačekaj... / Bekle..." : "Obriši / Sil"}
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
                Aktivni zapis ne postoji / Aktif kayıt yok
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
