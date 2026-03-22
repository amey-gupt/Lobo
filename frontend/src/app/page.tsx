"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Shield,
  AlertTriangle,
  Skull,
  Smile,
  Scale,
  FileText,
  CheckSquare,
  Zap,
  Brain,
} from "lucide-react";
import { ChatPanel } from "@/components/chat-panel";
import { useMounted } from "@/hooks/use-mounted";
import {
  buildMultipliersPayload,
  formatMultiplier,
  multiplierToSteeringLevel,
  parseMultipliersFromApi,
  steeringLevelToMultiplier,
  steeringStrengthLabel,
  STEERING_LEVEL_MAX,
} from "@/lib/steering-config";

interface SteeringVector {
  id: string;
  /** Action-first label, e.g. “Reduce misleading answers”. */
  actionTitle: string;
  /** One short line—what the steering direction is trying to do (not a guarantee). */
  blurb: string;
  enabled: boolean;
  /** 0…STEERING_LEVEL_MAX → multiplier 0…MAX (see steering-config). */
  level: number;
  category: "safety" | "behavior";
  icon: React.ElementType;
}

const initialVectors: SteeringVector[] = [
  {
    id: "deception",
    actionTitle: "Reduce deception",
    blurb: "Steer away from deceptive patterns.",
    enabled: true,
    level: 9,
    category: "safety",
    icon: Shield,
  },
  {
    id: "toxicity",
    actionTitle: "Reduce toxicity",
    blurb: "Push away from toxic language.",
    enabled: true,
    level: 10,
    category: "safety",
    icon: AlertTriangle,
  },
  {
    id: "danger",
    actionTitle: "Reduce danger",
    blurb: "Nudge away from harmful content.",
    enabled: true,
    level: 10,
    category: "safety",
    icon: Skull,
  },
  {
    id: "happiness",
    actionTitle: "Boost warmth",
    blurb: "Steer toward a warmer tone.",
    enabled: true,
    level: 7,
    category: "behavior",
    icon: Smile,
  },
  {
    id: "bias",
    actionTitle: "Reduce bias",
    blurb: "Steer against one-sided framing.",
    enabled: true,
    level: 8,
    category: "behavior",
    icon: Scale,
  },
  {
    id: "formality",
    actionTitle: "Increase formality",
    blurb: "Move toward formal language.",
    enabled: false,
    level: 6,
    category: "behavior",
    icon: FileText,
  },
  {
    id: "compliance",
    actionTitle: "Boost policy safety",
    blurb: "Nudge toward policy-safe wording.",
    enabled: true,
    level: 11,
    category: "behavior",
    icon: CheckSquare,
  },
];

const categoryConfig = {
  safety: {
    bg: "bg-[#e07a5f]",
    light: "bg-[#f4a68f]/40",
    text: "text-white",
    darkText: "text-[#1a2634]",
  },
  behavior: {
    bg: "bg-[#2b4162]",
    light: "bg-[#2b4162]/20",
    text: "text-white",
    darkText: "text-[#1a2634]",
  },
};

const categoryLabels = {
  safety: "Safety",
  behavior: "Behavior",
};

/** No buttons/inputs: avoids hydration mismatches when extensions inject attributes (e.g. fdprocessedid) before React hydrates. */
function SteeringPageSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <div
        className="fixed left-0 top-0 z-40 h-screen w-[72px] bg-sidebar"
        aria-hidden
      />
      <div className="ml-[72px] flex flex-1 flex-col">
        <div className="h-16 border-b border-border bg-card" aria-hidden />
        <main className="flex-1 overflow-auto p-6" aria-hidden>
          <div className="mb-6 h-4 w-48 animate-pulse rounded bg-muted/50" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
            <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
            <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
          </div>
          <div className="mt-8 h-64 animate-pulse rounded-lg bg-muted/20" />
        </main>
      </div>
    </div>
  );
}

function mergeVectorsFromMultipliers(
  base: SteeringVector[],
  multipliers: Record<string, number>,
): SteeringVector[] {
  return base.map((v) => {
    const { enabled, level } = multiplierToSteeringLevel(
      multipliers[v.id] ?? 0,
    );
    return { ...v, enabled, level };
  });
}

