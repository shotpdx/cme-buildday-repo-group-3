import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Gauge,
  Info,
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
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
  X,
  Zap,
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

type View = "overview" | "briefs" | "audiences" | "studio" | "evaluation" | "activations" | "markets" | "ask";
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

type AudienceTrait = {
  cohort_id: string;
  trait_profile_id: string;
  topic_affinity_json: string;
  subscription_propensity_score: number;
  churn_risk_score: number;
  device_usage_json: string;
  engagement_style: string;
  lifecycle_stage: string;
  preferred_tone: string;
  creative_implications_text: string;
};

type CreativeAsset = {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  storage_uri: string;
  thumbnail_uri: string;
  format: string;
  width_px: number;
  height_px: number;
  aspect_ratio: string;
  placement?: string;
  demo_category?: string;
  category_slug?: string;
  related_asset_ids?: string[];
  content_tags: string;
  description: string;
  recommended_usage?: string;
  source_system?: string;
  source_asset_external_id?: string;
  rights_profile_id: string;
  approved_usage_contexts_json: string;
  historical_performance_json: string;
  brand_safety_score: number;
  status: string;
};

type CreativeGenerationRequest = {
  request_id: string;
  brief_id: string;
  cohort_id: string;
  placement: string;
  campaign_objective: string;
  content_type: string;
  source_mode: string;
  selected_base_asset_ids_json: string;
  user_instructions: string;
  requested_variant_count: number;
  request_status: string;
  created_ts: string;
};

type CreativeVariant = {
  creative_asset_id: string;
  request_id: string;
  brief_id: string;
  cohort_id: string;
  source_asset_id: string;
  parent_creative_asset_id: string;
  reference_asset_id?: string;
  reference_asset_name?: string;
  reference_thumbnail_uri?: string;
  reference_demo_category?: string;
  variant_number: number;
  asset_name: string;
  asset_type: string;
  placement: string;
  format: string;
  width_px: number;
  height_px: number;
  aspect_ratio: string;
  storage_uri: string;
  thumbnail_uri: string;
  generation_prompt: string;
  generation_model: string;
  generation_params_json: string;
  adaptation_summary: string;
  approval_status: string;
  approved_by?: string;
  approved_ts?: string | null;
  quality_score?: number;
  predicted_ctr?: number;
  target_segment?: string;
  content_tags?: string;
};

type PolicyCheck = {
  check_id: string;
  creative_asset_id: string;
  check_type: string;
  check_status: string;
  score: number;
  blocking_reason: string;
  policy_version: string;
  model_or_rule: string;
  review_required: boolean;
};

type SyntheticEvaluation = {
  evaluation_id: string;
  creative_asset_id: string;
  cohort_id: string;
  placement: string;
  panel_size: number;
  click_propensity_score: number;
  expected_dwell_time_score: number;
  subscription_start_propensity_score: number;
  relevance_score: number;
  clarity_score: number;
  fatigue_risk_score: number;
  brand_fit_score: number;
  overall_score: number;
  rank_within_segment_placement: number;
  judge_model: string;
};

type CreativeLineageEdge = {
  lineage_edge_id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  relationship_type: string;
};

type CreativeTransformation = {
  transformation_id: string;
  creative_asset_id: string;
  input_asset_id: string;
  output_asset_id: string;
  transformation_type: string;
  edit_sequence: number;
  edit_label: string;
  edit_goal: string;
  placement: string;
  source_width_px: number;
  source_height_px: number;
  source_aspect_ratio: string;
  output_width_px: number;
  output_height_px: number;
  output_aspect_ratio: string;
  tool_or_model: string;
  edit_status: string;
};

type ActivationExport = {
  export_id: string;
  creative_asset_id: string;
  cohort_id: string;
  placement: string;
  destination_system: string;
  destination_asset_id: string;
  export_status: string;
  payload_uri: string;
  exported_by?: string;
  exported_ts?: string;
  error_message?: string;
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
  activation_source?: string;
  placement?: string;
  cohort_id?: string;
  destination_asset_id?: string;
  export_id?: string;
};

type ActivationSubmitResponse = {
  export: ActivationExport;
  activation: Activation;
};

type ActivationLineageStep = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string;
  status?: string;
  metadata: Record<string, string>;
};

type ActivationLineage = {
  activation_id: string;
  activation?: Activation | null;
  export?: ActivationExport | null;
  creative?: Creative | null;
  creative_variant?: CreativeVariant | null;
  generation_request?: CreativeGenerationRequest | null;
  brief?: Brief | null;
  audience?: Audience | null;
  reference_asset?: CreativeAsset | null;
  steps: ActivationLineageStep[];
  evidence: Array<{ label: string; value: string }>;
  transformations: CreativeTransformation[];
  policy_checks: PolicyCheck[];
  synthetic_evaluations: SyntheticEvaluation[];
  lineage_edges: CreativeLineageEdge[];
  source_preview_uri?: string;
  final_preview_uri?: string;
  video_preview_uri?: string;
  source_volume_url?: string;
  approved_volume_url?: string;
  generation_model?: string;
  generation_model_id?: string;
  brand_guideline_id?: string;
  brand_guideline_version?: string;
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
  data_source?: string;
  catalog?: string;
  schema?: string;
  data_dir: string;
  bundle_ready: boolean;
  tables: BackendTable[];
};

type ModelStatus = {
  audience_lens_uses_model_serving: boolean;
  serving_endpoint_configured: boolean;
  configured_endpoint: string | null;
  creative_generation_mode?: string;
  creative_model_endpoint?: string;
  creative_image_model?: string;
  policy_model_endpoint?: string;
  judge_model_endpoint?: string;
  mode: string;
  checked_path: string;
  verified: boolean;
  evidence: string[];
};

type BrandGuideline = {
  guideline_id: string;
  brand_name: string;
  profile_name: string;
  version: string;
  status: string;
  tone: string;
  headline_rules_json: string;
  visual_rules_json: string;
  color_tokens_json: string;
  required_elements_json: string;
  blocked_claims_json: string;
  created_ts: string;
  updated_ts: string;
};

type GenerationModel = {
  model_id: string;
  label: string;
  provider: string;
  endpoint_name: string;
  modality: string;
  default: boolean;
  description: string;
  latency_profile: string;
  governance_note: string;
};

type EvaluationRubric = {
  rubric_id: string;
  name: string;
  judge_model: string;
  weights_json: string;
  criteria_json: string;
  created_ts: string;
};

