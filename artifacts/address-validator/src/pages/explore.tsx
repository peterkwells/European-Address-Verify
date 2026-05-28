import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import {
  useListCoverage,
  useGetCoverage,
  getGetCoverageQueryKey,
} from "@workspace/api-client-react";
import type { CountryCoverage } from "@workspace/api-client-react";
import { X, ExternalLink, Loader2, Terminal } from "lucide-react";

const TIER_FILL: Record<number, string> = {
  1: "#22c55e",
  2: "#f59e0b",
  3: "#ef4444",
};


const TIER_LABELS: Record<number, { label: string; desc: string; color: string }> = {
  1: { label: "Tier 1 — Live API", desc: "Real-time authoritative validation", color: "text-emerald-700 dark:text-emerald-400" },
  2: { label: "Tier 2 — Local Dataset", desc: "Openly licensed bulk data", color: "text-amber-700 dark:text-amber-400" },
  3: { label: "Tier 3 — Restricted", desc: "No open validation available", color: "text-red-700 dark:text-red-400" },
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  "very-high": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

const METHOD_LABELS: Record<string, string> = {
  "open-api": "Live API",
  "bulk-local": "Bulk Local",
  "format+reference": "Format + Ref",
  "format-only": "Format Only",
  restricted: "Restricted",
};

interface GeoJsonFeature {
  type: string;
  properties: {
    ISO_A2?: string;
    ADMIN?: string;
    [key: string]: unknown;
  };
  geometry: unknown;
}

interface GeoJsonData {
  type: string;
  features: GeoJsonFeature[];
}

function DetailPanel({
  countryCode,
  coverage,
  onClose,
}: {
  countryCode: string;
  coverage: CountryCoverage | undefined;
  onClose: () => void;
}) {
  const [, setLocation] = useLocation();
  const { data: detail, isLoading } = useGetCoverage(countryCode, {
    query: {
      enabled: !!countryCode,
      queryKey: getGetCoverageQueryKey(countryCode),
    },
  });

  const tierInfo = coverage ? TIER_LABELS[coverage.tier] : null;
  const canTry = coverage && coverage.tier !== 3;

  return (
    <div
      className="absolute right-0 top-0 z-[1000] h-full w-72 overflow-y-auto border-l border-border bg-background shadow-lg"
      data-testid="panel-country-detail"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <span className="font-mono text-xs text-muted-foreground">{countryCode}</span>
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {coverage?.country_name ?? countryCode}
          </h3>
        </div>
        <button
          data-testid="button-close-panel"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {detail && !isLoading && (
        <div className="p-4 space-y-4 text-xs">
          {tierInfo && (
            <div>
              <p className={`font-semibold ${tierInfo.color}`}>{tierInfo.label}</p>
              <p className="text-muted-foreground">{tierInfo.desc}</p>
            </div>
          )}

          <div className="space-y-2">
            <Row label="Method" value={METHOD_LABELS[detail.validation_method] ?? detail.validation_method} />
            <Row label="Cost" value={detail.cost} />
            <Row
              label="Legal Risk"
              value={
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_BADGE[detail.legal_risk] ?? ""}`}>
                  {detail.legal_risk.replace("-", " ")}
                </span>
              }
            />
            <Row label="Licence" value={<code>{detail.licence}</code>} />
          </div>

          {detail.validation_method_description && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Validation</p>
              <p className="text-muted-foreground leading-relaxed">{detail.validation_method_description}</p>
            </div>
          )}

          {detail.legal_risk_notes && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Legal Notes</p>
              <p className="text-muted-foreground leading-relaxed">{detail.legal_risk_notes}</p>
            </div>
          )}

          {detail.cost_description && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Cost Details</p>
              <p className="text-muted-foreground leading-relaxed">{detail.cost_description}</p>
            </div>
          )}

          {detail.ingestion_status && (
            <Row label="Ingestion" value={detail.ingestion_status.replace("_", " ")} />
          )}

          <a
            href={detail.data_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
            data-testid="link-data-source"
          >
            {detail.data_source}
            <ExternalLink className="h-3 w-3" />
          </a>

          <button
            data-testid="button-try-validation"
            disabled={!canTry}
            onClick={() => setLocation(`/try?country=${countryCode}`)}
            className={[
              "mt-2 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
              canTry
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            ].join(" ")}
          >
            <Terminal className="h-3.5 w-3.5" />
            {canTry ? "Try validation" : "Restricted — no validation available"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0 w-20">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}

export default function Explore() {
  const { data: coverageData } = useListCoverage();
  const [geoJson, setGeoJson] = useState<GeoJsonData | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [geoError, setGeoError] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!coverageData) return;
    if (geoJson) return;

    const controller = new AbortController();
    setGeoLoading(true);
    fetch(`${import.meta.env.BASE_URL}europe-coverage.geojson`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GeoJsonData>;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setGeoJson(data);
          setGeoLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load GeoJSON", err);
          setGeoError(true);
          setGeoLoading(false);
        }
      });
    return () => controller.abort();
  }, [coverageData, geoJson]);

  const coverageByCode: Record<string, CountryCoverage> = {};
  if (coverageData) {
    for (const c of coverageData.countries) {
      coverageByCode[c.country_code] = c;
    }
  }

  const selectedCoverage = selectedCode ? coverageByCode[selectedCode] : undefined;

  const styleFeature = useCallback(
    (feature?: GeoJsonFeature): PathOptions => {
      const iso = feature?.properties?.ISO_A2;
      const coverage = iso ? coverageByCode[iso] : undefined;
      const fill = coverage ? (TIER_FILL[coverage.tier] ?? "#94a3b8") : "#94a3b8";
      return {
        fillColor: fill,
        fillOpacity: 0.65,
        color: "#fff",
        weight: 1,
        opacity: 0.8,
      };
    },
    [coverageByCode]
  );

  const onEachFeature = useCallback(
    (feature: GeoJsonFeature, layer: Layer) => {
      const iso = feature.properties?.ISO_A2;
      const coverage = iso ? coverageByCode[iso] : undefined;
      if (!coverage) return;

      const name = coverage.country_name;
      layer.bindTooltip(
        `<strong>${name}</strong><br/>Tier ${coverage.tier} &mdash; ${coverage.legal_risk} risk`,
        { sticky: true, className: "leaflet-tooltip-custom" }
      );

      layer.on({
        mouseover: (e: LeafletMouseEvent) => {
          const l = e.target as { setStyle: (s: PathOptions) => void; bringToFront: () => void };
          l.setStyle({ fillOpacity: 0.9, weight: 2, color: "#fff" });
          l.bringToFront();
        },
        mouseout: (e: LeafletMouseEvent) => {
          const l = e.target as { setStyle: (s: PathOptions) => void };
          if (iso) l.setStyle(styleFeature(feature));
        },
        click: () => {
          if (iso) setSelectedCode(iso);
        },
      });
    },
    [coverageByCode, styleFeature]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="heading-explore">
          Coverage Map
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Click a country to see full coverage details. Colour indicates validation tier.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        {[1, 2, 3].map((tier) => {
          const info = TIER_LABELS[tier];
          const fill = TIER_FILL[tier];
          return (
            <div key={tier} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm border border-white/30"
                style={{ backgroundColor: fill }}
              />
              <span className="text-muted-foreground">{info.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border border-white/30 bg-slate-400" />
          <span className="text-muted-foreground">Not covered</span>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{ height: "520px" }}
        data-testid="map-container"
      >
        {geoLoading && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-background/80">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading map data…</p>
          </div>
        )}

        {geoError && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">Failed to load map. Check network access.</p>
          </div>
        )}

        {!geoError && (
          <MapContainer
            center={[54, 15]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            {geoJson && (
              <GeoJSON
                key={JSON.stringify(Object.keys(coverageByCode))}
                data={geoJson as GeoJSON.GeoJsonObject}
                style={(feature) => styleFeature(feature as GeoJsonFeature)}
                onEachFeature={(feature, layer) => onEachFeature(feature as GeoJsonFeature, layer)}
              />
            )}
          </MapContainer>
        )}

        {selectedCode && (
          <DetailPanel
            countryCode={selectedCode}
            coverage={selectedCoverage}
            onClose={() => setSelectedCode(null)}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Map data &copy; OpenStreetMap contributors, &copy; CARTO. Country boundaries from{" "}
        <a
          href="https://github.com/datasets/geo-countries"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          datasets/geo-countries
        </a>{" "}
        (ODbL).
      </p>
    </div>
  );
}
