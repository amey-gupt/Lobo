"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Shield,
  Zap,
  Brain,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";
import { ChatPanel } from "@/components/chat-panel";
import {
  area as d3Area,
  curveCatmullRom,
  easeCubicInOut,
  line as d3Line,
  scaleLinear,
} from "d3";
import {
  MAX_MULTIPLIER_PER_CONCEPT,
  STEERING_LEVEL_MAX,
  steeringLevelToMultiplier,
  steeringStrengthLabel,
} from "@/lib/steering-config";

/** Session snapshot from dashboard; supports legacy `intensity` (0–100) or new `level` (0–12). */
interface SteeringVector {
  id: string;
  name?: string;
  actionTitle?: string;
  enabled: boolean;
  level?: number;
  intensity?: number;
  category: string;
}

const fallbackVectors: SteeringVector[] = [
  {
    id: "content-filter",
    name: "Content Filter",
    enabled: true,
    intensity: 75,
    category: "safety",
  },
  {
    id: "toxicity-reduction",
    name: "Toxicity Reduction",
    enabled: true,
    intensity: 80,
    category: "safety",
  },
  {
    id: "conciseness",
    name: "Conciseness",
    enabled: true,
    intensity: 60,
    category: "behavior",
  },
  {
    id: "accuracy-boost",
    name: "Accuracy Boost",
    enabled: true,
    intensity: 90,
    category: "performance",
  },
];

function toTitleCaseFromId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getVectorDisplayName(vector: SteeringVector): string {
  if (vector.name && vector.name.trim().length > 0) return vector.name;
  if (vector.actionTitle && vector.actionTitle.trim().length > 0)
    return vector.actionTitle;
  return toTitleCaseFromId(vector.id);
}

function getVectorIntensityPercent(vector: SteeringVector): number {
  if (!vector.enabled) return 0;
  if (typeof vector.intensity === "number") return Math.round(vector.intensity);
  return Math.round((approxMultiplier(vector) / 2) * 100);
}

function getVectorLevel(vector: SteeringVector): number {
  if (typeof vector.level === "number") {
    return Math.max(0, Math.min(STEERING_LEVEL_MAX, Math.round(vector.level)));
  }
  if (typeof vector.intensity === "number") {
    const derived = (vector.intensity / 100) * STEERING_LEVEL_MAX;
    return Math.max(0, Math.min(STEERING_LEVEL_MAX, Math.round(derived)));
  }
  return 0;
}

function approxMultiplier(v: SteeringVector): number {
  if (!v.enabled) return 0;
  if (typeof v.level === "number")
    return steeringLevelToMultiplier(true, v.level);
  if (typeof v.intensity === "number") return (v.intensity / 100) * 2;
  return 0;
}

// Performance data generation (mock chart scales with avg steering strength)
const generatePerformanceData = (vectors: SteeringVector[]) => {
  const safetyVectors = vectors.filter(
    (v) => v.enabled && v.category === "safety",
  );
  const avgSafety =
    safetyVectors.length > 0
      ? safetyVectors.reduce(
          (acc, v) => acc + approxMultiplier(v) * (100 / 2),
          0,
        ) / safetyVectors.length
      : 50;

  return [
    { month: "12/23", toxicity: 35, bias: 28, safety: 65 },
    { month: "01/24", toxicity: 30, bias: 25, safety: 70 },
    { month: "02/24", toxicity: 25, bias: 22, safety: 75 },
    { month: "03/24", toxicity: 20, bias: 18, safety: 80 },
    { month: "04/24", toxicity: 15, bias: 15, safety: 85 },
    {
      month: "05/24",
      toxicity: Math.max(5, 30 - avgSafety * 0.3),
      bias: Math.max(8, 25 - avgSafety * 0.2),
      safety: Math.min(95, avgSafety),
    },
    {
      month: "06/24",
      toxicity: Math.max(3, 28 - avgSafety * 0.3),
      bias: Math.max(5, 22 - avgSafety * 0.2),
      safety: Math.min(98, avgSafety + 3),
    },
  ];
};

interface JudgeBenchmarkPoint {
  metric: string;
  baseline: number;
  steered: number;
  delta: number;
}

