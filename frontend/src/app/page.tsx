"use client"

import { useCallback, useEffect, useState } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Shield, AlertTriangle, Skull, Smile, Scale, FileText, CheckSquare, ArrowUp, ArrowDown, Zap, Brain } from "lucide-react"
import { ChatPanel } from "@/components/chat-panel"
import { useMounted } from "@/hooks/use-mounted"
import {
  buildMultipliersPayload,
  multiplierToIntensity,
  parseMultipliersFromApi,
} from "@/lib/steering-config"

interface SteeringVector {
  id: string
  name: string
  description: string
  enabled: boolean
  intensity: number
  category: "safety" | "behavior"
  icon: React.ElementType
  trend?: { value: number; direction: "up" | "down" }
}

const initialVectors: SteeringVector[] = [
  {
    id: "deception",
    name: "Deception",
    description: "Detect and reduce deceptive content",
    enabled: true,
    intensity: 75,
    category: "safety",
    icon: Shield,
    trend: { value: 12, direction: "up" },
  },
  {
    id: "toxicity",
    name: "Toxicity",
    description: "Reduce toxic language patterns",
    enabled: true,
    intensity: 80,
    category: "safety",
    icon: AlertTriangle,
    trend: { value: 8, direction: "up" },
  },
  {
    id: "danger",
    name: "Danger",
    description: "Filter dangerous or harmful content",
    enabled: true,
    intensity: 85,
    category: "safety",
    icon: Skull,
    trend: { value: 15, direction: "up" },
  },
  {
    id: "happiness",
    name: "Happiness",
    description: "Adjust positive sentiment in responses",
    enabled: true,
    intensity: 60,
    category: "behavior",
    icon: Smile,
    trend: { value: 7, direction: "up" },
  },
  {
    id: "bias",
    name: "Bias",
    description: "Detect and mitigate response biases",
    enabled: true,
    intensity: 70,
    category: "behavior",
    icon: Scale,
    trend: { value: 5, direction: "up" },
  },
  {
    id: "formality",
    name: "Formality",
    description: "Control formal vs casual tone",
    enabled: false,
    intensity: 50,
    category: "behavior",
    icon: FileText,
    trend: { value: 3, direction: "down" },
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "Ensure regulatory and policy compliance",
    enabled: true,
    intensity: 90,
    category: "behavior",
    icon: CheckSquare,
    trend: { value: 10, direction: "up" },
  },
]

const categoryConfig = {
  safety: { bg: "bg-[#e07a5f]", light: "bg-[#f4a68f]/40", text: "text-white", darkText: "text-[#1a2634]" },
  behavior: { bg: "bg-[#2b4162]", light: "bg-[#2b4162]/20", text: "text-white", darkText: "text-[#1a2634]" },
}

const categoryLabels = {
  safety: "Safety",
  behavior: "Behavior",
}

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
  )
}

function mergeVectorsFromMultipliers(
  base: SteeringVector[],
  multipliers: Record<string, number>
): SteeringVector[] {
  return base.map((v) => {
    const { enabled, intensity } = multiplierToIntensity(multipliers[v.id] ?? 0)
    return { ...v, enabled, intensity }
  })
}

