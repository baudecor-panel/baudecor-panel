"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductGroup = {
  id: string;
  name: string;
  created_at?: string;
};

type ProductRow = {
  id: string;
  name: string;
  group_id?: string | null;
  is_active?: boolean | null;
};

export default function ProductGroupsPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newGroupName, setNewGroupName] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState("");

  useEffect(() => {
    initializePage();
  }, []);

  async function initializePage() {
    setLoading(true);
    await Promise.all([fetchGroups(), fetchProducts()]);
    setLoading(false);
  }

  async function fetchGroups() {
    const { data, error } = await supabase
      .from("product_groups")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      alert("Gruplar alınamadı / Product groups could not be loaded");
      return;
    }

    setGroups((data || []) as ProductGroup[]);
  }

  async function fetchProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, group_id, is_active")
      .order("name", { ascending: true });

    if (error) {
      alert("Ürünler alınamadı / Products could not be loaded");
      return;
    }

    setProducts((data || []) as ProductRow[]);
  }

  function normalizeName(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  async function createGroup() {
    const cleanedName = normalizeName(newGroupName);

    if (!cleanedName) {
      alert("Lütfen grup adı gir / Please enter group name");
      return;
    }

    const duplicate = groups.some(
      (group) => group.name.toLowerCase() === cleanedName.toLowerCase()
    );

    if (duplicate) {
      alert("Bu grup zaten var / This group already exists");
      return;
    }

    setSavingNew(true);

    const { error } = await supabase.from("product_groups").insert([
      {
        name: cleanedName,
      },
    ]);

    setSavingNew(false);

    if (error) {
      alert("Grup eklenemedi / Group insert failed: " + error.message);
      return;
    }

    alert("Grup eklendi / Product group created ✅");
    setNewGroupName("");
    await fetchGroups();
  }

  function startEdit(group: ProductGroup) {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  }

  function cancelEdit() {
    setEditingGroupId("");
    setEditingName("");
  }

  async function saveEdit() {
    if (!editingGroupId) return;

    const cleanedName = normalizeName(editingName);

    if (!cleanedName) {
      alert("Lütfen grup adı gir / Please enter group name");
      return;
    }

    const duplicate = groups.some(
      (group) =>
        group.id !== editingGroupId &&
        group.name.toLowerCase() === cleanedName.toLowerCase()
    );

    if (duplicate) {
      alert("Bu grup adı zaten kullanılıyor / This group name is already in use");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("product_groups")
      .update({ name: cleanedName })
      .eq("id", editingGroupId);

    setSavingEdit(false);

    if (error) {
      alert("Grup güncellenemedi / Group update failed: " + error.message);
      return;
    }

    alert("Grup güncellendi / Product group updated ✅");
    cancelEdit();
    await fetchGroups();
  }

  function getProductsInGroup(groupId: string) {
    return products.filter((product) => product.group_id === groupId);
  }

  function getActiveProductsInGroup(groupId: string) {
    return products.filter(
      (product) => product.group_id === groupId && (product.is_active ?? true) === true
    );
  }

  async function deleteGroup(group: ProductGroup) {
    const linkedProducts = getProductsInGroup(group.id);

    if (linkedProducts.length > 0) {
      alert(
        `Bu grup silinemez çünkü bu gruba bağlı ${linkedProducts.length} ürün var. Önce ürünlerin grubunu değiştir. / This group cannot be deleted because ${linkedProducts.length} product(s) are linked to it. Reassign products first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Bu grup silinecek:\n\n${group.name}\n\nEmin misin? / This product group will be deleted.\n\nAre you sure?`
    );

    if (!confirmed) return;

    setActionLoadingId(group.id);

    const { error } = await supabase
      .from("product_groups")
      .delete()
      .eq("id", group.id);

    setActionLoadingId("");

    if (error) {
      alert("Grup silinemedi / Group delete failed: " + error.message);
      return;
    }

    if (editingGroupId === group.id) {
      cancelEdit();
    }

    alert("Grup silindi / Product group deleted ✅");
    await fetchGroups();
  }

  const summary = useMemo(() => {
    const totalGroups = groups.length;
    const usedGroups = groups.filter((group) => getProductsInGroup(group.id).length > 0).length;
    const emptyGroups = totalGroups - usedGroups;

    return {
      totalGroups,
      usedGroups,
      emptyGroups,
      totalProducts: products.length,
    };
  }, [groups, products]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Ürün Grupları / Product Groups
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Ürün gruplarını oluştur, düzenle ve yönet. / Create, edit, and manage
          product groups.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Toplam Grup / Total Groups"
          value={String(summary.totalGroups)}
        />
        <SummaryCard
          title="Kullanılan Grup / Used Groups"
          value={String(summary.usedGroups)}
        />
        <SummaryCard
          title="Boş Grup / Empty Groups"
          value={String(summary.emptyGroups)}
          amber
        />
        <SummaryCard
          title="Bağlı Ürün / Linked Products"
          value={String(summary.totalProducts)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Yeni Grup / New Product Group
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Yeni ürün kategorisi oluştur. / Create a new product category.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Grup Adı / Group Name
              </label>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Örn: Outdoor / Dış Mekan"
                className="h-[56px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={createGroup}
              disabled={savingNew}
              className="mt-2 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingNew ? "Kaydediliyor... / Saving..." : "Grup Ekle / Add Group"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Bilgi / Information
          </h2>
          <div className="mt-6 space-y-4">
            <InfoCard
              title="Kural / Rule"
              value="Bir grup silinmeden önce o gruba bağlı ürünler başka bir gruba taşınmalıdır. / Before a group is deleted, any products linked to it must be moved to another group."
            />
            <InfoCard
              title="Akış / Flow"
              value="Gruplar → Ürünler → Satış / Stok / Groups → Products → Sales / Stock"
            />
            <InfoCard
              title="Not / Note"
              value="Grup sadece organizasyon ve filtreleme içindir; stok hareketleri ürün bazlı kalır. / Groups are only for organization and filtering; stock movements remain product-based."
            />
          </div>
        </aside>
      </div>

      {editingGroupId && (
        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Grup Düzenle / Edit Group
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Seçili grup adını güncelle. / Update the selected group name.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="h-[56px] rounded-2xl border border-slate-700 bg-slate-950 px-4 text-white outline-none transition focus:border-emerald-500"
            />

            <button
              onClick={saveEdit}
              disabled={savingEdit}
              className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
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
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Grup Listesi / Product Group List
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Grup kullanım durumunu gör ve yönlendir. / View and manage group usage.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Yükleniyor / Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Grup / Group</th>
                  <th className="py-3 text-center">Toplam Ürün / Total Products</th>
                  <th className="py-3 text-center">Aktif Ürün / Active Products</th>
                  <th className="py-3 text-left">Durum / Status</th>
                  <th className="py-3 text-center">Oluşturma / Created</th>
                  <th className="py-3 text-center">İşlemler / Actions</th>
                </tr>
              </thead>

              <tbody>
                {groups.map((group) => {
                  const linkedProducts = getProductsInGroup(group.id);
                  const activeProducts = getActiveProductsInGroup(group.id);
                  const busy = actionLoadingId === group.id;

                  return (
                    <tr
                      key={group.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/30"
                    >
                      <td className="py-3 font-medium text-white">{group.name}</td>
                      <td className="py-3 text-center">{linkedProducts.length}</td>
                      <td className="py-3 text-center">{activeProducts.length}</td>
                      <td className="py-3">
                        {linkedProducts.length > 0 ? (
                          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            Kullanılıyor / In Use
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            Boş / Empty
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-center text-slate-400">
                        {group.created_at ? group.created_at.slice(0, 10) : "-"}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            onClick={() => startEdit(group)}
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                          >
                            Düzenle / Edit
                          </button>

                          <button
                            onClick={() => deleteGroup(group)}
                            disabled={busy}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? "Bekle... / Wait..." : "Sil / Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Kayıt yok / No product groups found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  amber,
}: {
  title: string;
  value: string;
  amber?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
      <p className="text-sm text-slate-400">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${amber ? "text-amber-300" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-base font-medium text-white">{value}</p>
    </div>
  );
}