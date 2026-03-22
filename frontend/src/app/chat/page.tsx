"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { ChatPanel } from "@/components/chat-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock3, Info, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import type { GeminiResultV1 } from "@/lib/gemini-result-types";
import { isGeminiResultV1 } from "@/lib/gemini-result-types";
import { CONCEPT_IDS, CONCEPT_LABELS, type ConceptId } from "@/lib/steering-concepts";
import { requestChatReplayFromLog } from "@/lib/chat-panel-replay";
import { toast } from "sonner";

interface ChatLog {
  id: string;
  title: string;
  /** Subtitle in list: session id or placeholder */
  user: string;
  /** Short time for message bubbles (same moment for both turns in a log row) */
  startedAt: string;
  /** Full timestamp from `created_at` for detail panels */
  createdAtDisplay: string;
  sessionId: string | null;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    time: string;
  }>;
  /** Normalized from `multipliers` jsonb (all concept keys, including zeros) */
  multipliers: Record<string, number>;
  details: {
    model: string;
    vectorProfile: string;
    safetyFlags: string[];
    summary: string;
    multipliers?: Record<string, number>;
  };
  geminiResult?: GeminiResultV1 | null;
  geminiFlagging?: boolean;
  geminiFlaggedAt?: string | null;
}

function parseGeminiResult(raw: unknown): GeminiResultV1 | null {
  if (!raw) return null;
  const obj =
    typeof raw === "string"
      ? (JSON.parse(raw) as unknown)
      : raw;
  return isGeminiResultV1(obj) ? obj : null;
}

/** Normalize `chat_logs.multipliers` jsonb to one float per known concept. */
function normalizeMultipliersFromRow(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of CONCEPT_IDS) {
    out[id] = 0;
  }
  if (!raw || typeof raw !== "object") return out;
  const o = raw as Record<string, unknown>;
  for (const id of CONCEPT_IDS) {
    const v = o[id];
    if (typeof v === "number" && !Number.isNaN(v)) {
      out[id] = v;
    }
  }
  return out;
}

function mapRowToChatLog(log: Record<string, unknown>): ChatLog {
  const createdRaw = log.created_at;
  const createdAt =
    createdRaw instanceof Date
      ? createdRaw
      : new Date(
          typeof createdRaw === "string" || typeof createdRaw === "number"
            ? createdRaw
            : String(createdRaw ?? ""),
        );
  const timeStr = Number.isNaN(createdAt.getTime())
    ? "—"
    : createdAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
  const createdAtDisplay = Number.isNaN(createdAt.getTime())
    ? "Unknown"
    : createdAt.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });

  const promptPreview =
    typeof log.prompt === "string"
      ? log.prompt.substring(0, 50)
      : "Untitled";
  const rawMultipliers =
    typeof log.multipliers === "string"
      ? (JSON.parse(log.multipliers) as unknown)
      : log.multipliers;
  const multipliers = normalizeMultipliersFromRow(rawMultipliers);
  const gr = parseGeminiResult(log.gemini_result);
  const flaggedAt =
    typeof log.gemini_flagged_at === "string"
      ? log.gemini_flagged_at
      : null;

  const sessionId =
    typeof log.session_id === "string" && log.session_id.trim()
      ? log.session_id.trim()
      : null;

  return {
    id: String(log.id),
    title: promptPreview,
    user: sessionId ?? "No session id",
    startedAt: timeStr,
    createdAtDisplay,
    sessionId,
    messages: [
      {
        role: "user" as const,
        content: typeof log.prompt === "string" ? log.prompt : "",
        time: timeStr,
      },
      {
        role: "assistant" as const,
        content: typeof log.response === "string" ? log.response : "",
        time: timeStr,
      },
    ],
    multipliers,
    details: {
      model: "dolphin-2.9-llama3-8b",
      vectorProfile: "default",
      safetyFlags: [],
      summary: "Steering multipliers stored on this row",
      multipliers,
    },
    geminiResult: gr,
    geminiFlaggedAt: flaggedAt,
  };
}

