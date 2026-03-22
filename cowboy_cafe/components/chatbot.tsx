"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  X,
  Send,
  MessageCircle,
  Coffee,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const suggestedQuestions = [
    "What's your best coffee?",
    "Do you have vegetarian options?",
    "What are your hours?",
    "Tell me about specials",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:inset-auto md:bottom-6 md:right-6 md:w-[420px] md:h-[600px]">
      {/* Backdrop for mobile */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      <Card className="relative h-full w-full md:h-[600px] flex flex-col shadow-2xl border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-foreground/20">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-serif font-semibold">
                Cowboy Cafe Assistant
              </h3>
              <p className="text-xs text-primary-foreground/80">
                Always here to help, partner!
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h4 className="font-serif text-lg font-semibold text-foreground mb-2">
                Howdy, Partner!
              </h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                I'm here to help with menu questions, recommendations, and cafe
                info. What can I rustle up for ya?
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto min-w-0 justify-start whitespace-normal break-words py-2 px-3 text-left leading-snug border-border hover:bg-secondary hover:text-secondary-foreground"
                    onClick={() => {
                      sendMessage({ text: question });
                    }}
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
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md",
                    )}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <p
                            key={index}
                            className="text-sm leading-relaxed whitespace-pre-wrap"
                          >
                            {part.text}
                          </p>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export function ChatBotTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-110 transition-transform"
    >
      <MessageCircle className="h-6 w-6" />
      <span className="sr-only">Open chat</span>
    </Button>
  );
}
