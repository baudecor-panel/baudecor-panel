

import "./globals.css";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname, useRouter } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && pathname !== "/login") {
      router.push("/login");
    }

    if (user && pathname === "/login") {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <html>
        <body className="bg-slate-950 text-white">
          <div className="flex h-screen items-center justify-center">
            Loading...
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="tr">
      <body className="m-0 bg-slate-950 font-sans text-white">
        {children}
      </body>
    </html>
  );
}
