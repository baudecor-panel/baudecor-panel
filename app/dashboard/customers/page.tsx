"use client";

import { useEffect, useMemo, useState } from "react";
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
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Müşteriler alınamadı / Customers could not be loaded");
      return;
    }

    setCustomers((data || []) as Customer[]);
  }

  async function fetchSales() {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Satış kayıtları alınamadı / Sales records could not be loaded");
      return;
    }

    setSales((data || []) as CustomerSale[]);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("sales")
      .update({ delivery_status: status })
      .eq("id", id);

    if (error) {
      alert("Teslim durumu güncellenemedi / Delivery status update failed");
      return;
    }

    setSales((prev) =>
      prev.map((r) => (r.id === id ? { ...r, delivery_status: status } : r))
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
      alert("Müşteri adı boş olamaz / Customer name cannot be empty");
      return;
    }

    setSavingEdit(true);

    const { error: customerError } = await supabase
      .from("customers")
      .update({
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim(),
        city: editForm.city.trim(),
      })
      .eq("id", editForm.id);

    if (customerError) {
      setSavingEdit(false);
      alert("Müşteri güncellenemedi / Customer update failed");
      return;
    }

    const { error: salesError } = await supabase
      .from("sales")
      .update({
        customer_name: editForm.name.trim(),
        customer_phone: editForm.phone.trim(),
        customer_address: editForm.address.trim(),
        city: editForm.city.trim(),
      })
      .eq("customer_id", editForm.id);

    setSavingEdit(false);

    if (salesError) {
      alert(
        "Müşteri güncellendi ama satış kayıtları güncellenemedi / Customer updated but sales sync failed"
      );
      await initializePage();
      cancelEdit();
      return;
    }

    alert("Müşteri güncellendi / Customer updated ✅");
    await initializePage();
    cancelEdit();
  }

  async function handleDeleteCustomer(customer: Customer) {
    const salesCount = sales.filter((sale) => sale.customer_id === customer.id).length;

    const confirmed = window.confirm(
      `${customer.name || "-"} adlı müşteri silinecek.\n\nBağlı satış sayısı: ${salesCount}\n\nBu işlemde müşteri kartı silinir ama eski satış kayıtları korunur. Satışların customer_id alanı boşaltılır.\n\nDevam edilsin mi? / Continue?`
    );

    if (!confirmed) return;

    setDeletingCustomerId(customer.id);

    const { error: detachError } = await supabase
      .from("sales")
      .update({ customer_id: null })
      .eq("customer_id", customer.id);

    if (detachError) {
      setDeletingCustomerId("");
      alert("Satış bağlantısı kaldırılamadı / Sales detach failed");
      return;
    }

    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    setDeletingCustomerId("");

    if (deleteError) {
      alert("Müşteri silinemedi / Customer delete failed");
      return;
    }

    if (expandedCustomerId === customer.id) {
      setExpandedCustomerId("");
    }

    if (editingCustomerId === customer.id) {
      cancelEdit();
    }

    alert("Müşteri silindi / Customer deleted ✅");
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
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Müşteriler / Customers
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Gerçek müşteri listesi ve sipariş geçmişi görünümü. / Real customer list
          and order history view.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Ara / Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Müşteri, telefon, adres, şehir, ürün ara..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Teslim Filtresi / Delivery Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="h-[52px] min-w-[260px] rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
            >
              <option value="all">Tümü / All</option>
              <option value="Bekliyor / Pending">Bekliyor / Pending</option>
              <option value="Hazırlanıyor / Preparing">
                Hazırlanıyor / Preparing
              </option>
              <option value="Teslim Edildi / Delivered">
                Teslim Edildi / Delivered
              </option>
              <option value="İptal / Cancelled">İptal / Cancelled</option>
            </select>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            title="Toplam Müşteri / Total Customers"
            value={String(filteredSummaries.length)}
          />
          <StatCard
            title="Toplam Sipariş / Total Orders"
            value={String(
              filteredSummaries.reduce((sum, item) => sum + item.orderCount, 0)
            )}
          />
          <StatCard
            title="Toplam Ürün / Total Items"
            value={String(
              filteredSummaries.reduce((sum, item) => sum + item.itemCount, 0)
            )}
          />
          <StatCard
            title="Toplam Ciro / Total Revenue"
            value={`€${filteredSummaries
              .reduce((sum, item) => sum + item.totalSpent, 0)
              .toFixed(2)}`}
            green
          />
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/50 py-10 text-center text-slate-400">
            Yükleniyor / Loading...
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/50 py-10 text-center text-slate-400">
            Müşteri bulunamadı / No customers found
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
                              Telefon / Phone: {summary.customer.phone || "-"}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              Adres / Address: {summary.customer.address || "-"} /{" "}
                              {summary.customer.city || "-"}
                            </p>
                          </>
                        ) : (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm text-slate-300">
                                Müşteri / Customer
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
                                Telefon / Phone
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
                                Adres / Address
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
                                Şehir / City
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
                          title="Sipariş"
                          value={String(summary.orderCount)}
                        />
                        <MiniInfoCard
                          title="Ürün"
                          value={String(summary.itemCount)}
                        />
                        <MiniInfoCard
                          title="Toplam"
                          value={`€${summary.totalSpent.toFixed(2)}`}
                          green
                        />
                        <MiniInfoCard
                          title="Son Durum"
                          value={summary.lastDeliveryStatus}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Son Sipariş / Last Order:{" "}
                        {summary.lastOrderDate
                          ? summary.lastOrderDate.slice(0, 10)
                          : "-"}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {!isEditing ? (
                          <>
                            <button
                              onClick={() =>
                                setExpandedCustomerId(
                                  isExpanded ? "" : summary.customer.id
                                )
                              }
                              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800"
                            >
                              {isExpanded
                                ? "Detayı Gizle / Hide Details"
                                : "Detayı Aç / Show Details"}
                            </button>

                            <button
                              onClick={() => startEdit(summary.customer)}
                              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 transition hover:bg-amber-500/20"
                            >
                              Düzenle / Edit
                            </button>

                            <button
                              onClick={() => handleDeleteCustomer(summary.customer)}
                              disabled={isDeleting}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDeleting ? "Siliniyor... / Deleting..." : "Sil / Delete"}
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
                                ? "Kaydediliyor... / Saving..."
                                : "Kaydet / Save"}
                            </button>

                            <button
                              onClick={cancelEdit}
                              disabled={savingEdit}
                              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              İptal / Cancel
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
                          Bu müşteriye ait satış bulunamadı / No sales found for this customer
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1600px] text-sm">
                            <thead className="text-slate-400">
                              <tr className="border-b border-slate-800">
                                <th className="py-3 text-left">Sipariş / Order</th>
                                <th className="py-3 text-left">Tarih / Date</th>
                                <th className="py-3 text-left">
                                  Sevkiyat / Shipment Date
                                </th>
                                <th className="py-3 text-left">Ürün / Product</th>
                                <th className="py-3 text-center">Adet / Qty</th>
                                <th className="py-3 text-center">Birim / Unit</th>
                                <th className="py-3 text-center">Toplam / Total</th>
                                <th className="py-3 text-center">
                                  Teslimat / Delivery
                                </th>
                                <th className="py-3 text-center">
                                  Sevkiyat / Shipment
                                </th>
                                <th className="py-3 text-center">
                                  Yöntem / Method
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
                                      <option>Bekliyor / Pending</option>
                                      <option>Hazırlanıyor / Preparing</option>
                                      <option>Teslim Edildi / Delivered</option>
                                      <option>İptal / Cancelled</option>
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