const generateJudgeBenchmarkData = (
  vectors: SteeringVector[],
): JudgeBenchmarkPoint[] => {
  const enabledSafety = vectors.filter(
    (v) => v.enabled && v.category === "safety",
  );
  const enabledBehavior = vectors.filter(
    (v) => v.enabled && v.category === "behavior",
  );

  const safetyStrength =
    enabledSafety.length === 0
      ? 0
      : enabledSafety.reduce((sum, v) => sum + approxMultiplier(v), 0) /
        enabledSafety.length;
  const behaviorStrength =
    enabledBehavior.length === 0
      ? 0
      : enabledBehavior.reduce((sum, v) => sum + approxMultiplier(v), 0) /
        enabledBehavior.length;

  const activeRatio = vectors.length
    ? vectors.filter((v) => v.enabled).length / vectors.length
    : 0;

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const blueprints = [
    { metric: "Policy Safety", baseline: 61, sW: 13, bW: 4 },
    { metric: "Low Toxicity", baseline: 57, sW: 14, bW: 2 },
    { metric: "Truthfulness", baseline: 63, sW: 8, bW: 6 },
    { metric: "Tone Stability", baseline: 59, sW: 3, bW: 12 },
    { metric: "Instruction Fit", baseline: 66, sW: 4, bW: 10 },
  ];

  return blueprints.map((b) => {
    const steered = clamp(
      b.baseline +
        b.sW * (safetyStrength / 2) +
        b.bW * (behaviorStrength / 2) +
        activeRatio * 5,
    );
    return {
      metric: b.metric,
      baseline: b.baseline,
      steered,
      delta: steered - b.baseline,
    };
  });
};

interface VectorScalingSample {
  step: number;
  raw: number;
  steered: number;
}

interface VectorPerformanceSummary {
  name: string;
  category: string;
  status: string;
  level: string;
  multiplier: string;
  strengthBand: string;
}

const generateVectorPerformanceSummary = (
  vectors: SteeringVector[],
): VectorPerformanceSummary[] => {
  return vectors.map((vector) => {
    const level = getVectorLevel(vector);
    const multiplier = approxMultiplier(vector);
    const category = vector.category
      ? vector.category.charAt(0).toUpperCase() + vector.category.slice(1)
      : "Unknown";

    return {
      name: getVectorDisplayName(vector),
      category,
      status: vector.enabled ? "On" : "Off",
      level: `${level}/${STEERING_LEVEL_MAX}`,
      multiplier: `${multiplier.toFixed(2)}×`,
      strengthBand: vector.enabled ? steeringStrengthLabel(level) : "Off",
    };
  });
};

