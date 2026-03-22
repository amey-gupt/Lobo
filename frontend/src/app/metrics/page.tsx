"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  HelpCircle
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  ZAxis
} from "recharts"
import { ChatPanel } from "@/components/chat-panel"
import { steeringLevelToMultiplier } from "@/lib/steering-config"

/** Session snapshot from dashboard; supports legacy `intensity` (0–100) or new `level` (0–12). */
interface SteeringVector {
  id: string
  name?: string
  actionTitle?: string
  enabled: boolean
  intensity?: number
  level?: number
  category: string
}

function approxMultiplier(v: SteeringVector): number {
  if (!v.enabled) return 0
  if (typeof v.level === "number") return steeringLevelToMultiplier(true, v.level)
  if (typeof v.intensity === "number") return (v.intensity / 100) * 3
  return 0
}

// Performance data generation (mock chart scales with avg steering strength)
const generatePerformanceData = (vectors: SteeringVector[]) => {
  const safetyVectors = vectors.filter(v => v.enabled && v.category === "safety")
  const avgSafety =
    safetyVectors.length > 0
      ? safetyVectors.reduce((acc, v) => acc + approxMultiplier(v) * (100 / 3), 0) / safetyVectors.length
      : 50
  
  return [
    { month: "12/23", toxicity: 35, bias: 28, safety: 65 },
    { month: "01/24", toxicity: 30, bias: 25, safety: 70 },
    { month: "02/24", toxicity: 25, bias: 22, safety: 75 },
    { month: "03/24", toxicity: 20, bias: 18, safety: 80 },
    { month: "04/24", toxicity: 15, bias: 15, safety: 85 },
    { month: "05/24", toxicity: Math.max(5, 30 - avgSafety * 0.3), bias: Math.max(8, 25 - avgSafety * 0.2), safety: Math.min(95, avgSafety) },
    { month: "06/24", toxicity: Math.max(3, 28 - avgSafety * 0.3), bias: Math.max(5, 22 - avgSafety * 0.2), safety: Math.min(98, avgSafety + 3) }
  ]
}

const generateDailyReachData = () => [
  { date: "03-04-2024", reach: 1200 },
  { date: "03-05-2024", reach: 1800 },
  { date: "03-06-2024", reach: 1500 },
  { date: "03-07-2024", reach: 2200 },
  { date: "03-08-2024", reach: 2800 },
  { date: "03-09-2024", reach: 3200 },
  { date: "03-10-2024", reach: 3500 }
]

const generateInteractionsData = () => [
  { x: 1, safety: 180, behavior: 220, performance: 150 },
  { x: 2, safety: 200, behavior: 180, performance: 280 },
  { x: 3, safety: 160, behavior: 300, performance: 200 },
  { x: 4, safety: 280, behavior: 250, performance: 320 },
  { x: 5, safety: 220, behavior: 280, performance: 180 },
  { x: 6, safety: 300, behavior: 200, performance: 250 },
  { x: 7, safety: 180, behavior: 320, performance: 280 },
  { x: 8, safety: 250, behavior: 180, performance: 220 },
  { x: 9, safety: 320, behavior: 280, performance: 300 },
  { x: 10, safety: 280, behavior: 250, performance: 180 }
]

const vectorMetrics = [
  { name: "Content Filter", ctr: "0.82%", cost: "$19.16", cpc: "$0.21", progress: 85 },
  { name: "Toxicity Reduction", ctr: "0.11%", cost: "$8.63", cpc: "$1.35", progress: 45 },
  { name: "Helpfulness", ctr: "0.26%", cost: "$12.34", cpc: "$0.87", progress: 60 },
  { name: "Speed Optimization", ctr: "0.09%", cost: "$18.66", cpc: "$0.09", progress: 35 },
  { name: "Accuracy Boost", ctr: "1.01%", cost: "$2.18", cpc: "$0.87", progress: 70 }
]

const trafficData = [
  { source: "Safety Vectors", referral: 804, conversions: 71, change: "+8.12%", up: true },
  { source: "Behavior Vectors", referral: 1090, conversions: 99, change: "+3.10%", up: true },
  { source: "Performance Vectors", referral: 873, conversions: 63, change: "-7.06%", up: false },
  { source: "Custom Vectors", referral: 991, conversions: 112, change: "-3.11%", up: false },
  { source: "Experimental", referral: 915, conversions: 94, change: "+0.90%", up: true },
  { source: "Legacy", referral: 672, conversions: 66, change: "N/A", up: null }
]