function flaggedConceptLabels(result: GeminiResultV1 | null | undefined): string[] {
  if (!result?.concepts) return [];
  return CONCEPT_IDS.filter((id) => result.concepts[id] === 1).map(
    (id) => CONCEPT_LABELS[id]
  );
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

/** All concepts with labels, for detail rows (includes zeros). */
function multiplierRowsForDetails(m: Record<string, number>) {
  return CONCEPT_IDS.map((id) => ({
    id,
    label: CONCEPT_LABELS[id],
    value: m[id] ?? 0,
  }));
}

export default function ChatPage() {
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetailsFor, setShowDetailsFor] = useState<string | null>(null);

  const loadChatLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    const formatted = (data || []).map((log: Record<string, unknown>) =>
      mapRowToChatLog(log)
    );
    setChatLogs(formatted);
    setSelectedId((prev) => {
      if (prev && formatted.some((c) => c.id === prev)) return prev;
      return formatted.length > 0 ? formatted[0].id : null;
    });
    if (formatted.length > 0) {
      setShowDetailsFor((prev) =>
        prev && formatted.some((c) => c.id === prev) ? prev : formatted[0].id
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadChatLogs();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadChatLogs]);

  useEffect(() => {
    const channel = supabase
      .channel("chat_logs_gemini")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_logs" },
        () => {
          void loadChatLogs();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadChatLogs]);

  /** Re-run Gemini flags only (no new Modal generation). */
  const rerunGeminiForLog = useCallback(async (log: ChatLog) => {
    setChatLogs((prev) =>
      prev.map((c) =>
        c.id === log.id ? { ...c, geminiFlagging: true } : c
      )
    );
    try {
      const res = await fetch("/api/flag-chat-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id }),
      });
      const data = (await res.json()) as { result?: GeminiResultV1 };
      if (res.ok && data.result) {
        setChatLogs((prev) =>
          prev.map((c) =>
            c.id === log.id
              ? {
                  ...c,
                  geminiResult: data.result ?? null,
                  geminiFlagging: false,
                  geminiFlaggedAt: new Date().toISOString(),
                }
              : c
          )
        );
        toast.success("Gemini evaluation updated");
      } else {
        setChatLogs((prev) =>
          prev.map((c) =>
            c.id === log.id ? { ...c, geminiFlagging: false } : c
          )
        );
        toast.error("Could not re-run Gemini");
      }
    } catch {
      setChatLogs((prev) =>
        prev.map((c) =>
          c.id === log.id ? { ...c, geminiFlagging: false } : c
        )
      );
      toast.error("Could not re-run Gemini");
    }
  }, []);

  /**
   * Opens the floating admin chat, clears it, and sends the log’s user prompt
   * (same as a new customer message → new `chat_logs` row via Modal).
   */
  const replayPromptInAdminChat = useCallback((log: ChatLog) => {
    const prompt =
      log.messages.find((m) => m.role === "user")?.content?.trim() ?? "";
    if (!prompt) {
      toast.error("This log has no user prompt to replay");
      return;
    }
    if (!requestChatReplayFromLog(prompt)) {
      toast.error("Chat panel is not ready. Refresh and try again.");
      return;
    }
    toast.success("Sending prompt in the chat panel…");
  }, []);

  const selected = useMemo(
    () =>
      chatLogs.length > 0
        ? chatLogs.find((chat) => chat.id === selectedId) ?? chatLogs[0]
        : null,
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

  if (!selected) return null;

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
              Logs sync from Supabase; Gemini concept flags are written after each Modal
              generation (or re-run below). Enable Realtime on{" "}
              <code className="text-xs">chat_logs</code> in Supabase for live updates.
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
                  const flags = flaggedConceptLabels(chat.geminiResult);
                  const pendingGemini =
                    !chat.geminiFlaggedAt && !chat.geminiResult;

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
                        type="button"
                      >
                        <div className="mb-2 flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold text-foreground">
                              {chat.title}
                            </p>
                            {chat.geminiFlagging && (
                              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            )}
                            {pendingGemini && !chat.geminiFlagging && (
                              <span className="text-[10px] text-muted-foreground">
                                Gemini pending…
                              </span>
                            )}
                            {flags.length > 0 && (
                              <Badge
                                variant="destructive"
                                className="gap-0.5 text-[10px]"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {flags.join(", ")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {chat.user}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          <span>Started {chat.startedAt}</span>
                        </div>
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setShowDetailsFor(showDetails ? null : chat.id)
                          }
                          className="h-8"
                          type="button"
                        >
                          {showDetails ? "Hide details" : "More details"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8"
                          type="button"
                          onClick={() => replayPromptInAdminChat(chat)}
                        >
                          Re-evaluate
                        </Button>
                      </div>

                      {showDetails && (
                        <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-muted/60 p-3 text-xs">
                          <div className="space-y-2 text-muted-foreground">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Log ID
                              </span>
                              <span className="font-mono text-[11px]">
                                {chat.id}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Logged at
                              </span>
                              <span className="text-right">{chat.createdAtDisplay}</span>
                            </div>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <span className="shrink-0 font-medium text-foreground">
                                Session id
                              </span>
                              <span
                                className="break-all text-right font-mono text-[11px]"
                                title={chat.sessionId ?? undefined}
                              >
                                {chat.sessionId ?? "—"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Gemini flagged
                              </span>
                              <span className="text-right">
                                {chat.geminiFlaggedAt
                                  ? new Date(
                                      chat.geminiFlaggedAt,
                                    ).toLocaleString(undefined, {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "Pending"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Prompt length
                              </span>
                              <span>
                                {chat.messages[0]?.content?.length ?? 0} chars
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground">
                                Response length
                              </span>
                              <span>
                                {chat.messages[1]?.content?.length ?? 0} chars
                              </span>
                            </div>
                          </div>
                          <div className="border-t border-border/60 pt-2">
                            <p className="mb-2 font-medium text-foreground">
                              Steering multipliers{" "}
                              <span className="font-normal text-muted-foreground">
                                (from Supabase{" "}
                                <code className="text-[10px]">multipliers</code>)
                              </span>
                            </p>
                            <ul className="space-y-1 text-muted-foreground">
                              {multiplierRowsForDetails(chat.multipliers).map(
                                (row) => (
                                  <li
                                    key={row.id}
                                    className="flex justify-between gap-3"
                                  >
                                    <span>{row.label}</span>
                                    <span className="shrink-0 font-mono tabular-nums text-foreground">
                                      {row.value.toFixed(3)}
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="border-b border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm">{selected.title}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      type="button"
                      onClick={() => replayPromptInAdminChat(selected)}
                    >
                      Re-evaluate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={selected.geminiFlagging}
                      onClick={() => void rerunGeminiForLog(selected)}
                    >
                      Re-run Gemini
                    </Button>
                  </div>
                </div>
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

                {selected.geminiFlagging && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Running Gemini evaluation…
                  </div>
                )}

                {!selected.geminiFlagging &&
                  !selected.geminiFlaggedAt &&
                  !selected.geminiResult && (
                    <p className="text-xs text-muted-foreground">
                      Waiting for Gemini evaluation (Modal post-insert)…
                    </p>
                  )}

                {selected.geminiResult && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                      <Info className="h-4 w-4" />
                      Gemini concept flags
                    </div>
                    <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
                      {CONCEPT_IDS.map((id: ConceptId) => (
                        <div
                          key={id}
                          className="flex items-center justify-between rounded-md border border-border/60 bg-background/80 px-2 py-1 text-xs"
                        >
                          <span className="text-muted-foreground">
                            {CONCEPT_LABELS[id]}
                          </span>
                          <Badge
                            variant={
                              selected.geminiResult!.concepts[id] === 1
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {selected.geminiResult!.concepts[id]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {selected.geminiResult.reasoning ? (
                      <p className="text-xs text-muted-foreground">
                        {selected.geminiResult.reasoning}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Model: {selected.geminiResult.model} ·{" "}
                      {selected.geminiResult.evaluated_at}
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-[#f4a68f]/25 p-4 text-sm text-[#1a2634]">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <Info className="h-4 w-4" />
                    Steering Multipliers
                  </div>
                  <div className="space-y-1.5">
                    {formatMultipliers(selected.multipliers).length > 0 ? (
                      formatMultipliers(selected.multipliers).map((m) => (
                        <div
                          key={m.name}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[#1a2634]/80">{m.name}</span>
                          <span className="font-semibold text-[#1a2634]">
                            {m.value}×
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#1a2634]/60">
                        No active multipliers (all zero on this row)
                      </p>
                    )}
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