type ScoreExplanation = {
  explanation_id: string;
  evaluation: SyntheticEvaluation;
  creative_variant: CreativeVariant | null;
  audience: Audience | null;
  generation_request: CreativeGenerationRequest | null;
  brand_guideline: BrandGuideline | null;
  rubric: EvaluationRubric;
  channel_matrix: {
    evaluation_id: string;
    creative_asset_id: string;
    asset_name: string;
    recommended_channel_id: string;
    recommended_channel_label: string;
    channels: Array<{
      channel_id: string;
      channel_label: string;
      score: number;
      projected_ctr: number;
      projected_cpm: number;
      projected_conversions: number;
    }>;
  };
  model_settings: {
    judge_model: string;
    generation_model: string;
    generation_model_id: string;
    rubric_id: string;
    score_source: string;
  };
  reasoning: string[];
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
  audienceTraits: AudienceTrait[];
  creativeAssets: CreativeAsset[];
  generationRequests: CreativeGenerationRequest[];
  creativeVariants: CreativeVariant[];
  policyChecks: PolicyCheck[];
  syntheticEvaluations: SyntheticEvaluation[];
  lineageEdges: CreativeLineageEdge[];
  creativeTransformations: CreativeTransformation[];
  activationExports: ActivationExport[];
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
const GENIE_RECOMMENDED_QUESTIONS = [
  "Which base creative assets are approved for homepage hero placements for sports audiences?",
  "Which policy checks are blocked, warning, or require review, and what evidence was recorded?",
  "Which pending review variants are missing policy checks or synthetic audience evaluations?",
  "Where did live performance differ most from synthetic audience predictions?",
  "Which briefs have generated variants, approved winners, policy checks, and activation exports?",
  "Which creatives are ready for onsite personalization activation exports?",
  "Which base assets have rights constraints that block social or newsletter usage?",
  "What audience traits should influence creative direction for churn-risk sports cohorts?",
  "Which generation model endpoints produced the current variants, and which variants are approved?",
  "Which approved creative variants rank highest by segment and placement?",
  "Compare synthetic audience scores by placement, cohort, and creative variant.",
  "What transformations were applied to each creative variant, including crop, inpaint, outpaint, and aspect-ratio conversion?",
];
const PACING_WINDOWS = [7, 14, 30] as const;
type PacingWindow = (typeof PACING_WINDOWS)[number];
const PLACEMENT_OPTIONS = ["homepage_hero", "app_tile", "newsletter_banner", "social_square", "story_unit"];
const VIDEO_PLACEMENT_OPTIONS = ["ctv_15s", "youtube_15s", "social_video_15s"];
const PLACEMENT_DIMENSIONS: Record<string, string> = {
  homepage_hero: "1280x720",
  app_tile: "1080x1080",
  newsletter_banner: "1200x200",
  social_square: "1080x1080",
  story_unit: "1080x1920",
  ctv_15s: "1920x1080",
  youtube_15s: "1920x1080",
  social_video_15s: "1080x1920",
};
const VIDEO_ORIENTATION_PLACEMENTS: Record<string, string> = {
  horizontal: "youtube_15s",
  vertical: "social_video_15s",
};
type ActivationChannel = {
  id: string;
  label: string;
  baseCpm: number;
  ctrLift: number;
  placementFit: Partial<Record<string, number>>;
};
type ChannelProjection = {
  channel: ActivationChannel;
  score: number;
  projectedCtr: number;
  projectedCpm: number;
  projectedConversions: number;
};
const ACTIVATION_CHANNELS: ActivationChannel[] = [
  {
    id: "Meta",
    label: "Meta",
    baseCpm: 11.4,
    ctrLift: 0.22,
    placementFit: { social_square: 14, story_unit: 13, app_tile: 4, homepage_hero: -2, newsletter_banner: -4 },
  },
  {
    id: "Google Ads",
    label: "Google Ads",
    baseCpm: 9.8,
    ctrLift: 0.16,
    placementFit: { newsletter_banner: 8, social_square: 6, homepage_hero: 3, app_tile: 3, story_unit: 0 },
  },
  {
    id: "DV360",
    label: "DV360",
    baseCpm: 8.9,
    ctrLift: 0.08,
    placementFit: { homepage_hero: 9, newsletter_banner: 8, social_square: 3, app_tile: 2, story_unit: -2 },
  },
  {
    id: "The Trade Desk",
    label: "The Trade Desk",
    baseCpm: 10.6,
    ctrLift: 0.1,
    placementFit: { homepage_hero: 7, newsletter_banner: 5, social_square: 5, app_tile: 1, story_unit: 0 },
  },
  {
    id: "Adobe Target",
    label: "Adobe Target",
    baseCpm: 6.6,
    ctrLift: 0.2,
    placementFit: { homepage_hero: 15, app_tile: 12, newsletter_banner: 2, social_square: 1, story_unit: -3 },
  },
  {
    id: "Email",
    label: "Email",
    baseCpm: 3.2,
    ctrLift: 0.12,
    placementFit: { newsletter_banner: 15, homepage_hero: 1, app_tile: 1, social_square: -2, story_unit: -5 },
  },
];
const EDIT_OPERATION_OPTIONS = [
  "resize",
  "crop",
  "inpaint",
  "outpaint",
  "cleanup",
  "background_extension",
  "text_safe_area_adjustment",
  "aspect_ratio_conversion",
];
const ARCHITECTURE_ROWS = [
  {
    source: ["Briefs + C360", "detail modal + audience inventory"],
    stream: ["brief.audience", "objective, segment, match"],
    bronze: ["source briefs", "campaign and owner signals"],
    silver: ["trait profiles", "creative direction fields"],
    gold: ["gold_audience_trait_profile", "segment-ready traits"],
  },
  {
    source: ["Seed Images", "UC Volume by category"],
    stream: ["asset.manifest", "metadata + rights + preview"],
    bronze: ["volume image files", "governed PNG assets"],
    silver: ["asset search corpus", "embedding-ready text"],
    gold: ["Vector Search Index", "governed retrieval"],
  },
  {
    source: ["Generation Requests", "brief + category + prompt"],
    stream: ["creative.generate", "RAG + endpoint invocation"],
    bronze: ["request payload", "instructions + seed reference"],
    silver: ["variant slate", "embedded image preview"],
    gold: ["app_creative_variants", "Lakebase + live state"],
  },
  {
    source: ["Adaptation Events", "resize + edit operations"],
    stream: ["creative.adapt", "placement transforms"],
    bronze: ["edit request", "target placement"],
    silver: ["transformation log", "crop/inpaint/outpaint/etc."],
    gold: ["gold_creative_transformation", "lineage + reuse"],
  },
  {
    source: ["Review + Activate", "policy, judge, approval"],
    stream: ["creative.activate", "checks + synthetic audience"],
    bronze: ["policy evidence", "brand/rights/safety"],
    silver: ["ranked evaluations", "approved scored rows"],
    gold: ["app_activation_exports", "Activation dashboard"],
  },
];
const ARCH_SERVING_NODES = [
  ["SQL Warehouse", "Databricks table reads"],
  ["Genie + Fallback", "Ask AI governed answers"],
  ["Vector Search", "seed image RAG retrieval"],
  ["Model Serving", "generation, policy, judge endpoints"],
  ["Lakebase", "durable app state"],
  ["FastAPI", "workflow API boundary"],
  ["React App", "Creative Command Center"],
];
const ARCH_TAGS = ["domain=creative", "seed-images=governed", "lineage=variant-level", "state=lakebase", "activation=dashboard"];
const ARCH_PLATFORM_SERVICES = [
  ["Asset Bundles", "CI/CD deployment"],
  ["Databricks Apps", "React + FastAPI runtime"],
  ["Genie", "curated questions + governed fallback"],
  ["Lakebase", "persistent app state"],
  ["Vector Search", "seed-image RAG index"],
  ["UC Volumes", "category seed images"],
];
const DATA_CONTRACT_GAPS: DataContractGap[] = [
  {
    surface: "Audience traits",
    mockCsv: "Demo fallback derives topic affinity, lifecycle stage, tone, churn risk, device usage, and creative implications from bundled rows.",
    pipeline: "gold_buyside_audience_trait_profile stores the creative-relevant trait profile used by generation requests.",
    recommendation: "Keep segment definitions and trait profiles separate: the segment says who, the trait profile says how creative should change.",
  },
  {
    surface: "Approved base assets",
    mockCsv: "Demo fallback creates governed source assets with rights metadata, performance metadata, and approved channel contexts.",
    pipeline: "UC Volume seed_images/manifest.json, gold_buyside_base_creative_asset, and gold_buyside_asset_search_corpus back category retrieval and Vector Search.",
    recommendation: "Use the manifest for visual inspection and the search corpus for retrieval; keep category, placement, rights, and related app asset IDs aligned.",
  },
  {
    surface: "Generation and adaptation",
    mockCsv: "Live generated variants are persisted in Lakebase when available and fall back to in-memory state for local demo runs.",
    pipeline: "gold_buyside_creative_generation_request, gold_buyside_creative_variant, app_creative_variants, and app_creative_transformations carry request, seed reference, model, prompt, edit, and lineage metadata.",
    recommendation: "Keep generated thumbnails tied to reference seed images and Lakebase state so refreshes do not lose review or activation history.",
  },
  {
    surface: "Policy and approval",
    mockCsv: "Fallback policy rows return pass/warn records for generated variants.",
    pipeline: "gold_buyside_creative_policy_check records brand, rights, regional usage, and safety review evidence. Studio approval updates variant approval status.",
    recommendation: "Keep approval on the Studio page because Evaluation intentionally shows only approved scored variants.",
  },
  {
    surface: "Evaluation and activation",
    mockCsv: "Fallback synthetic audience rows rank approved variants by segment and placement.",
    pipeline: "gold_buyside_synthetic_audience_eval, gold_buyside_activation_export, app_activation_exports, and app_activations support approved-only scoring, Activate actions, and dashboard visibility.",
    recommendation: "Use activation submissions and feedback rows to compare live performance against synthetic prediction and improve future prompts and retrieval.",
  },
  {
    surface: "Ask AI",
    mockCsv: "Local fallback maps curated questions to governed workflow rows so demo users get useful answers even when Genie rejects free-form phrasing.",
    pipeline: "Configured Genie Space answers curated questions first; the FastAPI endpoint retries the closest sample question and falls back to governed table summaries.",
    recommendation: "Keep suggested prompts aligned to Genie samples and phrase fallback answers as Ask AI results, not backend failure messages.",
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
    description: "Campaign objective, audience intent, budget, owner, and supporting detail align into a launch-ready brief.",
    userGoal: "Open each brief detail view to confirm strategy, ownership, budget, objective, and approval readiness.",
    signal: "Strategy",
    outcome: "Launch-ready brief",
    icon: FileText,
    color: "#256b8f",
  },
  {
    id: "audiences",
    title: "Audience lens",
    navLabel: "Audience",
    description: "Segments are sized, governed, and compared through a readable reach, match-rate, and value inventory.",
    userGoal: "Choose the highest-fit audience cohorts and spot region, channel, and frequency constraints.",
    signal: "C360",
    outcome: "Prioritized audience plan",
    icon: Users,
    color: "#0f9f95",
  },
  {
    id: "studio",
    title: "Creative studio",
    navLabel: "Studio",
    description: "Filter governed seed images by category, generate RAG-backed variants, preview full images, and adapt placements.",
    userGoal: "Create rights-aware image variants from audience traits, selected category, Vector Search references, and approved seed assets.",
    signal: "Generate",
    outcome: "Variant slate",
    icon: Palette,
    color: "#5b65d8",
  },
  {
    id: "evaluation",
    title: "Evaluation gate",
    navLabel: "Evaluate",
    description: "Policy checks, rights constraints, and synthetic audiences rank approved variants before Activate sends them onward.",
    userGoal: "Select compliant, high-scoring creatives and activate them into the downstream dashboard.",
    signal: "Score",
    outcome: "Approved winner",
    icon: ShieldCheck,
    color: "#c7793a",
  },
  {
    id: "activations",
    title: "Activation control",
    navLabel: "Activate",
    description: "Activated exports, submitted channels, platform delivery, spend, conversions, and sync status are monitored in one control layer.",
    userGoal: "Track live delivery and every new Activate action without losing state after app updates.",
    signal: "Live",
    outcome: "Controlled media execution",
    icon: RadioTower,
    color: "#1f9d72",
  },
  {
    id: "ask",
    title: "Decision loop",
    navLabel: "Ask AI",
    description: "Ask AI uses the curated Genie space first, then governed workflow summaries when free-form phrasing needs a fallback.",
    userGoal: "Ask questions across variants, approvals, policy checks, evaluations, lineage, and activation readiness.",
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
  { id: "studio", label: "Creative Studio", icon: Palette },
  { id: "evaluation", label: "Evaluation", icon: ShieldCheck },
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

function labelize(value: string) {
  return value.replaceAll("_", " ");
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
  if (!isFiniteNumber(audience.match_rate)) return derivedAudienceMatchPercent(audience);
  return Math.round(audience.match_rate > 1 ? audience.match_rate : audience.match_rate * 100);
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
    .replace("Entertainment Seeker", "Entertainment")
    .replace("High Value Professional", "High Value Pro")
    .replace("Subscription", "Sub.")
    .replace("Churn Risk: Sports", "Churn Risk")
    .replace("Suppression: Service Issues", "Service Supp.");
}

function stableAudienceScore(audience: Audience) {
  const seed = `${audience.cohort_id}|${audience.cohort_name}`;
  const total = Array.from(seed).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  return (total % 1000) / 1000;
}

function derivedAudienceMatchPercent(audience: Audience) {
  const name = audience.cohort_name.toLowerCase();
  let score = 70 + Math.round(stableAudienceScore(audience) * 16);
  if (audience.is_region_allowed) score += 3;
  if (audience.is_channel_allowed) score += 3;
  if (audience.is_frequency_capped) score += 2;
  if (name.includes("churn") || name.includes("reactivat")) score += 3;
  if (name.includes("suppression") || name.includes("service")) score += 4;
  if (name.includes("lookalike")) score -= 2;
  return clampNumber(score, 62, 97);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9.% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function channelProjectionFor(evaluation: SyntheticEvaluation, channel: ActivationChannel): ChannelProjection {
  const placementFit = channel.placementFit[evaluation.placement] ?? 0;
  const score = Math.round(
    clampNumber(
      evaluation.overall_score * 0.58 +
        evaluation.click_propensity_score * 0.18 +
        evaluation.brand_fit_score * 0.14 +
        (100 - evaluation.fatigue_risk_score) * 0.1 +
        placementFit,
      0,
      99,
    ),
  );
  const projectedCtr = clampNumber((evaluation.click_propensity_score / 100) * 2.9 + channel.ctrLift + placementFit / 55, 0.25, 5.4);
  const projectedCpm = Math.max(2.5, channel.baseCpm + Math.max(0, 82 - evaluation.relevance_score) * 0.025 + Math.max(0, placementFit) * 0.03);
  const projectedConversions = Math.round((evaluation.subscription_start_propensity_score * score) / 10);
  return { channel, score, projectedCtr, projectedCpm, projectedConversions };
}

function channelProjectionsFor(evaluation: SyntheticEvaluation) {
  return ACTIVATION_CHANNELS.map((channel) => channelProjectionFor(evaluation, channel));
}

function recommendedChannelFor(evaluation: SyntheticEvaluation) {
  const [best] = [...channelProjectionsFor(evaluation)].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.projectedCpm - b.projectedCpm;
  });
  return best ?? channelProjectionFor(evaluation, ACTIVATION_CHANNELS[0]);
}

function channelScoreClass(score: number) {
  if (score >= 82) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (score >= 70) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function policyStatusFor(checks: PolicyCheck[], predicate: (check: PolicyCheck) => boolean) {
  const relevant = checks.filter(predicate);
  if (!relevant.length) return "warn";
  if (relevant.some((check) => ["fail", "failed", "block", "blocked"].includes(check.check_status.toLowerCase()))) return "block";
  if (relevant.some((check) => check.review_required || ["warn", "warning", "review"].includes(check.check_status.toLowerCase()))) return "warn";
  return "pass";
}

function readinessChipClass(status: "pass" | "warn" | "block") {
  if (status === "pass") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "block") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function variantReadinessChecks(variant: CreativeVariant, checks: PolicyCheck[]) {
  const quality = optionalNumber(variant.quality_score);
  return [
    {
      label: "Brand fit",
      status: quality === null ? policyStatusFor(checks, (check) => check.check_type.toLowerCase().includes("brand")) : quality >= 78 ? "pass" : quality >= 68 ? "warn" : "block",
    },
    {
      label: "Compliance",
      status: policyStatusFor(checks, (check) => ["policy", "compliance", "regional"].some((term) => check.check_type.toLowerCase().includes(term))),
    },
    {
      label: "Image safety",
      status: policyStatusFor(checks, (check) => ["safety", "sensitive", "moderation"].some((term) => check.check_type.toLowerCase().includes(term))),
    },
    {
      label: "Rights",
      status: policyStatusFor(checks, (check) => ["rights", "license", "usage"].some((term) => check.check_type.toLowerCase().includes(term))),
    },
  ] as Array<{ label: string; status: "pass" | "warn" | "block" }>;
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
  const [submittedActivations, setSubmittedActivations] = useState<Activation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [
          dashboard,
          briefs,
          audiences,
          creatives,
          activations,
          markets,
          backendTables,
          modelStatus,
          audienceTraits,
          creativeAssets,
          generationRequests,
          creativeVariants,
          policyChecks,
          syntheticEvaluations,
          lineageEdges,
          creativeTransformations,
          activationExports,
        ] = await Promise.all([
          fetchJson<Dashboard>("/api/dashboard"),
          fetchJson<Brief[]>("/api/briefs"),
          fetchJson<Audience[]>("/api/audiences"),
          fetchJson<Creative[]>("/api/creatives"),
          fetchJson<Activation[]>("/api/activations"),
          fetchJson<MarketRegion[]>("/api/markets"),
          fetchJson<BackendTables>("/api/backend-tables"),
          fetchJson<ModelStatus>("/api/model-status"),
          fetchJson<AudienceTrait[]>("/api/audience-traits"),
          fetchJson<CreativeAsset[]>("/api/creative-assets/search"),
          fetchJson<CreativeGenerationRequest[]>("/api/creative-generation/requests"),
          fetchJson<CreativeVariant[]>("/api/creative-variants"),
          fetchJson<PolicyCheck[]>("/api/policy-checks"),
          fetchJson<SyntheticEvaluation[]>("/api/synthetic-evaluations"),
          fetchJson<CreativeLineageEdge[]>("/api/creative-lineage-edges"),
          fetchJson<CreativeTransformation[]>("/api/creative-transformations"),
          fetchJson<ActivationExport[]>("/api/activation-exports"),
        ]);
        if (!ignore) {
          setData({
            dashboard,
            briefs,
            audiences,
            creatives,
            activations,
            markets,
            backendTables,
            modelStatus,
            audienceTraits,
            creativeAssets,
            generationRequests,
            creativeVariants,
            policyChecks,
            syntheticEvaluations,
            lineageEdges,
            creativeTransformations,
            activationExports,
          });
        }
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

  function handleActivationSubmitted(activation: Activation, exportRecord: ActivationExport) {
    setSubmittedActivations((current) => [
      activation,
      ...current.filter((item) => item.activation_id !== activation.activation_id),
    ]);
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        activations: [activation, ...current.activations.filter((item) => item.activation_id !== activation.activation_id)],
        activationExports: [exportRecord, ...current.activationExports.filter((item) => item.export_id !== exportRecord.export_id)],
      };
    });
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
                  {view === "studio" && <CreativeStudio data={data} />}
                  {view === "evaluation" && <Evaluation data={data} onActivationSubmitted={handleActivationSubmitted} />}
                  {view === "activations" && <Activations activations={data.activations} newSubmissions={submittedActivations} />}
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
              The working loop starts once strategy is defined, then cycles through audience, creative generation, evaluation, activation, and AI-assisted optimization.
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
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);
  const filtered = briefs.filter((brief) => {
    const text = normalizeSearchText(`${brief.brief_name} ${brief.brand_name} ${brief.owner ?? ""} ${brief.campaign_objective}`);
    return (status === "all" || brief.status === status) && (!search || text.includes(normalizeSearchText(search)));
  });

  useEffect(() => {
    if (!selectedBrief) return undefined;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedBrief(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedBrief]);

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
                <th className="px-4 py-3">Details</th>
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
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedBrief(brief)}
                      className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--ink)] transition-colors hover:bg-[var(--panel-soft)]"
                    >
                      <Maximize2 size={14} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <AnimatePresence>
        {selectedBrief ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setSelectedBrief(null)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedBrief.brief_name} details`}
              className="w-full max-w-3xl overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-2xl"
              initial={{ y: 18, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 12, scale: 0.98 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--panel-soft)] px-5 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase text-[var(--faint)]">{selectedBrief.brand_name}</p>
                  <h2 className="mt-1 text-[20px] font-bold text-[var(--ink)]">{selectedBrief.brief_name}</h2>
                  <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">{selectedBrief.brief_id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBrief(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Close brief details"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricMini label="Status" value={selectedBrief.status.replace("_", " ")} />
                  <MetricMini label="Budget" value={optionalMoney(selectedBrief.budget)} />
                  <MetricMini label="Concepts" value={selectedBrief.concepts_count?.toString() ?? "N/A"} />
                  <MetricMini label="Creatives" value={selectedBrief.creatives_count?.toString() ?? "N/A"} />
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-md border border-[var(--line)] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Campaign objective</p>
                    <p className="mt-2 text-[14px] leading-6 text-[var(--ink)]">{selectedBrief.campaign_objective}</p>
                  </div>
                  <div className="rounded-md border border-[var(--line)] bg-white p-4">
                    <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Target audience</p>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{selectedBrief.target_audience_description ?? "N/A"}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MetricMini label="Owner" value={selectedBrief.owner ?? "N/A"} />
                  <MetricMini label="Created" value={selectedBrief.created_ts ?? "N/A"} />
                  <MetricMini label="Brand" value={selectedBrief.brand_name} />
                </div>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Audiences({ audiences, modelStatus }: { audiences: Audience[]; modelStatus: ModelStatus }) {
  const [type, setType] = useState("all");
  const [selectedAudienceId, setSelectedAudienceId] = useState(audiences[0]?.cohort_id ?? "");
  const filtered = audiences
    .filter((audience) => type === "all" || audience.definition_type === type)
    .sort((a, b) => b.estimated_reach - a.estimated_reach);
  const selectedAudience = filtered.find((audience) => audience.cohort_id === selectedAudienceId) ?? filtered[0];
  const selectedMatch = selectedAudience ? audienceMatchPercent(selectedAudience) : null;
  const audienceChartRows = filtered.slice(0, 14);
  const chartData = audienceChartRows.map((audience) => {
    const match = audienceMatchPercent(audience);
    const rank = audienceChartRows.indexOf(audience) + 1;
    return {
      rank,
      rankLabel: `#${rank}`,
      name: audience.cohort_name,
      label: audienceChartLabel(audience.cohort_name),
      reach: audience.estimated_reach,
      match,
      matchLabel: `${match}%`,
    };
  });

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
          <SectionHeader
            title="Reach and match rate"
            eyebrow="C360 audience inventory"
            action={
              filtered.length > chartData.length ? (
                <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                  Top {chartData.length} by reach
                </span>
              ) : null
            }
          />
          <div className="grid gap-4 p-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 6, right: 18, top: 16, bottom: 6 }} barCategoryGap={8}>
                  <CartesianGrid stroke="#e6ebf1" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#626a78" }}
                    tickFormatter={formatCompact}
                  />
                  <YAxis
                    type="category"
                    dataKey="rankLabel"
                    width={38}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#626a78", fontWeight: 700 }}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
                    formatter={(value, name) => {
                      if (name === "Reach") return [formatNumber(Number(value)), "Reach"];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="reach" name="Reach" fill="#0f9f95" radius={[0, 5, 5, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-[360px] overflow-y-auto rounded-md border border-[var(--line)] bg-white thin-scrollbar">
              <table className="w-full min-w-[460px] text-left">
                <thead className="sticky top-0 bg-[var(--panel-soft)] text-[10px] uppercase text-[var(--faint)]">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Audience</th>
                    <th className="px-3 py-2 text-right">Reach</th>
                    <th className="px-3 py-2 text-right">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {chartData.map((item) => (
                    <tr key={item.name}>
                      <td className="px-3 py-2 font-mono text-[11px] font-bold text-[var(--faint)]">{item.rankLabel}</td>
                      <td className="px-3 py-2">
                        <p className="text-[12px] font-bold text-[var(--ink)]">{item.name}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--faint)]">{item.label}</p>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-[var(--muted)]">{formatCompact(item.reach)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[11px] font-bold text-amber-700">
                          {item.matchLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <SectionHeader
            title="Audience picker"
            eyebrow="Segment drilldown"
            action={
              <span className="rounded-md bg-[var(--panel-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                {modelStatus.mode.replaceAll("_", " ")}
              </span>
            }
          />
          <label className="mt-4 grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
            Selected audience
            <select
              value={selectedAudience?.cohort_id ?? ""}
              onChange={(event) => setSelectedAudienceId(event.target.value)}
              className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]"
            >
              {filtered.map((audience) => (
                <option key={audience.cohort_id} value={audience.cohort_id}>{audience.cohort_name}</option>
              ))}
            </select>
          </label>

          {selectedAudience ? (
            <div className="mt-4 rounded-md border border-[var(--line)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-bold">{selectedAudience.cohort_name}</p>
                  <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{selectedAudience.cohort_description}</p>
                </div>
                <StatusPill value={selectedAudience.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-3">
                <MetricMini label="Reach" value={formatCompact(selectedAudience.estimated_reach)} />
                <MetricMini label="Match" value={selectedMatch === null ? "N/A" : `${selectedMatch}%`} />
                <MetricMini label="LTV" value={optionalMoney(selectedAudience.avg_ltv)} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${selectedAudience.is_region_allowed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  Region {selectedAudience.is_region_allowed ? "allowed" : "blocked"}
                </span>
                <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${selectedAudience.is_channel_allowed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  Channel {selectedAudience.is_channel_allowed ? "allowed" : "blocked"}
                </span>
                <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${selectedAudience.is_frequency_capped ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                  {selectedAudience.is_frequency_capped ? "Frequency capped" : "No cap"}
                </span>
              </div>
              <p className="mt-4 rounded-md bg-[var(--panel-soft)] px-3 py-2 text-[12px] leading-5 text-[var(--muted)]">
                {selectedAudience.feature_summary_text ?? "No trait summary is available for this segment."}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-[var(--line)] bg-[var(--panel-soft)] p-4 text-[13px] text-[var(--muted)]">
              No audience rows match the current filter.
            </div>
          )}

          <div className="mt-4 grid gap-2">
            {filtered
              .filter((audience) => audience.cohort_id !== selectedAudience?.cohort_id)
              .slice(0, 4)
              .map((audience) => (
                <button
                  key={audience.cohort_id}
                  type="button"
                  onClick={() => setSelectedAudienceId(audience.cohort_id)}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-left transition-colors hover:bg-white"
                >
                  <span className="text-[12px] font-bold text-[var(--ink)]">{audience.cohort_name}</span>
                  <span className="font-mono text-[11px] text-[var(--faint)]">{formatCompact(audience.estimated_reach)}</span>
                </button>
              ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function parseJsonList(value: string | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function parseJsonObject(value: string | undefined) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function CreativeStudio({ data }: { data: AgencyData }) {
  const [briefId, setBriefId] = useState(data.briefs[0]?.brief_id ?? "");
  const [cohortId, setCohortId] = useState(data.audiences[0]?.cohort_id ?? "");
  const [placement, setPlacement] = useState("homepage_hero");
  const [query, setQuery] = useState("");
  const [selectedAssetType, setSelectedAssetType] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [contentType, setContentType] = useState<"image" | "video">("image");
  const [videoOrientation, setVideoOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [instructions, setInstructions] = useState("Use audience traits to create a premium, placement-ready streaming creative.");
  const [selectedAssetId, setSelectedAssetId] = useState(data.creativeAssets[0]?.asset_id ?? "");
  const [generatedVariants, setGeneratedVariants] = useState<CreativeVariant[]>([]);
  const [adaptedVariants, setAdaptedVariants] = useState<CreativeVariant[]>([]);
  const [liveTransformations, setLiveTransformations] = useState<CreativeTransformation[]>([]);
  const [adaptTargetPlacement, setAdaptTargetPlacement] = useState("story_unit");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedEditTypes, setSelectedEditTypes] = useState<string[]>([
    "resize",
    "aspect_ratio_conversion",
    "text_safe_area_adjustment",
    "cleanup",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, CreativeVariant>>({});
  const [approvingId, setApprovingId] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [previewVariant, setPreviewVariant] = useState<CreativeVariant | null>(null);
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuideline[]>([]);
  const [generationModels, setGenerationModels] = useState<GenerationModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("gpt-5-mini-balanced");
  const [compareMode, setCompareMode] = useState(false);
  const [compareModelIds, setCompareModelIds] = useState<string[]>([]);
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);

  const selectedBrief = data.briefs.find((brief) => brief.brief_id === briefId) ?? data.briefs[0];
  const selectedAudience = data.audiences.find((audience) => audience.cohort_id === cohortId) ?? data.audiences[0];
  const trait = data.audienceTraits.find((item) => item.cohort_id === cohortId);
  const assetTypes = ["all", ...Array.from(new Set(data.creativeAssets.map((asset) => asset.asset_type.toLowerCase()).filter(Boolean)))];
  const imageModelLabel = data.modelStatus.creative_image_model ?? "seeded synthetic image assets";
  const activeGuideline = brandGuidelines[0];
  const selectedModel = generationModels.find((model) => model.model_id === selectedModelId) ?? generationModels[0];
  const availableModels = generationModels.filter((model) => contentType === "video" ? model.modality === "video" : model.modality === "image");

  useEffect(() => {
    let ignore = false;
    async function loadEnhancements() {
      try {
        const [guidelines, models] = await Promise.all([
          fetchJson<BrandGuideline[]>("/api/brand-guidelines"),
          fetchJson<GenerationModel[]>("/api/generation-models"),
        ]);
        if (!ignore) {
          setBrandGuidelines(guidelines);
          setGenerationModels(models);
          const defaultModel = models.find((model) => model.default);
          if (defaultModel) setSelectedModelId(defaultModel.model_id);
        }
      } catch {
        // Fallback: endpoints may not be available yet
      }
    }
    loadEnhancements();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!previewVariant) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewVariant(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewVariant]);

  useEffect(() => {
    if (contentType === "video") {
      const videoModel = generationModels.find((model) => model.modality === "video");
      if (videoModel) setSelectedModelId(videoModel.model_id);
    } else {
      const imageModel = generationModels.find((model) => model.modality === "image" && model.default);
      if (imageModel) setSelectedModelId(imageModel.model_id);
    }
  }, [contentType, generationModels]);

  function assetMatchesPlacement(asset: CreativeAsset, targetPlacement: string) {
    const normalizedPlacement = normalizeSearchText(targetPlacement);
    if (!normalizedPlacement) return true;
    const explicitPlacement = normalizeSearchText(asset.placement ?? "");
    const searchablePlacement = normalizeSearchText(`${asset.content_tags} ${asset.approved_usage_contexts_json}`);
    if (explicitPlacement) return explicitPlacement === normalizedPlacement;
    return searchablePlacement.includes(normalizedPlacement) || searchablePlacement.includes("onsite personalization");
  }

  const categoryOptions = [
    "all",
    ...Array.from(
      new Set(
        data.creativeAssets
          .filter((asset) => assetMatchesPlacement(asset, placement))
          .map((asset) => asset.demo_category ?? labelize(asset.category_slug ?? ""))
          .filter(Boolean),
      ),
    ),
  ];
  const activeAssets = data.creativeAssets.filter((asset) => {
    const text = normalizeSearchText(`${asset.asset_name} ${asset.description} ${asset.content_tags} ${asset.approved_usage_contexts_json} ${asset.demo_category ?? ""} ${asset.category_slug ?? ""}`);
    const normalizedQuery = normalizeSearchText(query);
    const normalizedCategory = normalizeSearchText(selectedCategory);
    const categoryText = normalizeSearchText(`${asset.demo_category ?? ""} ${asset.category_slug ?? ""} ${asset.asset_name}`);
    const typeMatches = selectedAssetType === "all" || asset.asset_type.toLowerCase() === selectedAssetType;
    const categoryMatches = selectedCategory === "all" || categoryText.includes(normalizedCategory);
    return typeMatches && categoryMatches && (!normalizedQuery || text.includes(normalizedQuery)) && assetMatchesPlacement(asset, placement);
  });
  const selectedAsset = data.creativeAssets.find((asset) => asset.asset_id === selectedAssetId);
  const activeAssetKey = activeAssets.map((asset) => asset.asset_id).join("|");

  useEffect(() => {
    setSelectedCategory("all");
  }, [placement]);

  useEffect(() => {
    if (contentType === "video") {
      setPlacement(VIDEO_ORIENTATION_PLACEMENTS[videoOrientation]);
    } else if (VIDEO_PLACEMENT_OPTIONS.includes(placement)) {
      setPlacement("homepage_hero");
    }
  }, [contentType, videoOrientation]);

  useEffect(() => {
    if (activeAssets.length && !activeAssets.some((asset) => asset.asset_id === selectedAssetId)) {
      setSelectedAssetId(activeAssets[0].asset_id);
    }
  }, [activeAssetKey, selectedAssetId]);

  const allVariants = [...adaptedVariants, ...generatedVariants, ...data.creativeVariants].map(
    (variant) => approvalOverrides[variant.creative_asset_id] ?? variant,
  );
  const sessionVariants = [...adaptedVariants, ...generatedVariants].map(
    (variant) => approvalOverrides[variant.creative_asset_id] ?? variant,
  );
  const variants = allVariants.filter(
    (variant) => (!cohortId || variant.cohort_id === cohortId) && (!placement || variant.placement === placement),
  );
  const shownVariants = sessionVariants
    .filter((variant) => (!cohortId || variant.cohort_id === cohortId) && (!placement || variant.placement === placement))
    .slice(0, 8);
  const sourceVariant = allVariants.find((variant) => variant.creative_asset_id === selectedVariantId) ?? shownVariants[0] ?? allVariants[0];
  const transformationLedger = [...liveTransformations, ...data.creativeTransformations]
    .filter((item) => !sourceVariant || item.creative_asset_id === sourceVariant.creative_asset_id || item.input_asset_id === sourceVariant.creative_asset_id)
    .slice(0, 12);

  function toggleEditType(editType: string) {
    setSelectedEditTypes((current) => {
      if (current.includes(editType)) return current.filter((item) => item !== editType);
      return [...current, editType];
    });
  }

  async function generateVariants() {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/creative-generation/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief_id: briefId,
          cohort_id: cohortId,
          placement,
          category: selectedCategory === "all" ? selectedAsset?.demo_category ?? "" : selectedCategory,
          content_type: contentType,
          video_orientation: contentType === "video" ? videoOrientation : undefined,
          aspect_ratio: contentType === "video" ? (videoOrientation === "horizontal" ? "16:9" : "9:16") : undefined,
          user_instructions: instructions,
          retrieval_query: query,
          selected_base_asset_ids: selectedAssetId ? [selectedAssetId] : [],
          requested_variant_count: contentType === "video" ? 2 : 4,
        }),
      });
      if (!response.ok) throw new Error("Generation request failed");
      const payload = (await response.json()) as { variants: CreativeVariant[]; transformations?: CreativeTransformation[] };
      setGeneratedVariants(payload.variants);
      setLiveTransformations((current) => [...(payload.transformations ?? []), ...current]);
    } finally {
      setIsGenerating(false);
    }
  }

  async function adaptVariant() {
    if (!sourceVariant) return;
    setIsAdapting(true);
    try {
      const response = await fetch(`/api/creative-variants/${sourceVariant.creative_asset_id}/adapt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placement: adaptTargetPlacement,
          transformation_type: selectedEditTypes[0] ?? "resize",
          edit_types: selectedEditTypes.length ? selectedEditTypes : ["resize"],
          output_format: "SVG",
        }),
      });
      if (!response.ok) throw new Error("Adaptation request failed");
      const payload = (await response.json()) as { variant: CreativeVariant; transformations: CreativeTransformation[] };
      setAdaptedVariants((current) => [payload.variant, ...current.filter((item) => item.creative_asset_id !== payload.variant.creative_asset_id)]);
      setLiveTransformations((current) => [...payload.transformations, ...current]);
      setPlacement(adaptTargetPlacement);
      setSelectedVariantId(payload.variant.creative_asset_id);
    } finally {
      setIsAdapting(false);
    }
  }

  async function approveStudioVariant(variant: CreativeVariant) {
    setApprovingId(variant.creative_asset_id);
    setApprovalMessage("");
    setApprovalError("");
    try {
      const response = await fetch(`/api/creative-variants/${variant.creative_asset_id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "Approved",
          reviewer: "app_user",
          review_notes: "Approved from Creative Studio pending-review slate.",
          require_evaluation: false,
          variant_snapshot: variant,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail?.message ?? payload.detail ?? "Approval failed");
      setApprovalOverrides((current) => ({ ...current, [variant.creative_asset_id]: payload.variant }));
      setApprovalMessage(`Approved: ${payload.variant.asset_name}`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApprovingId("");
    }
  }

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Creative studio"
        subtitle="Search governed assets, generate endpoint-backed variants, and adapt for onsite placements"
        filters={contentType === "video" ? VIDEO_PLACEMENT_OPTIONS : PLACEMENT_OPTIONS}
        activeFilter={placement}
        onFilter={setPlacement}
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <SectionHeader title="Generation brief" eyebrow="Audience-driven creative" />
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
              Brief
              <select value={briefId} onChange={(event) => setBriefId(event.target.value)} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
                {data.briefs.map((brief) => (
                  <option key={brief.brief_id} value={brief.brief_id}>{brief.brief_name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
              Audience segment
              <select value={cohortId} onChange={(event) => setCohortId(event.target.value)} className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
                {data.audiences.map((audience) => (
                  <option key={audience.cohort_id} value={audience.cohort_id}>{audience.cohort_name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
              Asset search
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by category, asset name, placement, channel, or tag"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]"
              />
            </label>
            <label className="grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
              Text instructions
              <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} className="min-h-[96px] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] leading-5 text-[var(--ink)]" />
            </label>
            <div className="grid gap-1">
              <span className="text-[12px] font-semibold text-[var(--muted)]">Content type</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContentType("image")}
                  className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-bold transition-colors ${contentType === "image" ? "border-[var(--brand-accent)] bg-[var(--brand-primary)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}
                >
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => setContentType("video")}
                  className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-bold transition-colors ${contentType === "video" ? "border-[var(--brand-accent)] bg-[var(--brand-primary)] text-white" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}
                >
                  Video
                </button>
              </div>
            </div>
            {contentType === "video" ? (
              <div className="grid gap-1">
                <span className="text-[12px] font-semibold text-[var(--muted)]">Video orientation</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoOrientation("horizontal")}
                    className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-bold transition-colors ${videoOrientation === "horizontal" ? "border-[var(--brand-accent)] bg-[var(--panel-soft)] text-[var(--ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}
                  >
                    Horizontal (16:9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoOrientation("vertical")}
                    className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-bold transition-colors ${videoOrientation === "vertical" ? "border-[var(--brand-accent)] bg-[var(--panel-soft)] text-[var(--ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]"}`}
                  >
                    Vertical (9:16)
                  </button>
                </div>
              </div>
            ) : null}
            {availableModels.length > 0 ? (
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[var(--muted)]">Generation model</span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--faint)]">
                    <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} className="h-3 w-3" />
                    Compare models
                  </label>
                </div>
                {compareMode ? (
                  <div className="grid gap-2">
                    {availableModels.map((model) => (
                      <label key={model.model_id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] transition-colors ${compareModelIds.includes(model.model_id) ? "border-[var(--brand-accent)] bg-[var(--panel-soft)]" : "border-[var(--line)] bg-white"}`}>
                        <input
                          type="checkbox"
                          checked={compareModelIds.includes(model.model_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCompareModelIds((current) => [...current, model.model_id]);
                            } else {
                              setCompareModelIds((current) => current.filter((id) => id !== model.model_id));
                            }
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <div className="flex-1">
                          <p className="font-bold text-[var(--ink)]">{model.label}</p>
                          <p className="text-[11px] text-[var(--muted)]">{model.provider}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]"
                  >
                    {availableModels.map((model) => (
                      <option key={model.model_id} value={model.model_id}>
                        {model.label} {model.default ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>
                )}
                {selectedModel ? (
                  <p className="text-[11px] leading-4 text-[var(--faint)]">{selectedModel.description}</p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={generateVariants}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-sky-900/15 disabled:opacity-60"
            >
              <Sparkles size={16} />
              {isGenerating ? "Generating" : `Generate ${contentType === "video" ? "2" : "4"} Variants`}
            </button>
          </div>
          <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--panel-soft)] p-3">
            <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Trait influence</p>
            <p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">{trait?.creative_implications_text ?? selectedAudience?.feature_summary_text ?? "Audience traits will guide tone, offer, and placement."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {parseJsonList(trait?.topic_affinity_json).map((item) => (
                <span key={item} className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">{item}</span>
              ))}
              {trait ? <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">tone: {trait.preferred_tone}</span> : null}
              {trait ? <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">stage: {trait.lifecycle_stage}</span> : null}
            </div>
          </div>
          {activeGuideline ? (
            <div className="mt-3 rounded-md border border-[var(--line)] bg-white p-3">
              <button
                type="button"
                onClick={() => setGuidelinesExpanded((current) => !current)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-[var(--brand-primary)]" />
                  <span className="text-[11px] font-bold uppercase text-[var(--faint)]">Brand Guidelines</span>
                </div>
                <ChevronDown size={14} className={`text-[var(--muted)] transition-transform ${guidelinesExpanded ? "rotate-180" : ""}`} />
              </button>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[13px] font-bold text-[var(--ink)]">{activeGuideline.brand_name}</span>
                <span className="rounded bg-[var(--panel-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">v{activeGuideline.version}</span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--muted)]">{activeGuideline.tone}</p>
              {guidelinesExpanded ? (
                <div className="mt-3 space-y-3 border-t border-[var(--line)] pt-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Color Palette</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(parseJsonObject(activeGuideline.color_tokens_json)).map(([name, hex]) => (
                        <div key={name} className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--panel-soft)] px-2 py-1">
                          <span className="h-3 w-3 rounded-sm border border-white/20" style={{ backgroundColor: String(hex) }} />
                          <span className="text-[11px] font-semibold text-[var(--muted)]">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Required Elements</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {parseJsonList(activeGuideline.required_elements_json).map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 size={10} />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Blocked Claims</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {parseJsonList(activeGuideline.blocked_claims_json).map((item) => (
                        <span key={item} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Headline Rules</p>
                    <ul className="mt-1.5 space-y-1">
                      {parseJsonList(activeGuideline.headline_rules_json).map((rule, index) => (
                        <li key={index} className="flex items-start gap-2 text-[11px] leading-4 text-[var(--muted)]">
                          <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Visual Rules</p>
                    <ul className="mt-1.5 space-y-1">
                      {parseJsonList(activeGuideline.visual_rules_json).map((rule, index) => (
                        <li key={index} className="flex items-start gap-2 text-[11px] leading-4 text-[var(--muted)]">
                          <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 rounded-md border border-[var(--line)] bg-white p-3 sm:grid-cols-2">
            <MetricMini label="Creative endpoint" value={data.modelStatus.creative_model_endpoint ?? data.modelStatus.configured_endpoint ?? "N/A"} />
            <MetricMini label="Image model/source" value={imageModelLabel} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Governed asset retrieval" eyebrow="Approved base assets" />
          <div className="mt-4 grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {assetTypes.map((assetType) => (
                  <button
                    key={assetType}
                    type="button"
                    onClick={() => setSelectedAssetType(assetType)}
                    className={`rounded-md border px-3 py-1.5 text-[12px] font-bold capitalize transition-colors ${selectedAssetType === assetType ? "border-[var(--brand-accent)] bg-[var(--panel-soft)] text-[var(--ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]/65"}`}
                  >
                    {labelize(assetType)}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[11px] text-[var(--faint)]">{activeAssets.length} assets</span>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-white p-2">
              <div className="mb-2 flex items-center gap-2 px-1 text-[10px] font-bold uppercase text-[var(--faint)]">
                <Filter size={12} />
                Category
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${selectedCategory === category ? "border-[var(--brand-accent)] bg-[var(--panel-soft)] text-[var(--ink)]" : "border-[var(--line)] bg-white text-[var(--muted)] hover:bg-[var(--panel-soft)]/65"}`}
                  >
                    {category === "all" ? "All categories" : category}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 max-h-[460px] overflow-y-auto pr-2 thin-scrollbar">
            <div className="grid gap-3 md:grid-cols-2">
              {activeAssets.map((asset) => (
                <button
                  key={asset.asset_id}
                  type="button"
                  onClick={() => setSelectedAssetId(asset.asset_id)}
                  className={`overflow-hidden rounded-lg border text-left transition-colors ${selectedAssetId === asset.asset_id ? "border-[var(--brand-accent)] bg-[var(--panel-soft)]" : "border-[var(--line)] bg-white hover:bg-[var(--panel-soft)]/65"}`}
                >
                  <img src={`/api/creative-assets/${asset.asset_id}/thumbnail`} alt="" className="h-32 w-full bg-[var(--panel-soft)] object-contain" />
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">{asset.demo_category ?? labelize(asset.category_slug ?? asset.asset_type)}</p>
                    <p className="text-[13px] font-bold text-[var(--ink)]">{asset.asset_name}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">{asset.recommended_usage ?? asset.description}</p>
                    <div className="mt-3 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-[var(--faint)]">{asset.aspect_ratio} / {labelize(asset.placement ?? "asset")}</span>
                      <span className="font-semibold text-[var(--green)]">rights {asset.brand_safety_score}</span>
                    </div>
                  </div>
                </button>
              ))}
              {activeAssets.length === 0 ? (
                <div className="md:col-span-2 rounded-md border border-dashed border-[var(--line)] bg-[var(--panel-soft)] p-4 text-[13px] leading-5 text-[var(--muted)]">
                  No approved base assets match the current placement, asset type, and search term.
                </div>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <SectionHeader title="Generated variant slate" eyebrow={`${selectedBrief?.brief_name ?? "Brief"} / ${selectedAudience?.cohort_name ?? "Audience"}`} />
        {approvalMessage ? <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-[var(--green)]">{approvalMessage}</div> : null}
        {approvalError ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-[var(--red)]">{approvalError}</div> : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {shownVariants.map((variant) => {
            const readiness = variantReadinessChecks(
              variant,
              data.policyChecks.filter((check) => check.creative_asset_id === variant.creative_asset_id),
            );
            const generationParams = parseJsonObject(variant.generation_params_json);
            const referenceName = variant.reference_asset_name ?? String(generationParams.reference_asset_name ?? variant.source_asset_id);
            const retrievalSource = String(generationParams.retrieval_source ?? "");
            return (
            <article
              key={variant.creative_asset_id}
              className={`overflow-hidden rounded-lg border bg-white ${sourceVariant?.creative_asset_id === variant.creative_asset_id ? "border-[var(--brand-accent)]" : "border-[var(--line)]"}`}
            >
              <button
                type="button"
                onClick={() => setPreviewVariant(variant)}
                className="group relative block h-40 w-full overflow-hidden bg-[var(--panel-soft)] text-left"
                aria-label={`Open full preview for ${variant.asset_name}`}
              >
                <img src={`/api/creative-assets/${variant.creative_asset_id}/thumbnail`} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-[var(--ink)] shadow-sm opacity-0 transition-opacity group-hover:opacity-100" title="Open full preview">
                  <Maximize2 size={16} />
                </span>
              </button>
              <div className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <StatusPill value={variant.approval_status} />
                  <span className="font-mono text-[11px] text-[var(--faint)]">{variant.width_px}x{variant.height_px}</span>
                </div>
                <p className="text-[13px] font-bold">{variant.asset_name}</p>
                <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-[var(--brand-primary)]">Reference: {referenceName}</p>
                <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">{variant.adaptation_summary}</p>
                {retrievalSource ? (
                  <p className="mt-2 rounded-md bg-[var(--panel-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--faint)]">RAG: {retrievalSource}</p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {readiness.map((check) => (
                    <span key={check.label} className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${readinessChipClass(check.status)}`}>
                      {check.label}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-[var(--brand-primary)]">{variant.generation_model}</span>
                  <span className="font-mono text-[var(--muted)]">{variant.predicted_ctr?.toFixed(2) ?? "N/A"} CTR</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVariantId(variant.creative_asset_id)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-[12px] font-bold text-[var(--ink)] transition-colors hover:bg-white"
                >
                  <Maximize2 size={14} />
                  Use for adaptation
                </button>
                {variant.approval_status === "Pending_Review" ? (
                  <button
                    type="button"
                    onClick={() => approveStudioVariant(variant)}
                    disabled={approvingId === variant.creative_asset_id}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-[12px] font-bold text-white disabled:bg-slate-300"
                  >
                    <ShieldCheck size={14} />
                    {approvingId === variant.creative_asset_id ? "Approving" : "Approve"}
                  </button>
                ) : null}
              </div>
            </article>
            );
          })}
        </div>
      </Panel>

      {previewVariant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071523]/82 p-4">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setPreviewVariant(null)} aria-label="Close full image preview" />
          <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[var(--ink)]">{previewVariant.asset_name}</p>
                <p className="font-mono text-[11px] text-[var(--faint)]">{previewVariant.width_px}x{previewVariant.height_px} / {labelize(previewVariant.placement)}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVariant(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Close full image preview"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="bg-[#101820] p-3 sm:p-4">
              <img
                src={`/api/creative-assets/${previewVariant.creative_asset_id}/thumbnail`}
                alt={`${previewVariant.asset_name} full preview`}
                className="mx-auto max-h-[74vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <SectionHeader title="Modification and adaptation" eyebrow="Placement reformatting" />
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-[12px] font-semibold text-[var(--muted)]">
              Source creative
              <select
                value={sourceVariant?.creative_asset_id ?? ""}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]"
              >
                {allVariants.slice(0, 24).map((variant) => (
                  <option key={variant.creative_asset_id} value={variant.creative_asset_id}>
                    {variant.asset_name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Target placement</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {PLACEMENT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAdaptTargetPlacement(option)}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${adaptTargetPlacement === option ? "border-[var(--brand-accent)] bg-[var(--panel-soft)]" : "border-[var(--line)] bg-white hover:bg-[var(--panel-soft)]/65"}`}
                  >
                    <span className="block text-[12px] font-bold text-[var(--ink)]">{labelize(option)}</span>
                    <span className="font-mono text-[11px] text-[var(--faint)]">{PLACEMENT_DIMENSIONS[option]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Image edits to track</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {EDIT_OPERATION_OPTIONS.map((editType) => (
                  <label key={editType} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--ink)]">
                    <input type="checkbox" checked={selectedEditTypes.includes(editType)} onChange={() => toggleEditType(editType)} />
                    <span>{labelize(editType)}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={adaptVariant}
              disabled={isAdapting || !sourceVariant}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-[13px] font-bold text-white shadow-lg shadow-sky-900/15 disabled:opacity-60"
            >
              <Wand2 size={16} />
              {isAdapting ? "Adapting" : "Create Adaptation"}
            </button>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Transformation ledger" eyebrow="Lineage-ready edit steps" />
          <div className="mt-4 overflow-hidden rounded-md border border-[var(--line)]">
            <table className="min-w-full divide-y divide-[var(--line)] text-left">
              <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--faint)]">
                <tr>
                  <th className="px-3 py-2">Step</th>
                  <th className="px-3 py-2">Edit</th>
                  <th className="px-3 py-2">Placement</th>
                  <th className="px-3 py-2">Output</th>
                  <th className="px-3 py-2">Goal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-white">
                {transformationLedger.map((item) => (
                  <tr key={item.transformation_id}>
                    <td className="px-3 py-3 font-mono text-[12px] text-[var(--faint)]">{item.edit_sequence}</td>
                    <td className="px-3 py-3 text-[12px] font-bold text-[var(--ink)]">{item.edit_label || labelize(item.transformation_type)}</td>
                    <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{labelize(item.placement)}</td>
                    <td className="px-3 py-3 font-mono text-[12px] text-[var(--muted)]">{item.output_width_px}x{item.output_height_px}</td>
                    <td className="px-3 py-3 text-[12px] leading-5 text-[var(--muted)]">{item.edit_goal}</td>
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

function Evaluation({
  data,
  onActivationSubmitted,
}: {
  data: AgencyData;
  onActivationSubmitted: (activation: Activation, exportRecord: ActivationExport) => void;
}) {
  const [activationMessage, setActivationMessage] = useState("");
  const [activationError, setActivationError] = useState("");
  const [multiChannel, setMultiChannel] = useState(false);
  const [channelSelections, setChannelSelections] = useState<Record<string, string[]>>({});
  const [activatingId, setActivatingId] = useState("");
  const [scoreExplanation, setScoreExplanation] = useState<ScoreExplanation | null>(null);
  const [scoreExplanationLoading, setScoreExplanationLoading] = useState("");
  const approvedVariantIds = new Set(
    data.creativeVariants
      .filter((variant) => variant.approval_status === "Approved")
      .map((variant) => variant.creative_asset_id),
  );
  const judgeEndpoint = data.modelStatus.judge_model_endpoint ?? data.syntheticEvaluations[0]?.judge_model ?? "databricks-gpt-5-mini";
  const ranked = data.syntheticEvaluations.filter((evaluation) => approvedVariantIds.has(evaluation.creative_asset_id)).sort((a, b) => {
    if (a.rank_within_segment_placement !== b.rank_within_segment_placement) return a.rank_within_segment_placement - b.rank_within_segment_placement;
    return b.overall_score - a.overall_score;
  });
  const topRows = ranked.slice(0, 10);
  const readyActivationIds = new Set(data.activationExports.map((exportRecord) => exportRecord.export_id));
  data.activations
    .filter((activation) => activation.activation_source === "live_submission")
    .forEach((activation) => readyActivationIds.add(activation.export_id ?? activation.activation_id));

  function variantFor(id: string) {
    return data.creativeVariants.find((variant) => variant.creative_asset_id === id);
  }

  function checksFor(id: string) {
    return data.policyChecks.filter((check) => check.creative_asset_id === id);
  }

  function selectedChannelsFor(evaluation: SyntheticEvaluation) {
    const recommended = recommendedChannelFor(evaluation).channel.id;
    const selected = channelSelections[evaluation.evaluation_id];
    if (multiChannel) return selected?.length ? selected : [recommended];
    return [selected?.[0] ?? recommended];
  }

  function setSingleChannel(evaluationId: string, channelId: string) {
    setChannelSelections((current) => ({ ...current, [evaluationId]: [channelId] }));
  }

  function toggleChannel(evaluation: SyntheticEvaluation, channelId: string) {
    const recommended = recommendedChannelFor(evaluation).channel.id;
    setChannelSelections((current) => {
      const currentChannels = current[evaluation.evaluation_id] ?? [recommended];
      const next = currentChannels.includes(channelId)
        ? currentChannels.filter((item) => item !== channelId)
        : [...currentChannels, channelId];
      return { ...current, [evaluation.evaluation_id]: next.length ? next : [recommended] };
    });
  }

  async function activateVariant(evaluation: SyntheticEvaluation) {
    const variant = variantFor(evaluation.creative_asset_id);
    const channelIds = selectedChannelsFor(evaluation);
    setActivatingId(evaluation.evaluation_id);
    setActivationMessage("");
    setActivationError("");
    try {
      const submittedChannels: string[] = [];
      for (const channelId of channelIds) {
        const channel = ACTIVATION_CHANNELS.find((item) => item.id === channelId) ?? ACTIVATION_CHANNELS[0];
        const response = await fetch("/api/activation-exports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creative_asset_id: evaluation.creative_asset_id,
            cohort_id: evaluation.cohort_id,
            placement: evaluation.placement,
            destination_system: channel.label,
          }),
        });
        const payload = (await response.json()) as ActivationSubmitResponse;
        if (!response.ok) throw new Error(payload.export?.error_message || "Activation failed");
        onActivationSubmitted(payload.activation, payload.export);
        submittedChannels.push(channel.label);
      }
      setActivationMessage(`Activated ${variant?.asset_name ?? evaluation.creative_asset_id} for ${submittedChannels.join(", ")}.`);
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivatingId("");
    }
  }

  async function openScoreExplanation(evaluationId: string) {
    setScoreExplanationLoading(evaluationId);
    try {
      const explanation = await fetchJson<ScoreExplanation>(`/api/synthetic-evaluations/${encodeURIComponent(evaluationId)}/score-explanation`);
      setScoreExplanation(explanation);
    } catch {
      setActivationError("Failed to load score explanation");
    } finally {
      setScoreExplanationLoading("");
    }
  }

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Evaluation gate"
        subtitle="Synthetic audience response, policy checks, and channel activation readiness"
        filters={["policy", "rights", "synthetic audience", "activate"]}
        activeFilter="synthetic audience"
        onFilter={() => undefined}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Approved Scored" value={`${ranked.length}`} detail="approved synthetic rows" icon={ShieldCheck} tone="#5b65d8" />
        <KpiCard label="Policy Checks" value={`${data.policyChecks.length}`} detail="brand, rights, regional, safety" icon={Filter} tone="#c7793a" />
        <KpiCard label="Ready to Activate" value={`${readyActivationIds.size}`} detail="submitted or payload-ready" icon={Send} tone="#1f9d72" />
        <KpiCard label="Judge Model" value="Databricks" detail={judgeEndpoint} icon={Bot} tone="#256b8f" />
      </div>

      {activationMessage ? <Panel className="p-4 text-[13px] font-semibold text-[var(--green)]">{activationMessage}</Panel> : null}
      {activationError ? <Panel className="p-4 text-[13px] font-semibold text-[var(--red)]">{activationError}</Panel> : null}

      <Panel>
        <SectionHeader
          title="Channel-by-variant matrix"
          eyebrow="Recommended channel can be overwritten"
          action={
            <label className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--ink)]">
              <input type="checkbox" checked={multiChannel} onChange={(event) => setMultiChannel(event.target.checked)} />
              Multi-channel submit
            </label>
          }
        />
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[1440px] text-left">
            <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Placement</th>
                <th className="px-4 py-3 text-right">Overall</th>
                {ACTIVATION_CHANNELS.map((channel) => (
                  <th key={channel.id} className="px-3 py-3 text-center">{channel.label}</th>
                ))}
                <th className="px-4 py-3">Selection</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {topRows.map((evaluation) => {
                const variant = variantFor(evaluation.creative_asset_id);
                const checks = checksFor(evaluation.creative_asset_id);
                const readiness = variant ? variantReadinessChecks(variant, checks) : [];
                const blocked = readiness.some((check) => check.status === "block") || checks.some((check) => ["fail", "failed", "block", "blocked"].includes(check.check_status.toLowerCase()));
                const approved = variant?.approval_status === "Approved";
                const recommended = recommendedChannelFor(evaluation);
                const selectedChannels = selectedChannelsFor(evaluation);
                return (
                  <tr key={evaluation.evaluation_id} className="align-top hover:bg-[var(--panel-soft)]/70">
                    <td className="px-4 py-4">
                      <p className="text-[13px] font-bold">{variant?.asset_name ?? evaluation.creative_asset_id}</p>
                      <p className="font-mono text-[11px] text-[var(--faint)]">{evaluation.creative_asset_id}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {variant ? <StatusPill value={variant.approval_status} /> : null}
                        {readiness.slice(0, 4).map((check) => (
                          <span key={check.label} className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${readinessChipClass(check.status)}`}>
                            {check.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[13px] capitalize">{labelize(evaluation.placement)}</td>
                    <td className="px-4 py-4 text-right font-mono text-[13px]">
                      <span className="block text-[16px] font-bold">{evaluation.overall_score}</span>
                      <span className="text-[11px] text-[var(--faint)]">rank #{evaluation.rank_within_segment_placement}</span>
                    </td>
                    {ACTIVATION_CHANNELS.map((channel) => {
                      const projection = channelProjectionFor(evaluation, channel);
                      const isRecommended = channel.id === recommended.channel.id;
                      return (
                        <td key={channel.id} className="px-2 py-4">
                          <div className={`min-h-[92px] rounded-md border p-2 text-center ${channelScoreClass(projection.score)}`}>
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono text-[16px] font-bold">{projection.score}</span>
                              {isRecommended ? <span className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase">Rec</span> : null}
                            </div>
                            <p className="mt-1 font-mono text-[11px]">{projection.projectedCtr.toFixed(2)}% CTR</p>
                            <p className="font-mono text-[11px]">{formatMoney(projection.projectedCpm)} CPM</p>
                            <p className="font-mono text-[10px] text-current/70">{formatNumber(projection.projectedConversions)} starts</p>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-4">
                      {multiChannel ? (
                        <div className="grid gap-1.5">
                          {ACTIVATION_CHANNELS.map((channel) => (
                            <label key={channel.id} className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--muted)]">
                              <input
                                type="checkbox"
                                checked={selectedChannels.includes(channel.id)}
                                onChange={() => toggleChannel(evaluation, channel.id)}
                              />
                              {channel.label}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={selectedChannels[0]}
                          onChange={(event) => setSingleChannel(evaluation.evaluation_id, event.target.value)}
                          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-semibold text-[var(--ink)]"
                        >
                          {ACTIVATION_CHANNELS.map((channel) => (
                            <option key={channel.id} value={channel.id}>{channel.label}</option>
                          ))}
                        </select>
                      )}
                      <p className="mt-2 text-[11px] leading-4 text-[var(--faint)]">Recommended: {recommended.channel.label}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={blocked || !approved || activatingId === evaluation.evaluation_id}
                          onClick={() => activateVariant(evaluation)}
                          className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-[12px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                        >
                          <Send size={14} />
                          {activatingId === evaluation.evaluation_id ? "Activating" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openScoreExplanation(evaluation.evaluation_id)}
                          disabled={scoreExplanationLoading === evaluation.evaluation_id}
                          className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--panel-soft)] disabled:opacity-50"
                        >
                          <Info size={14} />
                          {scoreExplanationLoading === evaluation.evaluation_id ? "Loading..." : "Score Details"}
                        </button>
                      </div>
                      {blocked ? <p className="mt-2 text-[11px] font-semibold text-[var(--red)]">Blocked by checks</p> : null}
                    </td>
                  </tr>
                );
              })}
              {topRows.length === 0 ? (
                <tr>
                  <td colSpan={ACTIVATION_CHANNELS.length + 5} className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
                    No approved variants have synthetic evaluation rows yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      {scoreExplanation ? <ScoreExplanationModal explanation={scoreExplanation} onClose={() => setScoreExplanation(null)} /> : null}
    </div>
  );
}

function ScoreExplanationModal({ explanation, onClose }: { explanation: ScoreExplanation; onClose: () => void }) {
  const criteria = parseJsonList(explanation.rubric?.criteria_json);
  const evaluation = explanation.evaluation;
  const variant = explanation.creative_variant;
  const guideline = explanation.brand_guideline;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071523]/82 p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close score explanation" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Evaluation Criteria</p>
            <h2 className="truncate text-[18px] font-bold text-[var(--ink)]">
              {variant?.asset_name ?? evaluation.creative_asset_id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="thin-scrollbar overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Judge Model</p>
                <p className="mt-1 text-[14px] font-bold text-[var(--ink)]">{explanation.model_settings.judge_model}</p>
                <p className="mt-2 text-[12px] text-[var(--muted)]">
                  Generation: {explanation.model_settings.generation_model}
                </p>
                <p className="text-[12px] text-[var(--muted)]">
                  Rubric: {explanation.rubric?.rubric_id}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Overall Score</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[32px] font-bold text-[var(--brand-primary)]">{evaluation.overall_score}</span>
                  <span className="text-[14px] text-[var(--muted)]">/ 100</span>
                </div>
                <p className="mt-1 text-[12px] text-[var(--muted)]">
                  Rank #{evaluation.rank_within_segment_placement} for {labelize(evaluation.placement)}
                </p>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Scoring Dimensions</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Click Propensity", value: evaluation.click_propensity_score, weightLabel: "18%" },
                    { label: "Brand Fit", value: evaluation.brand_fit_score, weightLabel: "14%" },
                    { label: "Relevance", value: evaluation.relevance_score, weightLabel: "" },
                    { label: "Clarity", value: evaluation.clarity_score, weightLabel: "" },
                    { label: "Fatigue Risk", value: evaluation.fatigue_risk_score, inverse: true, weightLabel: "10%" },
                    { label: "Dwell Time", value: evaluation.expected_dwell_time_score, weightLabel: "" },
                  ].map((dimension) => (
                    <div key={dimension.label} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-[var(--ink)]">{dimension.label}</span>
                        {dimension.weightLabel ? (
                          <span className="rounded bg-[var(--panel-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                            {dimension.weightLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--panel-soft)]">
                          <div
                            className={`h-full rounded-full ${dimension.inverse ? "bg-amber-500" : "bg-[var(--brand-primary)]"}`}
                            style={{ width: `${dimension.value}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-mono text-[12px] font-bold text-[var(--ink)]">{dimension.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Channel Recommendation</p>
                <p className="mt-2 text-[14px] font-bold text-[var(--ink)]">
                  {explanation.channel_matrix?.recommended_channel_label ?? "N/A"}
                </p>
                <div className="mt-3 space-y-2">
                  {(explanation.channel_matrix?.channels ?? []).slice(0, 4).map((channel) => (
                    <div key={channel.channel_id} className="flex items-center justify-between rounded-md border border-[var(--line)] bg-[var(--panel-soft)]/50 px-3 py-2">
                      <span className="text-[12px] font-semibold text-[var(--ink)]">{channel.channel_label}</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="font-mono font-bold text-[var(--brand-primary)]">{channel.score}</span>
                        <span className="text-[var(--muted)]">{channel.projected_ctr?.toFixed(2)}% CTR</span>
                        <span className="text-[var(--muted)]">${channel.projected_cpm?.toFixed(2)} CPM</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {guideline ? (
                <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                  <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Brand Guideline Applied</p>
                  <p className="mt-1 text-[13px] font-bold text-[var(--ink)]">{guideline.brand_name}</p>
                  <p className="text-[12px] text-[var(--muted)]">Version: {guideline.version}</p>
                </div>
              ) : null}

              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Evaluation Criteria</p>
                <ul className="mt-2 space-y-1.5">
                  {criteria.map((criterion, index) => (
                    <li key={index} className="flex items-start gap-2 text-[12px] leading-5 text-[var(--muted)]">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--green)]" />
                      {criterion}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Score Reasoning</p>
                <ul className="mt-2 space-y-1.5">
                  {explanation.reasoning.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2 text-[12px] leading-5 text-[var(--muted)]">
                      <ChevronRight size={12} className="mt-1 shrink-0 text-[var(--brand-primary)]" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
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

function Activations({ activations, newSubmissions }: { activations: Activation[]; newSubmissions: Activation[] }) {
  const [platform, setPlatform] = useState("all");
  const [lineage, setLineage] = useState<ActivationLineage | null>(null);
  const [lineageLoadingId, setLineageLoadingId] = useState("");
  const [lineageError, setLineageError] = useState("");
  const submittedById = new Map<string, Activation>();
  activations.filter((item) => item.activation_source === "live_submission").forEach((item) => submittedById.set(item.activation_id, item));
  newSubmissions.forEach((item) => submittedById.set(item.activation_id, item));
  const submitted = Array.from(submittedById.values()).sort((a, b) => b.last_sync_ts.localeCompare(a.last_sync_ts));
  const submittedIds = new Set(submitted.map((item) => item.activation_id));
  const campaignActivations = activations.filter((item) => item.activation_source !== "live_submission" && !submittedIds.has(item.activation_id));
  const platforms = Array.from(new Set([...campaignActivations, ...submitted].map((item) => item.destination_platform).filter(Boolean)));
  const filteredCampaigns = campaignActivations.filter((activation) => platform === "all" || activation.destination_platform === platform);
  const filteredSubmissions = submitted.filter((activation) => platform === "all" || activation.destination_platform === platform);
  const totalSpend = filteredCampaigns.reduce((sum, item) => sum + item.cost, 0);
  const platformData = platforms.map((name) => ({
    name,
    spend: campaignActivations.filter((item) => item.destination_platform === name).reduce((sum, item) => sum + item.cost, 0),
  }));

  useEffect(() => {
    if (!lineage) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLineage(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineage]);

  async function openActivationLineage(activation: Activation) {
    setLineageLoadingId(activation.activation_id);
    setLineageError("");
    try {
      const payload = await fetchJson<ActivationLineage>(`/api/activations/${encodeURIComponent(activation.activation_id)}/lineage`);
      setLineage(payload);
    } catch (err) {
      setLineageError(err instanceof Error ? err.message : "Lineage lookup failed");
    } finally {
      setLineageLoadingId("");
    }
  }

  return (
    <div className="space-y-5">
      <WorkSurface
        title="Activation trafficking"
        subtitle={`${formatMoney(totalSpend)} in focused spend / ${filteredSubmissions.length} new submissions`}
        filters={["all", ...platforms]}
        activeFilter={platform}
        onFilter={setPlatform}
      />

      {lineageError ? <Panel className="p-4 text-[13px] font-semibold text-[var(--red)]">{lineageError}</Panel> : null}

      <Panel>
        <SectionHeader title="New submissions" eyebrow="Synthetic activations submitted from Evaluation" />
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-[var(--panel-soft)] text-[11px] uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Creative</th>
                <th className="px-4 py-3">Placement</th>
                <th className="px-4 py-3">Cohort</th>
                <th className="px-4 py-3">Destination asset</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lineage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredSubmissions.map((activation) => (
                <tr key={activation.activation_id} className="hover:bg-[var(--panel-soft)]/70">
                  <td className="px-4 py-4">
                    <p className="text-[13px] font-semibold">{activation.activation_id}</p>
                    <p className="font-mono text-[11px] text-[var(--faint)]">{activation.last_sync_ts}</p>
                  </td>
                  <td className="px-4 py-4 text-[13px]">{activation.destination_platform}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{activation.creative_asset_id}</td>
                  <td className="px-4 py-4 text-[13px] capitalize">{activation.placement ? labelize(activation.placement) : "N/A"}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{activation.cohort_id ?? "N/A"}</td>
                  <td className="px-4 py-4 font-mono text-[11px] text-[var(--muted)]">{activation.destination_asset_id ?? "N/A"}</td>
                  <td className="px-4 py-4"><StatusPill value={activation.trafficking_status} /></td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openActivationLineage(activation)}
                      disabled={lineageLoadingId === activation.activation_id}
                      className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--panel-soft)] disabled:opacity-50"
                    >
                      <Layers3 size={14} />
                      {lineageLoadingId === activation.activation_id ? "Tracing" : "Trace"}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
                    Activate a recommended variant from the Evaluation gate to populate this queue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel>
          <SectionHeader title="Spend by platform" eyebrow="Measured media delivery" />
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
          <SectionHeader title="Live delivery metrics" eyebrow="Existing campaign activations" />
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
                  <th className="px-4 py-3">Lineage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredCampaigns.map((activation) => (
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
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => openActivationLineage(activation)}
                        disabled={lineageLoadingId === activation.activation_id}
                        className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[12px] font-bold text-[var(--ink)] hover:bg-[var(--panel-soft)] disabled:opacity-50"
                      >
                        <Layers3 size={14} />
                        {lineageLoadingId === activation.activation_id ? "Tracing" : "Trace"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">
                      No measured delivery rows match this platform filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {lineage ? <ActivationLineageModal lineage={lineage} onClose={() => setLineage(null)} /> : null}
    </div>
  );
}

function ActivationLineageModal({ lineage, onClose }: { lineage: ActivationLineage; onClose: () => void }) {
  const primaryEntityTypes = ["activation", "activation_export", "creative_variant", "creative", "generation_request", "brief"];
  const primarySteps = lineage.steps.filter((step) => primaryEntityTypes.includes(step.entity_type));
  const supportSteps = lineage.steps.filter((step) => !primaryEntityTypes.includes(step.entity_type));
  const policyIssues = lineage.policy_checks.filter((check) => check.check_status.toLowerCase() !== "pass" || check.review_required);
  const hasAssetPreviews = lineage.source_preview_uri || lineage.final_preview_uri;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071523]/82 p-4">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close activation lineage" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Activation lineage</p>
            <h2 className="truncate text-[18px] font-bold text-[var(--ink)]">
              {lineage.activation?.destination_platform ?? "Activation"} back to {lineage.brief?.brief_name ?? "original brief"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Close activation lineage"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="thin-scrollbar overflow-y-auto p-4">
          {hasAssetPreviews ? (
            <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--panel-soft)]/50 p-4">
              <p className="text-[11px] font-bold uppercase text-[var(--faint)]">Asset Provenance</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {lineage.source_preview_uri ? (
                  <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Source Asset</p>
                    <img src={lineage.source_preview_uri} alt="Source asset" className="mt-2 h-32 w-full rounded-md bg-[var(--panel-soft)] object-contain" />
                    {lineage.reference_asset ? (
                      <p className="mt-2 text-[12px] font-semibold text-[var(--ink)]">{lineage.reference_asset.asset_name}</p>
                    ) : null}
                    {lineage.source_volume_url ? (
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]" title={lineage.source_volume_url}>
                        {lineage.source_volume_url}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {lineage.final_preview_uri ? (
                  <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase text-[var(--faint)]">Final Asset</p>
                      {lineage.source_preview_uri ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <ArrowRight size={10} />
                          Transformed
                        </span>
                      ) : null}
                    </div>
                    {lineage.video_preview_uri ? (
                      <video src={lineage.video_preview_uri} controls className="mt-2 h-32 w-full rounded-md bg-[var(--panel-soft)] object-contain" />
                    ) : (
                      <img src={lineage.final_preview_uri} alt="Final asset" className="mt-2 h-32 w-full rounded-md bg-[var(--panel-soft)] object-contain" />
                    )}
                    {lineage.creative_variant ? (
                      <p className="mt-2 text-[12px] font-semibold text-[var(--ink)]">{lineage.creative_variant.asset_name}</p>
                    ) : null}
                    {lineage.approved_volume_url ? (
                      <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]" title={lineage.approved_volume_url}>
                        {lineage.approved_volume_url}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {(lineage.generation_model || lineage.brand_guideline_id) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lineage.generation_model ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px]">
                      <Zap size={12} className="text-[var(--brand-primary)]" />
                      <span className="text-[var(--faint)]">Model:</span>
                      <span className="font-semibold text-[var(--ink)]">{lineage.generation_model}</span>
                    </span>
                  ) : null}
                  {lineage.brand_guideline_id ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[11px]">
                      <BookOpen size={12} className="text-[var(--brand-primary)]" />
                      <span className="text-[var(--faint)]">Guideline:</span>
                      <span className="font-semibold text-[var(--ink)]">{lineage.brand_guideline_id}</span>
                      {lineage.brand_guideline_version ? <span className="text-[var(--muted)]">v{lineage.brand_guideline_version}</span> : null}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-5">
            {primarySteps.map((step, index) => (
              <div key={`${step.entity_type}-${step.entity_id}`} className="relative rounded-lg border border-[var(--line)] bg-white p-3">
                {index < primarySteps.length - 1 ? (
                  <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-[var(--muted)] lg:block">
                    <ArrowRight size={18} />
                  </div>
                ) : null}
                <p className="text-[10px] font-bold uppercase text-[var(--faint)]">{labelize(step.entity_type)}</p>
                <p className="mt-1 text-[13px] font-bold text-[var(--ink)]">{step.title}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">{step.subtitle}</p>
                {step.status ? <div className="mt-2"><StatusPill value={step.status} /></div> : null}
                <p className="mt-2 font-mono text-[10px] text-[var(--faint)]">{step.entity_id}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {lineage.evidence.map((item) => (
              <div key={item.label} className="rounded-md border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                <p className="text-[10px] font-bold uppercase text-[var(--faint)]">{item.label}</p>
                <p className="mt-1 font-mono text-[16px] font-bold text-[var(--ink)]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-[13px] font-bold text-[var(--ink)]">Original brief trace</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {[...primarySteps, ...supportSteps].map((step) => (
                  <div key={`detail-${step.entity_type}-${step.entity_id}`} className="rounded-md border border-[var(--line)] bg-[var(--panel-soft)]/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-[var(--faint)]">{labelize(step.entity_type)}</p>
                        <p className="mt-1 text-[13px] font-bold text-[var(--ink)]">{step.title}</p>
                      </div>
                      {step.status ? <StatusPill value={step.status} /> : null}
                    </div>
                    <div className="mt-2 grid gap-1">
                      {Object.entries(step.metadata).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-3 text-[11px]">
                          <span className="text-[var(--faint)]">{key}</span>
                          <span className="max-w-[62%] truncate text-right font-mono text-[var(--muted)]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[13px] font-bold text-[var(--ink)]">Governance evidence</p>
                <div className="mt-3 space-y-2">
                  {lineage.policy_checks.slice(0, 6).map((check) => (
                    <div key={check.check_id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-[var(--panel-soft)]/55 px-3 py-2">
                      <div>
                        <p className="text-[12px] font-bold text-[var(--ink)]">{labelize(check.check_type)}</p>
                        <p className="font-mono text-[10px] text-[var(--faint)]">{check.check_id}</p>
                      </div>
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase ${readinessChipClass(policyIssues.includes(check) ? "warn" : "pass")}`}>
                        {check.check_status}
                      </span>
                    </div>
                  ))}
                  {lineage.policy_checks.length === 0 ? <p className="text-[12px] text-[var(--muted)]">No policy checks were found for this creative.</p> : null}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white p-4">
                <p className="text-[13px] font-bold text-[var(--ink)]">Transformations and evaluation</p>
                <div className="mt-3 grid gap-2">
                  {lineage.transformations.slice(0, 5).map((item) => (
                    <div key={item.transformation_id} className="rounded-md bg-[var(--panel-soft)] px-3 py-2 text-[11px] text-[var(--muted)]">
                      <span className="font-bold text-[var(--ink)]">{item.edit_label || labelize(item.transformation_type)}</span> · {item.edit_goal}
                    </div>
                  ))}
                  {lineage.synthetic_evaluations.slice(0, 3).map((evaluation) => (
                    <div key={evaluation.evaluation_id} className="rounded-md bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                      Synthetic score {evaluation.overall_score}; rank #{evaluation.rank_within_segment_placement} for {labelize(evaluation.placement)}
                    </div>
                  ))}
                  {lineage.transformations.length === 0 && lineage.synthetic_evaluations.length === 0 ? (
                    <p className="text-[12px] text-[var(--muted)]">No transformation or evaluation records were found for this activation.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
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
  const creativeEndpoint = data.modelStatus.creative_model_endpoint ?? data.modelStatus.configured_endpoint ?? "databricks-gpt-5-mini";
  const imageModel = data.modelStatus.creative_image_model ?? "seeded synthetic image assets";
  const policyEndpoint = data.modelStatus.policy_model_endpoint ?? creativeEndpoint;
  const judgeEndpoint = data.modelStatus.judge_model_endpoint ?? creativeEndpoint;
  const modelMode = data.modelStatus.creative_generation_mode ?? "model_endpoint";
  const baseAssetTable = data.backendTables.tables.find((table) => table.name === "base_creative_assets");
  const variantTable = data.backendTables.tables.find((table) => table.name === "creative_variants");
  const evaluationTable = data.backendTables.tables.find((table) => table.name === "synthetic_audience_evaluations");
  const approvedBaseAssets = data.creativeAssets.filter((asset) => asset.status === "active").length;
  const pendingVariants = data.creativeVariants.filter((variant) => variant.approval_status === "Pending_Review").length;
  const approvedVariants = data.creativeVariants.filter((variant) => variant.approval_status === "Approved").length;
  const storyCards = [
    {
      title: "Lead with the workflow",
      text: "Frame the demo as a closed loop: brief detail, C360 traits, governed seed-image retrieval, RAG generation, approval, Activate, and learning.",
      icon: Megaphone,
      tone: "#256b8f",
    },
    {
      title: "Show what is live",
      text: `The creative workflow uses Databricks tables, UC Volume seed images, Vector Search, Lakebase state, and configurable endpoint metadata with ${creativeEndpoint} as the starter endpoint.`,
      icon: Users,
      tone: "#0f9f95",
    },
    {
      title: "Separate data from visuals",
      text: `The visual source is labeled as ${imageModel}, while generated cards embed the governed seed image reference and record lineage, rights, policy, model, preview, and activation metadata.`,
      icon: Layers3,
      tone: "#5b65d8",
    },
  ];
  const deploySteps = [
    "databricks bundle deploy --target dev",
    "cd my_project && npm run build",
    "verify UC Volume seed images and Vector Search index",
    "verify Lakebase app state resource",
    "databricks bundle deploy --target dev",
    "databricks bundle run creative_command_center --target dev",
  ];
  const tabStories = [
    {
      tab: "Overview",
      icon: Gauge,
      story: "Open with campaign health so the audience sees this is still an operating command center, not only a creative lab.",
      graphs: [
        "KPI cards frame spend, impressions, conversions, and approved creative volume.",
        "Trend, channel mix, quality, and activity cards create the context for why better creative selection matters.",
        "Use this page to connect generated creative decisions back to business outcomes.",
      ],
      transition: "Move to Briefs to show where this operating loop starts.",
      tone: "#256b8f",
    },
    {
      tab: "Briefs",
      icon: FileText,
      story: "Briefs are the strategic input: objective, audience intent, budget, owner, campaign status, and the detail popup used in review conversations.",
      graphs: [
        "The brief cards provide the campaign objective that later becomes the generation request context.",
        "Open the detail popup to show budget, owner, target audience, objective, status, and supporting context without leaving Briefs.",
        "Status and budget fields help explain why teams need a governed workflow instead of one-off asset generation.",
        "Do not over-rotate on pixel generation here; this page is the planning handoff into audience traits and creative production.",
      ],
      transition: "Move to Audience to show how the brief becomes segment-specific creative direction.",
      tone: "#256b8f",
    },
    {
      tab: "Audiences",
      icon: Users,
      story: "Audience lens defines which segment traits should materially change the creative a user sees, with the C360 inventory cleaned up for readable reach and match-rate comparison.",
      graphs: [
        "The reach inventory is organized as readable ranked rows instead of crowded x-axis labels.",
        "Reach, match rate, LTV, and eligibility make sure we target segments that are large enough and allowed for activation.",
        "Trait profiles add creative influence: topic affinity, propensity, churn risk, lifecycle stage, device usage, and preferred tone.",
        "This is the key handoff into Studio: the segment is not just a targeting list, it changes the creative brief.",
      ],
      transition: "Move to Studio to show how segment traits become generated and adapted creative variants.",
      tone: "#0f9f95",
    },
    {
      tab: "Creative Studio",
      icon: Palette,
      story: "Creative Studio is the core demo: category-based governed seed-image retrieval, RAG-backed variant generation, full-image preview, adaptation, and approval.",
      graphs: [
        `Generate 4 Variants uses Vector Search and the configured creative endpoint metadata, currently ${creativeEndpoint}.`,
        `Image model/source is labeled separately as ${imageModel}; seed thumbnails come from the UC Volume manifest by selected category.`,
        "Generated variant thumbnails embed the seed image reference and can be opened into a full preview modal.",
        "Approved base assets are governed source assets with rights metadata, prior performance, related app asset IDs, and usage contexts.",
        "Create Adaptation tracks resize, crop, inpaint, outpaint, cleanup, background extension, safe-area, and aspect-ratio conversion.",
        "Approve appears on Pending_Review cards here because Evaluation only shows approved creatives.",
      ],
      transition: "Move to Evaluation to show how only approved creatives enter synthetic audience scoring.",
      tone: "#5b65d8",
    },
    {
      tab: "Evaluation",
      icon: ShieldCheck,
      story: "Evaluation is the review gate: policy evidence and synthetic audience scores determine which approved variants are ready for Activate.",
      graphs: [
        `Policy checks use ${policyEndpoint} metadata for brand, rights, regional usage, and safety review.`,
        `Synthetic audience judging uses ${judgeEndpoint} metadata for click propensity, dwell time, relevance, clarity, fatigue risk, and brand fit.`,
        "Approved Scored is intentionally filtered to approved variants so reviewers control what can advance.",
        "Activate is the user-facing action that submits selected approved winners into the Activation dashboard, with optional multi-channel submission.",
      ],
      transition: "Move to Activations to connect selected winners to downstream media and personalization systems.",
      tone: "#c7793a",
    },
    {
      tab: "Activations",
      icon: RadioTower,
      story: "Activations connect approved creative decisions to downstream delivery, Lakebase-retained submissions, and measurement.",
      graphs: [
        "Spend by platform shows where delivery is live and where budget is concentrated.",
        "New submissions show what was just activated from Evaluation before delivery metrics exist, and app state persists when Lakebase is available.",
        "The live delivery table connects campaign IDs to platform status and response metrics.",
        "Use this page to explain the production destination pattern: Meta, Google Ads, DV360, Adobe Target, email, AEM, Target, CMS, DAM, or onsite personalization.",
      ],
      transition: "Move to Markets to show how the same intelligence can guide regional scaling after activation.",
      tone: "#1f9d72",
    },
    {
      tab: "Markets",
      icon: MapPinned,
      story: "Markets are the optimization lens after activation: where to scale, optimize, or test based on response and audience mix.",
      graphs: [
        "The map turns performance data into a regional planning surface.",
        "Regional drilldowns explain where the creative-audience combination is working.",
        "This page supports the continuous improvement story: real-world outcomes feed future prompts, segments, and retrieval patterns.",
      ],
      transition: "Use Ask AI for follow-up questions or the Architecture menu to explain the implementation.",
      tone: "#c7793a",
    },
    {
      tab: "Ask AI",
      icon: Bot,
      story: "Ask AI remains decision support around the workflow; it uses Genie first and governed table summaries when free-form phrasing needs a fallback.",
      graphs: [
        "Suggested prompts are pulled from the configured Genie space and demonstrate the intended natural-language workflow.",
        "Structured answer tables show Genie-backed answers or governed Creative Command Center summaries behind the same UI.",
        "The fallback wording now leads with the answer instead of exposing a backend failure message.",
        "Keep the generation narrative in Studio and the implementation narrative in Architecture.",
      ],
      transition: "Use Talk Track when you need a concise presenter narrative without leaving the application.",
      tone: "#13212d",
    },
  ];

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Self-serve story</p>
            <h2 className="mt-2 text-[28px] font-extrabold tracking-tight">Talk Track explains the creative workflow without distracting from the live demo.</h2>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">
              The working product journey now centers on audience-informed creative generation: inspect brief details, choose a segment,
              retrieve category-filtered governed seed images, generate RAG-backed variants, expand thumbnails into full previews,
              adapt and approve pending-review creatives in Studio, score approved variants, and Activate winners into the dashboard.
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
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Workflow data setup</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <MetricMini label="API tables" value={`${loadedTables.length}`} />
                <MetricMini label="Rows" value={formatNumber(totalRows)} />
                <MetricMini label="Backend" value={data.backendTables.data_source === "databricks_sql" ? "DBSQL" : "Fallback"} />
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                Creative workflow tables are served through FastAPI from <span className="font-mono">{data.backendTables.catalog ?? "cme_outcomes_uswest"}.{data.backendTables.schema ?? "lakefoundry"}</span>,
                with CSV fallback available for local demos.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Creative endpoint check</p>
              <p className="mt-2 text-[14px] font-bold">
                {modelMode} / {creativeEndpoint}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[var(--muted)]">
                Policy review uses <span className="font-mono">{policyEndpoint}</span>; synthetic audience judging uses{" "}
                <span className="font-mono">{judgeEndpoint}</span>.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MetricMini label="Base assets" value={`${approvedBaseAssets}`} />
                <MetricMini label="Pending" value={`${pendingVariants}`} />
                <MetricMini label="Approved" value={`${approvedVariants}`} />
              </div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">Key table paths</p>
              <div className="mt-3 space-y-2 font-mono text-[11px] text-[var(--muted)]">
                <p>{baseAssetTable?.path ?? "base asset fallback"}</p>
                <p>{variantTable?.path ?? "variant fallback"}</p>
                <p>{evaluationTable?.path ?? "evaluation fallback"}</p>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[var(--muted)]">
                Use these paths when explaining where retrieval, generation, and evaluation records are persisted.
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
          <SectionHeader title="Workflow tables behind the APIs" eyebrow="Databricks tables to FastAPI contracts" />
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
          <SectionHeader title="Deployment talk track" eyebrow="Repo to Databricks workspace" />
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
          <SectionHeader title="Architecture summary" eyebrow="Current implementation" />
            <div className="space-y-3 p-4 text-[12px] leading-5 text-[var(--muted)]">
              <p>
                The app is deployed as a Databricks App with a React frontend and FastAPI backend. It prefers Databricks SQL tables
                in Unity Catalog and falls back to local CSV data only when workspace access is unavailable.
              </p>
              <p>
                The creative workflow now has configurable endpoint settings for generation, policy review, and synthetic audience judging,
                all defaulting to <span className="font-mono">{creativeEndpoint}</span>.
              </p>
              <p>
                The generated demo images use governed UC Volume seed references and RAG metadata. The metadata path is production-shaped:
                source asset, prompt, model endpoint, transformations, policy evidence, approval status, evaluation rank, Activate payload,
                Lakebase state, and feedback.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <SectionHeader title="Creative workflow data contract" eyebrow="Implementation notes" />
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

function useAskSuggestions() {
  const [suggestions, setSuggestions] = useState(GENIE_RECOMMENDED_QUESTIONS);

  useEffect(() => {
    let ignore = false;
    fetchJson<string[]>("/api/ask/suggestions")
      .then((questions) => {
        if (!ignore && questions.length) setSuggestions(questions);
      })
      .catch(() => {
        if (!ignore) setSuggestions(GENIE_RECOMMENDED_QUESTIONS);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return suggestions;
}

function useAskAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const suggestions = useAskSuggestions();

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

  return { input, loading, messages, setInput, submit, suggestions };
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
      {loading ? <p className="text-[13px] text-[var(--muted)]">Querying Ask AI...</p> : null}
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
        placeholder="Ask about variants, approvals, policy, or activation..."
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
    "/api/activations/:id/lineage",
    "/api/markets",
    "/api/backend-tables",
    "/api/model-status",
    "/api/audience-traits",
    "/api/creative-assets/search",
    "/api/creative-assets/:id/thumbnail",
    "/api/creative-generation/requests",
    "/api/creative-variants",
    "/api/creative-transformations",
    "/api/policy-checks",
    "/api/synthetic-evaluations",
    "/api/activation-exports",
    "/api/state/events",
    "/api/ask/suggestions",
    "/api/ask",
  ];
  const tabs: Array<{ id: ArchitectureTab; label: string; icon: typeof Gauge; description: string }> = [
    { id: "business", label: "Business Overview", icon: Gauge, description: "Brief, segment, preview, approve, Activate" },
    { id: "data", label: "Data & AI Pipeline", icon: Layers3, description: "Seed images, RAG, lineage, Lakebase" },
    { id: "platform", label: "Platform Architecture", icon: RadioTower, description: "Databricks app, Genie, Lakebase, APIs" },
    { id: "agent", label: "Workflow Topology", icon: Bot, description: "Retrieval, generation, review, Ask AI" },
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
                  <p className="truncate text-[12px] text-[var(--muted)]">Creative workflow, seed-image RAG, Lakebase state, Ask AI, and activation topology</p>
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
              {activeTab === "data" && <EndToEndArchitectureDiagram endpoints={endpoints} data={data} />}
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
  const creativeEndpoint = data.modelStatus.creative_model_endpoint ?? data.modelStatus.configured_endpoint ?? "databricks-gpt-5-mini";
  const userJourney = [
    {
      phase: "Brief + Segment",
      icon: Gauge,
      color: "#256b8f",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      persona: "Audience Strategist",
      goal: "Confirm campaign detail and define creative-influencing segment traits",
      touchpoints: ["Brief detail popup", "Audience inventory", "Eligibility checks"],
      outcome: "Brief and segment context with topic, lifecycle, risk, and device signals",
    },
    {
      phase: "Retrieve",
      icon: Users,
      color: "#0f9f95",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      persona: "Creative Producer",
      goal: "Find governed base assets for segment, placement, and objective",
      touchpoints: ["Category filter", "UC Volume seed images", "Vector Search index"],
      outcome: "Rights-aware seed image references with metadata and usage context",
    },
    {
      phase: "Generate",
      icon: Palette,
      color: "#5b65d8",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      persona: "Creative Director",
      goal: `Create four segment-specific variants through ${creativeEndpoint}`,
      touchpoints: ["Generation brief", "RAG references", "Full preview modal"],
      outcome: "Pending-review variant slate with embedded seed reference and lineage metadata",
    },
    {
      phase: "Approve",
      icon: Megaphone,
      color: "#c7793a",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      persona: "Brand / Legal Reviewer",
      goal: "Approve eligible pending creatives after policy and evaluation review",
      touchpoints: ["Creative Studio approval", "Policy checks", "Synthetic scores"],
      outcome: "Approved creative set visible in the evaluation gate",
    },
    {
      phase: "Activate",
      icon: TrendingUp,
      color: "#1f9d72",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      persona: "Media Ops",
      goal: "Activate approved winners into selected channels",
      touchpoints: ["Activate button", "Channel recommendation", "Activation dashboard"],
      outcome: "Lakebase-backed activation record with creative and segment metadata",
    },
    {
      phase: "Learn",
      icon: LineChartIcon,
      color: "#13212d",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
      persona: "Performance Analyst",
      goal: "Ask governed questions and compare live results with synthetic predictions",
      touchpoints: ["Ask AI", "Feedback table", "Prediction error"],
      outcome: "Improved prompts, segments, retrieval, and playbooks",
    },
  ];

  const dataFlows = [
    { from: "Brief details", to: "Generation brief", type: "objective, budget, owner, target audience" },
    { from: "Seed images", to: "Vector retrieval", type: "category, metadata, rights, approved usage contexts" },
    { from: "Request payload", to: "Model endpoint", type: "segment + prompt + placement + selected seed reference" },
    { from: "Variant slate", to: "Policy / approval", type: "brand, rights, regional usage, safety" },
    { from: "Approved winners", to: "Activate dashboard", type: "activation payload, Lakebase state, reusable metadata" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--brand-accent)]">Business User Journey</p>
        <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Creative Generation Workflow Architecture</h2>
        <p className="mt-2 max-w-3xl text-[13px] text-[var(--muted)]">
          How teams move from audience traits and governed retrieval to endpoint-backed creative generation, review,
          onsite activation, and feedback-driven improvement.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
        <p className="mb-4 text-[11px] font-bold uppercase text-slate-500">Workflow Phases</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
          <h3 className="mt-1 text-[16px] font-extrabold">How Creative Data Moves Through the System</h3>
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
                { role: "Audience Strategy", access: "Segment traits and eligibility", views: "Audiences" },
                { role: "Creative Studio", access: "Generate and adapt variants", views: "Studio" },
                { role: "Brand / Legal", access: "Policy review and approvals", views: "Studio, Evaluation" },
                { role: "Media Ops", access: "Activate and monitor submissions", views: "Evaluation, Activations" },
                { role: "Performance", access: "Feedback and prediction gaps", views: "Overview, Markets" },
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
              <p className="text-[12px] font-bold text-blue-900">Endpoint-Backed Workflow Controls</p>
            </div>
            <p className="mt-2 text-[11px] text-blue-800">The current implementation tracks:</p>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {["Configured model endpoints", "Variant-level lineage", "Policy and approval state", "Channel activation payloads"].map((cap) => (
                <div key={cap} className="rounded bg-white/70 px-2 py-1 text-[10px] font-medium text-blue-700">{cap}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-[11px] font-bold uppercase text-slate-500">Integration Touchpoints</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
              {["Briefs", "C360", "UC Volumes", "Vector Search", "Lakebase", "Genie / Ask AI", "Policy Tables", "Onsite Personalization"].map((system) => (
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
  const creativeEndpoint = data.modelStatus.creative_model_endpoint ?? data.modelStatus.configured_endpoint ?? "databricks-gpt-5-mini";
  const imageModel = data.modelStatus.creative_image_model ?? "seeded synthetic image assets";
  const policyEndpoint = data.modelStatus.policy_model_endpoint ?? creativeEndpoint;
  const judgeEndpoint = data.modelStatus.judge_model_endpoint ?? creativeEndpoint;
  const layers = [
    {
      name: "Presentation Layer",
      color: "#256b8f",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      components: [
        { name: "React App", type: "Frontend", spec: "Vite + TypeScript" },
        { name: "FastAPI", type: "API Gateway", spec: "Databricks App runtime" },
        { name: "Creative Studio", type: "Workflow UI", spec: "Generate, preview, adapt, approve" },
      ],
    },
    {
      name: "Workflow API Layer",
      color: "#5b65d8",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      components: [
        { name: "SQL Warehouse", type: "Table Reads", spec: "Databricks SQL" },
        { name: "Generation API", type: "FastAPI", spec: "/api/creative-generation" },
        { name: "Approval API", type: "FastAPI", spec: "/api/creative-variants/:id/approval" },
        { name: "State API", type: "FastAPI", spec: "/api/state/events" },
      ],
    },
    {
      name: "Data + AI Services",
      color: "#0f9f95",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      components: [
        { name: "Model Serving", type: "Generation", spec: creativeEndpoint },
        { name: "Seed Image Source", type: "Visual Assets", spec: imageModel },
        { name: "Policy Endpoint", type: "Review", spec: policyEndpoint },
        { name: "Judge Endpoint", type: "Evaluation", spec: judgeEndpoint },
        { name: "Ask AI", type: "Genie + Fallback", spec: "curated prompts + table summaries" },
      ],
    },
    {
      name: "Governance + Storage Layer",
      color: "#c7793a",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      components: [
        { name: "Unity Catalog", type: "Governance", spec: `${data.backendTables.tables.length} API tables` },
        { name: "UC Volume", type: "Seed Images", spec: "artifacts/creative_assets/seed_images" },
        { name: "Vector Search", type: "RAG Retrieval", spec: "creative-asset-search-dev" },
        { name: "Lakebase", type: "App State", spec: "generation, approval, activation events" },
      ],
    },
  ];

  const securityZones = [
    { zone: "Databricks App", trust: "Trusted", controls: ["same-origin API", "service principal auth", "user token for Genie"] },
    { zone: "Workflow APIs", trust: "Trusted", controls: ["FastAPI validation", "approval gate", "policy checks"] },
    { zone: "Data + AI", trust: "Highly trusted", controls: ["SQL warehouse", "Genie", "model endpoints", "Vector Search"] },
    { zone: "Governed Storage", trust: "Highly trusted", controls: ["Unity Catalog", "UC volumes", "Lakebase", "table ACLs"] },
  ];

  const authFlow = [
    { step: "1", name: "User Session", from: "Browser", to: "Databricks App", protocol: "workspace auth" },
    { step: "2", name: "API Request", from: "React", to: "FastAPI", protocol: "same-origin" },
    { step: "3", name: "Workspace Call", from: "FastAPI", to: "SQL / Genie / Model Serving", protocol: "SDK / REST" },
    { step: "4", name: "Governed Access", from: "Databricks", to: "UC tables + volumes + Lakebase", protocol: "Unity Catalog" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-slate-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-slate-500">// ARCHITECTURE BLUEPRINT</p>
            <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Databricks Creative Workflow Platform</h2>
            <p className="mt-2 max-w-2xl text-[13px] text-[var(--muted)]">
              React and FastAPI run as a Databricks App. Workflow APIs read governed tables, retrieve approved assets,
              invoke configurable model endpoints, and write lineage-ready approval, policy, evaluation, and activation records.
            </p>
          </div>
          <div className="hidden shrink-0 font-mono text-[10px] text-slate-400 md:block">
            <p>Mode: {data.modelStatus.creative_generation_mode ?? "model_endpoint"}</p>
            <p>Model: {creativeEndpoint}</p>
            <p>Image: {imageModel}</p>
            <p>Destination: selectable channels</p>
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
            { name: "Databricks Apps", desc: "Managed web runtime", code: "APP" },
            { name: "SQL Warehouse", desc: "Governed table access", code: "SQL" },
            { name: "Vector Search", desc: "Seed image retrieval", code: "VS" },
            { name: "Lakebase", desc: "Durable app state", code: "PG" },
            { name: "Genie", desc: "Ask AI questions", code: "AI" },
          ].map((item) => (
            <div key={item.name} className="rounded-lg border border-emerald-200 bg-white p-3">
              <p className="inline-flex h-7 min-w-7 items-center justify-center rounded bg-emerald-100 px-2 font-mono text-[10px] font-bold text-emerald-700">{item.code}</p>
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
              <tr><td className="px-3 py-2">SQL Warehouse</td><td className="px-3 py-2 text-[var(--muted)]">Compute</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">Databricks table backend</td></tr>
              <tr><td className="px-3 py-2">Model Serving</td><td className="px-3 py-2 text-[var(--muted)]">Creative AI</td><td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 ${data.modelStatus.configured_endpoint ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{data.modelStatus.configured_endpoint ? "Configured" : "None"}</span></td><td className="px-3 py-2 text-[var(--muted)]">{creativeEndpoint}</td></tr>
              <tr><td className="px-3 py-2">Seed Image Source</td><td className="px-3 py-2 text-[var(--muted)]">Visual Assets</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">{imageModel}</td></tr>
              <tr><td className="px-3 py-2">Policy / Judge Endpoints</td><td className="px-3 py-2 text-[var(--muted)]">Review AI</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Configured</span></td><td className="px-3 py-2 text-[var(--muted)]">{policyEndpoint} / {judgeEndpoint}</td></tr>
              <tr><td className="px-3 py-2">Vector Search</td><td className="px-3 py-2 text-[var(--muted)]">Retrieval</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">creative-asset-search-dev</td></tr>
              <tr><td className="px-3 py-2">Lakebase</td><td className="px-3 py-2 text-[var(--muted)]">State Store</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Configured</span></td><td className="px-3 py-2 text-[var(--muted)]">creative_command_center_state</td></tr>
              <tr><td className="px-3 py-2">Genie Space</td><td className="px-3 py-2 text-[var(--muted)]">Ask AI</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Configured</span></td><td className="px-3 py-2 text-[var(--muted)]">curated prompts + governed fallback</td></tr>
              <tr><td className="px-3 py-2">Unity Catalog</td><td className="px-3 py-2 text-[var(--muted)]">Governance</td><td className="px-3 py-2"><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Active</span></td><td className="px-3 py-2 text-[var(--muted)]">{data.backendTables.tables.length} API-backed tables</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AgentTopology({ data }: { data: AgencyData }) {
  const creativeEndpoint = data.modelStatus.creative_model_endpoint ?? data.modelStatus.configured_endpoint ?? "databricks-gpt-5-mini";
  const imageModel = data.modelStatus.creative_image_model ?? "seeded synthetic image assets";
  const policyEndpoint = data.modelStatus.policy_model_endpoint ?? creativeEndpoint;
  const judgeEndpoint = data.modelStatus.judge_model_endpoint ?? creativeEndpoint;
  const agents = [
    { id: "supervisor", name: "Workflow API", type: "Orchestrator", model: "FastAPI + Databricks SDK", tools: ["request_validate", "table_fetch", "lakebase_state"], color: "#13212d" },
    { id: "retriever", name: "Seed Retriever", type: "RAG Retrieval", model: "Vector Search + UC Volume", tools: ["asset_search", "category_filter", "thumbnail_fetch"], color: "#256b8f" },
    { id: "generator", name: "Creative Generator", type: "Model Endpoint", model: `${creativeEndpoint} / ${imageModel}`, tools: ["model_invoke", "variant_build", "preview_embed"], color: "#0f9f95" },
    { id: "reviewer", name: "Policy Reviewer", type: "Governance", model: policyEndpoint, tools: ["brand_check", "rights_check", "safety_check"], color: "#5b65d8" },
    { id: "judge", name: "Audience Judge", type: "Evaluation", model: judgeEndpoint, tools: ["panel_score", "rank_variants", "evidence_write"], color: "#c7793a" },
    { id: "activation", name: "Activation Ops", type: "Activate", model: "multi-channel", tools: ["approval_gate", "payload_write", "dashboard_sync"], color: "#1f9d72" },
    { id: "ask_ai", name: "Ask AI", type: "Decision Support", model: "Genie + governed fallback", tools: ["sample_prompt", "closest_retry", "table_summary"], color: "#13212d" },
  ];

  const toolMatrix = [
    { tool: "Unity Catalog", retriever: true, generator: true, reviewer: true, judge: true, activation: true },
    { tool: "UC Volumes", retriever: true, generator: true, reviewer: false, judge: false, activation: false },
    { tool: "Vector Search", retriever: true, generator: true, reviewer: false, judge: false, activation: false },
    { tool: "Lakebase", retriever: false, generator: true, reviewer: true, judge: true, activation: true },
    { tool: "Genie Space", retriever: false, generator: false, reviewer: false, judge: true, activation: true },
    { tool: "Model Serving", retriever: false, generator: true, reviewer: true, judge: true, activation: false },
    { tool: "Policy Tables", retriever: false, generator: false, reviewer: true, judge: false, activation: true },
    { tool: "Activation Submit", retriever: false, generator: false, reviewer: false, judge: true, activation: true },
  ];

  const stateMachine = [
    { state: "BRIEF", desc: "Brief details, segment, placement, instructions, and category selected", next: ["RETRIEVE"] },
    { state: "RETRIEVE", desc: "Seed images filtered by category, placement, metadata, and rights", next: ["GENERATE"] },
    { state: "GENERATE", desc: "RAG-backed variants created with embedded seed-image preview", next: ["PREVIEW"] },
    { state: "PREVIEW", desc: "Thumbnail expands for full creative inspection", next: ["ADAPT"] },
    { state: "ADAPT", desc: "Resize, crop, inpaint, outpaint, and safe-area transforms tracked", next: ["REVIEW"] },
    { state: "REVIEW", desc: "Policy, rights, regional, safety, and approval checks applied", next: ["EVALUATE"] },
    { state: "EVALUATE", desc: "Approved variants scored against synthetic audiences", next: ["ACTIVATE"] },
    { state: "ACTIVATE", desc: "Winning variants submitted and shown on Activation dashboard", next: ["LEARN"] },
    { state: "LEARN", desc: "Ask AI and feedback improve future prompts and retrieval", next: ["BRIEF"] },
  ];

  const guardrails = [
    { name: "Rights Scope", type: "Retrieval", desc: "Only approved usage contexts are eligible" },
    { name: "Brand + Safety", type: "Policy", desc: "Generated and adapted creatives get review evidence" },
    { name: "Approval Gate", type: "Status", desc: "Pending-review assets must be approved in Studio" },
    { name: "State Retention", type: "Lakebase", desc: "Generation, approval, and activation changes persist across app updates" },
    { name: "Lineage Required", type: "Audit", desc: "Request, prompt, model, source asset, preview reference, and transforms are retained" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-violet-600">// AI SYSTEM DESIGN</p>
            <h2 className="mt-1 text-[22px] font-extrabold text-[var(--ink)]">Creative Workflow Topology</h2>
            <p className="mt-2 max-w-2xl text-[13px] text-[var(--muted)]">
              Specialized workflow services coordinate asset retrieval, endpoint-backed generation, policy review,
              synthetic audience scoring, approval, channel activation, and feedback capture.
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
              <p className="mt-2 text-[13px] font-bold text-white">Workflow API</p>
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
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Retrieve</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Generate</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Review</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Judge</th>
                  <th className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">Activate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono">
                {toolMatrix.map((row) => (
                  <tr key={row.tool}>
                    <td className="px-2 py-1.5 font-semibold">{row.tool}</td>
                    <td className="px-2 py-1.5 text-center">{row.retriever ? "✓" : "-"}</td>
                    <td className="px-2 py-1.5 text-center">{row.generator ? "✓" : "-"}</td>
                    <td className="px-2 py-1.5 text-center">{row.reviewer ? "✓" : "-"}</td>
                    <td className="px-2 py-1.5 text-center">{row.judge ? "✓" : "-"}</td>
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
              { name: "Endpoint Config", desc: creativeEndpoint, status: data.modelStatus.configured_endpoint ? "Configured" : "Pending" },
              { name: "Seed Image RAG", desc: "category, reference asset, thumbnail preview", status: "Active" },
              { name: "Generation Metadata", desc: "prompt, model, invocation status", status: "Active" },
              { name: "Lakebase State", desc: "requests, variants, approvals, activations", status: "Active" },
              { name: "Lineage Tables", desc: "source asset, request, transforms", status: "Active" },
              { name: "Evaluation Tables", desc: "synthetic audience ranks", status: "Active" },
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
            <p className="font-mono text-[10px] font-bold text-blue-700">Captured Workflow Evidence</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {["Prompt", "Seed reference", "Model endpoint", "Invocation status", "Policy evidence", "Evaluation rank", "Activate event", "Prediction feedback"].map((m) => (
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

function EndToEndArchitectureDiagram({ endpoints, data }: { endpoints: string[]; data: AgencyData | null }) {
  const creativeEndpoint = data?.modelStatus.creative_model_endpoint ?? data?.modelStatus.configured_endpoint ?? "databricks-gpt-5-mini";
  const policyEndpoint = data?.modelStatus.policy_model_endpoint ?? creativeEndpoint;
  const judgeEndpoint = data?.modelStatus.judge_model_endpoint ?? creativeEndpoint;
  const generationMode = data?.modelStatus.creative_generation_mode ?? "model_endpoint";
  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-[24px] font-extrabold text-[var(--ink)]">Creative Generation Data and AI Architecture</h2>
        <p className="mt-2 text-[13px] font-semibold text-[var(--muted)]">Brief details, C360 traits, governed seed images, RAG retrieval, Lakebase state, Ask AI, and Activate on Databricks</p>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        {[
          ["Mode", generationMode],
          ["Creative Model", creativeEndpoint],
          ["Policy Model", policyEndpoint],
          ["Audience Judge", judgeEndpoint],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase text-[var(--faint)]">{label}</p>
            <p className="mt-1 truncate font-mono text-[12px] font-semibold text-[var(--ink)]">{value}</p>
          </div>
        ))}
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
                  {ARCH_SERVING_NODES.slice(0, 5).map((node, index) => (
                    <ArchitectureCard key={node[0]} title={node[0]} subtitle={node[1]} tone="serving" delay={1.05 + index * 0.05} />
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <ArchitectureConnector dotted delay={1.25} />
                </div>
                <ArchitectureCard title={ARCH_SERVING_NODES[5][0]} subtitle={ARCH_SERVING_NODES[5][1]} tone="source" delay={1.32} />
              </div>
            </div>
          </div>

          <motion.div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/45 p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-violet-900">Unity Catalog - Governance, Lineage and Reuse</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Audience traits, seed assets, generation requests, transformations, policy checks, evaluations, activations, Lakebase state, and feedback are governed.</p>
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
              <p><span className="font-semibold text-[var(--ink)]">Rights scope</span><br />regions, channels, dates, and usage context</p>
              <p><span className="font-semibold text-[var(--ink)]">Policy checks</span><br />brand, rights, regional usage, and safety</p>
              <p><span className="font-semibold text-[var(--ink)]">Lineage</span><br />seed asset, prompt, model, request, preview, and transforms</p>
              <p><span className="font-semibold text-[var(--ink)]">Reuse</span><br />approved variants, activations, and winning patterns</p>
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
          <p className="text-[13px] font-semibold">Current implementation</p>
          <div className="mt-3 space-y-2 text-[12px] leading-5 text-[var(--muted)]">
            <p>The app reads Databricks workflow tables with CSV fallback and serves the same FastAPI JSON contracts to the React command center.</p>
            <p>Generation uses category-filtered UC Volume seed images, Vector Search RAG references, embedded thumbnail previews, and Lakebase-backed state for live changes.</p>
            <p>Generation, adaptation, policy checks, synthetic audience judging, and Ask AI use configurable Databricks services, with {creativeEndpoint} as the starter model.</p>
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
  const { input, loading, messages, setInput, submit, suggestions } = useAskAssistant();

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
                  <p className="truncate text-[12px] text-[var(--muted)]">Genie plus governed workflow answers</p>
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
              <div className="thin-scrollbar grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
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
              emptyText="Ask Creative Command Center about variants, policy checks, synthetic evaluations, lineage, or activation readiness."
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
  const { input, loading, messages, setInput, submit, suggestions } = useAskAssistant();

  return (
    <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
      <Panel className="p-4">
        <div className="brand-mark mb-5 flex h-12 w-12 items-center justify-center rounded-lg">
          <Bot size={22} />
        </div>
        <h2 className="text-[22px] font-bold">Ask the activation desk</h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">
          Ask AI tries the curated Databricks Genie space first, then returns governed Creative Command Center summaries for supported workflow questions.
        </p>
        <div className="thin-scrollbar mt-6 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
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
        <AskMessageList
          messages={messages}
          loading={loading}
          emptyText="Select a query or ask about variants, approval status, policy checks, synthetic evaluation, lineage, or activation readiness."
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
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase text-[var(--faint)]">{label}</p>
      <p className="mt-1 break-words font-mono text-[15px] font-semibold leading-tight">{value}</p>
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
