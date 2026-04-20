"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    label: "Opšte / Genel",
    children: [{ href: "/dashboard", label: "Kontrolna tabla / Panel" }],
  },
  {
    id: "sales",
    label: "Prodaja / Satış",
    children: [
      { href: "/dashboard/sales", label: "Prodaja / Satış" },
      {
        href: "/dashboard/completed-sales",
        label: "Završene prodaje / Tamamlanan Satışlar",
      },
      { href: "/dashboard/customers", label: "Kupci / Müşteriler" },
    ],
  },
  {
    id: "dispatch",
    label: "Isporuka / Sevkiyat",
    children: [
      { href: "/dashboard/dispatch", label: "Isporuka / Sevkiyat" },
      {
        href: "/dashboard/dispatch-map",
        label: "Mapa isporuke / Sevkiyat Haritası",
      },
    ],
  },
  {
    id: "products",
    label: "Proizvodi / Ürünler",
    children: [
      { href: "/dashboard/products", label: "Proizvodi / Ürünler" },
      {
        href: "/dashboard/product-groups",
        label: "Grupe proizvoda / Ürün Grupları",
      },
      { href: "/dashboard/new-product", label: "Novi proizvod / Yeni Ürün" },
      { href: "/dashboard/suppliers", label: "Dobavljači / Tedarikçiler" },
    ],
  },
  {
    id: "stock",
    label: "Zaliha / Stok",
    children: [
      { href: "/dashboard/stock-entry", label: "Unos zaliha / Stok Girişi" },
      { href: "/dashboard/stock-out", label: "Izlaz zaliha / Stok Çıkışı" },
    ],
  },
  {
    id: "finance",
    label: "Finansije / Finans",
    children: [{ href: "/dashboard/expenses", label: "Troškovi / Giderler" }],
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
        <aside className="w-[290px] shrink-0 border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-5 py-6">
          <div className="flex h-full flex-col">
            <div>
              <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/20">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  SHOWROOM SISTEM
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
                  BAUDECOR
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Upravljački panel / Yönetim Paneli
                </p>
              </div>

              <nav className="space-y-3">
                {menuGroups.map((group) => {
                  const isOpen = openGroupId === group.id;
                  const hasActiveChild = group.children.some(
                    (item) => pathname === item.href
                  );

                  return (
                    <div
                      key={group.id}
                      className="rounded-3xl border border-slate-800 bg-slate-900/40"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left text-sm font-semibold transition ${
                          hasActiveChild
                            ? "bg-blue-500/10 text-white"
                            : "text-slate-200 hover:bg-slate-900/70 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center">
                          <span
                            className={`mr-3 h-2.5 w-2.5 rounded-full transition ${
                              hasActiveChild ? "bg-blue-400" : "bg-slate-600"
                            }`}
                          />
                          {group.label}
                        </div>

                        <span
                          className={`text-xs transition ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3">
                          <div className="space-y-2 border-t border-slate-800 pt-3">
                            {group.children.map((item) => {
                              const active = pathname === item.href;

                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={`group flex items-center rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                                    active
                                      ? "border-blue-500/30 bg-blue-500/10 text-white shadow-lg shadow-blue-950/30"
                                      : "border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900/70 hover:text-white"
                                  }`}
                                >
                                  <span
                                    className={`mr-3 h-2 w-2 rounded-full transition ${
                                      active
                                        ? "bg-blue-400"
                                        : "bg-slate-600 group-hover:bg-slate-400"
                                    }`}
                                  />
                                  {item.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  STATUS / DURUM
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-sm text-slate-300">
                    Sistem aktivan / Sistem aktif
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Upravljanje prodajom, zalihama, kupcima i dobavljačima /
                  Satış, stok, müşteri ve tedarikçi yönetimi
                </p>
              </div>
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