function SteeringDashboard() {
  const router = useRouter();
  const [vectors, setVectors] = useState<SteeringVector[]>(initialVectors);
  const [configLoading, setConfigLoading] = useState(true);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const debug = process.env.NODE_ENV === "development";
    (async () => {
      if (debug) {
        console.log(
          "[Lobo admin] GET /api/admin/config → fetching (Modal config hydrate)",
        );
      }
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) {
          if (debug)
            console.log(
              "[Lobo admin] GET /api/admin/config → aborted (unmounted)",
            );
          return;
        }
        if (debug) {
          console.log("[Lobo admin] GET /api/admin/config ← response", {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
          });
        }
        if (!res.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : `Could not load config (${res.status})`;
          console.warn("[Lobo admin] GET /api/admin/config failed", {
            status: res.status,
            body: data,
          });
          toast.error(msg);
          return;
        }
        const multipliers = parseMultipliersFromApi(data);
        if (debug) {
          console.log(
            "[Lobo admin] GET /api/admin/config ← parsed multipliers (UI will merge)",
            multipliers,
          );
        }
        setVectors((prev) => mergeVectorsFromMultipliers(prev, multipliers));
      } catch (err) {
        if (!cancelled) {
          console.error(
            "[Lobo admin] GET /api/admin/config → network or parse error",
            err,
          );
          toast.error("Failed to reach admin config API");
        }
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleVector = (id: string) => {
    setVectors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, enabled: !v.enabled } : v)),
    );
  };

  const updateLevel = (id: string, level: number) => {
    setVectors((prev) => prev.map((v) => (v.id === id ? { ...v, level } : v)));
  };

  const handleSubmit = useCallback(async () => {
    setApplyLoading(true);
    try {
      const multipliers = buildMultipliersPayload(vectors);
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multipliers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.detail === "string"
              ? data.detail
              : `Apply failed (${res.status})`;
        toast.error(msg);
        return;
      }
      toast.success("Steering config applied on Modal");
      sessionStorage.setItem("steeringVectors", JSON.stringify(vectors));
      router.push("/metrics");
    } catch {
      toast.error("Network error while applying config");
    } finally {
      setApplyLoading(false);
    }
  }, [vectors, router]);

  const enabledCount = vectors.filter((v) => v.enabled).length;
  const enabledList = vectors.filter((v) => v.enabled);
  const avgMultiplier =
    enabledList.length === 0
      ? 0
      : enabledList.reduce(
          (sum, v) => sum + steeringLevelToMultiplier(v.enabled, v.level),
          0,
        ) / enabledList.length;
  const peakMultiplier = Math.max(
    0,
    ...vectors.map((v) => steeringLevelToMultiplier(v.enabled, v.level)),
  );

  const categories = ["safety", "behavior"] as const;

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <ChatPanel />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader title="LOBO" />

        <main className="flex-1 overflow-auto p-6">
          {configLoading && (
            <p
              className="mb-4 text-xs text-muted-foreground"
              aria-live="polite"
            >
              Loading steering config from Modal…
            </p>
          )}
          {/* Overview */}
          <section className="mb-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              OVERVIEW
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 bg-[#e07a5f] text-white shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <Shield className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-90">
                    Controls turned on
                  </p>
                  <p className="text-3xl font-bold">{enabledCount}</p>
                  <p className="mt-2 text-center text-xs opacity-80">
                    How many controls are active right now
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#f4a68f] text-[#1a2634] shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/30">
                    <Zap className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-80">
                    Average strength
                  </p>
                  <p className="text-3xl font-bold">
                    {avgMultiplier.toFixed(2)}×
                  </p>
                  <p className="mt-2 text-center text-xs opacity-80">
                    The typical level across active controls
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#f2cc8f] text-[#1a2634] shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/30">
                    <Brain className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-80">
                    Strongest setting
                  </p>
                  <p className="text-3xl font-bold">
                    {peakMultiplier.toFixed(2)}×
                  </p>
                  <p className="mt-2 text-center text-xs opacity-80">
                    The highest level on any active control
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Active mix */}
          <section className="mb-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              ACTIVE MIX BY CATEGORY
            </h2>
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex h-10 overflow-hidden rounded-lg">
                  {categories.map((cat) => {
                    const catVectors = vectors.filter(
                      (v) => v.category === cat && v.enabled,
                    );
                    const percentage =
                      Math.round((catVectors.length / enabledCount) * 100) || 0;
                    return (
                      <div
                        key={cat}
                        className={`${categoryConfig[cat].bg} flex items-center justify-center ${categoryConfig[cat].text}`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 15 && (
                          <span className="text-sm font-medium">
                            {percentage}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-6">
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center gap-2">
                      <div
                        className={`h-3 w-3 rounded-full ${categoryConfig[cat].bg}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {categoryLabels[cat]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Steering */}
          <section className="mb-4">
            <Card className="items-center gap-0 border-0 shadow-md">
              <CardHeader className="w-full items-center pb-0">
                <CardTitle className="flex items-center justify-center gap-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-[#e07a5f]" />
                  STEERING
                </CardTitle>
              </CardHeader>
              <CardContent className="flex w-full justify-center pt-0">
                <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
                  Each control sets a{" "}
                  <span className="font-medium text-foreground">
                    coefficient
                  </span>{" "}
                  on a learned direction—not a literal “percent of concept” in
                  the text. Stronger steering nudges the model; it does not
                  guarantee removal or safety. The far end can{" "}
                  <span className="font-medium text-foreground">
                    hurt fluency
                  </span>{" "}
                  or make outputs worse.
                </p>
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {categories.map((category) => {
              const categoryVectors = vectors.filter(
                (v) => v.category === category,
              );
              return (
                <Card key={category} className="border-0 shadow-md">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <div
                        className={`h-2 w-2 rounded-full ${categoryConfig[category].bg}`}
                      />
                      {categoryLabels[category]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categoryVectors.map((vector) => {
                      const mult = formatMultiplier(
                        vector.enabled,
                        vector.level,
                      );
                      const label = steeringStrengthLabel(vector.level);
                      const highLoad = vector.enabled && vector.level >= 10;
                      return (
                        <div
                          key={vector.id}
                          className={`rounded-xl p-4 transition-all ${
                            vector.enabled
                              ? categoryConfig[category].light
                              : "bg-muted"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                  vector.enabled
                                    ? categoryConfig[category].bg
                                    : "bg-muted-foreground/20"
                                } ${vector.enabled ? categoryConfig[category].text : "text-muted-foreground"}`}
                              >
                                <vector.icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={`font-medium leading-snug ${vector.enabled ? "text-foreground" : "text-muted-foreground"}`}
                                >
                                  {vector.actionTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {vector.blurb}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                On
                              </span>
                              <Switch
                                checked={vector.enabled}
                                onCheckedChange={() => toggleVector(vector.id)}
                                aria-label={`Enable steering for ${vector.id}`}
                              />
                            </div>
                          </div>
                          {vector.enabled && (
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>Subtle</span>
                                <span className="text-[10px] uppercase tracking-wider">
                                  → stronger nudge →
                                </span>
                                <span className="text-amber-700 dark:text-amber-500">
                                  Max (risky)
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Slider
                                  value={[vector.level]}
                                  onValueChange={([val]) =>
                                    updateLevel(vector.id, val)
                                  }
                                  max={STEERING_LEVEL_MAX}
                                  step={1}
                                  className="min-w-[120px] flex-1"
                                  aria-valuetext={`${label}, ${mult}`}
                                />
                                <div className="flex w-[2.5rem] flex-col items-end text-right">
                                  <span className="text-lg font-semibold tabular-nums text-foreground">
                                    {mult}
                                  </span>
                                </div>
                              </div>
                              {highLoad && (
                                <div className="text-right">
                                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                    {label} · may garble
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={applyLoading || configLoading}
              size="lg"
              className="bg-[#e07a5f] px-12 text-white shadow-lg transition-all hover:bg-[#d06a4f] hover:shadow-xl"
            >
              {applyLoading ? "Applying…" : "Apply"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SteeringPage() {
  const mounted = useMounted();
  if (!mounted) {
    return <SteeringPageSkeleton />;
  }
  return <SteeringDashboard />;
}
