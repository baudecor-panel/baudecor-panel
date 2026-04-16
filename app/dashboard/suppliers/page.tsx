"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Supplier = {
  id: number;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
};

type StatusFilter = "all" | "active" | "passive";

const emptyForm = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  note: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState(emptyForm.name);
  const [contactPerson, setContactPerson] = useState(emptyForm.contactPerson);
  const [phone, setPhone] = useState(emptyForm.phone);
  const [email, setEmail] = useState(emptyForm.email);
  const [address, setAddress] = useState(emptyForm.address);
  const [note, setNote] = useState(emptyForm.note);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, contact_person, phone, email, address, note, is_active, created_at")
      .order("name", { ascending: true });

    if (error) {
      alert("Tedarikçiler alınamadı / Suppliers could not be loaded");
      setLoading(false);
      return;
    }

    setSuppliers((data || []) as Supplier[]);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setName(emptyForm.name);
    setContactPerson(emptyForm.contactPerson);
    setPhone(emptyForm.phone);
    setEmail(emptyForm.email);
    setAddress(emptyForm.address);
    setNote(emptyForm.note);
  }

  function fillFormForEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setName(supplier.name || "");
    setContactPerson(supplier.contact_person || "");
    setPhone(supplier.phone || "");
    setEmail(supplier.email || "");
    setAddress(supplier.address || "");
    setNote(supplier.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function checkDuplicateName(supplierName: string) {
    let query = supabase
      .from("suppliers")
      .select("id, name")
      .ilike("name", supplierName.trim());

    if (editingId !== null) {
      query = query.neq("id", editingId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      return { exists: false, checkFailed: true };
    }

    return { exists: (data || []).length > 0, checkFailed: false };
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Lütfen firma adı gir / Please enter supplier name");
      return;
    }

    const duplicateCheck = await checkDuplicateName(name);

    if (duplicateCheck.checkFailed) {
      alert("Duplicate kontrolü yapılamadı, lütfen tekrar dene / Duplicate check failed, please try again");
      return;
    }

    if (duplicateCheck.exists) {
      alert(
        "Aynı isimde bir tedarikçi zaten var / A supplier with the same name already exists"
      );
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      note: note.trim() || null,
    };

    if (editingId !== null) {
      const { error } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editingId);

      setSaving(false);

      if (error) {
        alert(
          "Tedarikçi güncellenemedi / Supplier could not be updated: " +
            error.message
        );
        return;
      }

      alert("Tedarikçi güncellendi / Supplier updated ✅");
      resetForm();
      await fetchSuppliers();
      return;
    }

    const { error } = await supabase.from("suppliers").insert([
      {
        ...payload,
        is_active: true,
      },
    ]);

    setSaving(false);

    if (error) {
      alert(
        "Tedarikçi eklenemedi / Supplier could not be added: " + error.message
      );
      return;
    }

    alert("Tedarikçi eklendi / Supplier added ✅");
    resetForm();
    await fetchSuppliers();
  }

  async function handleToggleStatus(supplier: Supplier) {
    const nextStatus = !supplier.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? "Bu firmayı tekrar aktif yapmak istiyor musun? / Do you want to activate this supplier again?"
        : "Bu firmayı pasif yapmak istiyor musun? / Do you want to set this supplier as passive?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: nextStatus })
      .eq("id", supplier.id);

    if (error) {
      alert(
        "Durum güncellenemedi / Status could not be updated: " + error.message
      );
      return;
    }

    alert(
      nextStatus
        ? "Firma aktif yapıldı / Supplier activated ✅"
        : "Firma pasif yapıldı / Supplier set to passive ✅"
    );

    await fetchSuppliers();
  }

  async function handleDelete(supplier: Supplier) {
    const { data: linkedProducts, error: checkError } = await supabase
      .from("products")
      .select("id")
      .eq("default_supplier_id", supplier.id)
      .limit(1);

    if (checkError) {
      alert("Kontrol yapılamadı / Check failed: " + checkError.message);
      return;
    }

    if ((linkedProducts || []).length > 0) {
      alert(
        "Bu tedarikçiye bağlı ürünler var, silinemez. Önce ürünlerin tedarikçisini değiştir. / This supplier has linked products and cannot be deleted. Reassign products first."
      );
      return;
    }

    const confirmed = window.confirm(
      `Bu tedarikçi kalıcı olarak silinecek:\n\n${supplier.name}\n\nEmin misin? / This supplier will be permanently deleted.\n\nAre you sure?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplier.id);

    if (error) {
      alert("Tedarikçi silinemedi / Supplier could not be deleted: " + error.message);
      return;
    }

    if (editingId === supplier.id) {
      resetForm();
    }

    alert("Tedarikçi silindi / Supplier deleted ✅");
    await fetchSuppliers();
  }

  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((item) => item.is_active).length;
    const passive = suppliers.filter((item) => !item.is_active).length;

    return { total, active, passive };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !normalizedSearch ||
        supplier.name?.toLowerCase().includes(normalizedSearch) ||
        supplier.contact_person?.toLowerCase().includes(normalizedSearch) ||
        supplier.phone?.toLowerCase().includes(normalizedSearch) ||
        supplier.email?.toLowerCase().includes(normalizedSearch) ||
        supplier.address?.toLowerCase().includes(normalizedSearch) ||
        supplier.note?.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? supplier.is_active
          : !supplier.is_active;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchTerm, statusFilter]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            BAUDECOR SISTEM / BAUDECOR SİSTEM
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Dobavljači / Tedarikçiler
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Upravljaj firmama od kojih kupuješ proizvode na jednom mjestu. Ova struktura će kasnije biti povezana sa proizvodima, unosom zaliha i istorijom kretanja. / Ürün alımı yaptığın firmaları tek merkezden yönet.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/50 px-5 py-4 shadow-2xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Ukupno / Toplam
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{stats.total}</p>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 shadow-2xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.22em] text-emerald-300/70">
              Aktivno / Aktif
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">
              {stats.active}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 shadow-2xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-300/70">
              Pasivno / Pasif
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-300">
              {stats.passive}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {editingId !== null
                  ? "Uredi dobavljača / Tedarikçi Düzenle"
                  : "Novi dobavljač / Yeni Tedarikçi"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Unesi, ažuriraj i sačuvaj podatke o firmi. / Firma bilgilerini gir, düzenle ve kayıt altına al.
              </p>
            </div>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Otkaži / İptal
              </button>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Naziv firme / Firma Adı
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Atlas Mobilya / Example: Atlas Furniture"
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Kontakt osoba / Yetkili Kişi
                </label>
                <input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Yetkili adı / Contact name"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Telefon / Telefon
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefon numarası / Phone number"
                  className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email / E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@firma.com / mail@company.com"
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Adresa / Adres
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Firma adresi / Supplier address"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Napomena / Not
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Özel notlar, ödeme bilgisi, çalışma notu / Private notes, payment info, working notes"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Čuva se... / Kaydediliyor..."
                  : editingId !== null
                  ? "Ažuriraj / Güncelle"
                  : "Sačuvaj / Kaydet"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Očisti / Temizle
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Lista firmi / Firma Listesi
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Pretražuj, filtriraj i upravljaj zapisima dobavljača. / Tedarikçi kayıtlarını ara, filtrele ve yönet.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Pretraga / Arama
                </label>
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Firma, yetkili, telefon, e-posta... / Supplier, contact, phone, email..."
                  className="h-[52px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Status / Durum
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="h-[52px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
                >
                  <option value="all">Sve / Tümü</option>
                  <option value="active">Aktivno / Aktif</option>
                  <option value="passive">Pasivno / Pasif</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950/80">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Firma / Dobavljač
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Kontakt / Yetkili
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Telefon / Telefon
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Email / E-posta
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Status / Durum
                    </th>
                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Akcija / İşlem
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        Dobavljači se učitavaju... / Tedarikçiler yükleniyor...
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-slate-400"
                      >
                        Nema zapisa / Kayıt bulunamadı
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">
                            {supplier.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            ID: {supplier.id}
                          </div>
                          {supplier.address ? (
                            <div className="mt-2 max-w-[260px] text-xs leading-5 text-slate-400">
                              {supplier.address}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-300">
                          {supplier.contact_person || "-"}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-300">
                          {supplier.phone || "-"}
                        </td>

                        <td className="px-4 py-4 text-sm text-slate-300">
                          {supplier.email || "-"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              supplier.is_active
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {supplier.is_active
                              ? "Aktivno / Aktif"
                              : "Pasivno / Pasif"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => fillFormForEdit(supplier)}
                              className="rounded-2xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-500 hover:bg-blue-500/10"
                            >
                              Uredi / Düzenle
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(supplier)}
                              className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                                supplier.is_active
                                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              }`}
                            >
                              {supplier.is_active
                                ? "Pasiviraj / Pasife Al"
                                : "Aktiviraj / Aktif Et"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(supplier)}
                              className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
                            >
                              Obriši / Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-500">
            Ukupno prikazanih zapisa / Toplam gösterilen kayıt:{" "}
            <span className="font-semibold text-slate-300">
              {filteredSuppliers.length}
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