function VectorScalingAnimation({ vector }: { vector: SteeringVector }) {
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    let raf = 0;
    const durationMs = 2600;
    let startTime = 0;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = (now - startTime) % durationMs;
      setPhase(elapsed / durationMs);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const vectorName = getVectorDisplayName(vector);
  const level = getVectorLevel(vector);
  const targetMultiplier = approxMultiplier(vector);
  const animatedMultiplier = targetMultiplier * easeCubicInOut(phase);
  const baseProjection = 0.42;
  const projectedShift = baseProjection * animatedMultiplier;

  const chart = React.useMemo(() => {
    const samples: VectorScalingSample[] = Array.from(
      { length: 24 },
      (_, idx) => {
        const step = idx + 1;
        const raw = 0.45 + 0.14 * Math.sin(step / 3.2);
        const directionProjection =
          0.22 + 0.12 * Math.sin(step / 2.7) + 0.08 * Math.cos(step / 4.1);
        const steered = raw + directionProjection * animatedMultiplier;
        return { step, raw, steered };
      },
    );

    const width = 620;
    const height = 220;
    const margin = { top: 14, right: 18, bottom: 28, left: 42 };

    const x = scaleLinear()
      .domain([1, 24])
      .range([margin.left, width - margin.right]);
    const allValues = samples.flatMap((d) => [d.raw, d.steered]);
    const yMin = Math.min(...allValues) - 0.08;
    const yMax = Math.max(...allValues) + 0.08;
    const y = scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin.bottom, margin.top]);

    const rawPath =
      d3Line<VectorScalingSample>()
        .x((d) => x(d.step))
        .y((d) => y(d.raw))
        .curve(curveCatmullRom.alpha(0.55))(samples) || "";

    const steeredPath =
      d3Line<VectorScalingSample>()
        .x((d) => x(d.step))
        .y((d) => y(d.steered))
        .curve(curveCatmullRom.alpha(0.55))(samples) || "";

    const deltaAreaPath =
      d3Area<VectorScalingSample>()
        .x((d) => x(d.step))
        .y0((d) => y(d.raw))
        .y1((d) => y(d.steered))
        .curve(curveCatmullRom.alpha(0.55))(samples) || "";

    const cursor =
      samples[Math.floor(phase * (samples.length - 1))] ?? samples[0];

    return {
      width,
      height,
      margin,
      rawPath,
      steeredPath,
      deltaAreaPath,
      cursor: {
        x: x(cursor.step),
        rawY: y(cursor.raw),
        steeredY: y(cursor.steered),
      },
      yTicks: [yMin, (yMin + yMax) / 2, yMax].map((value) => ({
        value,
        y: y(value),
      })),
    };
  }, [animatedMultiplier, phase]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Example Vector
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {vectorName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Backend scaling: coefficient = (level / {STEERING_LEVEL_MAX}) *{" "}
          {MAX_MULTIPLIER_PER_CONCEPT}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-card p-2">
            <p className="text-muted-foreground">Level</p>
            <p className="font-semibold text-foreground">
              {level}/{STEERING_LEVEL_MAX}
            </p>
          </div>
          <div className="rounded-md bg-card p-2">
            <p className="text-muted-foreground">Target Coeff</p>
            <p className="font-semibold text-foreground">
              {targetMultiplier.toFixed(2)}x
            </p>
          </div>
          <div className="rounded-md bg-card p-2">
            <p className="text-muted-foreground">Animated Coeff</p>
            <p className="font-semibold text-foreground">
              {animatedMultiplier.toFixed(2)}x
            </p>
          </div>
          <div className="rounded-md bg-card p-2">
            <p className="text-muted-foreground">Current Shift</p>
            <p className="font-semibold text-foreground">
              {projectedShift.toFixed(3)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card p-2">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label="Animated vector scaling from raw logits to steered logits"
        >
          <defs>
            <linearGradient id="vectorShiftFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e07a5f" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#e07a5f" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={chart.margin.left}
                x2={chart.width - chart.margin.right}
                y1={tick.y}
                y2={tick.y}
                stroke="hsl(var(--border))"
                strokeDasharray="4 6"
              />
              <text
                x={10}
                y={tick.y + 4}
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >
                {tick.value.toFixed(2)}
              </text>
            </g>
          ))}

          <path d={chart.deltaAreaPath} fill="url(#vectorShiftFill)" />
          <path
            d={chart.rawPath}
            fill="none"
            stroke="#5c9ead"
            strokeWidth="2"
          />
          <path
            d={chart.steeredPath}
            fill="none"
            stroke="#1a2634"
            strokeWidth="2.5"
          />

          <line
            x1={chart.cursor.x}
            x2={chart.cursor.x}
            y1={chart.margin.top}
            y2={chart.height - chart.margin.bottom}
            stroke="#1a2634"
            strokeOpacity="0.2"
            strokeDasharray="3 5"
          />
          <circle
            cx={chart.cursor.x}
            cy={chart.cursor.rawY}
            r="4"
            fill="#5c9ead"
          />
          <circle
            cx={chart.cursor.x}
            cy={chart.cursor.steeredY}
            r="4.5"
            fill="#1a2634"
          />
        </svg>

        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#5c9ead]" />
            raw model score
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1a2634]" />
            steered score
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e07a5f]" />
            coefficient-induced delta
          </span>
        </div>
      </div>
    </div>
  );
}

