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
      alert("Grupe nijesu učitane / Gruplar alınamadı");
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
      alert("Proizvodi nijesu učitani / Ürünler alınamadı");
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
      alert("Unesi naziv grupe / Lütfen grup adı gir");
      return;
    }

    const duplicate = groups.some(
      (group) => group.name.toLowerCase() === cleanedName.toLowerCase()
    );

    if (duplicate) {
      alert("Ova grupa već postoji / Bu grup zaten var");
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
      alert("Grup eklenemedi / Dodavanje grupe nije uspjelo: " + error.message);
      return;
    }

    alert("Grup eklendi / Grupa kreirana ✅");
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
      alert("Unesi naziv grupe / Lütfen grup adı gir");
      return;
    }

    const duplicate = groups.some(
      (group) =>
        group.id !== editingGroupId &&
        group.name.toLowerCase() === cleanedName.toLowerCase()
    );

    if (duplicate) {
      alert("Ovaj naziv grupe je već u upotrebi / Bu grup adı zaten kullanılıyor");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("product_groups")
      .update({ name: cleanedName })
      .eq("id", editingGroupId);

    setSavingEdit(false);

    if (error) {
      alert("Grup güncellenemedi / Ažuriranje nije uspjelo: " + error.message);
      return;
    }

    alert("Grup güncellendi / Grupa ažurirana ✅");
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
        `Ova grupa se ne može obrisati jer ima ${linkedProducts.length} ürün var. Önce ürünlerin grubunu değiştir. / This group cannot be deleted because ${linkedProducts.length} product(s) are linked to it. Reassign products first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Ova grupa će biti obrisana:\n\n${group.name}\n\nDa li si siguran? / Bu grup silinecek\n\nAre you sure?`
    );

    if (!confirmed) return;

    setActionLoadingId(group.id);

    const { error } = await supabase
      .from("product_groups")
      .delete()
      .eq("id", group.id);

    setActionLoadingId("");

    if (error) {
      alert("Grup silinemedi / Brisanje nije uspjelo: " + error.message);
      return;
    }

    if (editingGroupId === group.id) {
      cancelEdit();
    }

    alert("Grup silindi / Grupa obrisana ✅");
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
          BAUDECOR SISTEM / BAUDECOR SİSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Grupe proizvoda / Ürün Grupları
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">
          Kreiraj, uređuj i upravljaj grupama proizvoda. / Ürün gruplarını oluştur, düzenle ve yönet.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Ukupno grupa / Toplam Grup"
          value={String(summary.totalGroups)}
        />
        <SummaryCard
          title="Korišćene grupe / Kullanılan Grup"
          value={String(summary.usedGroups)}
        />
        <SummaryCard
          title="Prazne grupe / Boş Grup"
          value={String(summary.emptyGroups)}
          amber
        />
        <SummaryCard
          title="Povezani proizvodi / Bağlı Ürün"
          value={String(summary.totalProducts)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Nova grupa / Yeni Grup
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Kreiraj novu kategoriju proizvoda. / Yeni ürün kategorisi oluştur.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Naziv grupe / Grup Adı
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
              {savingNew ? "Čuva se... / Kaydediliyor..." : "Dodaj grupu / Grup Ekle"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold">
            Informacije / Bilgi
          </h2>
          <div className="mt-6 space-y-4">
            <InfoCard
              title="Pravilo / Kural"
              value="Bir grup silinmeden önce o gruba bağlı ürünler başka bir gruba taşınmalıdır. / Before a group is deleted, any products linked to it must be moved to another group."
            />
            <InfoCard
              title="Tok / Akış"
              value="Gruplar → Ürünler → Satış / Stok / Groups → Products → Sales / Stock"
            />
            <InfoCard
              title="Napomena / Not"
              value="Grup sadece organizasyon ve filtreleme içindir; stok hareketleri ürün bazlı kalır. / Groups are only for organization and filtering; stock movements remain product-based."
            />
          </div>
        </aside>
      </div>

      {editingGroupId && (
        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Uredi grupu / Grup Düzenle
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Ažuriraj naziv odabrane grupe. / Seçili grup adını güncelle.
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
              {savingEdit ? "Čuva se... / Kaydediliyor..." : "Ažuriraj / Güncelle"}
            </button>

            <button
              onClick={cancelEdit}
              className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Otkaži / İptal
            </button>
          </div>
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl shadow-black/20">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">
            Lista grupa / Grup Listesi
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Pregledaj i upravljaj korišćenjem grupa. / Grup kullanım durumunu gör ve yönlendir.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Učitava se / Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-3 text-left">Grupa / Grup</th>
                  <th className="py-3 text-center">Ukupno proizvoda / Toplam Ürün</th>
                  <th className="py-3 text-center">Aktivni proizvodi / Aktif Ürün</th>
                  <th className="py-3 text-left">Status / Durum</th>
                  <th className="py-3 text-center">Kreirano / Oluşturma</th>
                  <th className="py-3 text-center">Akcije / İşlemler</th>
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
                            U upotrebi / Kullanılıyor
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            Prazno / Boş
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
                            Uredi / Düzenle
                          </button>

                          <button
                            onClick={() => deleteGroup(group)}
                            disabled={busy}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy ? "Sačekaj... / Bekle..." : "Obriši / Sil"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Nema zapisa / Kayıt yok
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
