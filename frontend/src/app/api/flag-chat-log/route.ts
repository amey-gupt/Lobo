import { NextResponse } from "next/server";
import { flagChatLogForAdmin } from "@/lib/gemini-flag";
import { supabase } from "@/lib/supabase-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/flag-chat-log
 * Flags a single chat log with Gemini for admin review.
 * Only processes logs that haven't been flagged yet (gemini_flagged_at is null).
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

    if (log.gemini_flagged_at) {
      return NextResponse.json({
        ok: true,
        alreadyFlagged: true,
        result: log.gemini_result,
      });
    }

    const result = await flagChatLogForAdmin(
      log.prompt || "",
      log.response || "",
      "Cowboy Cafe - a western-themed restaurant chatbot"
    );

    const { error: updateError } = await admin
      .from("chat_logs")
      .update({
        gemini_flagged_at: new Date().toISOString(),
        gemini_result: result,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to update chat_logs with flag:", updateError);
      return NextResponse.json(
        { error: "Failed to save flag result", detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("flag-chat-log error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
