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

type DiagnosticPhase = "name-resolution" | "authorization";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ district?: string | string[] }>;
}) {
  const districtParam = (await searchParams).district;
  const requestedEntry =
    typeof districtParam === "string" ? districtParam : undefined;
  let requestedDistrict = requestedEntry;

  const selectedIdentity = publicEntryIdentities.find(
    ({ name }) => name === requestedEntry,
  );
  const diagnosticId = crypto.randomUUID();
  const explicitFetchCounts = {
    nameResolution: 0,
    authorization: 0,
    failed: 0,
    redirectedResponses: 0,
  };

  function diagnosticFetch(phase: DiagnosticPhase): typeof fetch {
    return async (input, init) => {
      if (phase === "name-resolution") {
        explicitFetchCounts.nameResolution += 1;
      } else {
        explicitFetchCounts.authorization += 1;
      }

      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let target = { origin: "invalid", pathname: "invalid" };
      try {
        const parsed = new URL(requestUrl);
        target = { origin: parsed.origin, pathname: parsed.pathname };
      } catch {
        // The wrapped fetch remains responsible for handling invalid input.
      }

      try {
        const response = await fetch(input, init);
        if (response.redirected) {
          explicitFetchCounts.redirectedResponses += 1;
        }
        if (!response.ok) {
          explicitFetchCounts.failed += 1;
          console.warn("Public authorization explicit fetch failed", {
            diagnosticId,
            name: selectedIdentity?.name,
            phase,
            origin: target.origin,
            pathname: target.pathname,
            status: response.status,
          });
        }
        return response;
      } catch (error) {
        explicitFetchCounts.failed += 1;
        console.warn("Public authorization explicit fetch failed", {
          diagnosticId,
          name: selectedIdentity?.name,
          phase,
          origin: target.origin,
          pathname: target.pathname,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  const nameEntries = publicEntryIdentities.map(({ name }) => ({
    name,
    districtName: null as string | null,
    resolutionStatus: "not_run" as "not_run" | "resolved" | "unavailable",
    authorizationStatus: "CURRENT VERIFICATION NOT RUN",
  }));

  if (selectedIdentity) {
    const selectedEntry = nameEntries.find(
      ({ name }) => name === selectedIdentity.name,
    );

    try {
      const resolution = await resolveName(selectedIdentity.name, {
        nameIdentity: bitmapverseNameIdentity,
        fetchImpl: diagnosticFetch("name-resolution"),
        ordBase: "https://0rdinals.com",
      });
      const authorization = await resolvePubliclyAuthorizedName(
        selectedIdentity.name,
        {
          fetchImpl: diagnosticFetch("authorization"),
          nameResolver: async () => resolution,
        },
      );

      if (authorization.status === "UNAVAILABLE") {
        console.warn("Public authorization unavailable", {
          name: selectedIdentity.name,
          status: authorization.status,
          code: authorization.code,
          reason: authorization.reason,
        });
      }

      if (selectedEntry) {
        selectedEntry.districtName = resolution.resolved_target;
        selectedEntry.resolutionStatus = "resolved";
        selectedEntry.authorizationStatus =
          authorization.status === "ACCEPT"
            ? "AUTHORIZED"
            : authorization.status === "REJECT"
              ? "NOT AUTHORIZED"
              : authorization.status === "UNAVAILABLE"
                ? "VERIFICATION UNAVAILABLE"
                : "CURRENT VERIFICATION NOT RUN";
      }
    } catch {
      if (selectedEntry) {
        selectedEntry.resolutionStatus = "unavailable";
        selectedEntry.authorizationStatus =
          "UNAVAILABLE — NAME RESOLUTION COULD NOT BE VERIFIED; CURRENT AUTHORIZATION VERIFICATION NOT RUN";
      }
    }
  }

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
      fetchImpl: diagnosticFetch("name-resolution"),
    });
    requestedDistrict = nameResolution.resolved_target.replace(/\.bitmap$/, "");
  }

  const totalExplicitAttempts =
    explicitFetchCounts.nameResolution + explicitFetchCounts.authorization;
  if (totalExplicitAttempts > 0) {
    console.warn("Public authorization explicit fetch summary", {
      diagnosticId,
      selectedName: selectedIdentity?.name ?? null,
      nameResolutionAttempts: explicitFetchCounts.nameResolution,
      authorizationAttempts: explicitFetchCounts.authorization,
      totalExplicitAttempts,
      failedAttempts: explicitFetchCounts.failed,
      redirectedResponses: explicitFetchCounts.redirectedResponses,
      limitation:
        "Explicit fetch attempts only; redirects, framework activity, and other implicit subrequests may consume additional Worker budget.",
    });
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
