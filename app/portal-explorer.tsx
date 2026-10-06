"use client";

import { useMemo, useState } from "react";
import type { ResolverResult } from "../src/resolvers/same-sat-latest-v01.mjs";

type Territory = {
  label: string;
  role: string;
  accent: "green" | "amber" | "blue";
  result: ResolverResult;
};

type View = "experience" | "verification";

function EvidenceRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="evidence-row">
      <dt>{label}</dt>
      <dd className={mono ? "mono" : undefined} title={value}>
        {value}
      </dd>
    </div>
  );
}

export function PortalExplorer({
  territories,
}: {
  territories: Territory[];
}) {
  const [activeDistrict, setActiveDistrict] = useState(
    territories[0].result.district,
  );
  const [routeDirection, setRouteDirection] = useState<"forward" | "reverse">(
    "forward",
  );
  const [view, setView] = useState<View>("experience");

  const active = useMemo(
    () =>
      territories.find(
        ({ result }) => result.district === activeDistrict,
      ) ?? territories[0],
    [activeDistrict, territories],
  );

  const route =
    routeDirection === "forward"
      ? `${territories[0].result.district_name} → ${territories[1].result.district_name}`
      : `${territories[1].result.district_name} → ${territories[0].result.district_name}`;

  const contentUrl = `https://ordinals.com/content/${active.result.selected_inscription_id}`;

  return (
    <main>
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Bitmapverse home">
          <span className="wordmark-mark">B</span>
          <span>BITMAPVERSE</span>
        </a>
        <div className="status-lockup" aria-label="Project status">
          <span className="pulse" />
          <span>EXPERIMENTAL</span>
          <span className="divider">/</span>
          <span>INTERNAL v0.1</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">LOCAL MVE CANDIDATE</div>
        <h1>
          Three territories.
          <br />
          <span>One verifiable route.</span>
        </h1>
        <p className="hero-copy">
          Bitmapverse observes a fixed Bitcoin snapshot, applies the
          experimental same_sat_latest_v0.1 rule to each District, and shows
          which content that rule selects within the snapshot. Here you can
          explore three test territories and the route connecting them.
        </p>
        <div className="snapshot-bar">
          <div>
            <span>SNAPSHOT</span>
            <strong>HEIGHT {territories[0].result.snapshot_height}</strong>
          </div>
          <div>
            <span>RULE</span>
            <strong>same_sat_latest_v0.1</strong>
          </div>
        </div>
      </section>

      <nav className="view-toggle" aria-label="Detail level">
        <button
          type="button"
          className={view === "experience" ? "active" : ""}
          aria-pressed={view === "experience"}
          onClick={() => setView("experience")}
        >
          EXPERIENCE
        </button>
        <button
          type="button"
          className={view === "verification" ? "active" : ""}
          aria-pressed={view === "verification"}
          onClick={() => setView("verification")}
        >
          VERIFICATION
        </button>
      </nav>

      {view === "experience" && (
        <>
          <section
            className="portal-stage"
            aria-label="Portal between territories"
          >
            {territories.map((territory, index) => {
              const isActive =
                active.result.district === territory.result.district;
              return (
                <div className="territory-wrap" key={territory.result.district}>
                  <button
                    className={`territory-card ${territory.accent} ${isActive ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveDistrict(territory.result.district)}
                    aria-pressed={isActive}
                  >
                    <span className="territory-role">{territory.role}</span>
                    <span className="territory-index">0{index + 1}</span>
                    <span className="territory-orbit" aria-hidden="true">
                      <span />
                    </span>
                    <strong>{territory.label}</strong>
                    <span className="district-name">
                      {territory.result.district_name}
                    </span>
                    <span className="territory-meta">
                      {territory.result.candidate_count} inscriptions on the
                      same sat
                    </span>
                    <span className="card-action">
                      {isActive ? "ACTIVE TERRITORY" : "CHOOSE TERRITORY"}
                      <span aria-hidden="true">↗</span>
                    </span>
                  </button>

                  {index === 0 && (
                    <div className="portal-link">
                      <button
                        type="button"
                        onClick={() =>
                          setRouteDirection((current) =>
                            current === "forward" ? "reverse" : "forward",
                          )
                        }
                        aria-label="Reverse portal direction"
                      >
                        <span className="portal-core">↔</span>
                        <span>REVERSE ROUTE</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <section className="route-readout" aria-live="polite">
            <span>ACTIVE ROUTE</span>
            <strong>{route}</strong>
            <span className="route-state">RESOLVED</span>
          </section>

          <section className="experience-cta">
            <div>
              <span className="section-kicker">SELECTED CONTENT</span>
              <p>
                For <strong>{active.label}</strong> ({active.result.district_name}
                ): Bitmapverse selected this content by applying
                same_sat_latest_v0.1 to the fixed snapshot. You can open it
                directly or review the technical evidence supporting the
                selection.
              </p>
            </div>
            <div className="experience-cta-actions">
              <a
                className="primary-link"
                href={contentUrl}
                target="_blank"
                rel="noreferrer"
              >
                OPEN SELECTED CONTENT <span aria-hidden="true">↗</span>
              </a>
              <button
                type="button"
                className="secondary-link"
                onClick={() => setView("verification")}
              >
                VIEW TECHNICAL VERIFICATION <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        </>
      )}

      {view === "verification" && (
        <>
          <section className="evidence-panel" id="evidence">
            <div className="evidence-heading">
              <div>
                <span className="section-kicker">SELECTED EVIDENCE</span>
                <h2>
                  {active.label} <small>{active.result.district_name}</small>
                </h2>
              </div>
              <a
                className="primary-link"
                href={contentUrl}
                target="_blank"
                rel="noreferrer"
              >
                OPEN CONTENT IN ORD <span aria-hidden="true">↗</span>
              </a>
            </div>

            <dl className="evidence-grid">
              <EvidenceRow
                label="DISTRICT"
                value={String(active.result.district)}
              />
              <EvidenceRow
                label="ORIGINAL INSCRIPTION"
                value={active.result.original_inscription_id}
              />
              <EvidenceRow
                label="SELECTED RESULT"
                value={active.result.selected_inscription_id}
              />
              <EvidenceRow label="SAT" value={String(active.result.sat)} />
              <EvidenceRow
                label="CANONICAL POSITION"
                value={`${active.result.selected_position.block_height}:${active.result.selected_position.transaction_index}:${active.result.selected_position.inscription_index}`}
              />
              <EvidenceRow
                label="CONTENT SHA-256"
                value={active.result.selected_content_sha256}
              />
              <EvidenceRow
                label="SNAPSHOT BLOCK HASH"
                value={active.result.snapshot_block_hash}
              />
              <EvidenceRow
                label="RULE APPLIED"
                value={active.result.resolver}
              />
              <EvidenceRow
                label="ORD ENUMERATION"
                value={active.result.source_manifest.ord.enumeration_response_sha256}
              />
            </dl>

            <div className="proof-footer">
              <div>
                <span className="proof-dot" />
                <p>
                  <strong>Full set observed</strong>
                  <br />
                  {active.result.candidate_count} of{" "}
                  {active.result.candidate_count} candidates included through
                  the snapshot.
                </p>
              </div>
              <div>
                <span className="proof-dot warning" />
                <p>
                  <strong>OPI response not captured</strong>
                  <br />
                  Code and query are fixed; independent reconstruction is
                  still missing.
                </p>
              </div>
            </div>
          </section>

          <section className="method">
            <span className="section-kicker">WHAT THIS DEMONSTRATES TODAY</span>
            <div className="method-grid">
              {[
                ["01", "DISCOVER", "Fix the original District and its sat."],
                ["02", "RESOLVE", "Enumerate the same sat through a snapshot."],
                [
                  "03",
                  "VERIFY",
                  "Sort by canonical position and check hashes.",
                ],
                [
                  "04",
                  "TRAVERSE",
                  "Open the selected content without mistaking it for authority.",
                ],
              ].map(([number, title, copy]) => (
                <article key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>

            <span className="section-kicker limits-kicker">
              WHAT THIS DOES NOT YET DEMONSTRATE
            </span>
            <ul className="limits-list">
              <li>Does not independently reconstruct the OPI response.</li>
              <li>
                Does not demonstrate live resolution after the fixed
                snapshot.
              </li>
              <li>
                Does not demonstrate sovereignty, universality, autonomy, or
                consciousness of any District.
              </li>
              <li>Does not include Names.bitmap or any host District.</li>
            </ul>
          </section>
        </>
      )}

      <footer>
        <p>
          Local Minimum Verifiable Experience (MVE) candidate · Internal
          Bitmapverse v0.1 convention · Experimental status · Not yet a
          public MVE or a universal Bitmap standard.
        </p>
        <p>Names.bitmap and live resolution after the snapshot are out of scope.</p>
      </footer>
    </main>
  );
}
