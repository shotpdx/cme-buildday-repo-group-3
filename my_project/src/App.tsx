import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Filter,
  Gauge,
  Layers3,
  LineChart as LineChartIcon,
  MapPinned,
  Maximize2,
  Megaphone,
  MousePointerClick,
  Palette,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { feature } from "topojson-client";
import statesTopology from "us-atlas/states-10m.json";

type View = "overview" | "briefs" | "audiences" | "creatives" | "activations" | "markets" | "ask";
type ArchitectureTab = "business" | "data" | "platform" | "agent";

type Dashboard = {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpa: number;
    active_briefs: number;
    approved_creatives: number;
  };
  trend: Array<{ date: string; spend: number; conversions: number; ctr: number }>;
  channel_mix: Array<{ name: string; value: number; spend: number }>;
  quality_radar: Array<{ axis: string; score: number }>;
  activity: Array<{ event: string; detail: string; time: string; type: string }>;
};

type Brief = {
  brief_id: string;
  brief_name: string;
  brand_name: string;
  campaign_objective: string;
  target_audience_description?: string;
  status: string;
  created_ts?: string;
  concepts_count?: number;
  creatives_count?: number;
  budget?: number;
  owner?: string;
};

type Audience = {
  cohort_id: string;
  cohort_name: string;
  cohort_description: string;
  definition_type: string;
  personalization_granularity?: string;
  estimated_reach: number;
  is_region_allowed: boolean;
  is_channel_allowed: boolean;
  is_frequency_capped: boolean;
  status: string;
  last_updated_ts?: string;
  last_refreshed_ts?: string;
  match_rate?: number;
  avg_ltv?: number;
  feature_summary_text?: string;
};

type Creative = {
  creative_asset_id: string;
  asset_name: string;
  asset_type: string;
  format: string;
  width_px: number;
  height_px: number;
  approval_status: string;
  target_segment?: string;
  content_tags?: string[] | string;
  generation_model?: string;
  created_at?: string;
  created_ts?: string;
  quality_score?: number;
  predicted_ctr?: number;
};

type Activation = {
  activation_id: string;
  creative_asset_id: string;
  campaign_id: string;
  destination_platform: string;
  trafficking_status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ab_test_id: string | null;
  last_sync_ts: string;
};

type MarketCity = {
  name: string;
  state: string;
  reach: number;
  ctr: number;
  lift: number;
};

type StateFeature = {
  id: string;
  properties: { name: string };
  geometry: unknown;
};

type MarketRegion = {
  id: string;
  name: string;
  short_name: string;
  states: string[];
  reach: number;
  spend: number;
  ctr: number;
  conversion_lift: number;
  priority: "Scale" | "Optimize" | "Test";
  signal: string;
  top_audience: string;
  recommended_action: string;
  cities: MarketCity[];
  trend: Array<{ week: string; reach: number; conversions: number }>;
  audience_mix: Array<{ name: string; value: number }>;
};

type BackendTable = {
  name: string;
  endpoint: string;
  lakehouse_table: string;
  description: string;
  source: string;
  path: string | null;
  rows: number;
  loaded: boolean;
};

type BackendTables = {
  data_dir: string;
  bundle_ready: boolean;
  tables: BackendTable[];
};

type ModelStatus = {
  audience_lens_uses_model_serving: boolean;
  serving_endpoint_configured: boolean;
  configured_endpoint: string | null;
  mode: string;
  checked_path: string;
  verified: boolean;
  evidence: string[];
};

type AgencyData = {
  dashboard: Dashboard;
  briefs: Brief[];
  audiences: Audience[];
  creatives: Creative[];
  activations: Activation[];
  markets: MarketRegion[];
  backendTables: BackendTables;
  modelStatus: ModelStatus;
};

type AskResult = {
  answer: string;
  result: { title: string; rows: Record<string, string>[] } | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: AskResult["result"];
};

type JourneyStep = {
  id: View;
  title: string;
  navLabel: string;
  description: string;
  userGoal: string;
  signal: string;
  outcome: string;
  icon: typeof Gauge;
  color: string;
};

type DataContractGap = {
  surface: string;
  mockCsv: string;
  pipeline: string;
  recommendation: string;
};

const COLORS = ["#0f9f95", "#256b8f", "#c7793a", "#5b65d8", "#1f9d72", "#d89a23", "#b65aa6"];
const ASK_SUGGESTIONS = ["average CTR by audience", "activation status", "creative quality", "campaign ROI"];
const PACING_WINDOWS = [7, 14, 30] as const;
type PacingWindow = (typeof PACING_WINDOWS)[number];
const ARCHITECTURE_ROWS = [
  {
    source: ["Campaign Briefs", "Planning / CRM"],
    stream: ["brief.sync", "strategy"],
    bronze: ["bronze_briefs", "raw brief payloads"],
    silver: ["silver_campaigns", "validated objectives"],
    gold: ["gold_dashboard", "executive KPIs"],
  },
  {
    source: ["Customer 360 Audiences", "CDP / Identity"],
    stream: ["audience.segments", "cohorts"],
    bronze: ["bronze_audiences", "raw memberships"],
    silver: ["silver_cohorts", "reach + match"],
    gold: ["gold_audience_reach", "activation-ready cohorts"],
  },
  {
    source: ["Creative Assets", "DAM / GenAI"],
    stream: ["creative.assets", "metadata"],
    bronze: ["bronze_creatives", "asset records"],
    silver: ["silver_creative_quality", "approval + scoring"],
    gold: ["gold_creative_slate", "ready assets"],
  },
  {
    source: ["Media Activations", "Ad platforms"],
    stream: ["activation.events", "delivery"],
    bronze: ["bronze_activations", "raw platform logs"],
    silver: ["silver_delivery", "clean delivery"],
    gold: ["gold_activation_kpi", "spend + response"],
  },
  {
    source: ["Market Signals", "Geo / spend"],
    stream: ["market.signals", "regional feed"],
    bronze: ["bronze_markets", "raw geo signals"],
    silver: ["silver_geo", "region + metro"],
    gold: ["gold_market_opportunity", "scale / test / optimize"],
  },
];
const ARCH_SERVING_NODES = [
  ["SQL Warehouse", "Statement API + governed metrics"],
  ["Lakebase", "PostgreSQL wire protocol"],
  ["Genie Space", "Natural-language analytics"],
  ["FastAPI", "Databricks App API boundary"],
  ["React", "Creative Command Center"],
];
const ARCH_TAGS = ["domain=marketing", "sensitivity=internal", "data_classification=pii", "quality=validated", "refresh_cadence=near-real-time"];
const ARCH_PLATFORM_SERVICES = [
  ["Asset Bundles", "CI/CD deployment"],
  ["Serverless Compute", "Pipeline + API runtime"],
  ["SQL Warehouse", "Serving + BI compute"],
  ["Secrets", "Credential store"],
];
const DATA_CONTRACT_GAPS: DataContractGap[] = [
  {
    surface: "Audiences",
    mockCsv: "Adds match_rate, avg_ltv, and last_updated_ts for charts.",
    pipeline: "gold_buyside_audience_cohort emits definition_value, feature_summary_text, last_refreshed_ts, and eligibility flags.",
    recommendation: "Derive match_rate and value metrics in the API or change the UI to label them as unavailable when reading the pipeline table directly.",
  },
  {
    surface: "Creatives",
    mockCsv: "Adds quality_score, predicted_ctr, semicolon tags, and created_at.",
    pipeline: "gold_buyside_generated_creatives emits created_ts, updated_ts, generation_params, target_content_genre, and comma-separated content_tags.",
    recommendation: "Normalize tags and map created_ts to the UI contract; add a scoring table or model output for quality_score and predicted_ctr.",
  },
  {
    surface: "Activations",
    mockCsv: "Uses a compact activation record shaped exactly for the table.",
    pipeline: "gold_buyside_campaign_activation also includes line_item_id, brief_id, destination_placement_id, activation_ts, metrics update time, and ab_test_variant_id.",
    recommendation: "The UI can keep its current columns, but the API should pass through line item and variant fields when deeper drilldowns are added.",
  },
  {
    surface: "Overview and Markets",
    mockCsv: "Uses dashboard, activity, channel mix, quality radar, market, metro, and trend extracts.",
    pipeline: "The current pipeline files do not create gold_market_* or dashboard aggregate tables with these exact names.",
    recommendation: "Create aggregate views from activation, creative, and audience tables or continue treating these CSVs as demo-only presentation extracts.",
  },
  {
    surface: "Briefs",
    mockCsv: "Includes owner, budget, concepts_count, and creatives_count.",
    pipeline: "Briefs are sourced from media_demo.gold_media_creative_briefs, so optional planning fields may not match the CSV surface.",
    recommendation: "Confirm the source brief schema and compute counts from concepts and generated creatives before replacing the CSV extract.",
  },
];
const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "overview",
    title: "Command overview",
    navLabel: "Orient",
    description: "Start with the executive readout: performance, investment mix, quality gates, and active signals.",
    userGoal: "Understand campaign health before deciding where to inspect next.",
    signal: "Pulse",
    outcome: "Shared operating picture",
    icon: Gauge,
    color: "#13212d",
  },
  {
    id: "briefs",
    title: "Brief intake",
    navLabel: "Brief",
    description: "Campaign objective, audience intent, budget, and owner align into a launch-ready brief.",
    userGoal: "Confirm strategy, ownership, budget, and approval readiness.",
    signal: "Strategy",
    outcome: "Launch-ready brief",
    icon: FileText,
    color: "#256b8f",
  },
  {
    id: "audiences",
    title: "Audience lens",
    navLabel: "Audience",
    description: "Segments are sized, governed, and compared through reach, match rate, and value signals.",
    userGoal: "Choose the highest-fit audience cohorts and spot governance constraints.",
    signal: "C360",
    outcome: "Prioritized audience plan",
    icon: Users,
    color: "#0f9f95",
  },
  {
    id: "creatives",
    title: "Creative scoring",
    navLabel: "Creative",
    description: "Generated assets are evaluated for approval status, quality, predicted CTR, and fit.",
    userGoal: "Identify which creative assets are ready, risky, or worth iterating.",
    signal: "Quality",
    outcome: "Approved creative slate",
    icon: Palette,
    color: "#5b65d8",
  },
  {
    id: "markets",
    title: "Market expansion",
    navLabel: "Market",
    description: "Geography overlays expose regional opportunity and metro-level media priorities.",
    userGoal: "Decide where to scale, optimize, or test by region and metro.",
    signal: "Geo",
    outcome: "Market action map",
    icon: MapPinned,
    color: "#c7793a",
  },
  {
    id: "activations",
    title: "Activation control",
    navLabel: "Activate",
    description: "Platform delivery, spend, conversions, and sync status are monitored in one control layer.",
    userGoal: "Track live delivery, platform spend, trafficking status, and conversion response.",
    signal: "Live",
    outcome: "Controlled media execution",
    icon: RadioTower,
    color: "#1f9d72",
  },
  {
    id: "ask",
    title: "Decision loop",
    navLabel: "Ask AI",
    description: "Ask AI turns campaign data into answers, tables, and next-best-action context.",
    userGoal: "Ask questions, validate assumptions, and translate data into the next move.",
    signal: "AI",
    outcome: "Decision support",
    icon: Bot,
    color: "#13212d",
  },
];
const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "briefs", label: "Briefs", icon: FileText },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "creatives", label: "Creatives", icon: Palette },
  { id: "markets", label: "Markets", icon: MapPinned },
  { id: "activations", label: "Activations", icon: RadioTower },
  { id: "ask", label: "Ask AI", icon: Bot },
];

const REGION_SHAPES: Record<string, { path: string; label: { x: number; y: number }; color: string }> = {
  west: {
    path: "M53 43 L138 56 L154 165 L125 203 L73 181 L48 99 Z",
    label: { x: 94, y: 125 },
    color: "#256b8f",
  },
  central: {
    path: "M143 58 L253 62 L276 164 L220 204 L153 166 Z",
    label: { x: 206, y: 132 },
    color: "#0f9f95",
  },
  midwest: {
    path: "M246 58 L341 65 L356 136 L281 160 L257 70 Z",
    label: { x: 305, y: 107 },
    color: "#5b65d8",
  },
  southeast: {
    path: "M275 145 L358 138 L387 216 L316 226 L229 203 Z",
    label: { x: 316, y: 184 },
    color: "#1f9d72",
  },
  northeast: {
    path: "M342 61 L409 52 L420 113 L359 137 L347 108 Z",
    label: { x: 383, y: 93 },
    color: "#c7793a",
  },
};

