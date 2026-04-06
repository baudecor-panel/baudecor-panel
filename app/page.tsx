export default function Home() {
  return (
    <main
      style={{
        padding: 40,
        background: "#0f172a",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: 32, fontWeight: "bold" }}>
        BAUDECOR SYSTEM
      </h1>

      <p style={{ marginTop: 10, color: "#94a3b8" }}>
        Yönetim Paneli / Management Dashboard
      </p>

      <div
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
      >
        <div style={card}>Ciro / Revenue</div>
        <div style={card}>Kâr / Profit</div>
        <div style={card}>Gider / Expenses</div>
        <div style={card}>Stok / Stock</div>
      </div>
    </main>
  );
}

const card = {
  background: "#1e293b",
  padding: 20,
  borderRadius: 12,
};