export default function MetricsPage() {
  const router = useRouter()
  const [vectors, setVectors] = React.useState<SteeringVector[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    const storedVectors = sessionStorage.getItem("steeringVectors")
    if (storedVectors) {
      setVectors(JSON.parse(storedVectors))
    } else {
      setVectors([
        { id: "content-filter", name: "Content Filter", enabled: true, intensity: 75, category: "safety" },
        { id: "toxicity-reduction", name: "Toxicity Reduction", enabled: true, intensity: 80, category: "safety" },
        { id: "helpfulness", name: "Helpfulness", enabled: true, intensity: 85, category: "behavior" },
        { id: "creativity", name: "Creativity", enabled: false, intensity: 50, category: "behavior" },
        { id: "conciseness", name: "Conciseness", enabled: true, intensity: 60, category: "behavior" },
        { id: "speed-optimization", name: "Speed Optimization", enabled: true, intensity: 70, category: "performance" },
        { id: "accuracy-boost", name: "Accuracy Boost", enabled: true, intensity: 90, category: "performance" }
      ])
    }
  }, [])

  if (!mounted) return null

  const performanceData = generatePerformanceData(vectors)
  const dailyReachData = generateDailyReachData()
  const interactionsData = generateInteractionsData()
  
  const enabledCount = vectors.filter(v => v.enabled).length
  const avgMultiplier =
    enabledCount === 0
      ? 0
      : vectors.filter(v => v.enabled).reduce((sum, v) => sum + approxMultiplier(v), 0) / enabledCount

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <ChatPanel />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader title="LOBO - METRICS" />

        <main className="flex-1 overflow-auto p-6">
          {/* Top Row - Key Metrics and Vector Summary */}
          <div className="mb-6 grid gap-6 lg:grid-cols-5">
            {/* Key Metrics Cards */}
            <div className="lg:col-span-2">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                KEY STEERING METRICS
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-0 bg-[#e07a5f] text-white shadow-md">
                  <CardContent className="flex flex-col items-center p-4">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Shield className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium opacity-90">Active</p>
                    <p className="text-2xl font-bold">{enabledCount}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <ArrowUp className="h-3 w-3" />
                      <span>+2</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-[#f4a68f] text-[#1a2634] shadow-md">
                  <CardContent className="flex flex-col items-center p-4">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
                      <Zap className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium opacity-80">Avg ×</p>
                    <p className="text-2xl font-bold">{avgMultiplier.toFixed(2)}×</p>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <ArrowUp className="h-3 w-3" />
                      <span>+5.2%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-[#f2cc8f] text-[#1a2634] shadow-md">
                  <CardContent className="flex flex-col items-center p-4">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/30">
                      <Brain className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium opacity-80">Health</p>
                    <p className="text-2xl font-bold">92%</p>
                    <div className="mt-1 flex items-center gap-1 text-xs text-[#e07a5f]">
                      <ArrowDown className="h-3 w-3" />
                      <span>-1.2%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Vector Performance Summary Table */}
            <div className="lg:col-span-3">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                VECTOR PERFORMANCE SUMMARY
              </h2>
              <Card className="border-0 shadow-md">
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vector</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">CTR</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cost/Conv</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">CPC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vectorMetrics.map((metric, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 text-sm font-medium text-foreground">{metric.name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{metric.ctr}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-[#2b4162]">
                                <div 
                                  className="h-full bg-[#81b29a]" 
                                  style={{ width: `${metric.progress}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground">{metric.cost}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{metric.cpc}</td>
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
                    <span className="text-xs text-muted-foreground">safety</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#e07a5f]" />
                    <span className="text-xs text-muted-foreground">toxicity</span>
                  </div>
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="safety" fill="#81b29a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="toxicity" fill="#e07a5f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Area Chart - Daily Reach */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  DAILY MODEL REACH
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyReachData}>
                      <defs>
                        <linearGradient id="reachGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f4a68f" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#f4a68f" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="reach" 
                        stroke="#e07a5f" 
                        strokeWidth={2}
                        fill="url(#reachGradient)" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="reach" 
                        stroke="#1a2634" 
                        strokeWidth={2}
                        dot={{ fill: '#1a2634', strokeWidth: 2, r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
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
                  <div className="flex w-[17%] items-center justify-center bg-[#f2cc8f] text-xs font-medium text-[#1a2634]">17%</div>
                  <div className="flex w-[20%] items-center justify-center bg-[#e07a5f] text-xs font-medium text-white">20%</div>
                  <div className="flex w-[10%] items-center justify-center bg-[#2b4162] text-xs font-medium text-white">10%</div>
                  <div className="flex w-[38%] items-center justify-center bg-[#81b29a] text-xs font-medium text-[#1a2634]">38%</div>
                  <div className="flex w-[15%] items-center justify-center bg-[#5c9ead] text-xs font-medium text-white">15%</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#f2cc8f]" />
                    <span className="text-xs text-muted-foreground">Safety</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#e07a5f]" />
                    <span className="text-xs text-muted-foreground">Behavior</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#2b4162]" />
                    <span className="text-xs text-muted-foreground">Performance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#81b29a]" />
                    <span className="text-xs text-muted-foreground">Custom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#5c9ead]" />
                    <span className="text-xs text-muted-foreground">Experimental</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scatter Chart - Interactions */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  VECTOR INTERACTIONS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#5c9ead]" />
                    <span className="text-xs text-muted-foreground">Safety</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#e07a5f]" />
                    <span className="text-xs text-muted-foreground">Behavior</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#1a2634]" />
                    <span className="text-xs text-muted-foreground">Performance</span>
                  </div>
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        type="number"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Scatter name="Safety" data={interactionsData} dataKey="safety" fill="#5c9ead" />
                      <Scatter name="Behavior" data={interactionsData} dataKey="behavior" fill="#e07a5f" />
                      <Scatter name="Performance" data={interactionsData} dataKey="performance" fill="#1a2634" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
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
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Referral</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Conv</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-2 text-xs font-medium text-foreground">{row.source}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.referral.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.conversions}</td>
                        <td className="px-3 py-2">
                          <div className={`flex items-center gap-1 text-xs ${
                            row.up === true ? 'text-[#81b29a]' : 
                            row.up === false ? 'text-[#e07a5f]' : 
                            'text-muted-foreground'
                          }`}>
                            {row.up === true && <TrendingUp className="h-3 w-3" />}
                            {row.up === false && <TrendingDown className="h-3 w-3" />}
                            {row.up === null && <HelpCircle className="h-3 w-3" />}
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
  )
}
