"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const path = usePathname();

  const menu = [
    { name: "Kontrolna tabla / Panel", href: "/dashboard" },
    { name: "Prodaja / Satış", href: "/dashboard/sales" },
    { name: "Proizvodi / Ürünler", href: "/dashboard/products" },
    { name: "Kupci / Müşteriler", href: "/dashboard/customers" },
    { name: "Troškovi / Giderler", href: "/dashboard/expenses" },
    { name: "Isporuka / Teslimat", href: "/dashboard/deliveries" },
    { name: "Izvještaji / Raporlar", href: "/dashboard/reports" },
  ];

  return (
    <aside className="w-64 h-screen bg-slate-900 border-r border-slate-800 p-4">
      <h2 className="text-xl font-bold mb-6">BAUDECOR</h2>

      <nav className="flex flex-col gap-2">
        {menu.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={`p-3 rounded-lg cursor-pointer ${
                path === item.href ? "bg-blue-600" : "hover:bg-slate-800"
              }`}
            >
              {item.name}
            </div>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
