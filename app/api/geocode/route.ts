import { NextRequest, NextResponse } from "next/server";

type NominatimRow = {
  lat: string;
  lon: string;
  display_name?: string;
};

async function queryNominatim(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "me");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "BAUDECOR-SYSTEM/1.0 (dispatch geocoding)",
      "Accept-Language": "tr,en",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      query,
      raw: text,
      data: [] as NominatimRow[],
    };
  }

  let data: NominatimRow[] = [];

  try {
    data = JSON.parse(text) as NominatimRow[];
  } catch {
    return {
      ok: false,
      status: response.status,
      query,
      raw: text,
      data: [] as NominatimRow[],
    };
  }

  return {
    ok: true,
    status: response.status,
    query,
    raw: text,
    data,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = (searchParams.get("address") || "").trim();
    const city = (searchParams.get("city") || "").trim();

    if (!address && !city) {
      return NextResponse.json(
        { error: "Address or city is required" },
        { status: 400 }
      );
    }

    const queries = [
      [address, city, "Montenegro"].filter(Boolean).join(", "),
      [address, city].filter(Boolean).join(", "),
      [city, "Montenegro"].filter(Boolean).join(", "),
      [city].filter(Boolean).join(", "),
    ].filter(Boolean);

    const attempts: Array<{
      query: string;
      ok: boolean;
      status: number;
      result_count: number;
      sample_display_name: string | null;
      raw_preview: string;
    }> = [];

    for (const query of queries) {
      const result = await queryNominatim(query);

      attempts.push({
        query: result.query,
        ok: result.ok,
        status: result.status,
        result_count: result.data.length,
        sample_display_name: result.data[0]?.display_name || null,
        raw_preview: result.raw.slice(0, 300),
      });

      if (result.ok && result.data.length > 0) {
        const first = result.data[0];

        return NextResponse.json({
          found: true,
          latitude: Number(first.lat),
          longitude: Number(first.lon),
          display_name: first.display_name || null,
          matched_query: query,
          attempts,
        });
      }
    }

    return NextResponse.json({
      found: false,
      latitude: null,
      longitude: null,
      display_name: null,
      matched_query: null,
      attempts,
    });
  } catch (error) {
    console.error("Geocode API error:", error);

    return NextResponse.json(
      {
        error: "Unexpected geocoding error",
        details: String(error),
      },
      { status: 500 }
    );
  }
}