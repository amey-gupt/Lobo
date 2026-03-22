"use client";

import { useMemo, useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock3, Info } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

interface ChatLog {
  id: string;
  title: string;
  user: string;
  startedAt: string;
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
    multipliers?: Record<string, number>;
  };
}

function formatMultipliers(multipliers: Record<string, number> | undefined) {
  if (!multipliers) return [];
  return Object.entries(multipliers)
    .filter(([_, value]) => value !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: value.toFixed(2),
    }));
}




export default function ChatPage() {
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailsFor, setShowDetailsFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("chat_logs")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }

        // Transform Supabase data to ChatLog format
        const formatted = (data || []).map((log: any) => {
          const createdAt = new Date(log.created_at);
          const timeStr = createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const promptPreview = log.prompt?.substring(0, 50) || "Untitled";
          const multipliers = typeof log.multipliers === "string" ? JSON.parse(log.multipliers) : log.multipliers;

          return {
            id: log.id,
            title: promptPreview,
            user: log.session_id || "User",
            startedAt: timeStr,
            messages: [
              {
                role: "user" as const,
                content: log.prompt || "",
                time: timeStr,
              },
              {
                role: "assistant" as const,
                content: log.response || "",
                time: timeStr,
              },
            ],
            details: {
              model: "dolphin-2.9-llama3-8b",
              vectorProfile: "default",
              safetyFlags: [],
              summary: "Steering Multipliers",
              multipliers: multipliers || {},
            },
          };
        });

        setChatLogs(formatted);
        if (formatted.length > 0) {
          setSelectedId(formatted[0].id);
          setShowDetailsFor(formatted[0].id);
        }
      } catch (err) {
        console.error("Failed to load chat logs:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(
    () => (chatLogs.length > 0) ? (chatLogs.find((chat) => chat.id === selectedId) ?? chatLogs[0]) : null,
    [selectedId, chatLogs],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <ChatPanel />
        <div className="ml-[72px] flex flex-1 flex-col">
          <DashboardHeader title="LOBO - CHATS" />
          <main className="flex-1 p-6">
            <p className="text-muted-foreground">Loading chat logs...</p>
          </main>
        </div>
      </div>
    );
  }

  if (chatLogs.length === 0) {
    return (
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar />
        <ChatPanel />
        <div className="ml-[72px] flex flex-1 flex-col">
          <DashboardHeader title="LOBO - CHATS" />
          <main className="flex-1 p-6">
            <p className="text-muted-foreground">No chat logs found.</p>
          </main>
        </div>
      </div>
    );
  }

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
              Real-time logs from Supabase. Select a chat to inspect messages and view steering multipliers.
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
                        <div className="mb-2 flex flex-col gap-1">
                          <p className="text-sm font-semibold text-foreground">
                            {chat.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {chat.user}
                          </p>
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
                          <p className="text-foreground">
                            <span className="font-medium">Multipliers:</span>{" "}
                            {chat.details.summary}
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
                <CardTitle className="text-sm">
                  {selected?.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {selected ? (
                  <>
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
                      <div className="mb-3 flex items-center gap-2 font-semibold">
                        <Info className="h-4 w-4" />
                        Steering Multipliers
                      </div>
                      <div className="space-y-1.5">
                        {formatMultipliers(selected.details.multipliers).length > 0 ? (
                          formatMultipliers(selected.details.multipliers).map((m) => (
                            <div key={m.name} className="flex justify-between items-center text-xs">
                              <span className="text-[#1a2634]/80">{m.name}</span>
                              <span className="font-semibold text-[#1a2634]">{m.value}×</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#1a2634]/60">No active multipliers</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a chat to view details</p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
