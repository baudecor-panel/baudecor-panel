"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ProductGroup = {
  id: string;
  name: string;
};

export default function NewProductPage() {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [minimumStock, setMinimumStock] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

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

  async function checkDuplicateName(productName: string) {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .ilike("name", productName.trim())
      .limit(1);

    if (error) {
      return { exists: false };
    }

    return { exists: (data || []).length > 0 };
  }

  async function handleSave() {
    if (!name.trim()) {
      alert("Lütfen ürün adı gir / Please enter product name");
      return;
    }

    if (!groupId) {
      alert("Lütfen ürün grubu seç / Please select product group");
      return;
    }

    if (price < 0 || cost < 0 || stock < 0 || minimumStock < 0) {
      alert("Fiyat, stok veya minimum stok geçersiz / Invalid price, stock, or minimum stock");
      return;
    }

    setSaving(true);

    const duplicate = await checkDuplicateName(name);

    if (duplicate.exists) {
      setSaving(false);
      alert(
        "Bu isimde bir ürün zaten var!\nLütfen farklı isim kullan. / A product with this name already exists!"
      );
      return;
    }

    const initialStock = Number(stock);

    const { error } = await supabase.from("products").insert([
      {
        name: name.trim(),
        group_id: groupId,
        price: Number(price),
        cost: Number(cost),
        stock: initialStock,
        opening_stock: initialStock,
        minimum_stock: Number(minimumStock),
        is_active: true,
      },
    ]);

    setSaving(false);

    if (error) {
      alert("Ürün eklenemedi / Product insert failed: " + error.message);
      return;
    }

    alert("Ürün eklendi / Product created ✅");

    setName("");
    setGroupId("");
    setPrice(0);
    setCost(0);
    setStock(0);
    setMinimumStock(5);
  }

  const selectedGroupName = useMemo(() => {
    return groups.find((group) => group.id === groupId)?.name || "-";
  }, [groups, groupId]);

  const margin = Number(price) - Number(cost);
  const initialStockValue = Number(stock || 0);
  const initialInventoryCost = initialStockValue * Number(cost || 0);
  const initialInventorySaleValue = initialStockValue * Number(price || 0);

  return (
    <main className="flex-1 bg-slate-950 p-8 text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          BAUDECOR SYSTEM
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          Yeni Ürün / New Product
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Sisteme yeni ürün ekle. Açılış stoku opening stock olarak kaydedilir. /
          Add a new product to the system. Initial stock is saved as opening stock.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="grid gap-4">
            <div>
              <label className="text-sm text-slate-400">
                Ürün Adı / Product Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Ürün Grubu / Product Group
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={loadingGroups}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4 text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {loadingGroups
                    ? "Gruplar yükleniyor... / Loading groups..."
                    : "Grup seç / Select group"}
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              {!loadingGroups && groups.length === 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Henüz grup yok. Önce veritabanına grup eklemelisin. / No groups found yet. Add groups in the database first.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">
                  Satış Fiyatı / Price
                </label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400">
                  Maliyet / Cost
                </label>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-400">
                Başlangıç Stok / Initial Stock
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
              />
              <p className="mt-2 text-xs text-slate-500">
                Bu değer opening_stock olarak kaydedilir. Sistem uyumu için products.stock alanına da aynı değer yazılır. /
                This value is saved as opening_stock. For compatibility, the same value is also written to products.stock.
              </p>
            </div>
            <div>
              <label className="text-sm text-slate-400">
                Minimum Stok / Minimum Stock
              </label>
              <input
                type="number"
                min={0}
                value={minimumStock}
                onChange={(e) => setMinimumStock(Number(e.target.value))}
                className="mt-2 h-[56px] w-full rounded-2xl bg-slate-950 px-4"
              />
              <p className="mt-2 text-xs text-slate-500">
                Bu değer kritik stok sınırıdır. Dashboard ve ürünler ekranı bu limite göre uyarı verir. /
                This value is the critical stock threshold. Dashboard and products screens will use this limit for alerts.
              </p>
            </div>


            <button
              onClick={handleSave}
              disabled={saving || loadingGroups || groups.length === 0}
              className="mt-4 rounded-2xl bg-blue-600 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Kaydet / Save"}
            </button>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold">Özet / Summary</h2>

          <div className="mt-6 space-y-4">
            <InfoCard title="Ürün" value={name || "-"} />
            <InfoCard title="Grup" value={selectedGroupName} />
            <InfoCard title="Fiyat" value={`€${Number(price).toFixed(2)}`} />
            <InfoCard title="Maliyet" value={`€${Number(cost).toFixed(2)}`} />
            <InfoCard
              title="Marj"
              value={`€${Number(margin).toFixed(2)}`}
              green={margin >= 0}
              red={margin < 0}
            />
            <InfoCard title="Başlangıç Stok" value={String(initialStockValue)} />
            <InfoCard title="Minimum Stok" value={String(Number(minimumStock || 0))} />
            <InfoCard
              title="Açılış Maliyeti / Opening Cost"
              value={`€${initialInventoryCost.toFixed(2)}`}
            />
            <InfoCard
              title="Açılış Satış Değeri / Opening Sale Value"
              value={`€${initialInventorySaleValue.toFixed(2)}`}
            />
          </div>
        </aside>
      </div>
    </main>
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
    <div className="rounded-xl border border-slate-800 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-1 text-lg ${color}`}>{value}</p>
    </div>
  );
}