const US_GEO = feature(
  statesTopology as never,
  (statesTopology as { objects: { states: unknown } }).objects.states as never,
) as unknown as { features: StateFeature[] };

const STATE_ABBR_BY_NAME: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const CITY_COORDS: Record<string, [number, number]> = {
  "Los Angeles": [-118.2437, 34.0522],
  "San Francisco": [-122.4194, 37.7749],
  Seattle: [-122.3321, 47.6062],
  Phoenix: [-112.074, 33.4484],
  Dallas: [-96.797, 32.7767],
  Houston: [-95.3698, 29.7604],
  Denver: [-104.9903, 39.7392],
  "Kansas City": [-94.5786, 39.0997],
  Chicago: [-87.6298, 41.8781],
  Detroit: [-83.0458, 42.3314],
  Minneapolis: [-93.265, 44.9778],
  Cleveland: [-81.6944, 41.4993],
  Atlanta: [-84.388, 33.749],
  Miami: [-80.1918, 25.7617],
  Charlotte: [-80.8431, 35.2271],
  Nashville: [-86.7816, 36.1627],
  "New York": [-74.006, 40.7128],
  Boston: [-71.0589, 42.3601],
  Philadelphia: [-75.1652, 39.9526],
  Washington: [-77.0369, 38.9072],
};

const REGION_LABEL_COORDS: Record<string, [number, number]> = {
  west: [-119.5, 39],
  central: [-99, 34],
  midwest: [-89, 43],
  southeast: [-83, 32],
  northeast: [-74, 42],
};

const METRO_LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
  "Los Angeles": { dx: 12, dy: 18, anchor: "start" },
  "San Francisco": { dx: 12, dy: -13, anchor: "start" },
  Seattle: { dx: 12, dy: -10, anchor: "start" },
  Phoenix: { dx: 12, dy: 16, anchor: "start" },
  Dallas: { dx: 12, dy: -12, anchor: "start" },
  Houston: { dx: 12, dy: 20, anchor: "start" },
  Denver: { dx: -16, dy: -14, anchor: "end" },
  "Kansas City": { dx: 12, dy: 12, anchor: "start" },
  Chicago: { dx: -16, dy: 10, anchor: "end" },
  Detroit: { dx: 12, dy: -16, anchor: "start" },
  Minneapolis: { dx: -16, dy: -12, anchor: "end" },
  Cleveland: { dx: 12, dy: 20, anchor: "start" },
  Atlanta: { dx: -16, dy: 18, anchor: "end" },
  Miami: { dx: -14, dy: 19, anchor: "end" },
  Charlotte: { dx: 12, dy: -14, anchor: "start" },
  Nashville: { dx: -16, dy: -14, anchor: "end" },
  "New York": { dx: 12, dy: 2, anchor: "start" },
  Boston: { dx: -16, dy: -13, anchor: "end" },
  Philadelphia: { dx: -16, dy: 11, anchor: "end" },
  Washington: { dx: 12, dy: 22, anchor: "start" },
};

let messageSeed = 0;

function nextMessageId(prefix: string) {
  messageSeed += 1;
  return `${prefix}-${messageSeed}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
  }
  return response.json() as Promise<T>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}

function pct(numerator: number, denominator: number) {
  return denominator ? ((numerator / denominator) * 100).toFixed(2) : "0.00";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalNumber(value: unknown) {
  return isFiniteNumber(value) ? value : null;
}

function optionalMoney(value: unknown) {
  const amount = optionalNumber(value);
  return amount === null ? "N/A" : formatMoney(amount);
}

function audienceMatchPercent(audience: Audience) {
  return isFiniteNumber(audience.match_rate) ? Math.round(audience.match_rate * 100) : null;
}

function creativeQualityScore(creative: Creative) {
  return optionalNumber(creative.quality_score);
}

function creativePredictedCtr(creative: Creative) {
  return optionalNumber(creative.predicted_ctr);
}

function creativeTags(creative: Creative) {
  if (Array.isArray(creative.content_tags)) return creative.content_tags;
  if (!creative.content_tags) return [];
  return creative.content_tags
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function audienceChartLabel(name: string) {
  return name
    .replace("Premium Upgrade Lookalikes", "Premium Upgrade")
    .replace("Live Sports Loyalists", "Sports Loyalists")
    .replace("Family Co-Viewing", "Family Co-View")
    .replace("Churn Risk: Sports", "Churn Risk")
    .replace("Suppression: Service Issues", "Service Supp.");
}

function statusClass(status: string) {
  if (["Live", "Active", "Approved"].includes(status)) return "bg-emerald-50 text-[var(--green)] border-emerald-200";
  if (["Draft", "Submitted", "In Review", "Pending_Review"].includes(status)) return "bg-amber-50 text-[var(--amber)] border-amber-200";
  if (["Rejected", "Ended"].includes(status)) return "bg-red-50 text-[var(--red)] border-red-200";
  return "bg-slate-100 text-[var(--muted)] border-slate-200";
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`brand-panel rounded-lg border border-[var(--line)] bg-[var(--panel)] ${className}`}>{children}</section>;
}

function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">{eyebrow}</p> : null}
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Gauge;
  tone: string;
}) {
  return (
    <motion.div
      layout
      className="brand-kpi rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"
      style={{ borderTopColor: tone }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
        <span className="rounded-md border border-[var(--line)] bg-[var(--panel-soft)] p-1.5" style={{ color: tone }}>
          <Icon size={16} />
        </span>
      </div>
      <p className="font-mono text-[26px] font-semibold leading-none">{value}</p>
      <p className="mt-2 text-[12px] text-[var(--faint)]">{detail}</p>
    </motion.div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(value)}`}>{value.replace("_", " ")}</span>;
}

function regionForState(stateName: string, markets: MarketRegion[]) {
  const abbr = STATE_ABBR_BY_NAME[stateName];
  return markets.find((market) => market.states.includes(abbr));
}

