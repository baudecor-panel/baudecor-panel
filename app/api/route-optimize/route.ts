import { NextResponse } from "next/server";

type Point = {
  id: string;
  lat: number;
  lng: number;
};

const SHOWROOM_LAT = 41.935659350080314;
const SHOWROOM_LNG = 19.220623821826575;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const points: Point[] = body.points || [];

    if (points.length < 2) {
      return NextResponse.json(
        { error: "Not enough points" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ORS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ORS_API_KEY missing" },
        { status: 500 }
      );
    }

    const jobs = points.map((p, index) => ({
      id: index,
      location: [p.lng, p.lat],
      service: 300,
    }));

    const res = await fetch("https://api.openrouteservice.org/optimization", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobs,
        vehicles: [
          {
            id: 1,
            profile: "driving-car",
            start: [SHOWROOM_LNG, SHOWROOM_LAT],
            end: [SHOWROOM_LNG, SHOWROOM_LAT],
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || "ORS error" },
        { status: 500 }
      );
    }

    const steps = data?.routes?.[0]?.steps;

    if (!steps) {
      return NextResponse.json(
        { error: "No result" },
        { status: 500 }
      );
    }

    const order = steps
      .filter((s: any) => s.type === "job")
      .map((s: any) => s.id);

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Optimization failed" },
      { status: 500 }
    );
  }
}