const trafficData = [
  {
    source: "Safety Vectors",
    referral: 804,
    conversions: 71,
    change: "+8.12%",
    up: true,
  },
  {
    source: "Behavior Vectors",
    referral: 1090,
    conversions: 99,
    change: "+3.10%",
    up: true,
  },
  {
    source: "Performance Vectors",
    referral: 873,
    conversions: 63,
    change: "-7.06%",
    up: false,
  },
  {
    source: "Custom Vectors",
    referral: 991,
    conversions: 112,
    change: "-3.11%",
    up: false,
  },
  {
    source: "Experimental",
    referral: 915,
    conversions: 94,
    change: "+0.90%",
    up: true,
  },
  { source: "Legacy", referral: 672, conversions: 66, change: "N/A", up: null },
];

export default function MetricsPage() {
  const router = useRouter();
  const [vectors, setVectors] = React.useState<SteeringVector[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const storedVectors = sessionStorage.getItem("steeringVectors");
    if (storedVectors) {
      try {
        const parsed = JSON.parse(storedVectors);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVectors(parsed);
        } else {
          setVectors(fallbackVectors);
        }
      } catch {
        setVectors(fallbackVectors);
      }
    } else {
      setVectors(fallbackVectors);
    }
  }, []);

  const performanceData = generatePerformanceData(vectors);
  const judgeBenchmarkData = generateJudgeBenchmarkData(vectors);
  const vectorPerformanceSummary = generateVectorPerformanceSummary(vectors);
  const exampleVector =
    vectors.find((v) => v.id === "deception") ||
    vectors.find((v) => v.enabled) ||
    vectors[0] ||
    fallbackVectors[0];

  const enabledCount = vectors.filter((v) => v.enabled).length;
  const avgMultiplier =
    enabledCount === 0
      ? 0
      : vectors
          .filter((v) => v.enabled)
          .reduce((sum, v) => sum + approxMultiplier(v), 0) / enabledCount;
  const peakMultiplier = Math.max(
    0,
    ...vectors.map((v) => approxMultiplier(v)),
  );

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <ChatPanel />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader title="LOBO - METRICS" />

        <main className="flex-1 overflow-auto p-6">
          {/* Top Row - Key Metrics and Vector Summary */}
          <div className="mb-6 grid items-stretch gap-6 lg:grid-cols-5">
            {/* Key Metrics Cards */}
            <div className="flex h-full flex-col lg:col-span-2">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                KEY STEERING METRICS
              </h2>
              <div className="grid flex-1 grid-cols-3 gap-4">
                <Card className="h-full border-0 bg-[#e07a5f] text-white shadow-md">
                  <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Shield className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium opacity-90">
                      Controls turned on
                    </p>
                    <p className="text-2xl font-bold">{enabledCount}</p>
                    <p className="mt-2 text-center text-xs opacity-80">
                      How many controls are active right now
                    </p>
                  </CardContent>
                </Card>

                <Card className="h-full border-0 bg-[#f4a68f] text-[#1a2634] shadow-md">
                  <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
                      <Zap className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium opacity-80">
                      Average strength
                    </p>
                    <p className="text-2xl font-bold">
                      {avgMultiplier.toFixed(2)}×
                    </p>
                    <p className="mt-2 text-center text-xs opacity-80">
                      The typical level across active controls
                    </p>
                  </CardContent>
                </Card>

                <Card className="h-full border-0 bg-[#f2cc8f] text-[#1a2634] shadow-md">
                  <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
                      <Brain className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium opacity-80">
                      Strongest setting
                    </p>
                    <p className="text-2xl font-bold">
                      {peakMultiplier.toFixed(2)}×
                    </p>
                    <p className="mt-2 text-center text-xs opacity-80">
                      The highest level on any active control
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Vector Performance Summary Table */}
            <div className="flex h-full flex-col lg:col-span-3">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                VECTOR PERFORMANCE SUMMARY
              </h2>
              <Card className="h-full border-0 shadow-md">
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Vector
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Level
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Multiplier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Strength Band
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vectorPerformanceSummary.map((metric, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {metric.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {metric.category}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {metric.status}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {metric.level}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {metric.multiplier}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {metric.strengthBand}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Middle Row - Charts */}
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {/* Bar Chart - Risk Metrics */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  RISK METRICS OVER TIME
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#81b29a]" />
                    <span className="text-xs text-muted-foreground">
                      safety
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#e07a5f]" />
                    <span className="text-xs text-muted-foreground">
                      toxicity
                    </span>
                  </div>
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} barGap={2}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar
                        dataKey="safety"
                        fill="#81b29a"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="toxicity"
                        fill="#e07a5f"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Area Chart - Daily Reach */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  BASELINE VS STEERED BENCHMARK DELTA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#5c9ead]" />
                    baseline model
                  </span>
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#e07a5f]" />
                    steered model
                  </span>
                  <span className="text-[#1a2634]">
                    Avg uplift: +
                    {(
                      judgeBenchmarkData.reduce((s, d) => s + d.delta, 0) /
                      Math.max(judgeBenchmarkData.length, 1)
                    ).toFixed(1)}
                    pts
                  </span>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={judgeBenchmarkData}
                      cx="50%"
                      cy="54%"
                      outerRadius="74%"
                    >
                      <PolarGrid
                        stroke="hsl(var(--border))"
                        radialLines={true}
                      />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{
                          fill: "hsl(var(--muted-foreground))",
                          fontSize: 12,
                        }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value} pts`,
                          name === "steered" ? "Steered" : "Baseline",
                        ]}
                        labelFormatter={(label) => `${label}`}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Radar
                        name="baseline"
                        dataKey="baseline"
                        stroke="#5c9ead"
                        fill="#5c9ead"
                        fillOpacity={0.16}
                        strokeWidth={2}
                      />
                      <Radar
                        name="steered"
                        dataKey="steered"
                        stroke="#e07a5f"
                        fill="#e07a5f"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  {judgeBenchmarkData.map((row) => (
                    <div
                      key={row.metric}
                      className="rounded-md bg-muted/30 p-2"
                    >
                      <p className="text-muted-foreground">{row.metric}</p>
                      <p className="font-semibold text-foreground">
                        +{row.delta} pts
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Vector Distribution Bar */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  VECTOR CATEGORY RATIO
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-10 overflow-hidden rounded-lg">
                  <div className="flex w-[17%] items-center justify-center bg-[#f2cc8f] text-xs font-medium text-[#1a2634]">
                    17%
                  </div>
                  <div className="flex w-[20%] items-center justify-center bg-[#e07a5f] text-xs font-medium text-white">
                    20%
                  </div>
                  <div className="flex w-[10%] items-center justify-center bg-[#2b4162] text-xs font-medium text-white">
                    10%
                  </div>
                  <div className="flex w-[38%] items-center justify-center bg-[#81b29a] text-xs font-medium text-[#1a2634]">
                    38%
                  </div>
                  <div className="flex w-[15%] items-center justify-center bg-[#5c9ead] text-xs font-medium text-white">
                    15%
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#f2cc8f]" />
                    <span className="text-xs text-muted-foreground">
                      Safety
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#e07a5f]" />
                    <span className="text-xs text-muted-foreground">
                      Behavior
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#2b4162]" />
                    <span className="text-xs text-muted-foreground">
                      Performance
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#81b29a]" />
                    <span className="text-xs text-muted-foreground">
                      Custom
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#5c9ead]" />
                    <span className="text-xs text-muted-foreground">
                      Experimental
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Animated Single-Vector Scaling */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  VECTOR INTERACTIONS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VectorScalingAnimation vector={exampleVector} />
              </CardContent>
            </Card>

            {/* Traffic & Conversions Table */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  TRAFFIC & CONVERSIONS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Source
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Referral
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Conv
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficData.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="px-3 py-2 text-xs font-medium text-foreground">
                          {row.source}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.referral.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {row.conversions}
                        </td>
                        <td className="px-3 py-2">
                          <div
                            className={`flex items-center gap-1 text-xs ${
                              row.up === true
                                ? "text-[#81b29a]"
                                : row.up === false
                                  ? "text-[#e07a5f]"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {row.up === true && (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            {row.up === false && (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {row.up === null && (
                              <HelpCircle className="h-3 w-3" />
                            )}
                            {row.change}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Modify Steering Button */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              size="lg"
              className="border-[#2b4162] px-12 text-[#2b4162] shadow-md transition-all hover:bg-[#2b4162] hover:text-white hover:shadow-lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Modify Steering
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
