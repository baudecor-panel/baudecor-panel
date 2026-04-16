import { NextResponse } from "next/server";

type RouteLineRequest = {
  coords?: [number, number][];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RouteLineRequest;
    const coords = Array.isArray(body?.coords) ? body.coords : [];

    if (coords.length < 2) {
      return NextResponse.json(
        { error: "Not enough coordinates" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ORS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ORS_API_KEY is missing in .env.local" },
        { status: 500 }
      );
    }

    const orsRes = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: coords,
          instructions: false,
        }),
      }
    );

    const orsData = await orsRes.json();

    if (!orsRes.ok) {
      return NextResponse.json(
        {
          error:
            orsData?.error?.message ||
            orsData?.message ||
            "openrouteservice directions failed",
          ors: orsData,
        },
        { status: orsRes.status }
      );
    }

    return NextResponse.json(orsData);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Route line failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}