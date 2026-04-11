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
    label: "Genel / General",
    children: [{ href: "/dashboard", label: "Dashboard / Panel" }],
  },
  {
    id: "sales",
    label: "Satış / Sales",
    children: [
      { href: "/dashboard/sales", label: "Satış / Sales" },
      {
        href: "/dashboard/completed-sales",
        label: "Tamamlanan Satışlar / Completed Sales",
      },
      { href: "/dashboard/customers", label: "Müşteriler / Customers" },
    ],
  },
  {
    id: "dispatch",
    label: "Sevkiyat / Dispatch",
    children: [
      { href: "/dashboard/dispatch", label: "Sevkiyat / Dispatch" },
      {
        href: "/dashboard/dispatch-map",
        label: "Sevkiyat Harita / Dispatch Map",
      },
    ],
  },
  {
    id: "products",
    label: "Ürün / Product",
    children: [
      { href: "/dashboard/products", label: "Ürünler / Products" },
      {
        href: "/dashboard/product-groups",
        label: "Ürün Grupları / Product Groups",
      },
      { href: "/dashboard/new-product", label: "Yeni Ürün / New Product" },
      { href: "/dashboard/suppliers", label: "Tedarikçiler / Suppliers" },
    ],
  },
  {
    id: "stock",
    label: "Stok / Stock",
    children: [
      { href: "/dashboard/stock-entry", label: "Stok Girişi / Stock Entry" },
      { href: "/dashboard/stock-out", label: "Stok Çıkışı / Stock Out" },
    ],
  },
  {
    id: "finance",
    label: "Finans / Finance",
    children: [{ href: "/dashboard/expenses", label: "Giderler / Expenses" }],
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
                  Showroom System
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
                  BAUDECOR
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Yönetim paneli / Management panel
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
                  Status / Durum
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-sm text-slate-300">
                    Sistem aktif / System online
                  </span>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Showroom satış, stok, müşteri ve tedarikçi yönetimi /
                  Showroom sales, stock, customer and supplier management
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-slate-950">
          <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">
              Yönetim Paneli / Management Dashboard
            </h2>
          </div>

          <div className="min-h-[calc(100vh-64px)] px-6 py-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
