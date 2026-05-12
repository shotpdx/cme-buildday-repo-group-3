import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bot,
  ChevronDown,
  CircleDollarSign,
  FileText,
  Filter,
  Gauge,
  Layers3,
  LineChart as LineChartIcon,
  Megaphone,
  Palette,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
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

type View = "overview" | "briefs" | "audiences" | "creatives" | "activations" | "ask";

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
  target_audience_description: string;
  status: "Draft" | "In Review" | "Approved" | "Active";
  created_ts: string;
  concepts_count: number;
  creatives_count: number;
  budget: number;
  owner: string;
};

type Audience = {
  cohort_id: string;
  cohort_name: string;
  cohort_description: string;
  definition_type: "rule_based" | "ml_model" | "lookalike" | "manual";
  personalization_granularity: "Segment" | "Micro_Cohort" | "One_to_One";
  estimated_reach: number;
  is_region_allowed: boolean;
  is_channel_allowed: boolean;
  is_frequency_capped: boolean;
  status: "Active" | "Archived";
  last_updated_ts: string;
  match_rate: number;
  avg_ltv: number;
};

type Creative = {
  creative_asset_id: string;
  asset_name: string;
  asset_type: "Image" | "Video" | "DCO";
  format: string;
  width_px: number;
  height_px: number;
  approval_status: "Draft" | "Pending_Review" | "Approved" | "Rejected";
  target_segment: string;
  content_tags: string[];
  generation_model: string;
  created_at: string;
  quality_score: number;
  predicted_ctr: number;
};

type Activation = {
  activation_id: string;
  creative_asset_id: string;
  campaign_id: string;
  destination_platform: string;
  trafficking_status: "Draft" | "Submitted" | "Live" | "Paused" | "Ended";
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ab_test_id: string | null;
  last_sync_ts: string;
};

type AgencyData = {
  dashboard: Dashboard;
  briefs: Brief[];
  audiences: Audience[];
  creatives: Creative[];
  activations: Activation[];
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

const COLORS = ["#0f8b8d", "#e4572e", "#7157d9", "#2e9d62", "#c78a05"];
const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Gauge }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "briefs", label: "Briefs", icon: FileText },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "creatives", label: "Creatives", icon: Palette },
  { id: "activations", label: "Activations", icon: RadioTower },
  { id: "ask", label: "Ask AI", icon: Bot },
];

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
  return <section className={`rounded-lg border border-[var(--line)] bg-[var(--panel)] ${className}`}>{children}</section>;
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
      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4"
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

function App() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<AgencyData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [dashboard, briefs, audiences, creatives, activations] = await Promise.all([
          fetchJson<Dashboard>("/api/dashboard"),
          fetchJson<Brief[]>("/api/briefs"),
          fetchJson<Audience[]>("/api/audiences"),
          fetchJson<Creative[]>("/api/creatives"),
          fetchJson<Activation[]>("/api/activations"),
        ]);
        if (!ignore) setData({ dashboard, briefs, audiences, creatives, activations });
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Unable to load app data");
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-[248px] border-r border-[var(--line)] bg-[#17181c] text-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--teal)]">
            <Megaphone size={18} />
          </div>
          <div>
            <p className="text-[14px] font-bold">Activation Desk</p>
            <p className="text-[11px] text-white/55">Agency command center</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
                  active ? "bg-white text-[#17181c]" : "text-white/72 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/[0.07] p-3">
            <p className="text-[12px] font-semibold">API status</p>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-white/70">
              <span className="h-2 w-2 rounded-full bg-[var(--green)]" />
              FastAPI live
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:pl-[248px]">
        <TopBar view={view} onView={setView} />
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          {error ? (
            <Panel className="p-6 text-sm text-[var(--red)]">{error}</Panel>
          ) : data ? (
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
                {view === "audiences" && <Audiences audiences={data.audiences} />}
                {view === "creatives" && <Creatives creatives={data.creatives} />}
                {view === "activations" && <Activations activations={data.activations} />}
                {view === "ask" && <AskDesk />}
              </motion.div>
            </AnimatePresence>
          ) : (
            <LoadingState />
          )}
        </div>
      </main>
    </div>
  );
}

