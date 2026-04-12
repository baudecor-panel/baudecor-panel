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
      { name: cleanedName },
    ]);

    setSavingNew(false);

    if (error) {
      alert("Dodavanje grupe nije uspjelo: " + error.message);
      return;
    }

    alert("Grupa kreirana / Grup eklendi ✅");
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
      alert("Naziv već postoji / Bu grup adı zaten kullanılıyor");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("product_groups")
      .update({ name: cleanedName })
      .eq("id", editingGroupId);

    setSavingEdit(false);

    if (error) {
      alert("Ažuriranje nije uspjelo: " + error.message);
      return;
    }

    alert("Grupa ažurirana / Grup güncellendi ✅");
    cancelEdit();
    await fetchGroups();
  }

  function getProductsInGroup(groupId: string) {
    return products.filter((p) => p.group_id === groupId);
  }

  function getActiveProductsInGroup(groupId: string) {
    return products.filter(
      (p) => p.group_id === groupId && (p.is_active ?? true)
    );
  }

  async function deleteGroup(group: ProductGroup) {
    const linkedProducts = getProductsInGroup(group.id);

    if (linkedProducts.length > 0) {
      alert(
        `Ova grupa se ne može obrisati jer ima ${linkedProducts.length} proizvoda / Bu grup silinemez çünkü ${linkedProducts.length} ürün bağlı`
      );
      return;
    }

    const confirmed = window.confirm(
      `Ova grupa će biti obrisana:\n\n${group.name}\n\nDa li si siguran? / Emin misin?`
    );

    if (!confirmed) return;

    setActionLoadingId(group.id);

    const { error } = await supabase
      .from("product_groups")
      .delete()
      .eq("id", group.id);

    setActionLoadingId("");

    if (error) {
      alert("Brisanje nije uspjelo: " + error.message);
      return;
    }

    alert("Grupa obrisana / Grup silindi ✅");
    await fetchGroups();
  }

  const summary = useMemo(() => {
    const totalGroups = groups.length;
    const usedGroups = groups.filter((g) => getProductsInGroup(g.id).length > 0).length;
    return {
      totalGroups,
      usedGroups,
      emptyGroups: totalGroups - usedGroups,
      totalProducts: products.length,
    };
  }, [groups, products]);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <p className="text-xs text-slate-500">
        BAUDECOR SISTEM / BAUDECOR SİSTEM
      </p>

      <h1 className="text-4xl font-bold">
        Grupe proizvoda / Ürün Grupları
      </h1>

      <p className="text-slate-400">
        Kreiraj, uređuj i upravljaj grupama proizvoda.
      </p>

      <div className="grid gap-4 mt-6 md:grid-cols-4">
        <SummaryCard title="Ukupno grupa" value={summary.totalGroups} />
        <SummaryCard title="Korišćene grupe" value={summary.usedGroups} />
        <SummaryCard title="Prazne grupe" value={summary.emptyGroups} />
        <SummaryCard title="Proizvodi" value={summary.totalProducts} />
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: any) {
  return (
    <div className="p-4 bg-slate-900 rounded-xl">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
