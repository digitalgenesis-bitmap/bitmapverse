"use client";

import { useMemo, useState } from "react";
import type { ResolverResult } from "../src/resolvers/same-sat-latest-v01.mjs";

type Territory = {
  label: string;
  role: string;
  accent: "green" | "amber";
  result: ResolverResult;
};

function shorten(value: string, left = 9, right = 8) {
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

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

  return (
    <main>
      <div className="ambient-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Bitmapverse inicio">
          <span className="wordmark-mark">B</span>
          <span>BITMAPVERSE</span>
        </a>
        <div className="status-lockup" aria-label="Estado del proyecto">
          <span className="pulse" />
          <span>EXPERIMENTAL</span>
          <span className="divider">/</span>
          <span>INTERNO v0.1</span>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">PRIMER PORTAL REPRODUCIBLE</div>
        <h1>
          Dos territorios.
          <br />
          <span>Una ruta verificable.</span>
        </h1>
        <p className="hero-copy">
          Bitmapverse observa un snapshot fijo de Bitcoin, aplica la misma regla
          a cada District y muestra exactamente qué inscripción selecciona.
        </p>
        <div className="snapshot-bar">
          <div>
            <span>SNAPSHOT</span>
            <strong>HEIGHT {territories[0].result.snapshot_height}</strong>
          </div>
          <div className="snapshot-hash">
            <span>BLOCK HASH</span>
            <code>{shorten(territories[0].result.snapshot_block_hash, 14, 12)}</code>
          </div>
          <div>
            <span>REGLA</span>
            <strong>same_sat_latest_v0.1</strong>
          </div>
        </div>
      </section>

      <section className="portal-stage" aria-label="Portal entre territorios">
        {territories.map((territory, index) => {
          const isActive = active.result.district === territory.result.district;
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
                  {territory.result.candidate_count} inscripciones sobre el
                  mismo sat
                </span>
                <span className="card-action">
                  {isActive ? "EVIDENCIA ABIERTA" : "INSPECCIONAR"}
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
                    aria-label="Invertir dirección del portal"
                  >
                    <span className="portal-core">↔</span>
                    <span>INVERTIR RUTA</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="route-readout" aria-live="polite">
        <span>RUTA ACTIVA</span>
        <strong>{route}</strong>
        <span className="route-state">RESUELTA</span>
      </section>

      <section className="evidence-panel" id="evidence">
        <div className="evidence-heading">
          <div>
            <span className="section-kicker">EVIDENCIA SELECCIONADA</span>
            <h2>
              {active.label} <small>{active.result.district_name}</small>
            </h2>
          </div>
          <a
            className="primary-link"
            href={`https://ordinals.com/content/${active.result.selected_inscription_id}`}
            target="_blank"
            rel="noreferrer"
          >
            ABRIR CONTENIDO EN ORD <span aria-hidden="true">↗</span>
          </a>
        </div>

        <dl className="evidence-grid">
          <EvidenceRow
            label="INSCRIPCIÓN ORIGINAL"
            value={active.result.original_inscription_id}
          />
          <EvidenceRow
            label="RESULTADO SELECCIONADO"
            value={active.result.selected_inscription_id}
          />
          <EvidenceRow label="SAT" value={String(active.result.sat)} />
          <EvidenceRow
            label="POSICIÓN CANÓNICA"
            value={`${active.result.selected_position.block_height}:${active.result.selected_position.transaction_index}:${active.result.selected_position.inscription_index}`}
          />
          <EvidenceRow
            label="CONTENT SHA-256"
            value={active.result.selected_content_sha256}
          />
          <EvidenceRow
            label="ENUMERACIÓN ORD"
            value={active.result.source_manifest.ord.enumeration_response_sha256}
          />
        </dl>

        <div className="proof-footer">
          <div>
            <span className="proof-dot" />
            <p>
              <strong>Conjunto completo observado</strong>
              <br />
              {active.result.candidate_count} de {active.result.candidate_count}{" "}
              candidatos incluidos hasta el snapshot.
            </p>
          </div>
          <div>
            <span className="proof-dot warning" />
            <p>
              <strong>Respuesta OPI no capturada</strong>
              <br />
              Código y consulta fijados; falta reconstrucción independiente.
            </p>
          </div>
        </div>
      </section>

      <section className="method">
        <span className="section-kicker">QUÉ DEMUESTRA HOY</span>
        <div className="method-grid">
          {[
            ["01", "DESCUBRIR", "Fijar el District original y su sat."],
            ["02", "RESOLVER", "Enumerar el mismo sat hasta un snapshot."],
            ["03", "VERIFICAR", "Ordenar por posición canónica y comprobar hashes."],
            ["04", "ATRAVESAR", "Abrir el contenido resuelto sin confundirlo con autoridad."],
          ].map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <p>
          Convención interna de Bitmapverse v0.1 · Estado experimental · No es
          todavía una EMV pública ni un estándar universal de Bitmap.
        </p>
        <p>Names.bitmap y la resolución viva posterior al snapshot quedan fuera.</p>
      </footer>
    </main>
  );
}