function TopBar({ view, onView }: { view: View; onView: (view: View) => void }) {
  const active = NAV_ITEMS.find((item) => item.id === view);
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-white/88 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span>Creative Activation</span>
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
            onClick={() => onView("ask")}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--ink)] px-3 py-2 text-[12px] font-semibold text-white"
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
              onClick={() => onView(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[12px] font-semibold ${
                selected ? "bg-[var(--ink)] text-white" : "bg-white text-[var(--muted)]"
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

function Overview({ data }: { data: AgencyData }) {
  const { dashboard } = data;
  const qualityAvg = Math.round(dashboard.quality_radar.reduce((sum, item) => sum + item.score, 0) / dashboard.quality_radar.length);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Spend" value={formatMoney(dashboard.totals.spend)} detail={`CPA ${formatMoney(dashboard.totals.cpa)}`} icon={CircleDollarSign} tone="#0f8b8d" />
        <KpiCard label="Conversions" value={formatNumber(dashboard.totals.conversions)} detail={`${dashboard.totals.ctr}% blended CTR`} icon={TrendingUp} tone="#2e9d62" />
        <KpiCard label="Impressions" value={formatCompact(dashboard.totals.impressions)} detail={`${formatNumber(dashboard.totals.clicks)} clicks`} icon={LineChartIcon} tone="#7157d9" />
        <KpiCard label="Quality Index" value={`${qualityAvg}`} detail={`${dashboard.totals.approved_creatives} approved assets`} icon={Wand2} tone="#e4572e" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel>
          <SectionHeader
            title="Pacing and response curve"
            eyebrow="Spend, conversions, and CTR"
            action={<span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">Last 7 days</span>}
          />
          <div className="h-[360px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e6ebf1" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#626a78" }} />
                <Tooltip formatter={(value, name) => (name === "spend" ? formatMoney(Number(value)) : value)} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#0f8b8d" strokeWidth={3} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#e4572e" strokeWidth={3} dot={{ r: 3 }} />
                <Line yAxisId="right" type="monotone" dataKey="ctr" stroke="#7157d9" strokeWidth={2} dot={false} />
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
                <Radar dataKey="score" stroke="#7157d9" fill="#7157d9" fillOpacity={0.28} />
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
    const text = `${brief.brief_name} ${brief.brand_name} ${brief.owner}`.toLowerCase();
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
                  <td className="max-w-[220px] px-4 py-4 text-[12px] text-[var(--muted)]">{brief.target_audience_description}</td>
                  <td className="px-4 py-4 text-right font-mono text-[13px]">{formatMoney(brief.budget)}</td>
                  <td className="px-4 py-4 text-right font-mono text-[13px]">{brief.creatives_count}</td>
                  <td className="px-4 py-4 text-[13px]">{brief.owner}</td>
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

function Audiences({ audiences }: { audiences: Audience[] }) {
  const [type, setType] = useState("all");
  const filtered = audiences
    .filter((audience) => type === "all" || audience.definition_type === type)
    .sort((a, b) => b.estimated_reach - a.estimated_reach);
  const chartData = filtered.map((audience) => ({
    name: audience.cohort_name,
    label: audienceChartLabel(audience.cohort_name),
    reach: audience.estimated_reach,
    match: Math.round(audience.match_rate * 100),
    ltv: audience.avg_ltv,
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
                    if (name === "match") return [`${value}%`, "Match rate"];
                    return [value, name];
                  }}
                />
                <Legend verticalAlign="top" height={30} />
                <Bar yAxisId="reach" dataKey="reach" name="Reach" fill="#0f8b8d" radius={[4, 4, 0, 0]} />
                <Line yAxisId="match" type="monotone" dataKey="match" name="Match rate" stroke="#e4572e" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <div className="grid gap-3">
          {filtered.map((audience) => (
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
                <MetricMini label="Match" value={`${Math.round(audience.match_rate * 100)}%`} />
                <MetricMini label="LTV" value={formatMoney(audience.avg_ltv)} />
              </div>
            </Panel>
          ))}
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
    quality: creative.quality_score,
    ctr: creative.predicted_ctr,
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
              <Area dataKey="quality" stroke="#7157d9" fill="#7157d9" fillOpacity={0.18} strokeWidth={3} />
              <Line type="monotone" dataKey="ctr" stroke="#e4572e" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filtered.map((creative, index) => (
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
                <span className="font-mono text-[12px] text-[var(--muted)]">{creative.predicted_ctr.toFixed(2)}% CTR</span>
              </div>
              <p className="text-[12px] text-[var(--muted)]">{creative.target_segment}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {creative.content_tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.article>
        ))}
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
                <Bar dataKey="spend" fill="#0f8b8d" radius={[0, 5, 5, 0]} />
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

function AskDesk() {
  const suggestions = ["average CTR by audience", "activation status", "creative quality", "campaign ROI"];
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

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel className="p-4">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--ink)] text-white">
          <Bot size={22} />
        </div>
        <h2 className="text-[22px] font-bold">Ask the activation desk</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
          The FastAPI endpoint returns structured tables now. It can be wired to Genie, SQL warehouse, or Lakebase without changing the React surface.
        </p>
        <div className="mt-6 grid gap-2">
          {suggestions.map((suggestion) => (
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
        <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-[13px] text-[var(--faint)]">
              Select a query or ask about CTR, activation status, creative quality, or ROI.
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[86%] rounded-lg px-4 py-3 ${message.role === "user" ? "bg-[var(--ink)] text-white" : "border border-[var(--line)] bg-white"}`}>
                <p className="text-[13px]">{message.content}</p>
                {message.result ? <ResultTable result={message.result} /> : null}
              </div>
            </div>
          ))}
          {loading ? <p className="text-[13px] text-[var(--muted)]">Querying FastAPI...</p> : null}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
          className="flex gap-2 border-t border-[var(--line)] p-4"
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
                  activeFilter === filter ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)]"
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

export default App;
