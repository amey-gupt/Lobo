import { NextResponse } from "next/server";
import { evaluateChatLogConcepts } from "@/lib/gemini-flag";
import { supabase } from "@/lib/supabase-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/flag-chat-log
 * Runs Gemini per-concept evaluation and updates `chat_logs` (manual re-evaluate or backfill).
 * Requires SUPABASE_SERVICE_ROLE_KEY for updates.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid chat log id" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY not configured. Add it to .env.local to enable chat log flagging.",
        },
        { status: 503 }
      );
    }

    const { data: log, error: fetchError } = await supabase
      .from("chat_logs")
      .select("id, prompt, response, gemini_flagged_at, gemini_result")
      .eq("id", id)
      .single();

    if (fetchError || !log) {
      return NextResponse.json(
        { error: "Chat log not found", detail: fetchError?.message },
        { status: 404 }
      );
    }

    const gemini_result = await evaluateChatLogConcepts(
      log.prompt || "",
      log.response || ""
    );

    const { error: updateError } = await admin
      .from("chat_logs")
      .update({
        gemini_flagged_at: new Date().toISOString(),
        gemini_result,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update chat_logs with flag:", updateError);
      return NextResponse.json(
        { error: "Failed to save flag result", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result: gemini_result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("flag-chat-log error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
