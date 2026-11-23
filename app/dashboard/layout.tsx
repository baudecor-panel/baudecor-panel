"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type MenuChild = {
  href: string;
  label: string;
};

type MenuGroup = {
  id: string;
  label: string;
  children: MenuChild[];
};

const menuGroups: MenuGroup[] = [
  {
    id: "general",
    label: "Kontrolna tabla / Panel",
    children: [{ href: "/dashboard", label: "Kontrolna tabla / Panel" }],
  },
  {
    id: "sales",
    label: "Prodaja / Satış",
    children: [
      { href: "/dashboard/sales", label: "Prodaja / Satış" },
      { href: "/dashboard/completed-sales", label: "Završene prodaje / Tamamlanan Satışlar" },
      { href: "/dashboard/customers", label: "Kupci / Müşteriler" },
    ],
  },
  {
    id: "dispatch",
    label: "Isporuka / Sevkiyat",
    children: [
      { href: "/dashboard/dispatch", label: "Isporuka / Sevkiyat" },
      { href: "/dashboard/dispatch-map", label: "Mapa isporuke / Sevkiyat Haritası" },
    ],
  },
  {
    id: "products",
    label: "Proizvodi i zaliha / Ürünler & Stok",
    children: [
      { href: "/dashboard/products", label: "Proizvodi / Ürünler" },
      { href: "/dashboard/stock-entry", label: "Unos zaliha / Stok Girişi" },
      { href: "/dashboard/stock-out", label: "Izlaz zaliha / Stok Çıkışı" },
      { href: "/dashboard/new-product", label: "Novi proizvod / Yeni Ürün" },
      { href: "/dashboard/product-groups", label: "Grupe proizvoda / Ürün Grupları" },
      { href: "/dashboard/suppliers", label: "Dobavljači / Tedarikçiler" },
    ],
  },
  {
    id: "finance",
    label: "Kasa i troškovi / Kasa & Giderler",
    children: [
      { href: "/dashboard/kasa", label: "Kasa / Kasa" },
      { href: "/dashboard/expenses", label: "Troškovi / Giderler" },
    ],
  },
  {
    id: "reports",
    label: "Izvještaji / Raporlar",
    children: [{ href: "/dashboard/reports", label: "Izvještaji / Raporlar" }],
  },
  {
    id: "ai",
    label: "AI Asistan",
    children: [{ href: "/dashboard/ai-assistant", label: "AI Asistan / AI Asistent" }],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoggingOut(false);
      alert("Odjava nije uspjela / Çıkış yapılamadı: " + error.message);
      return;
    }
    router.push("/login");
  }

  const activeGroupId = useMemo(() => {
    return (
      menuGroups.find((group) =>
        group.children.some((item) => pathname === item.href)
      )?.id || null
    );
  }, [pathname]);

  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId);

  useEffect(() => {
    setOpenGroupId(activeGroupId);
  }, [activeGroupId]);

  function toggleGroup(groupId: string) {
    setOpenGroupId((prev) => (prev === groupId ? null : groupId));
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-white">
      <div className="flex h-full">
        <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900 px-4 py-6">
          <div className="flex h-full flex-col">
            <div>
              <div className="mb-6 px-3">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  BAU<span className="text-blue-400">DECOR</span>
                </h1>
              </div>

              <nav className="space-y-1">
                {menuGroups.map((group) => {
                  const isOpen = openGroupId === group.id;
                  const hasActiveChild = group.children.some(
                    (item) => pathname === item.href
                  );

                  if (group.children.length === 1) {
                    const item = group.children[0];
                    return (
                      <Link
                        key={group.id}
                        href={item.href}
                        className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          hasActiveChild
                            ? "bg-blue-500/15 text-white"
                            : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        {group.label}
                      </Link>
                    );
                  }

                  return (
                    <div key={group.id}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                          hasActiveChild
                            ? "text-white"
                            : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        {group.label}
                        <span
                          className={`text-[10px] text-slate-500 transition ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="mb-1 ml-3 space-y-0.5 border-l border-slate-800 pl-2">
                          {group.children.map((item) => {
                            const active = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={`block rounded-lg px-3 py-2 text-sm transition ${
                                  active
                                    ? "bg-blue-500/15 font-medium text-white"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full rounded-xl border border-slate-800 px-3 py-2.5 text-left text-sm text-slate-400 transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-60"
              >
                {loggingOut ? "Odjava u toku / Çıkış yapılıyor" : "Odjava / Çıkış Yap"}
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-slate-950">
          <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Upravljački panel / Yönetim Paneli
              </h2>
            </div>
          </div>

          <div className="min-h-[calc(100vh-64px)] px-6 py-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
