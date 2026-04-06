import "./globals.css";
import "leaflet/dist/leaflet.css";
import AuthProvider from "./AuthProvider";

export const metadata = {
  title: "BAUDECOR SYSTEM",
  description: "Showroom Management Panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="m-0 bg-slate-950 font-sans text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
