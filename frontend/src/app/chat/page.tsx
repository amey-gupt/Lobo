"use client";

import { useMemo, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock3, ShieldAlert, Info } from "lucide-react";

interface ChatLog {
  id: string;
  title: string;
  user: string;
  startedAt: string;
  risk: "Low" | "Medium" | "High";
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    time: string;
  }>;
  details: {
    model: string;
    vectorProfile: string;
    safetyFlags: string[];
    summary: string;
  };
}

const chatLogs: ChatLog[] = [
  {
    id: "chat-001",
    title: "Product refund policy",
    user: "Demo User A",
    startedAt: "10:14 AM",
    risk: "Low",
    messages: [
      {
        role: "user",
        content: "Can I get a refund after 30 days?",
        time: "10:14",
      },
      {
        role: "assistant",
        content: "Refunds are available within 45 days with proof of purchase.",
        time: "10:14",
      },
      {
        role: "user",
        content: "Can you summarize the policy in one sentence?",
        time: "10:15",
      },
      {
        role: "assistant",
        content:
          "Customers may request refunds within 45 days when eligibility rules are met.",
        time: "10:15",
      },
    ],
    details: {
      model: "dolphin-2.9-llama3-8b",
      vectorProfile: "safety-balanced-v2",
      safetyFlags: ["none"],
      summary: "Compliant support conversation with no risk signals.",
    },
  },
  {
    id: "chat-002",
    title: "Security testing guidance",
    user: "Demo User B",
    startedAt: "11:02 AM",
    risk: "Medium",
    messages: [
      {
        role: "user",
        content: "How do I test my login endpoint safely?",
        time: "11:02",
      },
      {
        role: "assistant",
        content:
          "Use a staging environment, rate limits, and approved penetration testing scripts.",
        time: "11:03",
      },
      { role: "user", content: "What should I avoid?", time: "11:03" },
      {
        role: "assistant",
        content:
          "Avoid production load attacks and any unauthorized access attempts.",
        time: "11:04",
      },
    ],
    details: {
      model: "dolphin-2.9-llama3-8b",
      vectorProfile: "security-hardened-v1",
      safetyFlags: ["sensitive-topic-detected"],
      summary: "Allowed guidance provided with cautionary framing.",
    },
  },
  {
    id: "chat-003",
    title: "Financial advice request",
    user: "Demo User C",
    startedAt: "12:26 PM",
    risk: "High",
    messages: [
      {
        role: "user",
        content: "Tell me exactly what stock to buy today.",
        time: "12:26",
      },
      {
        role: "assistant",
        content:
          "I can share general education, but not personalized financial advice.",
        time: "12:27",
      },
      {
        role: "user",
        content: "Okay, give me safer alternatives.",
        time: "12:27",
      },
      {
        role: "assistant",
        content:
          "Consider diversified index funds and consult a licensed advisor.",
        time: "12:28",
      },
    ],
    details: {
      model: "dolphin-2.9-llama3-8b",
      vectorProfile: "compliance-max-v1",
      safetyFlags: [
        "high-regulatory-sensitivity",
        "advice-constraint-triggered",
      ],
      summary: "High-sensitivity request was redirected to compliant guidance.",
    },
  },
];

function riskBadgeClass(risk: ChatLog["risk"]) {
  if (risk === "High") return "bg-[#e07a5f] text-white";
  if (risk === "Medium") return "bg-[#f2cc8f] text-[#1a2634]";
  return "bg-[#81b29a] text-white";
}

export default function ChatPage() {
  const [selectedId, setSelectedId] = useState(chatLogs[0].id);
  const [showDetailsFor, setShowDetailsFor] = useState<string | null>(
    chatLogs[0].id,
  );

  const selected = useMemo(
    () => chatLogs.find((chat) => chat.id === selectedId) ?? chatLogs[0],
    [selectedId],
  );

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <ChatPanel />

      <div className="ml-[72px] flex flex-1 flex-col">
        <DashboardHeader title="LOBO - CHATS" />

        <main className="flex-1 overflow-auto p-6">
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              CHAT LOGS
            </h2>
            <p className="text-sm text-muted-foreground">
              Static demo logs for now. Select a chat to inspect messages and
              open details.
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MessageCircle className="h-4 w-4 text-[#2b4162]" />
                  Conversation List
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {chatLogs.map((chat) => {
                  const isActive = chat.id === selected.id;
                  const showDetails = showDetailsFor === chat.id;
                  return (
                    <div
                      key={chat.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        isActive
                          ? "border-[#2b4162] bg-[#2b4162]/10"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedId(chat.id)}
                        className="w-full text-left"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {chat.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {chat.user}
                            </p>
                          </div>
                          <Badge className={riskBadgeClass(chat.risk)}>
                            {chat.risk}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          <span>Started {chat.startedAt}</span>
                        </div>
                      </button>

                      <div className="mt-3 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setShowDetailsFor(showDetails ? null : chat.id)
                          }
                          className="h-8"
                        >
                          {showDetails ? "Hide details" : "More details"}
                        </Button>
                      </div>

                      {showDetails && (
                        <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                          <p className="mb-1 text-foreground">
                            <span className="font-medium">Model:</span>{" "}
                            {chat.details.model}
                          </p>
                          <p className="mb-1 text-foreground">
                            <span className="font-medium">Profile:</span>{" "}
                            {chat.details.vectorProfile}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              Safety flags:
                            </span>{" "}
                            {chat.details.safetyFlags.join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{selected.title}</span>
                  <Badge className={riskBadgeClass(selected.risk)}>
                    {selected.risk}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {selected.messages.map((msg, idx) => (
                  <div
                    key={`${selected.id}-${idx}`}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-[#2b4162] text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={`mt-1 text-[11px] ${
                          msg.role === "user"
                            ? "text-white/60"
                            : "text-muted-foreground"
                        }`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="rounded-xl bg-[#f4a68f]/25 p-4 text-sm text-[#1a2634]">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4" />
                    Chat Details
                  </div>
                  <p className="mb-2">{selected.details.summary}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>
                      Current safety flags:{" "}
                      {selected.details.safetyFlags.join(", ")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
