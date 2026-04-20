import { NextResponse } from "next/server";

type RouteLineRequest = {
  coords?: [number, number][]; // [lng, lat] pairs
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RouteLineRequest;
    const coords = Array.isArray(body?.coords) ? body.coords : [];

    if (coords.length < 2) {
      return NextResponse.json({ error: "Not enough coordinates" }, { status: 400 });
    }

    // OSRM: coords as "lng,lat;lng,lat;..." in URL
    const coordStr = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

    const res = await fetch(url, { headers: { "User-Agent": "baudecor-system/1.0" } });
    const data = await res.json();

    if (!res.ok || data.code !== "Ok") {
      return NextResponse.json({ error: data.message || "OSRM routing failed" }, { status: 500 });
    }

    // Normalize to same shape as before: features[0].geometry.coordinates
    const geometry = data?.routes?.[0]?.geometry;
    return NextResponse.json({ features: [{ geometry }] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Route line failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
