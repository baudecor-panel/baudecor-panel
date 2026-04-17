"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

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

type CustomerSale = {
  id: string;
  customer_id?: string | null;
  order_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  city?: string | null;
  created_at: string;
  shipment_date?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  final_unit_price?: number | null;
  total: number;
  delivery_status?: string | null;
  shipment_status?: string | null;
  delivery_method?: string | null;
};

type FilterType =
  | "all"
  | "Bekliyor / Pending"
  | "Hazırlanıyor / Preparing"
  | "Teslim Edildi / Delivered"
  | "İptal / Cancelled";

type CustomerSummary = {
  customer: Customer;
  orderCount: number;
  itemCount: number;
  totalSpent: number;
  lastOrderDate: string | null;
  lastDeliveryStatus: string;
  sales: CustomerSale[];
};

type EditForm = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    id: "",
    name: "",
    phone: "",
    address: "",
    city: "",
  });

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    setLoading(true);
    await Promise.all([fetchCustomers(), fetchSales()]);
    setLoading(false);
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
    const { data, error } = await supabase
      .from("sales")
      .select("id, customer_id, order_id, customer_name, customer_phone, customer_address, city, created_at, shipment_date, product_name, quantity, unit_price, final_unit_price, total, delivery_status, shipment_status, delivery_method")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Zapisi prodaje nijesu učitani / Satış kayıtları alınamadı");
      return;
    }

    setSales((data || []) as CustomerSale[]);
  }

  async function geocodeAddress(address: string, cityName: string) {
    const trimmedAddress = address.trim();
    const trimmedCity = cityName.trim();

    if (!trimmedAddress || !trimmedCity) {
      return { found: false, latitude: null, longitude: null };
    }

    try {
      const url = new URL("/api/geocode", window.location.origin);
      url.searchParams.set("address", trimmedAddress);
      url.searchParams.set("city", trimmedCity);

      const response = await fetch(url.toString());
      if (!response.ok) return { found: false, latitude: null, longitude: null };

      const data = await response.json();
      return {
        found: Boolean(data.found),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      };
    } catch {
      return { found: false, latitude: null, longitude: null };
    }
  }

  function getStatusPayload(status: string) {
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
    if (status === "Hazırlanıyor / Preparing") {
      return {
        delivery_status: "Hazırlanıyor / Preparing",
        shipment_status: "Hazırlanıyor / Preparing",
      };
    }
    return {
      delivery_status: "Bekliyor / Pending",
      shipment_status: "Planlandı / Planned",
    };
  }

  async function updateStatus(id: string, status: string) {
    const payload = getStatusPayload(status);

    const { error } = await supabase
      .from("sales")
      .update(payload)
      .eq("id", id);

    if (error) {
      alert("Status isporuke nije ažuriran / Teslim durumu güncellenemedi");
      return;
    }

    setSales((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, delivery_status: payload.delivery_status, shipment_status: payload.shipment_status }
          : r
      )
    );
  }

  function startEdit(customer: Customer) {
    setEditingCustomerId(customer.id);
    setEditForm({
      id: customer.id,
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
    });
  }

  function cancelEdit() {
    setEditingCustomerId("");
    setEditForm({
      id: "",
      name: "",
      phone: "",
      address: "",
      city: "",
    });
  }

  async function handleSaveEdit() {
    if (!editForm.id) return;

    if (!editForm.name.trim()) {
      alert("Ime kupca ne može biti prazno / Müşteri adı boş olamaz");
      return;
    }

    setSavingEdit(true);

    const geocode = await geocodeAddress(editForm.address, editForm.city);

    const { error: customerError } = await supabase
      .from("customers")
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        city: editForm.city.trim(),
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      })
      .eq("id", editForm.id);

    if (customerError) {
      setSavingEdit(false);
      alert("Kupac nije ažuriran / Müşteri güncellenemedi");
      return;
    }

    const { error: salesError } = await supabase
      .from("sales")
      .update({
        customer_name: editForm.name.trim(),
        customer_phone: editForm.phone.trim(),
        customer_address: editForm.address.trim(),
        city: editForm.city.trim(),
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      })
      .eq("customer_id", editForm.id);

    setSavingEdit(false);

    if (salesError) {
      alert(
        "Kupac je ažuriran ali zapisi prodaje nijesu sinhronizovani / Müşteri güncellendi ama satış kayıtları güncellenemedi"
      );
      await initializePage();
      cancelEdit();
      return;
    }

    alert("Kupac je ažuriran / Müşteri güncellendi ✅");
    await initializePage();
    cancelEdit();
  }

  async function handleDeleteCustomer(customer: Customer) {
    const salesCount = sales.filter((sale) => sale.customer_id === customer.id).length;

    const confirmed = window.confirm(
      `${customer.name || "-"}  adlı kupac će biti obrisan.\n\nBroj povezanih prodaja: ${salesCount}\n\nU ovoj radnji kartica kupca se briše, ali stari zapisi prodaje ostaju. Polje customer_id u prodajama će biti ispražnjeno.\n\nNastaviti? / Devam edilsin mi?`
    );

    if (!confirmed) return;

    setDeletingCustomerId(customer.id);

    const { error: detachError } = await supabase
      .from("sales")
      .update({ customer_id: null })
      .eq("customer_id", customer.id);

    if (detachError) {
      setDeletingCustomerId("");
      alert("Veza prodaje nije uklonjena / Satış bağlantısı kaldırılamadı");
      return;
    }

    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    setDeletingCustomerId("");

    if (deleteError) {
      alert("Kupac nije obrisan / Müşteri silinemedi");
      return;
    }

    if (expandedCustomerId === customer.id) {
      setExpandedCustomerId("");
    }

    if (editingCustomerId === customer.id) {
      cancelEdit();
    }

    alert("Kupac je obrisan / Müşteri silindi ✅");
    await initializePage();
  }

  const customerSummaries = useMemo(() => {
    return customers.map((customer) => {
      const customerSales = sales.filter((sale) => sale.customer_id === customer.id);

      const uniqueOrderIds = new Set(
        customerSales
          .map((sale) => sale.order_id)
          .filter((orderId): orderId is string => Boolean(orderId))
      );

      const fallbackOrderKeys = new Set(
        customerSales
          .filter((sale) => !sale.order_id)
          .map(
            (sale) =>
              `${sale.created_at || ""}_${sale.shipment_date || ""}_${sale.product_name || ""}`
          )
      );

      const orderCount = uniqueOrderIds.size + fallbackOrderKeys.size;

      const itemCount = customerSales.reduce(
        (sum, sale) => sum + Number(sale.quantity || 0),
        0
      );

      const totalSpent = customerSales.reduce(
        (sum, sale) => sum + Number(sale.total || 0),
        0
      );

      const sortedSales = [...customerSales].sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );

      const lastOrderDate = sortedSales[0]?.created_at || null;
      const lastDeliveryStatus = sortedSales[0]?.delivery_status || "-";

      return {
        customer,
        orderCount,
        itemCount,
        totalSpent,
        lastOrderDate,
        lastDeliveryStatus,
        sales: sortedSales,
      };
    });
  }, [customers, sales]);

  const filteredSummaries = useMemo(() => {
    let result = customerSummaries;

    if (filter !== "all") {
      result = result.filter(
        (summary) =>
          summary.sales.length > 0 &&
          summary.sales.some((sale) => sale.delivery_status === filter)
      );
    }

    const q = search.toLowerCase().trim();

    if (!q) return result;

    return result.filter((summary) => {
      const c = summary.customer;

      const matchCustomer =
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q);

      const matchSales = summary.sales.some(
        (sale) =>
          (sale.product_name || "").toLowerCase().includes(q) ||
          (sale.delivery_status || "").toLowerCase().includes(q) ||
          (sale.shipment_status || "").toLowerCase().includes(q)
      );

      return matchCustomer || matchSales;
    });
  }, [customerSummaries, filter, search]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Kupci / Müşteriler
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Prikaz stvarne liste kupaca i istorije narudžbi. / Gerçek müşteri listesi ve sipariş geçmişi görünümü.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Pretraga / Arama
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kupac, telefon, adresa, grad, proizvod ara... / Müşteri, telefon, adres, şehir, ürün ara..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Filter isporuke / Teslim Filtresi
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="h-[52px] min-w-[260px] rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
            >
              <option value="all">Sve / Tümü</option>
              <option value="Bekliyor / Pending">Čeka / Bekliyor</option>
              <option value="Hazırlanıyor / Preparing">
                Priprema se / Hazırlanıyor
              </option>
              <option value="Teslim Edildi / Delivered">
                Isporučeno / Teslim Edildi
              </option>
              <option value="İptal / Cancelled">Otkazano / İptal</option>
            </select>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            title="Ukupno kupaca / Ukupno Müşteri"
            value={String(filteredSummaries.length)}
          />
          <StatCard
            title="Ukupno narudžbi / Ukupno Narudžba"
            value={String(
              filteredSummaries.reduce((sum, item) => sum + item.orderCount, 0)
            )}
          />
          <StatCard
            title="Ukupno proizvoda / Ukupno Proizvod"
            value={String(
              filteredSummaries.reduce((sum, item) => sum + item.itemCount, 0)
            )}
          />
          <StatCard
            title="Ukupan promet / Ukupno Ciro"
            value={`€${filteredSummaries
              .reduce((sum, item) => sum + item.totalSpent, 0)
              .toFixed(2)}`}
            green
          />
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/50 py-10 text-center text-slate-400">
            Učitava se / Yükleniyor...
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/50 py-10 text-center text-slate-400">
            Kupac nije pronađen / Müşteri bulunamadı
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSummaries.map((summary) => {
              const isExpanded = expandedCustomerId === summary.customer.id;
              const isEditing = editingCustomerId === summary.customer.id;
              const isDeleting = deletingCustomerId === summary.customer.id;

              return (
                <div
                  key={summary.customer.id}
                  className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/50"
                >
                  <div className="px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        {!isEditing ? (
                          <>
                            <h2 className="text-xl font-semibold text-white">
                              {summary.customer.name || "-"}
                            </h2>
                            <p className="mt-1 text-sm text-slate-300">
                              Telefon / Telefon: {summary.customer.phone || "-"}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              Adresa / Adres: {summary.customer.address || "-"} /{" "}
                              {summary.customer.city || "-"}
                            </p>
                          </>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm text-slate-300">
                                Kupac / Müşteri
                              </label>
                              <input
                                value={editForm.name}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                  }))
                                }
                                className="h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-slate-300">
                                Telefon / Telefon
                              </label>
                              <input
                                value={editForm.phone}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    phone: e.target.value,
                                  }))
                                }
                                className="h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-slate-300">
                                Adresa / Adres
                              </label>
                              <input
                                value={editForm.address}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    address: e.target.value,
                                  }))
                                }
                                className="h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-slate-300">
                                Grad / Şehir
                              </label>
                              <input
                                value={editForm.city}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    city: e.target.value,
                                  }))
                                }
                                className="h-[48px] w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <MiniInfoCard
                          title="Narudžba"
                          value={String(summary.orderCount)}
                        />
                        <MiniInfoCard
                          title="Proizvod"
                          value={String(summary.itemCount)}
                        />
                        <MiniInfoCard
                          title="Ukupno"
                          value={`€${summary.totalSpent.toFixed(2)}`}
                          green
                        />
                        <MiniInfoCard
                          title="Posljednji status"
                          value={summary.lastDeliveryStatus}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Son Narudžba / Last Order:{" "}
                        {summary.lastOrderDate
                          ? summary.lastOrderDate.slice(0, 10)
                          : "-"}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {!isEditing ? (
                          <>
                            <Link
                              href={`/dashboard/customers/${summary.customer.id}`}
                              className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 transition hover:bg-blue-500/20"
                            >
                              Detay Sayfası / Detalji
                            </Link>

                            <button
                              onClick={() =>
                                setExpandedCustomerId(
                                  isExpanded ? "" : summary.customer.id
                                )
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800"
                            >
                              {isExpanded
                                ? "Sakrij detalje / Detayı Gizle"
                                : "Otvori detalje / Detayı Aç"}
                            </button>

                            <button
                              onClick={() => startEdit(summary.customer)}
                              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/20"
                            >
                              Uredi / Düzenle
                            </button>

                            <button
                              onClick={() => handleDeleteCustomer(summary.customer)}
                              disabled={isDeleting}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? "Briše se... / Siliniyor..." : "Obriši / Sil"}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={savingEdit}
                              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingEdit
                                ? "Čuva se... / Kaydediliyor..."
                                : "Sačuvaj / Kaydet"}
                            </button>

                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Otkaži / İptal
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && !isEditing && (
                    <div className="border-t border-slate-800 px-6 py-6">
                      {summary.sales.length === 0 ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 py-8 text-center text-slate-400">
                          Za ovog kupca nije pronađena prodaja / Bu müşteriye ait satış bulunamadı
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1600px] text-sm">
                            <thead className="text-slate-400">
                              <tr className="border-b border-slate-800">
                                <th className="py-3 text-left">Narudžba / Order</th>
                                <th className="py-3 text-left">Datum / Tarih</th>
                                <th className="py-3 text-left">
                                  Datum isporuke / Sevkiyat Tarihi
                                </th>
                                <th className="py-3 text-left">Proizvod / Product</th>
                                <th className="py-3 text-center">Količina / Adet</th>
                                <th className="py-3 text-center">Jedinica / Birim</th>
                                <th className="py-3 text-center">Ukupno / Total</th>
                                <th className="py-3 text-center">
                                  Isporuka / Teslimat
                                </th>
                                <th className="py-3 text-center">
                                  Pošiljka / Sevkiyat
                                </th>
                                <th className="py-3 text-center">
                                  Metod / Yöntem
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {summary.sales.map((sale) => (
                                <tr
                                  key={sale.id}
                                  className="border-t border-slate-800 transition hover:bg-slate-900/60"
                                >
                                  <td className="py-3">
                                    <span className="text-xs text-slate-300">
                                      {sale.order_id || "-"}
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    {sale.created_at?.slice(0, 10) || "-"}
                                  </td>
                                  <td className="py-3">
                                    {sale.shipment_date || "-"}
                                  </td>
                                  <td className="py-3">{sale.product_name || "-"}</td>
                                  <td className="py-3 text-center">
                                    {sale.quantity || 0}
                                  </td>
                                  <td className="py-3 text-center">
                                    €
                                    {Number(
                                      sale.final_unit_price ?? sale.unit_price ?? 0
                                    ).toFixed(2)}
                                  </td>
                                  <td className="py-3 text-center font-medium">
                                    €{Number(sale.total || 0).toFixed(2)}
                                  </td>
                                  <td className="py-3 text-center">
                                    <select
                                      value={
                                        sale.delivery_status || "Bekliyor / Pending"
                                      }
                                      onChange={(e) =>
                                        updateStatus(sale.id, e.target.value)
                                      }
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                                    >
                                      <option value="Bekliyor / Pending">Čeka / Bekliyor</option>
                                      <option value="Hazırlanıyor / Preparing">Priprema se / Hazırlanıyor</option>
                                      <option value="Teslim Edildi / Delivered">Isporučeno / Teslim Edildi</option>
                                      <option value="İptal / Cancelled">Otkazano / İptal</option>
                                    </select>
                                  </td>
                                  <td className="py-3 text-center">
                                    {sale.shipment_status || "-"}
                                  </td>
                                  <td className="py-3 text-center">
                                    {sale.delivery_method || "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({
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
      <p className={`mt-2 text-lg font-semibold ${green ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function MiniInfoCard({
  title,
  value,
  green,
}: {
  title: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-1 text-sm font-semibold ${green ? "text-emerald-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
