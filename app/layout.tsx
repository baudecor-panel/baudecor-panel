import "./globals.css";
import "leaflet/dist/leaflet.css";
import AuthProvider from "./AuthProvider";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata = {
  title: "BAUDECOR SYSTEM",
  description: "Showroom Management Panel",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Baudecor",
  },
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="m-0 bg-slate-950 font-sans text-white">
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