function SteeringDashboard() {
  const router = useRouter()
  const { user, isLoading } = useUser()
  const [vectors, setVectors] = useState<SteeringVector[]>(initialVectors)
  const [configLoading, setConfigLoading] = useState(true)
  const [applyLoading, setApplyLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/config", { cache: "no-store" })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : `Could not load config (${res.status})`
          toast.error(msg)
          return
        }
        const multipliers = parseMultipliersFromApi(data)
        setVectors((prev) => mergeVectorsFromMultipliers(prev, multipliers))
      } catch {
        if (!cancelled) toast.error("Failed to reach admin config API")
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleVector = (id: string) => {
    setVectors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, enabled: !v.enabled } : v))
    )
  }

  const updateIntensity = (id: string, intensity: number) => {
    setVectors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, intensity } : v))
    )
  }

  const handleSubmit = useCallback(async () => { // eslint-disable-line react-hooks/exhaustive-deps
    setApplyLoading(true)
    try {
      const multipliers = buildMultipliersPayload(vectors)
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multipliers }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.detail === "string"
              ? data.detail
              : `Apply failed (${res.status})`
        toast.error(msg)
        return
      }
      toast.success("Steering config applied on Modal")
      sessionStorage.setItem("steeringVectors", JSON.stringify(vectors))
      router.push("/metrics")
    } catch {
      toast.error("Network error while applying config")
    } finally {
      setApplyLoading(false)
    }
  }, [vectors, router])

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>

  if (!user) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Lobo Admin</h1>
        <a href="/auth/login" className="rounded-lg bg-[#e07a5f] px-6 py-3 text-white hover:bg-[#d06a4f]">
          Login
        </a>
      </div>
    </div>
  )

  const enabledCount = vectors.filter((v) => v.enabled).length
  const avgIntensity = Math.round(
    vectors.filter((v) => v.enabled).reduce((sum, v) => sum + v.intensity, 0) /
      (enabledCount || 1)
  )

  const categories = ["safety", "behavior"] as const

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <ChatPanel />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader title="LOBO" />

        <main className="flex-1 overflow-auto p-6">
          {configLoading && (
            <p className="mb-4 text-xs text-muted-foreground" aria-live="polite">
              Loading steering config from Modal…
            </p>
          )}
          {/* Key Metrics */}
          <section className="mb-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              KEY STEERING METRICS
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0 bg-[#e07a5f] text-white shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                    <Shield className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-90">Active Vectors</p>
                  <p className="text-3xl font-bold">{enabledCount}</p>
                  <div className="mt-2 flex items-center gap-1 text-sm">
                    <ArrowUp className="h-4 w-4" />
                    <span>+2</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#f4a68f] text-[#1a2634] shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/30">
                    <Zap className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-80">Avg Intensity</p>
                  <p className="text-3xl font-bold">{avgIntensity}%</p>
                  <div className="mt-2 flex items-center gap-1 text-sm">
                    <ArrowUp className="h-4 w-4" />
                    <span>+5.2%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#f2cc8f] text-[#1a2634] shadow-md">
                <CardContent className="flex flex-col items-center p-6">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/30">
                    <Brain className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium opacity-80">Model Health</p>
                  <p className="text-3xl font-bold">92%</p>
                  <div className="mt-2 flex items-center gap-1 text-sm text-[#e07a5f]">
                    <ArrowDown className="h-4 w-4" />
                    <span>-1.2%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Vector Distribution */}
          <section className="mb-8">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              VECTOR DISTRIBUTION
            </h2>
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex h-10 overflow-hidden rounded-lg">
                  {categories.map((cat) => {
                    const catVectors = vectors.filter((v) => v.category === cat && v.enabled)
                    const percentage = Math.round((catVectors.length / enabledCount) * 100) || 0
                    return (
                      <div
                        key={cat}
                        className={`${categoryConfig[cat].bg} flex items-center justify-center ${categoryConfig[cat].text}`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 15 && (
                          <span className="text-sm font-medium">{percentage}%</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-6">
                  {categories.map((cat) => (
                    <div key={cat} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${categoryConfig[cat].bg}`} />
                      <span className="text-sm text-muted-foreground">{categoryLabels[cat]}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Steering Vectors by Category */}
          <div className="grid gap-6 lg:grid-cols-2">
            {categories.map((category) => {
              const categoryVectors = vectors.filter((v) => v.category === category)
              return (
                <Card key={category} className="border-0 shadow-md">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <div className={`h-2 w-2 rounded-full ${categoryConfig[category].bg}`} />
                      {categoryLabels[category]} Vectors
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categoryVectors.map((vector) => (
                      <div
                        key={vector.id}
                        className={`rounded-xl p-4 transition-all ${
                          vector.enabled ? categoryConfig[category].light : "bg-muted"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                                vector.enabled ? categoryConfig[category].bg : "bg-muted-foreground/20"
                              } ${vector.enabled ? categoryConfig[category].text : "text-muted-foreground"}`}
                            >
                              <vector.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className={`font-medium ${vector.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                                {vector.name}
                              </p>
                              <p className="text-xs text-muted-foreground">{vector.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={vector.enabled}
                            onCheckedChange={() => toggleVector(vector.id)}
                          />
                        </div>
                        {vector.enabled && (
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[vector.intensity]}
                              onValueChange={([val]) => updateIntensity(vector.id, val)}
                              max={100}
                              step={5}
                              className="flex-1"
                            />
                            <span className="w-12 text-right text-sm font-medium text-foreground">
                              {vector.intensity}%
                            </span>
                            {vector.trend && (
                              <div
                                className={`flex items-center gap-1 text-xs ${
                                  vector.trend.direction === "up" ? "text-[#81b29a]" : "text-[#e07a5f]"
                                }`}
                              >
                                {vector.trend.direction === "up" ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {vector.trend.value}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
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
  )
}

export default function SteeringPage() {
  const mounted = useMounted()
  if (!mounted) {
    return <SteeringPageSkeleton />
  }
  return <SteeringDashboard />
}
