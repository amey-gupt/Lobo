"use client"

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Same transport + `/api/chat` behavior as Cowboy Cafe — tests the customer-facing Modal
 * pipeline (LobotomyInference + steering from admin sliders).
 */
export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messageFlags, setMessageFlags] = useState<
    Record<string, { flag: 0 | 1 }>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Flag assistant messages as they arrive
  useEffect(() => {
    const flagMessages = async () => {
      for (const message of messages) {
        if (
          message.role === "assistant" &&
          !messageFlags[message.id] &&
          message.parts.some((p) => p.type === "text")
        ) {
          // Find the user message that prompted this response
          const messageIndex = messages.indexOf(message);
          const userMessage = messages
            .slice(0, messageIndex)
            .reverse()
            .find((m) => m.role === "user");

          if (userMessage) {
            const userText = userMessage.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("");

            const assistantText = message.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("");

            try {
              const response = await fetch("/api/flag-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userMessage: userText,
                  assistantResponse: assistantText,
                  context:
                    "Cowboy Cafe - a western-themed coffee shop and restaurant chatbot",
                }),
              });

              if (response.ok) {
                const data = (await response.json()) as { flag?: 0 | 1 };
                if (data.flag !== undefined) {
                  setMessageFlags((prev) => ({
                    ...prev,
                    [message.id]: { flag: data.flag as 0 | 1 },
                  }));
                }
              }
            } catch (err) {
              console.error("Failed to flag message:", err);
            }
          }
        }
      }
    };

    flagMessages();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestedQuestions = [
    "What's your best coffee?",
    "Do you have vegetarian options?",
    "What are your hours?",
    "Tell me about specials",
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#e07a5f] text-white shadow-lg transition-all hover:scale-105 hover:bg-[#d06a4f] hover:shadow-xl ${
          isOpen ? "pointer-events-none scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        aria-label="Open chat"
        type="button"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <div
        className={`fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border-0 bg-card shadow-2xl transition-all duration-300 ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between bg-[#1a2634] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e07a5f]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Lobo · Cowboy Cafe test</p>
              <p className="text-xs text-white/60">Same API as customer chat + steering</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            type="button"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e07a5f]/15">
                  <MessageCircle className="h-7 w-7 text-[#e07a5f]" />
                </div>
                <h4 className="mb-1 font-semibold text-foreground">Howdy, partner</h4>
                <p className="mb-4 max-w-[280px] text-xs text-muted-foreground">
                  This panel calls the same <span className="font-medium">/api/chat</span> route as Cowboy Cafe
                  (Modal generate + your steering config). Use it to preview what customers see.
                </p>
                <div className="grid w-full max-w-[300px] grid-cols-2 gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      type="button"
                      disabled={isLoading}
                      className="h-auto justify-start px-3 py-2 text-left text-xs"
                      onClick={() => sendMessage({ text: question })}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white",
                        message.role === "user" ? "bg-[#2b4162]" : "bg-[#e07a5f]"
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2.5",
                        message.role === "user"
                          ? "bg-[#2b4162] text-white"
                          : messageFlags[message.id]?.flag === 1
                            ? "bg-red-100 text-foreground border-2 border-red-300"
                            : "bg-muted text-foreground",
                      )}
                    >
                      {message.parts.map((part, index) => {
                        if (part.type === "text") {
                          return (
                            <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
                              {part.text}
                            </p>
                          )
                        }
                        return null
                      })}
                      {message.role === "assistant" &&
                        messageFlags[message.id]?.flag === 1 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Flagged as potentially unacceptable</span>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e07a5f] text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                {error && (
                  <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error.message}
                  </p>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask like a customer…"
                disabled={isLoading}
                className="flex-1 rounded-full border-muted bg-muted px-4"
              />
              <Button
                onClick={handleSend}
                size="icon"
                disabled={!input.trim() || isLoading}
                type="button"
                className="h-10 w-10 shrink-0 rounded-full bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
