import type { Metadata } from "next";
import freedeonFixture from "../fixtures/507999.snapshot.json";
import organaFixture from "../fixtures/7187.snapshot.json";
import bitmapverseFixture from "../fixtures/937336.snapshot.json";
import { resolveSameSatLatestV01 } from "../src/resolvers/same-sat-latest-v01.mjs";
import parcelIdentities937336 from "../data/parcels/937336.parcel-identities.json";
import bitmapverseNameIdentity from "../data/bitmapverse-name-identity.json";
import { resolveName } from "../experiments/experiment-9/resolver.mjs";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";
import { PortalExplorer } from "./portal-explorer";

export const metadata: Metadata = {
  title: "Bitmapverse v0.1 — Portal experimental",
  description:
    "Ruta reproducible entre 507999.bitmap y 7187.bitmap, congelada en un snapshot de Bitcoin.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ district?: string | string[] }>;
}) {
  const districtParam = (await searchParams).district;
  const requestedEntry =
    typeof districtParam === "string" ? districtParam : undefined;
  let requestedDistrict = requestedEntry;

  if (requestedEntry === bitmapverseNameIdentity.name) {
    const nameResolution = await resolveName(requestedEntry, {
      nameIdentity: bitmapverseNameIdentity,
    });
    requestedDistrict = nameResolution.resolved_target.replace(/\.bitmap$/, "");
  }

  const territories = [
    {
      label: "Freedeon",
      role: "ORIGEN",
      accent: "green" as const,
      result: resolveSameSatLatestV01(freedeonFixture),
    },
    {
      label: "Organa",
      role: "CONTRASTE EXTERNO",
      accent: "amber" as const,
      result: resolveSameSatLatestV01(organaFixture),
    },
    {
      label: "Bitmapverse",
      role: "CANDIDATO EXPERIMENTAL",
      accent: "blue" as const,
      result: resolveSameSatLatestV01(bitmapverseFixture),
    },
  ];

  const districtParcels = toDistrictParcelsV01(parcelIdentities937336);

  return (
    <PortalExplorer
      territories={territories}
      districtParcels={districtParcels}
      requestedDistrict={requestedDistrict}
    />
  );
}