function GeographyMarketMap({
  markets,
  selected,
  onSelect,
}: {
  markets: MarketRegion[];
  selected: MarketRegion;
  onSelect: (regionId: string) => void;
}) {
  const projection = useMemo(() => geoAlbersUsa().fitSize([920, 520], US_GEO as never), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  return (
    <svg viewBox="0 0 960 560" role="img" aria-label="US geography market map" className="h-auto w-full">
      <rect x="0" y="0" width="960" height="560" rx="20" fill="#f1f6f9" />
      <g transform="translate(20 16)">
        {US_GEO.features.map((state) => {
          const region = regionForState(state.properties.name, markets);
          const isActive = region?.id === selected.id;
          const statePath = path(state as never);
          if (!statePath) return null;
          return (
            <motion.path
              key={state.id}
              d={statePath}
              onClick={() => region && onSelect(region.id)}
              whileHover={region ? { scale: 1.006 } : undefined}
              className={region ? "cursor-pointer outline-none" : ""}
              fill={region ? REGION_SHAPES[region.id]?.color ?? "#0f9f95" : "#e6eef3"}
              fillOpacity={region ? (isActive ? 0.96 : 0.54) : 0.45}
              stroke={isActive ? "#111827" : "#ffffff"}
              strokeWidth={isActive ? 2.2 : 1.1}
              strokeLinejoin="round"
            />
          );
        })}

        {markets.map((market) => {
          const coords = REGION_LABEL_COORDS[market.id];
          const point = coords ? projection(coords) : null;
          if (!point) return null;
          const [x, y] = point;
          const isActive = market.id === selected.id;
          return (
            <motion.g
              key={market.id}
              onClick={() => onSelect(market.id)}
              className="cursor-pointer"
              animate={{ scale: isActive ? 1.08 : 1 }}
              transition={{ duration: 0.18 }}
            >
              <circle cx={x} cy={y - 26} r={isActive ? 28 : 24} fill="#ffffff" stroke={REGION_SHAPES[market.id]?.color} strokeWidth="3" />
              <text x={x} y={y - 30} textAnchor="middle" className="fill-[#111827] text-[16px] font-extrabold">
                {market.ctr.toFixed(2)}%
              </text>
              <text x={x} y={y - 12} textAnchor="middle" className="fill-[#5f6470] text-[10px] font-bold">
                CTR
              </text>
              <text
                x={x}
                y={y + 20}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth="6"
                className="fill-[#111827] text-[15px] font-extrabold"
              >
                {market.short_name}
              </text>
              <text
                x={x}
                y={y + 37}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth="5"
                className="fill-[#5f6470] text-[11px] font-bold"
              >
                {formatCompact(market.reach)} reach
              </text>
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}

function RegionalMetroMap({ market }: { market: MarketRegion }) {
  const projection = useMemo(() => geoAlbersUsa().fitSize([920, 520], US_GEO as never), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const regionColor = REGION_SHAPES[market.id]?.color ?? "#0f9f95";

  return (
    <svg viewBox="0 0 960 560" className="h-full w-full" role="img" aria-label={`${market.name} metro geography map`}>
      <rect x="0" y="0" width="960" height="560" rx="20" fill="#f1f6f9" />
      <g transform="translate(20 16)">
        {US_GEO.features.map((state) => {
          const abbr = STATE_ABBR_BY_NAME[state.properties.name];
          const inRegion = market.states.includes(abbr);
          const statePath = path(state as never);
          if (!statePath) return null;
          return (
            <path
              key={state.id}
              d={statePath}
              fill={inRegion ? regionColor : "#e6eef3"}
              fillOpacity={inRegion ? 0.84 : 0.28}
              stroke="#ffffff"
              strokeWidth={inRegion ? 1.8 : 0.8}
              strokeLinejoin="round"
            />
          );
        })}

        {market.cities.map((city) => {
          const coords = CITY_COORDS[city.name];
          const point = coords ? projection(coords) : null;
          if (!point) return null;
          const [x, y] = point;
          const label = METRO_LABEL_OFFSETS[city.name] ?? { dx: 18, dy: 0, anchor: "start" as const };
          const labelX = x + label.dx * 2.2;
          const labelY = y + label.dy * 1.5;
          return (
            <motion.g key={city.name} initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <circle cx={x} cy={y} r={Math.max(14, city.reach / 5200)} fill={regionColor} fillOpacity="0.22" />
              <line x1={x} y1={y} x2={labelX} y2={labelY - 5} stroke="#667085" strokeWidth="1.4" strokeDasharray="4 4" />
              <circle cx={x} cy={y} r="7" fill={regionColor} stroke="#ffffff" strokeWidth="3" />
              <text
                x={labelX}
                y={labelY}
                textAnchor={label.anchor}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth="8"
                className="fill-[#111827] text-[15px] font-extrabold"
              >
                {city.name}
              </text>
              <text
                x={labelX}
                y={labelY + 18}
                textAnchor={label.anchor}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth="7"
                className="fill-[#5f6470] text-[11px] font-bold"
              >
                {formatCompact(city.reach)} · {city.ctr.toFixed(2)}% CTR
              </text>
            </motion.g>
          );
        })}
      </g>
    </svg>
  );
}

function App() {
  const [view, setView] = useState<View>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [askPanelOpen, setAskPanelOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);
  const [architectureTab, setArchitectureTab] = useState<ArchitectureTab>("data");
  const [talkTrackOpen, setTalkTrackOpen] = useState(false);
  const [data, setData] = useState<AgencyData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [dashboard, briefs, audiences, creatives, activations, markets, backendTables, modelStatus] = await Promise.all([
          fetchJson<Dashboard>("/api/dashboard"),
          fetchJson<Brief[]>("/api/briefs"),
          fetchJson<Audience[]>("/api/audiences"),
          fetchJson<Creative[]>("/api/creatives"),
          fetchJson<Activation[]>("/api/activations"),
          fetchJson<MarketRegion[]>("/api/markets"),
          fetchJson<BackendTables>("/api/backend-tables"),
          fetchJson<ModelStatus>("/api/model-status"),
        ]);
        if (!ignore) setData({ dashboard, briefs, audiences, creatives, activations, markets, backendTables, modelStatus });
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Unable to load app data");
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const activeJourneyView = askPanelOpen ? "ask" : view;

  function navigateJourney(nextView: View) {
    if (nextView === "ask") {
      setAskPanelOpen(true);
      return;
    }
    setAskPanelOpen(false);
    setView(nextView);
  }

  function openArchitecture(tab: ArchitectureTab) {
    setArchitectureTab(tab);
    setArchitectureOpen(true);
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <motion.aside
        className={`brand-sidebar fixed left-0 top-0 z-20 hidden h-screen border-r border-white/10 text-white lg:block ${sidebarCollapsed ? "w-[76px]" : "w-[248px]"}`}
        animate={{ width: sidebarCollapsed ? 76 : 248 }}
        transition={{ duration: 0.22 }}
      >
        <button
          onClick={() => setSidebarCollapsed((current) => !current)}
          className="absolute -right-3 top-5 z-30 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[var(--brand-navy)] text-white/80 shadow-lg shadow-[#0b1f33]/20 transition-colors hover:bg-[var(--brand-navy-soft)] hover:text-white"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ArrowRight size={14} className={sidebarCollapsed ? "" : "rotate-180"} />
        </button>

        <div className={`flex h-16 items-center border-b border-white/10 ${sidebarCollapsed ? "justify-center px-3" : "gap-3 px-5 pr-8"}`}>
          <div className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg shadow-lg shadow-teal-500/20">
            <Megaphone size={18} />
          </div>
          {!sidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold leading-[16px]">
                <span className="block">Creative Command</span>
                <span className="block">Center</span>
              </p>
              <p className="truncate text-[11px] text-white/60">Marketing intelligence OS</p>
            </div>
          ) : null}
        </div>
        <nav className={`space-y-1 py-4 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateJourney(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center rounded-md py-2.5 text-left text-[13px] font-semibold transition-colors ${
                  active ? "bg-[var(--brand-copper)] text-white shadow-lg shadow-amber-900/20" : "text-white/72 hover:bg-white/10 hover:text-white"
                } ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"}`}
              >
                <Icon size={17} />
                {!sidebarCollapsed ? item.label : null}
              </button>
            );
          })}
        </nav>
        <div className={`absolute bottom-0 left-0 right-0 border-t border-white/10 ${sidebarCollapsed ? "p-2" : "p-4"}`}>
          {!sidebarCollapsed ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.08] p-3">
              <p className="text-[12px] font-semibold">Creative signal</p>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-white/70">
                <span className="h-2 w-2 rounded-full bg-[var(--brand-accent)]" />
                Decision layer live
              </div>
            </div>
          ) : null}
          <button
            onClick={() => openArchitecture("data")}
            title="Architecture"
            className={`flex w-full items-center rounded-md border border-white/10 bg-white/[0.06] text-left text-[12px] font-semibold text-white/72 transition-colors hover:bg-white/10 hover:text-white ${
              sidebarCollapsed ? "h-10 justify-center px-2" : "mt-2 justify-between px-3 py-2"
            }`}
          >
            <span className={`inline-flex items-center ${sidebarCollapsed ? "" : "gap-2"}`}>
              <Layers3 size={14} />
              {!sidebarCollapsed ? "Architecture" : null}
            </span>
            {!sidebarCollapsed ? <ArrowRight size={13} /> : null}
          </button>
          <button
            onClick={() => setTalkTrackOpen(true)}
            title="Talk Track"
            className={`flex w-full items-center rounded-md border border-white/10 bg-white/[0.06] text-left text-[12px] font-semibold text-white/72 transition-colors hover:bg-white/10 hover:text-white ${
              sidebarCollapsed ? "mt-2 h-10 justify-center px-2" : "mt-2 justify-between px-3 py-2"
            }`}
          >
            <span className={`inline-flex items-center ${sidebarCollapsed ? "" : "gap-2"}`}>
              <Megaphone size={14} />
              {!sidebarCollapsed ? "Talk Track" : null}
            </span>
            {!sidebarCollapsed ? <ArrowRight size={13} /> : null}
          </button>
        </div>
      </motion.aside>

      <main className={sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"}>
        <TopBar view={view} onView={navigateJourney} onAsk={() => navigateJourney("ask")} />
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          {error ? (
            <Panel className="p-6 text-sm text-[var(--red)]">{error}</Panel>
          ) : data ? (
            <div className="space-y-5">
              <JourneyExperience view={activeJourneyView} onNavigate={navigateJourney} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {view === "overview" && <Overview data={data} />}
                  {view === "briefs" && <Briefs briefs={data.briefs} />}
                  {view === "audiences" && <Audiences audiences={data.audiences} modelStatus={data.modelStatus} />}
                  {view === "creatives" && <Creatives creatives={data.creatives} />}
                  {view === "activations" && <Activations activations={data.activations} />}
                  {view === "markets" && <Markets markets={data.markets} />}
                  {view === "ask" && <AskDesk />}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <LoadingState />
          )}
        </div>
      </main>
      <AskSidePanel open={askPanelOpen} onClose={() => setAskPanelOpen(false)} />
      <SolutionArchitecturePanel
        open={architectureOpen}
        onClose={() => setArchitectureOpen(false)}
        data={data}
        activeTab={architectureTab}
        onActiveTab={setArchitectureTab}
      />
      <TalkTrackPanel open={talkTrackOpen} onClose={() => setTalkTrackOpen(false)} data={data} />
    </div>
  );
}

function TopBar({ view, onView, onAsk }: { view: View; onView: (view: View) => void; onAsk: () => void }) {
  const active = NAV_ITEMS.find((item) => item.id === view);
  return (
    <header className="brand-topbar sticky top-0 z-10 border-b border-[var(--line)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span>Creative Command Center</span>
            <span>/</span>
            <span className="font-semibold text-[var(--ink)]">{active?.label}</span>
          </div>
          <h1 className="mt-0.5 text-[20px] font-bold">{active?.label ?? "Overview"}</h1>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--muted)]">
            <Filter size={15} />
            Region: US
            <ChevronDown size={14} />
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--muted)]">
            <RefreshCw size={15} />
            Synced 09:40 CT
          </button>
          <button
            onClick={onAsk}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-[12px] font-semibold text-white shadow-lg shadow-sky-900/20"
          >
            <Sparkles size={15} />
            Ask AI
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4 py-2 lg:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.id === view;
          return (
            <button
              key={item.id}
              onClick={() => (item.id === "ask" ? onAsk() : onView(item.id))}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[12px] font-semibold ${
                selected ? "bg-[var(--brand-primary)] text-white" : "bg-white text-[var(--muted)]"
              }`}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-lg border border-[var(--line)] bg-white" />
      ))}
    </div>
  );
}

function JourneyExperience({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const activeStep = JOURNEY_STEPS.find((step) => step.id === view) ?? JOURNEY_STEPS[0];
  const ActiveIcon = activeStep.icon;
  const optimizationSteps = JOURNEY_STEPS.filter((step) => step.id !== "overview");

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--panel-soft)]/55 p-4">
        <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Campaign journey</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: activeStep.color }}>
              <ActiveIcon size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold">{activeStep.title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{activeStep.userGoal}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-[var(--faint)]">Signal</p>
              <p className="mt-1 text-[12px] font-semibold text-[var(--ink)]">{activeStep.signal}</p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-[var(--faint)]">Outcome</p>
              <p className="mt-1 text-[12px] font-semibold text-[var(--ink)]">{activeStep.outcome}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Brief to optimization loop</p>
            <p className="mt-1 text-[13px] leading-6 text-[var(--muted)]">
              The working loop starts once strategy is defined, then cycles through audience, creative, market, activation, and AI-assisted optimization.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--panel-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--muted)]">
            <RefreshCw size={14} />
            Continuous improvement
          </span>
        </div>
        <div className="thin-scrollbar overflow-x-auto pb-1">
          <div className="grid min-w-[780px] grid-cols-6 gap-3">
            {optimizationSteps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === view;
              return (
                <button
                  key={step.id}
                  onClick={() => onNavigate(step.id)}
                  className={`relative min-h-[136px] rounded-lg border p-3 text-left transition-colors ${
                    isActive ? "border-[var(--brand-accent)] bg-[var(--panel-soft)] shadow-sm" : "border-[var(--line)] bg-white hover:bg-[var(--panel-soft)]/60"
                  }`}
                >
                  {index < optimizationSteps.length - 1 ? (
                    <span className="absolute -right-[18px] top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--muted)] lg:flex">
                      <ArrowRight size={14} />
                    </span>
                  ) : null}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white" style={{ background: step.color }}>
                      <Icon size={17} />
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 font-mono text-[10px] font-semibold uppercase text-[var(--muted)]">{step.signal}</span>
                  </div>
                  <p className="text-[13px] font-bold">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{step.outcome}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Overview({ data }: { data: AgencyData }) {
  const { dashboard } = data;
  const [pacingWindow, setPacingWindow] = useState<PacingWindow>(7);
  const pacingTrend = useMemo(() => dashboard.trend.slice(-pacingWindow), [dashboard.trend, pacingWindow]);
  const qualityAvg = Math.round(dashboard.quality_radar.reduce((sum, item) => sum + item.score, 0) / dashboard.quality_radar.length);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Spend" value={formatMoney(dashboard.totals.spend)} detail={`CPA ${formatMoney(dashboard.totals.cpa)}`} icon={CircleDollarSign} tone="#256b8f" />
        <KpiCard label="Conversions" value={formatNumber(dashboard.totals.conversions)} detail={`${dashboard.totals.ctr}% blended CTR`} icon={TrendingUp} tone="#1f9d72" />
        <KpiCard label="Impressions" value={formatCompact(dashboard.totals.impressions)} detail={`${formatNumber(dashboard.totals.clicks)} clicks`} icon={LineChartIcon} tone="#5b65d8" />
        <KpiCard label="Quality Index" value={`${qualityAvg}`} detail={`${dashboard.totals.approved_creatives} approved assets`} icon={Wand2} tone="#0f9f95" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel>
          <SectionHeader
            title="Pacing and response curve"
            eyebrow="Spend and conversions"
            action={
              <div className="inline-flex rounded-md border border-[var(--line)] bg-[var(--panel-soft)] p-0.5" aria-label="Pacing date range">
                {PACING_WINDOWS.map((window) => (
                  <button
                    key={window}
                    type="button"
                    onClick={() => setPacingWindow(window)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      pacingWindow === window
                        ? "bg-white text-[var(--brand-primary)] shadow-sm"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {window}D
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-[360px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pacingTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf1" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
                <YAxis
                  yAxisId="spend"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#626a78" }}
                  tickFormatter={(value) => formatCompact(Number(value))}
                />
                <YAxis
                  yAxisId="response"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#626a78" }}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "Spend") return [formatMoney(Number(value)), name];
                    if (name === "Conversions") return [formatNumber(Number(value)), name];
                    return [value, name];
                  }}
                />
                <Legend verticalAlign="top" height={32} iconType="line" />
                <Line yAxisId="spend" type="monotone" dataKey="spend" name="Spend" stroke="#256b8f" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line yAxisId="response" type="monotone" dataKey="conversions" name="Conversions" stroke="#1f9d72" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Channel investment mix" eyebrow="Budget allocation" />
          <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1fr] xl:grid-cols-1 2xl:grid-cols-[0.9fr_1fr]">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboard.channel_mix} dataKey="value" innerRadius={54} outerRadius={86} paddingAngle={3}>
                    {dashboard.channel_mix.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {dashboard.channel_mix.map((channel, index) => (
                <div key={channel.name}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold">{channel.name}</span>
                    <span className="font-mono text-[var(--muted)]">{formatMoney(channel.spend)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--panel-soft)]">
                    <div className="h-2 rounded-full" style={{ width: `${channel.value}%`, background: COLORS[index % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <SectionHeader title="Creative quality gates" eyebrow="Pre-flight evaluation" />
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={dashboard.quality_radar}>
                <PolarGrid stroke="#dce3eb" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#626a78" }} />
                <Radar dataKey="score" stroke="#5b65d8" fill="#5b65d8" fillOpacity={0.28} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Agency activity stream" eyebrow="Operational feed" />
          <div className="divide-y divide-[var(--line)]">
            {dashboard.activity.map((item, index) => (
              <motion.div
                key={item.event}
                className="flex items-start gap-3 px-4 py-4"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--panel-soft)] text-[var(--teal)]">
                  {item.type === "alert" ? <Activity size={16} /> : <Layers3 size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{item.event}</p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">{item.detail}</p>
                </div>
                <span className="font-mono text-[11px] text-[var(--faint)]">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Briefs({ briefs }: { briefs: Brief[] }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = briefs.filter((brief) => {
    const text = `${brief.brief_name} ${brief.brand_name} ${brief.owner ?? ""}`.toLowerCase();
    return (status === "all" || brief.status === status) && (!search || text.includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Creative briefs"
        subtitle={`${filtered.length} briefs in the agency queue`}
        search={search}
        onSearch={setSearch}
        filters={["all", "Draft", "In Review", "Approved", "Active"]}
        activeFilter={status}
        onFilter={setStatus}
      />
      <Panel>
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Brief</th>
                <th className="px-4 py-3">Objective</th>
                <th className="px-4 py-3">Audience</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Assets</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filtered.map((brief) => (
                <tr key={brief.brief_id} className="hover:bg-[var(--panel-soft)]/70">
                  <td className="px-4 py-4">
                    <p className="text-[13px] font-semibold">{brief.brief_name}</p>
                    <p className="font-mono text-[11px] text-[var(--faint)]">{brief.brief_id}</p>
                  </td>
                  <td className="max-w-[280px] px-4 py-4 text-[13px] text-[var(--muted)]">{brief.campaign_objective}</td>
                  <td className="max-w-[220px] px-4 py-4 text-[12px] text-[var(--muted)]">{brief.target_audience_description ?? "N/A"}</td>
                  <td className="px-4 py-4 text-right font-mono text-[13px]">{optionalMoney(brief.budget)}</td>
                  <td className="px-4 py-4 text-right font-mono text-[13px]">{brief.creatives_count ?? "N/A"}</td>
                  <td className="px-4 py-4 text-[13px]">{brief.owner ?? "N/A"}</td>
                  <td className="px-4 py-4"><StatusPill value={brief.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Audiences({ audiences, modelStatus }: { audiences: Audience[]; modelStatus: ModelStatus }) {
  const [type, setType] = useState("all");
  const filtered = audiences
    .filter((audience) => type === "all" || audience.definition_type === type)
    .sort((a, b) => b.estimated_reach - a.estimated_reach);
  const chartData = filtered.map((audience) => ({
    name: audience.cohort_name,
    label: audienceChartLabel(audience.cohort_name),
    reach: audience.estimated_reach,
    match: audienceMatchPercent(audience),
  }));

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Audience strategy"
        subtitle={`${formatCompact(filtered.reduce((sum, item) => sum + item.estimated_reach, 0))} addressable customers`}
        filters={["all", "ml_model", "rule_based", "lookalike", "manual"]}
        activeFilter={type}
        onFilter={setType}
      />
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <SectionHeader title="Reach and match rate" eyebrow="C360 audience inventory" />
          <div className="h-[360px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 10, top: 8, bottom: 12 }}>
                <CartesianGrid stroke="#e6ebf1" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={58}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  tick={{ fontSize: 11, fill: "#626a78" }}
                />
                <YAxis
                  yAxisId="reach"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#626a78" }}
                  tickFormatter={formatCompact}
                />
                <YAxis
                  yAxisId="match"
                  orientation="right"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#626a78" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                  formatter={(value, name) => {
                    if (name === "reach") return [formatNumber(Number(value)), "Reach"];
                    if (name === "match") return [value === null ? "N/A" : `${value}%`, "Match rate"];
                    return [value, name];
                  }}
                />
                <Legend verticalAlign="top" height={30} />
                <Bar yAxisId="reach" dataKey="reach" name="Reach" fill="#0f9f95" radius={[4, 4, 0, 0]} />
                <Line yAxisId="match" type="monotone" dataKey="match" name="Match rate" stroke="#c7793a" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <div className="grid gap-3">
          {filtered.map((audience) => {
            const match = audienceMatchPercent(audience);
            return (
              <Panel key={audience.cohort_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold">{audience.cohort_name}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">{audience.cohort_description}</p>
                  </div>
                  <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                    {audience.definition_type.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-3">
                  <MetricMini label="Reach" value={formatCompact(audience.estimated_reach)} />
                  <MetricMini label="Match" value={match === null ? "N/A" : `${match}%`} />
                  <MetricMini label="LTV" value={optionalMoney(audience.avg_ltv)} />
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Creatives({ creatives }: { creatives: Creative[] }) {
  const [status, setStatus] = useState("all");
  const filtered = creatives.filter((creative) => status === "all" || creative.approval_status === status);
  const qualityData = filtered.map((creative) => ({
    name: creative.asset_name.split(" ").slice(0, 2).join(" "),
    quality: creativeQualityScore(creative),
    ctr: creativePredictedCtr(creative),
  }));

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Creative studio"
        subtitle={`${filtered.length} generated assets with quality signals`}
        filters={["all", "Draft", "Pending_Review", "Approved", "Rejected"]}
        activeFilter={status}
        onFilter={setStatus}
      />
      <Panel>
        <SectionHeader title="Quality vs predicted CTR" eyebrow="Pre-flight scoring" />
        <div className="h-[260px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={qualityData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e6ebf1" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
              <Tooltip />
              <Area dataKey="quality" stroke="#5b65d8" fill="#5b65d8" fillOpacity={0.18} strokeWidth={3} />
              <Line type="monotone" dataKey="ctr" stroke="#c7793a" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map((creative, index) => {
          const predictedCtr = creativePredictedCtr(creative);
          return (
            <motion.article
              key={creative.creative_asset_id}
              className="overflow-hidden rounded-lg border border-[var(--line)] bg-white"
              whileHover={{ y: -3 }}
              transition={{ duration: 0.16 }}
            >
              <div className={`relative flex h-40 items-end p-4 text-white ${["creative-sports", "creative-story", "creative-family", "creative-upgrade"][index % 4]}`}>
                <div className="absolute right-3 top-3 rounded-md bg-black/28 px-2 py-1 font-mono text-[11px]">
                  {creative.width_px}x{creative.height_px}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase opacity-80">{creative.asset_type}</p>
                  <p className="mt-1 text-[18px] font-bold leading-tight">{creative.asset_name}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <StatusPill value={creative.approval_status} />
                  <span className="font-mono text-[12px] text-[var(--muted)]">
                    {predictedCtr === null ? "N/A CTR" : `${predictedCtr.toFixed(2)}% CTR`}
                  </span>
                </div>
                <p className="text-[12px] text-[var(--muted)]">{creative.target_segment ?? "N/A"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {creativeTags(creative).map((tag) => (
                    <span key={tag} className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function Activations({ activations }: { activations: Activation[] }) {
  const [platform, setPlatform] = useState("all");
  const platforms = Array.from(new Set(activations.map((item) => item.destination_platform)));
  const filtered = activations.filter((activation) => platform === "all" || activation.destination_platform === platform);
  const totalSpend = filtered.reduce((sum, item) => sum + item.cost, 0);
  const platformData = platforms.map((name) => ({
    name,
    spend: activations.filter((item) => item.destination_platform === name).reduce((sum, item) => sum + item.cost, 0),
  }));

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Activation trafficking"
        subtitle={`${formatMoney(totalSpend)} in focused spend`}
        filters={["all", ...platforms]}
        activeFilter={platform}
        onFilter={setPlatform}
      />
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <SectionHeader title="Spend by platform" eyebrow="Media delivery" />
          <div className="h-[320px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical" margin={{ left: 10, right: 18, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf1" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="spend" fill="#0f9f95" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Activation</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">Conversions</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3">Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filtered.map((activation) => (
                  <tr key={activation.activation_id} className="hover:bg-[var(--panel-soft)]/70">
                    <td className="px-4 py-4">
                      <p className="text-[13px] font-semibold">{activation.activation_id}</p>
                      <p className="font-mono text-[11px] text-[var(--faint)]">{activation.campaign_id}</p>
                    </td>
                    <td className="px-4 py-4 text-[13px]">{activation.destination_platform}</td>
                    <td className="px-4 py-4"><StatusPill value={activation.trafficking_status} /></td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">{formatNumber(activation.impressions)}</td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">{pct(activation.clicks, activation.impressions)}%</td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">{formatNumber(activation.conversions)}</td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">{formatMoney(activation.cost)}</td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{activation.last_sync_ts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Markets({ markets }: { markets: MarketRegion[] }) {
  const [selectedId, setSelectedId] = useState(markets[0]?.id ?? "");
  const [expanded, setExpanded] = useState(true);
  const selected = markets.find((market) => market.id === selectedId) ?? markets[0];
  const totalReach = markets.reduce((sum, market) => sum + market.reach, 0);
  const totalSpend = markets.reduce((sum, market) => sum + market.spend, 0);

  function selectRegion(regionId: string) {
    setSelectedId(regionId);
    setExpanded(true);
  }

  if (!selected) {
    return <Panel className="p-6 text-[13px] text-[var(--muted)]">No market data available.</Panel>;
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid min-h-[650px] xl:grid-cols-[1.3fr_0.8fr]">
          <div className="relative border-b border-[var(--line)] bg-[#f8fafc] p-5 xl:border-b-0 xl:border-r">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">National market command map</p>
                <h2 className="mt-1 text-[22px] font-bold">Click a region to expand media opportunity</h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--muted)]">
                  Regional overlays combine C360 reach, paid-media spend, creative performance, and activation recommendations.
                </p>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 lg:w-[390px]">
                <MarketHeaderStat label="Reach" value={formatCompact(totalReach)} />
                <MarketHeaderStat label="Spend" value={formatMoney(totalSpend)} />
                <MarketHeaderStat label="Regions" value={`${markets.length}`} />
              </div>
            </div>

            <div className={`grid gap-4 ${expanded ? "2xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--muted)]">
                    <MousePointerClick size={15} />
                    Click any market region
                  </div>
                  <button
                    onClick={() => setExpanded((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--muted)]"
                  >
                    <Maximize2 size={14} />
                    {expanded ? "Compact" : "Expand"}
                  </button>
                </div>

                <GeographyMarketMap markets={markets} selected={selected} onSelect={selectRegion} />
              </div>

              <AnimatePresence mode="wait">
                {expanded ? (
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg border border-[var(--line)] bg-white p-4"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Expanded market lens</p>
                        <h3 className="mt-1 text-[19px] font-bold">{selected.name}</h3>
                      </div>
                      <span className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1.5 text-[11px] font-semibold text-white">{selected.priority}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-y border-[var(--line)] py-4">
                      <MetricMini label="Reach" value={formatCompact(selected.reach)} />
                      <MetricMini label="Spend" value={formatMoney(selected.spend)} />
                      <MetricMini label="CTR" value={`${selected.ctr.toFixed(2)}%`} />
                      <MetricMini label="Lift" value={`+${selected.conversion_lift.toFixed(1)}%`} />
                    </div>

                    <div className="mt-4 rounded-md bg-[var(--panel-soft)] p-3">
                      <p className="text-[12px] font-semibold">Signal</p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{selected.signal}</p>
                    </div>
                    <div className="mt-3 rounded-md border border-[var(--line)] p-3">
                      <p className="text-[12px] font-semibold">Recommended action</p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{selected.recommended_action}</p>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-[12px] font-semibold">Priority metros</p>
                      <div className="space-y-2">
                        {selected.cities.map((city) => (
                          <div key={city.name} className="flex items-center justify-between rounded-md border border-[var(--line)] px-3 py-2">
                            <div>
                              <p className="text-[12px] font-semibold">{city.name}, {city.state}</p>
                              <p className="font-mono text-[11px] text-[var(--faint)]">{formatCompact(city.reach)} reach</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-[12px] font-semibold">{city.ctr.toFixed(2)}%</p>
                              <p className="text-[11px] text-[var(--green)]">+{city.lift}% lift</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Selected region</p>
              <h3 className="mt-1 text-[22px] font-bold">{selected.name}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
                Top audience: <span className="font-semibold text-[var(--ink)]">{selected.top_audience}</span>
              </p>
            </div>

            <Panel>
              <SectionHeader title="Metro-level drilldown" eyebrow="Click-through intensity" />
              <div className="relative h-[300px] overflow-hidden rounded-b-lg bg-[#f1f6f9]">
                <RegionalMetroMap market={selected} />
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Reach momentum" eyebrow="Four-week activation curve" />
              <div className="h-[210px] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={selected.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e6ebf1" vertical={false} />
                    <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#626a78" }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#626a78" }} tickFormatter={formatCompact} />
                    <Tooltip formatter={(value, name) => (name === "reach" ? formatNumber(Number(value)) : value)} />
                    <Bar dataKey="reach" fill={REGION_SHAPES[selected.id]?.color ?? "#0f9f95"} fillOpacity={0.32} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="conversions" stroke="#13212d" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel>
              <SectionHeader title="Audience mix" eyebrow="Regional personalization" />
              <div className="space-y-3 p-4">
                {selected.audience_mix.map((item, index) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-semibold">{item.name}</span>
                      <span className="font-mono text-[var(--muted)]">{item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--panel-soft)]">
                      <motion.div
                        className="h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function TalkTrack({ data }: { data: AgencyData }) {
  const loadedTables = data.backendTables.tables.filter((table) => table.loaded);
  const totalRows = data.backendTables.tables.reduce((sum, table) => sum + table.rows, 0);
  const audienceTable = data.backendTables.tables.find((table) => table.name === "audiences");
  const storyCards = [
    {
      title: "Stay inside the app",
      text: "Use this tab as the customer-facing talk track so the demo does not have to jump to a separate architecture diagram.",
      icon: Megaphone,
      tone: "#256b8f",
    },
    {
      title: "Narrate brief to activation",
      text: "The application story starts with the brief, moves through audience, creative scoring, market opportunity, and activation control.",
      icon: Users,
      tone: "#0f9f95",
    },
    {
      title: "Be explicit about reality",
      text: "Call out what is live in this branch, what is sample-backed, and where Model Serving or Genie can be connected later.",
      icon: Layers3,
      tone: "#5b65d8",
    },
  ];
  const deploySteps = [
    "cd my_project",
    "npm ci",
    "npm run build",
    "databricks bundle deploy -t dev",
    "databricks bundle run creative_command_center -t dev",
  ];
  const tabStories = [
    {
      tab: "Overview",
      icon: Gauge,
      story: "Open with the operating picture: campaign health, spend, response, quality, and current operational signals in one place.",
      graphs: [
        "KPI cards frame the business scorecard: spend, conversions, impressions, and creative quality.",
        "The pacing curve shows whether spend is translating into conversion response over time.",
        "Channel mix explains where budget is concentrated before drilling into individual platform delivery.",
        "Quality radar and activity stream suggest whether the campaign is ready to scale or needs intervention.",
      ],
      transition: "Move to Briefs to show where this operating loop starts.",
      tone: "#256b8f",
    },
    {
      tab: "Briefs",
      icon: FileText,
      story: "Everything starts with the campaign brief: objective, audience intent, budget, owner, status, and asset readiness.",
      graphs: [
        "The brief table is the intake queue and approval checkpoint.",
        "Status filters show which campaigns are still draft, in review, approved, or active.",
        "Budget and asset counts explain how much work is ready to move into audience and creative planning.",
      ],
      transition: "Move to Audience to show how the brief turns into targetable cohorts.",
      tone: "#256b8f",
    },
    {
      tab: "Audiences",
      icon: Users,
      story: "Audience lens compares who we can reach, how well each cohort matches the campaign, and what governance constraints apply.",
      graphs: [
        "Reach bars show addressable scale by cohort.",
        "The match-rate line shows quality of fit, not just audience size.",
        "The cards surface LTV and eligibility flags so the team can avoid picking a large but poor-fit audience.",
      ],
      transition: "Move to Creative to show how selected audiences are matched to assets and performance signals.",
      tone: "#0f9f95",
    },
    {
      tab: "Creatives",
      icon: Palette,
      story: "Creative scoring is about evaluating existing or generated assets for readiness and predicted performance, not claiming pixel generation in this app.",
      graphs: [
        "The quality versus predicted CTR chart compares asset readiness against expected response.",
        "Approval-status filters separate ready assets from drafts and pending review.",
        "Creative cards connect format, target segment, tags, dimensions, quality, and predicted CTR.",
        "The story is performance measurement and iteration: which creative should go live, which needs work, and which variants can support A/B testing.",
      ],
      transition: "Move to Markets to explain where the strongest creative-audience combinations should be scaled.",
      tone: "#5b65d8",
    },
    {
      tab: "Markets",
      icon: MapPinned,
      story: "Market expansion adds geography to the decision: where to scale, optimize, or test based on reach, spend, CTR, lift, and audience mix.",
      graphs: [
        "The national map turns performance data into a regional planning surface.",
        "Clicking a region exposes the local signal and recommended action.",
        "Metro drilldown shows where reach and CTR concentrate within a region.",
        "Reach momentum and audience mix explain whether the recommendation is backed by growth, concentration, or cohort fit.",
      ],
      transition: "Move to Activations to show how market decisions become platform execution.",
      tone: "#c7793a",
    },
    {
      tab: "Activations",
      icon: RadioTower,
      story: "Activation control shows the media execution layer: platform spend, status, impressions, CTR, conversions, sync timing, and A/B references.",
      graphs: [
        "Spend by platform shows where delivery is live and where budget is concentrated.",
        "The activation table connects campaign IDs to platform status and response metrics.",
        "CTR and conversions show whether launched creative is generating measurable response.",
        "Sync timestamps reinforce that this is the operational control surface for trafficking and measurement.",
      ],
      transition: "Use Ask AI as an overlay for follow-up questions, not as the final workflow step.",
      tone: "#1f9d72",
    },
    {
      tab: "Ask AI",
      icon: Bot,
      story: "Ask AI is decision support that can open from the workflow without forcing the presenter to leave the current context.",
      graphs: [
        "Suggested prompts demonstrate the intended natural-language workflow.",
        "Structured answer tables show how Genie or SQL-backed answers could appear behind the same UI.",
        "In this branch the endpoint returns sample-backed answers, which is why the talk track should frame Genie as a production connection point.",
      ],
      transition: "Use Talk Track when you need to explain architecture, data source reality, or the demo story without leaving the app.",
      tone: "#13212d",
    },
  ];

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Self-serve story</p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-tight">Talk Track supports the demo narrative without becoming part of the workflow.</h2>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">
              The working product journey stays focused on brief intake, audience matching, creative performance scoring,
              regional opportunity, and activation control. This tab is only a presenter aid: it keeps the architecture,
              data provenance, and implementation caveats available inside the app while the customer-facing flow remains clean.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {storyCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-lg border border-[var(--line)] bg-white p-4">
                    <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-md text-white" style={{ background: card.tone }}>
                      <Icon size={17} />
                    </span>
                    <p className="text-[13px] font-bold">{card.title}</p>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">{card.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-4">
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Bundle data setup</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MetricMini label="CSV extracts" value={`${loadedTables.length}`} />
                <MetricMini label="Rows" value={formatNumber(totalRows)} />
                <MetricMini label="Bundle" value={data.backendTables.bundle_ready ? "Ready" : "Check"} />
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                Sample backend tables deploy with the Databricks App under <span className="font-mono">{data.backendTables.data_dir}</span>.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Audience model check</p>
              <p className="mt-2 text-[14px] font-bold">
                {data.modelStatus.audience_lens_uses_model_serving ? "Real Model Serving call detected" : "No real Model Serving call detected"}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                Audience lens reads <span className="font-mono">{data.modelStatus.checked_path}</span> from{" "}
                <span className="font-mono">{audienceTable?.path ?? "embedded fallback"}</span>.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeader title="Presenter guide by tab" eyebrow="What each view is saying" />
        <div className="grid gap-px overflow-hidden rounded-b-lg bg-[var(--line)] lg:grid-cols-2">
          {tabStories.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.tab} className="bg-white p-4">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white" style={{ background: item.tone }}>
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold">{item.tab}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{item.story}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {item.graphs.map((graph) => (
                    <div key={graph} className="rounded-md border border-[var(--line)] bg-[var(--panel-soft)]/55 px-3 py-2 text-[12px] leading-5 text-[var(--muted)]">
                      {graph}
                    </div>
                  ))}
                </div>
                <p className="mt-3 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold leading-5 text-[var(--ink)]">
                  {item.transition}
                </p>
              </article>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <SectionHeader title="Backend tables in this bundle" eyebrow="CSV extracts to FastAPI contracts" />
          <div className="overflow-x-auto thin-scrollbar">
            <table className="w-full min-w-[960px] text-left">
              <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Extract</th>
                  <th className="px-4 py-3">API</th>
                  <th className="px-4 py-3">Lakehouse target</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3">Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {data.backendTables.tables.map((table) => (
                  <tr key={table.name} className="hover:bg-[var(--panel-soft)]/70">
                    <td className="px-4 py-4">
                      <p className="text-[13px] font-semibold">{table.name}</p>
                      <p className="mt-1 max-w-[260px] text-[11px] leading-4 text-[var(--muted)]">{table.description}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{table.endpoint}</td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{table.lakehouse_table}</td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">{formatNumber(table.rows)}</td>
                    <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{table.path ?? "embedded fallback"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <SectionHeader title="Deployment talk track" eyebrow="Repo to Databricks App" />
            <div className="space-y-2 p-4">
              {deploySteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--panel-soft)] font-mono text-[11px] font-semibold text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <span className="font-mono text-[12px] text-[var(--ink)]">{step}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader title="Architecture summary" eyebrow="What changes in production" />
            <div className="space-y-3 p-4 text-[12px] leading-5 text-[var(--muted)]">
              <p>
                The portable branch serves CSV extracts through FastAPI so the app can deploy without workspace-specific tables,
                warehouses, Genie spaces, or serving endpoints.
              </p>
              <p>
                The production path replaces CSV extracts with Unity Catalog tables, keeps the same <span className="font-mono">/api/*</span> contracts,
                and can add Genie, SQL Warehouse, Lakebase, or Model Serving behind the API boundary.
              </p>
              <p>
                Current model verification is explicit: Audience lens does not call a real Model Serving endpoint in this branch.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <SectionHeader title="Mock CSV vs pipeline data contract" eyebrow="Production adjustments" />
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[1080px] text-left">
            <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Surface</th>
                <th className="px-4 py-3">CSV demo data</th>
                <th className="px-4 py-3">Pipeline data</th>
                <th className="px-4 py-3">Suggested adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {DATA_CONTRACT_GAPS.map((gap) => (
                <tr key={gap.surface} className="align-top hover:bg-[var(--panel-soft)]/70">
                  <td className="px-4 py-4 text-[13px] font-semibold">{gap.surface}</td>
                  <td className="px-4 py-4 text-[12px] leading-5 text-[var(--muted)]">{gap.mockCsv}</td>
                  <td className="px-4 py-4 text-[12px] leading-5 text-[var(--muted)]">{gap.pipeline}</td>
                  <td className="px-4 py-4 text-[12px] leading-5 text-[var(--ink)]">{gap.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function useAskAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { id: nextMessageId("u"), role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const answer = (await response.json()) as AskResult;
      setMessages((current) => [
        ...current,
        { id: nextMessageId("a"), role: "assistant", content: answer.answer, result: answer.result },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return { input, loading, messages, setInput, submit };
}

function AskMessageList({
  messages,
  loading,
  emptyText,
  className = "",
}: {
  messages: ChatMessage[];
  loading: boolean;
  emptyText: string;
  className?: string;
}) {
  return (
    <div className={`thin-scrollbar flex-1 space-y-4 overflow-y-auto ${className}`}>
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[180px] items-center justify-center text-center text-[13px] leading-6 text-[var(--faint)]">
          {emptyText}
        </div>
      ) : null}
      {messages.map((message) => (
        <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={`max-w-[86%] rounded-lg px-4 py-3 ${message.role === "user" ? "bg-[var(--brand-primary)] text-white" : "border border-[var(--line)] bg-white"}`}>
            <p className="text-[13px] leading-5">{message.content}</p>
            {message.result ? <ResultTable result={message.result} /> : null}
          </div>
        </div>
      ))}
      {loading ? <p className="text-[13px] text-[var(--muted)]">Querying FastAPI...</p> : null}
    </div>
  );
}

function AskInputBar({
  input,
  setInput,
  loading,
  submit,
  className = "",
}: {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  submit: (question: string) => void;
  className?: string;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(input);
      }}
      className={`flex gap-2 border-t border-[var(--line)] p-4 ${className}`}
    >
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-[13px] outline-none focus:border-[var(--teal)]"
        placeholder="Ask about campaign performance..."
      />
      <button disabled={loading || !input.trim()} className="inline-flex items-center gap-2 rounded-md bg-[var(--teal)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
        <Send size={15} />
        Send
      </button>
    </form>
  );
}

function TalkTrackPanel({ open, onClose, data }: { open: boolean; onClose: () => void; data: AgencyData | null }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 cursor-default bg-[#0b1f33]/35 backdrop-blur-[1px]" onClick={onClose} aria-label="Close talk track" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Talk track"
            className="absolute right-0 top-0 flex h-full w-full max-w-[1320px] flex-col border-l border-[var(--line)] bg-[var(--panel)] shadow-2xl shadow-[#0b1f33]/20"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Megaphone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold">Talk Track</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">Presenter narrative and tab-by-tab demo story</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
            <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
              {data ? <TalkTrack data={data} /> : <LoadingState />}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SolutionArchitecturePanel({
  open,
  onClose,
  data,
  activeTab,
  onActiveTab,
}: {
  open: boolean;
  onClose: () => void;
  data: AgencyData | null;
  activeTab: ArchitectureTab;
  onActiveTab: (tab: ArchitectureTab) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const endpoints = [
    "/api/health",
    "/api/dashboard",
    "/api/briefs",
    "/api/audiences",
    "/api/creatives",
    "/api/activations",
    "/api/markets",
    "/api/backend-tables",
    "/api/model-status",
    "/api/ask",
  ];
  const tabs: Array<{ id: ArchitectureTab; label: string; icon: typeof Gauge; description: string }> = [
    { id: "business", label: "Business Overview", icon: Gauge, description: "CMO questions and outcomes" },
    { id: "data", label: "Data & ML Pipeline", icon: Layers3, description: "Data sources through serving" },
    { id: "platform", label: "Platform Architecture", icon: RadioTower, description: "AWS hosting, VPN, and auth" },
    { id: "agent", label: "Agent Topology", icon: Bot, description: "Future Ask AI orchestration" },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 cursor-default bg-[#0b1f33]/35 backdrop-blur-[1px]" onClick={onClose} aria-label="Close architecture panel" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Backend solution architecture"
            className="absolute right-0 top-0 flex h-full w-full max-w-[1320px] flex-col border-l border-[var(--line)] bg-[var(--panel)] shadow-2xl shadow-[#0b1f33]/20"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Layers3 size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold">Architecture menu</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">Business lens, platform flow, data and ML pipeline, and agent topology</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="border-b border-[var(--line)] bg-[var(--panel-soft)]/65 p-3">
              <div className="thin-scrollbar flex gap-2 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onActiveTab(tab.id)}
                      className={`min-w-[190px] rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected ? "border-[var(--brand-accent)] bg-white text-[var(--ink)] shadow-sm" : "border-[var(--line)] bg-white/60 text-[var(--muted)] hover:bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-[12px] font-bold">
                        <Icon size={15} />
                        {tab.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-[var(--faint)]">{tab.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
              {activeTab === "business" && (data ? <BusinessArchitectureOverview data={data} /> : <LoadingState />)}
              {activeTab === "data" && <EndToEndArchitectureDiagram endpoints={endpoints} />}
              {activeTab === "platform" && (data ? <PlatformArchitecture data={data} /> : <LoadingState />)}
              {activeTab === "agent" && (data ? <AgentTopology data={data} /> : <LoadingState />)}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BusinessArchitectureOverview({ data }: { data: AgencyData }) {
  const userJourney = [
    {
      phase: "Plan",
      icon: Gauge,
      color: "#256b8f",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      persona: "CMO / Campaign Lead",
      goal: "Set campaign objectives and budget allocation",
      touchpoints: ["Overview dashboard", "Budget planner", "Goal setting"],
      outcome: "Approved campaign brief with KPI targets",
    },
    {
      phase: "Target",
      icon: Users,
      color: "#0f9f95",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      persona: "Audience Strategist",
      goal: "Identify and prioritize audience segments",
      touchpoints: ["Audience explorer", "Cohort builder", "Match analysis"],
      outcome: "Activation-ready audience lists",
    },
    {
      phase: "Create",
      icon: Palette,
      color: "#5b65d8",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      persona: "Creative Director",
      goal: "Evaluate and approve creative assets",
      touchpoints: ["Asset library", "Quality scores", "A/B test setup"],
      outcome: "Approved creatives with test variants",
    },
    {
      phase: "Activate",
      icon: Megaphone,
      color: "#c7793a",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      persona: "Media Planner",
      goal: "Deploy campaigns to platforms",
      touchpoints: ["Platform sync", "Trafficking status", "Go-live checklist"],
      outcome: "Live campaigns across channels",
    },
    {
      phase: "Optimize",
      icon: TrendingUp,
      color: "#1f9d72",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      persona: "Performance Analyst",
      goal: "Monitor and improve campaign performance",
      touchpoints: ["Real-time metrics", "Market insights", "Ask AI"],
      outcome: "Optimized spend and improved ROI",
    },
  ];

  const dataFlows = [
    { from: "1P Data", to: "Audience Builder", type: "CRM, transactions, web" },
    { from: "Partner Data", to: "Enrichment", type: "Demographics, intent" },
    { from: "Creative Assets", to: "Quality Scoring", type: "Images, video, copy" },
    { from: "Platform APIs", to: "Activation Sync", type: "Meta, Google, TTD" },
    { from: "Performance Data", to: "Dashboards", type: "Impressions, conversions" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-accent)]">Business User Journey</p>
        <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Campaign Lifecycle Architecture</h2>
        <p className="mt-2 max-w-3xl text-[13px] text-[var(--muted)]">
          How marketing teams interact with the Creative Command Center — from planning through optimization.
          Each phase has a primary persona, key touchpoints, and a defined outcome.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
        <p className="mb-4 text-[11px] font-bold uppercase text-slate-500">User Journey Phases</p>
        <div className="grid grid-cols-5 gap-3">
          {userJourney.map((phase, index) => {
            const Icon = phase.icon;
            return (
              <div key={phase.phase} className="relative">
                {index < userJourney.length - 1 && (
                  <div className="absolute right-0 top-8 z-10 hidden h-0.5 w-6 -translate-x-0 translate-y-0 bg-slate-300 lg:block" style={{ right: "-12px" }} />
                )}
                <div className={`rounded-xl border-2 ${phase.borderColor} ${phase.bgColor} p-4`}>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: phase.color }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: phase.color }}>{phase.phase}</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-white/80 p-2">
                    <p className="text-[10px] font-semibold text-[var(--faint)]">Persona</p>
                    <p className="text-[11px] font-bold text-[var(--ink)]">{phase.persona}</p>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--muted)]">{phase.goal}</p>
                  <div className="mt-3 space-y-1">
                    {phase.touchpoints.map((tp) => (
                      <div key={tp} className="rounded bg-white/60 px-2 py-1 text-[10px] font-medium text-[var(--ink)]">{tp}</div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-white pt-2">
                    <p className="text-[9px] font-semibold uppercase text-[var(--faint)]">Outcome</p>
                    <p className="text-[10px] font-semibold" style={{ color: phase.color }}>{phase.outcome}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-white p-5">
          <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Data Flow Architecture</p>
          <h3 className="mt-1 text-[16px] font-extrabold">How Data Moves Through the System</h3>
          <div className="mt-4 space-y-2">
            {dataFlows.map((flow) => (
              <div key={flow.from} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-slate-50/50 p-3">
                <div className="min-w-[100px] rounded bg-blue-100 px-2 py-1 text-center">
                  <p className="text-[11px] font-bold text-blue-800">{flow.from}</p>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <div className="h-0.5 w-4 bg-slate-300" />
                  <ArrowRight size={14} />
                  <div className="h-0.5 w-4 bg-slate-300" />
                </div>
                <div className="min-w-[120px] rounded bg-emerald-100 px-2 py-1 text-center">
                  <p className="text-[11px] font-bold text-emerald-800">{flow.to}</p>
                </div>
                <p className="flex-1 text-[10px] text-[var(--muted)]">{flow.type}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-[11px] font-bold uppercase text-[var(--faint)]">User Roles & Access</p>
            <div className="mt-3 space-y-2">
              {[
                { role: "CMO / Executive", access: "Read all, approve budgets", views: "Overview, Reports" },
                { role: "Campaign Manager", access: "Full campaign control", views: "All lenses" },
                { role: "Audience Analyst", access: "Audience data, segments", views: "Audiences, Markets" },
                { role: "Creative Team", access: "Asset management", views: "Creative, Briefs" },
                { role: "Media Ops", access: "Platform activation", views: "Activations, Sync" },
              ].map((user) => (
                <div key={user.role} className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-slate-50/50 px-3 py-2">
                  <p className="text-[11px] font-bold text-[var(--ink)]">{user.role}</p>
                  <p className="text-[10px] text-[var(--muted)]">{user.access}</p>
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">{user.views}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              <p className="text-[12px] font-bold text-blue-900">Ask AI — Cross-Phase Intelligence</p>
            </div>
            <p className="mt-2 text-[11px] text-blue-800">AI assistant spans all phases, helping users:</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {["Answer campaign questions", "Surface insights", "Recommend actions", "Explain metrics"].map((cap) => (
                <div key={cap} className="rounded bg-white/70 px-2 py-1 text-[10px] font-medium text-blue-700">{cap}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Integration Touchpoints</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {["CRM Systems", "Data Warehouse", "Ad Platforms", "Analytics", "Creative Tools", "Reporting"].map((system) => (
            <div key={system} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
              <p className="text-[11px] font-semibold text-[var(--ink)]">{system}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlatformArchitecture({ data }: { data: AgencyData }) {
  const layers = [
    {
      name: "Presentation Layer",
      color: "#256b8f",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      components: [
        { name: "React App", type: "Frontend", spec: "Vite + TypeScript" },
        { name: "FastAPI", type: "API Gateway", spec: "Python 3.11" },
      ],
    },
    {
      name: "Compute Layer",
      color: "#5b65d8",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      components: [
        { name: "SQL Warehouse", type: "Analytics", spec: "Serverless" },
        { name: "Model Serving", type: "ML Inference", spec: "GPU/CPU" },
        { name: "Genie", type: "NL Query", spec: "AI-powered" },
      ],
    },
    {
      name: "Orchestration Layer",
      color: "#0f9f95",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      components: [
        { name: "Lakeflow", type: "Pipelines", spec: "Declarative ETL" },
        { name: "Workflows", type: "Jobs", spec: "Scheduled/Triggered" },
        { name: "MLflow", type: "ML Ops", spec: "Experiment tracking" },
      ],
    },
    {
      name: "Storage Layer",
      color: "#c7793a",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      components: [
        { name: "Unity Catalog", type: "Governance", spec: `${data.backendTables.tables.length} tables` },
        { name: "Delta Lake", type: "Tables", spec: "ACID transactions" },
        { name: "S3", type: "Object Store", spec: "AWS managed" },
      ],
    },
  ];

  const securityZones = [
    { zone: "Public Internet", trust: "Untrusted", controls: ["WAF", "DDoS protection", "TLS 1.3"] },
    { zone: "DMZ / Edge", trust: "Semi-trusted", controls: ["Load balancer", "API gateway", "Rate limiting"] },
    { zone: "Application", trust: "Trusted", controls: ["Service mesh", "mTLS", "RBAC"] },
    { zone: "Data", trust: "Highly trusted", controls: ["Encryption at rest", "Column masking", "Row filters"] },
  ];

  const authFlow = [
    { step: "1", name: "SSO Redirect", from: "Browser", to: "Enterprise IdP", protocol: "SAML/OIDC" },
    { step: "2", name: "Token Issue", from: "IdP", to: "Databricks", protocol: "JWT" },
    { step: "3", name: "Workspace Auth", from: "Databricks", to: "Unity Catalog", protocol: "SCIM" },
    { step: "4", name: "Data Access", from: "UC", to: "S3/Delta", protocol: "IAM" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">// ARCHITECTURE BLUEPRINT</p>
            <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Platform Reference Architecture</h2>
            <p className="mt-2 max-w-2xl text-[13px] text-[var(--muted)]">
              Four-layer architecture on AWS with Databricks as the unified data + AI platform.
              Security zones enforce defense in depth from edge to data.
            </p>
          </div>
          <div className="hidden shrink-0 font-mono text-[10px] text-slate-400 md:block">
            <p>Region: us-west-2</p>
            <p>VPC: 10.0.0.0/16</p>
            <p>AZs: 3</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
        <p className="mb-4 font-mono text-[11px] font-bold uppercase text-slate-500">Layered Architecture</p>
        <div className="space-y-3">
          {layers.map((layer) => (
            <div key={layer.name} className={`rounded-lg border-2 ${layer.borderColor} ${layer.bgColor} p-3`}>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: layer.color }}>
                  <Layers3 size={16} className="text-white" />
                </div>
                <p className="text-[13px] font-bold" style={{ color: layer.color }}>{layer.name}</p>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {layer.components.map((comp) => (
                  <div key={comp.name} className="rounded-md border border-white bg-white p-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-bold text-[var(--ink)]">{comp.name}</p>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">{comp.type}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{comp.spec}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500">
              <RadioTower size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-red-700">Security Zones</p>
          </div>
          <div className="mt-3 space-y-2">
            {securityZones.map((zone, i) => (
              <div key={zone.zone} className="flex items-center gap-3 rounded-md border border-red-200 bg-white p-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-red-200 font-mono text-[10px] font-bold text-red-700">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[var(--ink)]">{zone.zone}</p>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                      zone.trust === "Untrusted" ? "bg-red-100 text-red-700" :
                      zone.trust === "Semi-trusted" ? "bg-amber-100 text-amber-700" :
                      zone.trust === "Trusted" ? "bg-emerald-100 text-emerald-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{zone.trust}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--muted)]">{zone.controls.join(" · ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
              <Users size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-blue-700">Authentication Flow</p>
          </div>
          <div className="mt-3 space-y-2">
            {authFlow.map((step) => (
              <div key={step.step} className="flex items-center gap-2 rounded-md border border-blue-200 bg-white p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 font-mono text-[10px] font-bold text-white">
                  {step.step}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[var(--ink)]">{step.name}</p>
                  <p className="font-mono text-[9px] text-[var(--muted)]">{step.from} → {step.to}</p>
                </div>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-blue-700">{step.protocol}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
        <p className="font-mono text-[11px] font-bold uppercase text-emerald-700">Network Topology</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          {[
            { name: "VPN / Direct Connect", desc: "Corporate → AWS private path", icon: "🔒" },
            { name: "PrivateLink", desc: "Private API endpoints in VPC", icon: "🔗" },
            { name: "NAT Gateway", desc: "Controlled outbound egress", icon: "🌐" },
            { name: "Security Groups", desc: "Instance-level firewall", icon: "🛡️" },
          ].map((item) => (
            <div key={item.name} className="rounded-lg border border-emerald-200 bg-white p-3">
              <p className="text-[16px]">{item.icon}</p>
              <p className="mt-1 text-[12px] font-bold text-[var(--ink)]">{item.name}</p>
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-slate-50 p-4">
        <p className="font-mono text-[11px] font-bold uppercase text-slate-500">Component Inventory</p>
        <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-mono font-bold text-slate-600">Service</th>
                <th className="px-3 py-2 text-left font-mono font-bold text-slate-600">Type</th>
                <th className="px-3 py-2 text-left font-mono font-bold text-slate-600">Status</th>
                <th className="px-3 py-2 text-left font-mono font-bold text-slate-600">Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] font-mono">
              <tr><td className="px-3 py-2">Databricks App</td><td className="px-3 py-2 text-[var(--muted)]">Presentation</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">React + FastAPI</td></tr>
              <tr><td className="px-3 py-2">SQL Warehouse</td><td className="px-3 py-2 text-[var(--muted)]">Compute</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">Serverless</td></tr>
              <tr><td className="px-3 py-2">Model Serving</td><td className="px-3 py-2 text-[var(--muted)]">ML</td><td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 ${data.modelStatus.configured_endpoint ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{data.modelStatus.configured_endpoint ? "Configured" : "None"}</span></td><td className="px-3 py-2 text-[var(--muted)]">GPU endpoint</td></tr>
              <tr><td className="px-3 py-2">Unity Catalog</td><td className="px-3 py-2 text-[var(--muted)]">Governance</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">{data.backendTables.tables.length} tables governed</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AgentTopology({ data }: { data: AgencyData }) {
  const agents = [
    { id: "supervisor", name: "Supervisor", type: "Orchestrator", model: "Claude 3.5", tools: ["intent_classifier", "policy_guard", "response_synth"], color: "#13212d" },
    { id: "genie", name: "Genie Analyst", type: "Data Agent", model: "Genie Space", tools: ["sql_exec", "schema_lookup", "uc_query"], color: "#256b8f" },
    { id: "scorer", name: "Model Scorer", type: "ML Agent", model: "Serving Endpoint", tools: ["feature_fetch", "model_invoke", "score_explain"], color: "#0f9f95" },
    { id: "creative", name: "Creative Eval", type: "Content Agent", model: "Vision + LLM", tools: ["asset_analyze", "quality_score", "variant_compare"], color: "#5b65d8" },
    { id: "activation", name: "Activation Ops", type: "Ops Agent", model: "Tool-use LLM", tools: ["platform_api", "status_check", "alert_trigger"], color: "#c7793a" },
  ];

  const toolMatrix = [
    { tool: "Unity Catalog", genie: true, scorer: true, creative: false, activation: false, desc: "Governed table access" },
    { tool: "SQL Warehouse", genie: true, scorer: false, creative: false, activation: true, desc: "Analytics queries" },
    { tool: "Model Serving", genie: false, scorer: true, creative: true, activation: false, desc: "ML inference" },
    { tool: "Feature Store", genie: false, scorer: true, creative: false, activation: false, desc: "Real-time features" },
    { tool: "Vector Search", genie: true, scorer: false, creative: true, activation: false, desc: "Semantic retrieval" },
    { tool: "MLflow", genie: false, scorer: true, creative: true, activation: false, desc: "Experiment tracking" },
  ];

  const stateMachine = [
    { state: "IDLE", desc: "Awaiting user input", next: ["ROUTING"] },
    { state: "ROUTING", desc: "Supervisor classifies intent", next: ["ANALYTICS", "SCORING", "CREATIVE", "OPS"] },
    { state: "ANALYTICS", desc: "Genie/SQL query execution", next: ["SYNTHESIS"] },
    { state: "SCORING", desc: "Model inference + explain", next: ["SYNTHESIS"] },
    { state: "CREATIVE", desc: "Asset evaluation", next: ["SYNTHESIS"] },
    { state: "OPS", desc: "Platform status check", next: ["SYNTHESIS"] },
    { state: "SYNTHESIS", desc: "Response assembly", next: ["IDLE"] },
  ];

  const guardrails = [
    { name: "PII Filter", type: "Input", desc: "Redact sensitive data before processing" },
    { name: "Policy Guard", type: "Routing", desc: "Block unauthorized tool access" },
    { name: "Hallucination Check", type: "Output", desc: "Verify claims against source data" },
    { name: "Token Budget", type: "Resource", desc: "Cap context length per turn" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-violet-600">// AI SYSTEM DESIGN</p>
            <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Multi-Agent Orchestration Architecture</h2>
            <p className="mt-2 max-w-2xl text-[13px] text-[var(--muted)]">
              Supervisor pattern with specialized sub-agents. Each agent has scoped tools, guardrails, and observability via MLflow tracing.
            </p>
          </div>
          <div className="hidden shrink-0 rounded-lg border border-violet-200 bg-white p-3 md:block">
            <p className="font-mono text-[10px] text-violet-500">Runtime</p>
            <p className="font-mono text-[14px] font-bold text-[var(--ink)]">{data.modelStatus.mode.replace("_", " ")}</p>
            <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">/api/ask</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-4">
        <p className="mb-4 font-mono text-[11px] font-bold uppercase text-slate-500">Agent Graph</p>
        <div className="flex items-start justify-center gap-6">
          <div className="flex flex-col items-center">
            <div className="rounded-xl border-2 border-slate-800 bg-slate-800 p-4 text-center shadow-lg">
              <Bot size={24} className="mx-auto text-white" />
              <p className="mt-2 text-[13px] font-bold text-white">Supervisor</p>
              <p className="text-[10px] text-slate-300">Orchestrator</p>
            </div>
            <div className="mt-2 h-8 w-0.5 bg-slate-300" />
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-0.5 w-8 bg-slate-300" />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {agents.slice(1).map((agent) => (
            <div key={agent.id} className="rounded-lg border-2 p-3" style={{ borderColor: agent.color, background: `${agent.color}10` }}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded" style={{ background: agent.color }}>
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: agent.color }}>{agent.name}</p>
                  <p className="font-mono text-[9px] text-[var(--muted)]">{agent.type}</p>
                </div>
              </div>
              <div className="mt-2 rounded bg-white/70 px-2 py-1">
                <p className="font-mono text-[9px] text-[var(--muted)]">Model: {agent.model}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {agent.tools.map((tool) => (
                  <span key={tool} className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[8px]" style={{ color: agent.color }}>{tool}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500">
              <Layers3 size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-emerald-700">Tool Capability Matrix</p>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-emerald-200 bg-white">
            <table className="w-full text-[10px]">
              <thead className="bg-emerald-100">
                <tr>
                  <th className="px-2 py-1.5 text-left font-mono font-bold text-emerald-700">Tool</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Genie</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Scorer</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Creative</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono">
                {toolMatrix.map((row) => (
                  <tr key={row.tool}>
                    <td className="px-2 py-1.5 font-semibold">{row.tool}</td>
                    <td className="px-2 py-1.5 text-center">{row.genie ? "✓" : "–"}</td>
                    <td className="px-2 py-1.5 text-center">{row.scorer ? "✓" : "–"}</td>
                    <td className="px-2 py-1.5 text-center">{row.creative ? "✓" : "–"}</td>
                    <td className="px-2 py-1.5 text-center">{row.activation ? "✓" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500">
              <Activity size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-amber-700">State Machine</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {stateMachine.map((s, i) => (
              <div key={s.state} className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-2 py-1.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                  s.state === "IDLE" ? "bg-slate-200 text-slate-600" :
                  s.state === "ROUTING" ? "bg-violet-200 text-violet-700" :
                  s.state === "SYNTHESIS" ? "bg-emerald-200 text-emerald-700" :
                  "bg-amber-200 text-amber-700"
                }`}>{i}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold text-[var(--ink)]">{s.state}</p>
                  <p className="truncate text-[9px] text-[var(--muted)]">{s.desc}</p>
                </div>
                <span className="font-mono text-[8px] text-amber-600">→ {s.next.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500">
              <RadioTower size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-red-700">Guardrails</p>
          </div>
          <div className="mt-3 space-y-2">
            {guardrails.map((g) => (
              <div key={g.name} className="rounded-md border border-red-200 bg-white p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[var(--ink)]">{g.name}</p>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-red-700">{g.type}</span>
                </div>
                <p className="mt-0.5 text-[9px] text-[var(--muted)]">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
              <LineChartIcon size={14} className="text-white" />
            </div>
            <p className="font-mono text-[11px] font-bold uppercase text-blue-700">MLOps Integration</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { name: "MLflow Tracing", desc: "End-to-end request tracing", status: "Active" },
              { name: "Experiment Tracking", desc: "Prompt/model versioning", status: "Active" },
              { name: "Model Registry", desc: "Serving endpoint management", status: data.modelStatus.configured_endpoint ? "Configured" : "Pending" },
              { name: "Evaluation", desc: "Quality metrics & evals", status: "Active" },
            ].map((item) => (
              <div key={item.name} className="rounded-md border border-blue-200 bg-white p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[var(--ink)]">{item.name}</p>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-semibold ${
                    item.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                    item.status === "Configured" ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>{item.status}</span>
                </div>
                <p className="mt-0.5 text-[9px] text-[var(--muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-blue-200 bg-white p-2">
            <p className="font-mono text-[10px] font-bold text-blue-700">Observability Stack</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["Traces", "Spans", "Latency", "Token count", "Error rate", "Feedback"].map((m) => (
                <span key={m} className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[9px] text-blue-700">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectureCard({
  title,
  subtitle,
  tone,
  delay = 0,
}: {
  title: string;
  subtitle: string;
  tone: "source" | "stream" | "bronze" | "silver" | "gold" | "serving";
  delay?: number;
}) {
  const toneClass = {
    source: "border-blue-300 bg-blue-50 text-blue-950",
    stream: "border-violet-300 bg-violet-50 text-violet-950",
    bronze: "border-orange-300 bg-orange-50 text-orange-950",
    silver: "border-slate-300 bg-slate-50 text-slate-950",
    gold: "border-amber-300 bg-amber-50 text-amber-950",
    serving: "border-emerald-300 bg-emerald-50 text-emerald-950",
  }[tone];

  return (
    <motion.div
      className={`architecture-card flex min-h-[72px] flex-col justify-center rounded-lg border px-3 py-2 text-center ${toneClass}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.28, delay }}
    >
      <p className="text-[12px] font-bold leading-4">{title}</p>
      <p className="mt-1 font-mono text-[10px] leading-4 text-[var(--muted)]">{subtitle}</p>
    </motion.div>
  );
}

function ArchitectureConnector({ dotted = false, delay = 0 }: { dotted?: boolean; delay?: number }) {
  return (
    <div className="architecture-connector-track relative flex h-5 items-center justify-center">
      <motion.span
        className={`architecture-flow-line h-0.5 w-full ${dotted ? "border-t-2 border-dashed border-blue-400" : "bg-blue-400"}`}
        initial={{ scaleX: 0, transformOrigin: "left" }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.35, delay }}
      />
      <span className="architecture-signal-dot" style={{ animationDelay: `${delay + 0.15}s` }} />
      <span className="architecture-signal-dot architecture-signal-dot-secondary" style={{ animationDelay: `${delay + 0.65}s` }} />
      <motion.span
        className="h-2 w-2 shrink-0 rounded-full bg-blue-500 shadow-sm shadow-blue-500/40"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ duration: 0.4, delay: delay + 0.18 }}
      />
    </div>
  );
}

function EndToEndArchitectureDiagram({ endpoints }: { endpoints: string[] }) {
  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-[24px] font-extrabold text-[var(--ink)]">Marketing Intelligence Data Architecture</h2>
        <p className="mt-2 text-[13px] font-semibold text-[var(--muted)]">Creative Command Center: end-to-end data and AI flow on Databricks</p>
      </div>

      <div className="thin-scrollbar overflow-x-auto pb-2">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[190px_38px_170px_38px_520px_38px_300px] gap-0">
            <motion.div className="rounded-t-xl border border-blue-200 bg-blue-50" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
              <ArchitectureLaneHeader icon={FileText} title="Data Sources" subtitle="Enterprise systems" color="#256b8f" />
            </motion.div>
            <div />
            <motion.div className="rounded-t-xl border border-violet-200 bg-violet-50" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <ArchitectureLaneHeader icon={RefreshCw} title="Ingestion" subtitle="Jobs / API sync" color="#5b65d8" />
            </motion.div>
            <div />
            <motion.div className="rounded-t-xl border border-red-200 bg-red-50" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <ArchitectureLaneHeader icon={Layers3} title="Data & AI Platform" subtitle="Databricks Lakehouse" color="#ef4444" />
            </motion.div>
            <div />
            <motion.div className="rounded-t-xl border border-emerald-200 bg-emerald-50" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <ArchitectureLaneHeader icon={RadioTower} title="Serving & Apps" subtitle="Operational consumption" color="#0f9f95" />
            </motion.div>

            <div className="space-y-5 rounded-b-xl border-x border-b border-blue-200 bg-blue-50/35 p-4">
              {ARCHITECTURE_ROWS.map((row, index) => (
                <ArchitectureCard key={row.source[0]} title={row.source[0]} subtitle={row.source[1]} tone="source" delay={0.05 + index * 0.04} />
              ))}
            </div>

            <div className="space-y-[83px] pt-9">
              {ARCHITECTURE_ROWS.map((row, index) => (
                <ArchitectureConnector key={row.source[0]} delay={0.18 + index * 0.04} />
              ))}
            </div>

            <div className="space-y-5 rounded-b-xl border-x border-b border-violet-200 bg-violet-50/35 p-4">
              {ARCHITECTURE_ROWS.map((row, index) => (
                <ArchitectureCard key={row.stream[0]} title={row.stream[0]} subtitle={row.stream[1]} tone="stream" delay={0.22 + index * 0.04} />
              ))}
            </div>

            <div className="space-y-[83px] pt-9">
              {ARCHITECTURE_ROWS.map((row, index) => (
                <ArchitectureConnector key={row.stream[0]} delay={0.34 + index * 0.04} />
              ))}
            </div>

            <div className="rounded-b-xl border-x border-b border-red-200 bg-red-50/30 p-3">
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
                <div className="mb-3 grid grid-cols-3 gap-3 px-1 text-center text-[11px] font-bold uppercase text-[var(--faint)]">
                  <span>Bronze</span>
                  <span>Silver</span>
                  <span>Gold</span>
                </div>
                <div className="space-y-5">
                  {ARCHITECTURE_ROWS.map((row, rowIndex) => (
                    <div key={row.bronze[0]} className="grid grid-cols-[1fr_24px_1fr_24px_1fr] items-center gap-2">
                      <ArchitectureCard title={row.bronze[0]} subtitle={row.bronze[1]} tone="bronze" delay={0.4 + rowIndex * 0.04} />
                      <ArchitectureConnector delay={0.5 + rowIndex * 0.04} />
                      <ArchitectureCard title={row.silver[0]} subtitle={row.silver[1]} tone="silver" delay={0.58 + rowIndex * 0.04} />
                      <ArchitectureConnector dotted delay={0.68 + rowIndex * 0.04} />
                      <ArchitectureCard title={row.gold[0]} subtitle={row.gold[1]} tone="gold" delay={0.76 + rowIndex * 0.04} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[11px] font-semibold text-[var(--faint)]">Lakeflow Declarative Pipeline / Medallion Architecture</p>
              </div>
            </div>

            <div className="space-y-[83px] pt-9">
              {ARCHITECTURE_ROWS.map((row, index) => (
                <ArchitectureConnector key={row.gold[0]} dotted delay={0.92 + index * 0.04} />
              ))}
            </div>

            <div className="rounded-b-xl border-x border-b border-emerald-200 bg-emerald-50/25 p-4">
              <div className="grid h-full grid-rows-[1fr_auto_1fr] gap-4">
                <div className="grid grid-cols-2 gap-3">
                  {ARCH_SERVING_NODES.slice(0, 4).map((node, index) => (
                    <ArchitectureCard key={node[0]} title={node[0]} subtitle={node[1]} tone="serving" delay={1.05 + index * 0.05} />
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <ArchitectureConnector dotted delay={1.25} />
                </div>
                <ArchitectureCard title={ARCH_SERVING_NODES[4][0]} subtitle={ARCH_SERVING_NODES[4][1]} tone="source" delay={1.32} />
              </div>
            </div>
          </div>

          <motion.div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/45 p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-violet-900">Unity Catalog - Governance, Quality & Access Control</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Classification tags, masking policies, table constraints, lineage, and endpoint access boundaries.</p>
              </div>
              <span className="rounded-md border border-violet-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-violet-700">governed</span>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              {ARCH_TAGS.map((tag, index) => (
                <motion.span
                  key={tag}
                  className="rounded-md border border-violet-200 bg-white px-2 py-1 text-center font-mono text-[10px] font-semibold text-violet-700"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.15 + index * 0.05 }}
                >
                  {tag}
                </motion.span>
              ))}
            </div>
            <div className="mt-3 grid gap-3 text-[11px] text-[var(--muted)] md:grid-cols-4">
              <p><span className="font-semibold text-[var(--ink)]">PII masking</span><br />cohort identifiers, customer attributes</p>
              <p><span className="font-semibold text-[var(--ink)]">DLT expectations</span><br />valid spend, valid CTR, valid market mapping</p>
              <p><span className="font-semibold text-[var(--ink)]">Lineage</span><br />source to gold KPI traceability</p>
              <p><span className="font-semibold text-[var(--ink)]">Access control</span><br />app, analyst, and operator views</p>
            </div>
          </motion.div>

          <motion.div className="mt-4 rounded-xl border border-red-200 bg-red-50/35 p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
            <p className="mb-3 text-[13px] font-bold text-red-900">Platform Services</p>
            <div className="grid gap-3 md:grid-cols-4">
              {ARCH_PLATFORM_SERVICES.map((service, index) => (
                <motion.div
                  key={service[0]}
                  className="rounded-lg border border-red-200 bg-white px-3 py-3 text-center"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 + index * 0.05 }}
                >
                  <p className="text-[12px] font-bold">{service[0]}</p>
                  <p className="mt-1 text-[11px] text-[var(--faint)]">{service[1]}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-[13px] font-semibold">Current API contract</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {endpoints.map((endpoint) => (
              <span key={endpoint} className="rounded-md border border-[var(--line)] bg-[var(--panel-soft)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--muted)]">
                {endpoint}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-[13px] font-semibold">Implementation path</p>
          <div className="mt-3 space-y-2 text-[12px] leading-5 text-[var(--muted)]">
            <p>Today the demo uses FastAPI JSON contracts and bundled CSV extracts. The architecture canvas shows the production path behind the same contracts.</p>
            <p>Databricks tables, Genie, SQL Warehouse, and Lakebase can be added without changing the React command center surface.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectureLaneHeader({ icon: Icon, title, subtitle, color }: { icon: typeof Gauge; title: string; subtitle: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-md text-white" style={{ background: color }}>
        <Icon size={17} />
      </span>
      <div>
        <p className="text-[13px] font-extrabold leading-4">{title}</p>
        <p className="text-[11px] font-semibold text-[var(--faint)]">{subtitle}</p>
      </div>
    </div>
  );
}

function AskSidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { input, loading, messages, setInput, submit } = useAskAssistant();

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 cursor-default bg-[#0b1f33]/35 backdrop-blur-[1px]" onClick={onClose} aria-label="Close Ask AI panel" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Ask AI side panel"
            className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--line)] bg-[var(--panel)] shadow-2xl shadow-[#0b1f33]/20"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 300 }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Bot size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">Ask Creative Command Center</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">Natural language workspace</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="border-b border-[var(--line)] bg-[var(--panel-soft)]/70 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase text-[var(--faint)]">Suggested prompts</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ASK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion)}
                    className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[var(--muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
                  >
                    <span>{suggestion}</span>
                    <Send size={14} className="shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <AskMessageList
              messages={messages}
              loading={loading}
              emptyText="Ask Creative Command Center about CTR, spend, activation status, creative quality, or ROI."
              className="p-4"
            />
            <AskInputBar input={input} setInput={setInput} loading={loading} submit={submit} />
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function AskDesk() {
  const { input, loading, messages, setInput, submit } = useAskAssistant();

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel className="p-4">
        <div className="brand-mark mb-5 flex h-12 w-12 items-center justify-center rounded-lg">
          <Bot size={22} />
        </div>
        <h2 className="text-[22px] font-bold">Ask the activation desk</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
          The FastAPI endpoint returns structured tables now. It can be wired to Genie, SQL warehouse, or Lakebase without changing the React surface.
        </p>
        <div className="mt-6 grid gap-2">
          {ASK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => submit(suggestion)}
              className="flex items-center justify-between rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--muted)] hover:border-[var(--teal)] hover:text-[var(--ink)]"
            >
              {suggestion}
              <Send size={14} />
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="flex min-h-[620px] flex-col">
        <SectionHeader title="Query results" eyebrow="Natural language workspace" />
        <AskMessageList
          messages={messages}
          loading={loading}
          emptyText="Select a query or ask about CTR, activation status, creative quality, or ROI."
          className="p-4"
        />
        <AskInputBar input={input} setInput={setInput} loading={loading} submit={submit} />
      </Panel>
    </div>
  );
}

function ResultTable({ result }: { result: NonNullable<AskResult["result"]> }) {
  const columns = Object.keys(result.rows[0] ?? {});
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-[var(--line)] bg-white text-[var(--ink)]">
      <div className="border-b border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-[12px] font-semibold">{result.title}</div>
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="text-[var(--muted)]">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index} className="border-t border-[var(--line)]">
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 font-mono text-[11px]">{row[column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkSurface({
  title,
  subtitle,
  search,
  onSearch,
  filters,
  activeFilter,
  onFilter,
}: {
  title: string;
  subtitle: string;
  search?: string;
  onSearch?: (value: string) => void;
  filters: string[];
  activeFilter: string;
  onFilter: (value: string) => void;
}) {
  return (
    <Panel className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-[20px] font-bold">{title}</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {onSearch ? (
            <label className="flex h-10 min-w-[260px] items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3">
              <Search size={15} className="text-[var(--faint)]" />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                placeholder="Search"
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => onFilter(filter)}
                className={`rounded-md border px-3 py-2 text-[12px] font-semibold ${
                  activeFilter === filter ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]"
                }`}
              >
                {filter === "all" ? "All" : filter.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">{label}</p>
      <p className="mt-1 font-mono text-[17px] font-semibold">{value}</p>
    </div>
  );
}

function MarketHeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--line)] bg-white px-3 py-2.5">
      <p className="truncate text-[10px] font-semibold uppercase text-[var(--faint)]">{label}</p>
      <p className="mt-1 truncate font-mono text-[15px] font-semibold leading-none text-[var(--ink)]">{value}</p>
    </div>
  );
}

export default App;
