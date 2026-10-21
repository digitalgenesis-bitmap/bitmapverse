import type { Metadata } from "next";
import freedeonFixture from "../fixtures/507999.snapshot.json";
import organaFixture from "../fixtures/7187.snapshot.json";
import bitmapverseFixture from "../fixtures/937336.snapshot.json";
import { resolveSameSatLatestV01 } from "../src/resolvers/same-sat-latest-v01.mjs";
import parcelIdentities937336 from "../data/parcels/937336.parcel-identities.json";
import bitmapverseNameIdentity from "../data/bitmapverse-name-identity.json";
import { resolveName } from "../experiments/experiment-9/resolver.mjs";
import { resolvePubliclyAuthorizedName } from "../experiments/experiment-24/resolver.mjs";
import bitmapverseAuthorization from "../experiments/experiment-23/public-authorization-artifact.v0.1.json";
import bitmapworldAuthorization from "../experiments/experiment-26/bitmapworld.public-authorization-artifact.v0.1.json";
import bitmapmetaverseAuthorization from "../experiments/experiment-26/bitmapmetaverse.public-authorization-artifact.v0.1.json";
import { toDistrictParcelsV01 } from "../src/parcels/district-parcels-v01.mjs";
import { PortalExplorer } from "./portal-explorer";

export const metadata: Metadata = {
  title: "Bitmapverse v0.1 — Experimental Portal",
  description:
    "A reproducible route between 507999.bitmap and 7187.bitmap, frozen in a Bitcoin snapshot.",
};

const canonicalNameIdentities = bitmapverseNameIdentity.identities;
const publicAuthorizationArtifacts = [
  bitmapverseAuthorization,
  bitmapworldAuthorization,
  bitmapmetaverseAuthorization,
];

const publicEntryIdentities = publicAuthorizationArtifacts.map((artifact) => {
  const identity = canonicalNameIdentities.find(
    ({ canonical_inscription_id }) =>
      canonical_inscription_id === artifact.binding.name_inscription_id,
  );

  if (!identity) {
    throw new Error(
      `No canonical Name identity matches public binding ${artifact.binding.id}`,
    );
  }

  return identity;
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ district?: string | string[] }>;
}) {
  const districtParam = (await searchParams).district;
  const requestedEntry =
    typeof districtParam === "string" ? districtParam : undefined;
  let requestedDistrict = requestedEntry;

  const nameEntries = await Promise.all(
    publicEntryIdentities.map(async ({ name }) => {
      try {
        const resolution = await resolveName(name, {
          nameIdentity: bitmapverseNameIdentity,
        });
        const authorization = await resolvePubliclyAuthorizedName(name, {
          nameResolver: async () => resolution,
        });

        if (authorization.status === "UNAVAILABLE") {
          console.warn("Public authorization unavailable", {
            name,
            status: authorization.status,
            code: authorization.code,
            reason: authorization.reason,
          });
        }

        return {
          name,
          districtName: resolution.resolved_target,
          resolutionStatus: "resolved" as const,
          authorizationStatus:
            authorization?.status === "ACCEPT"
              ? ("AUTHORIZED" as const)
              : authorization?.status === "REJECT"
                ? ("NOT AUTHORIZED" as const)
                : authorization?.status === "UNAVAILABLE"
                  ? ("VERIFICATION UNAVAILABLE" as const)
                  : ("CURRENT VERIFICATION NOT RUN" as const),
        };
      } catch {
        return {
          name,
          districtName: null,
          resolutionStatus: "unavailable" as const,
          authorizationStatus:
            "UNAVAILABLE — NAME RESOLUTION COULD NOT BE VERIFIED; CURRENT AUTHORIZATION VERIFICATION NOT RUN" as const,
        };
      }
    }),
  );

  const requestedPublicEntry = nameEntries.find(
    ({ name }) => name === requestedEntry,
  );

  if (requestedPublicEntry?.districtName) {
    requestedDistrict = requestedPublicEntry.districtName.replace(/\.bitmap$/, "");
  } else if (
    requestedEntry &&
    canonicalNameIdentities.some(({ name }) => name === requestedEntry) &&
    !requestedPublicEntry
  ) {
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
      requestedEntryName={requestedPublicEntry?.name}
      nameEntries={nameEntries}
    />
  );
}
