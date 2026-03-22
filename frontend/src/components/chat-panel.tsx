"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, X, Send, Bot, User } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}

function formatMessageTime(d: Date) {
  return d.toLocaleTimeString("en-US", TIME_OPTS)
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! This is a testing ground for the currently available chatbot. Feel free to play around with any new updates to characteristics.",
      timestamp: new Date("2024-01-15T14:00:00.000Z"),
    },
    {
      id: "2",
      role: "assistant",
      content: "Hello, this is Thiru's Burgers, how may I help you today?",
      timestamp: new Date("2024-01-15T14:01:00.000Z"),
    },
  ])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")

    // Simulate assistant response
    setTimeout(() => {
      const responses = [
        "Each row is a steering direction: you set a coefficient (×), not a “percent of topic in the reply.”",
        "Higher × applies a stronger nudge along that learned direction. It is not a guarantee of safety or removal.",
        "The right end of the slider is powerful—if outputs get garbled, dial back before chasing “more removal.”",
        "Turn a channel off to set its multiplier to zero. Use Apply to push the config to Modal.",
        "Start with Light–Moderate strengths; increase only if the effect is too weak.",
      ]
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    }, 1000)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#e07a5f] text-white shadow-lg transition-all hover:bg-[#d06a4f] hover:scale-105 hover:shadow-xl ${isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
          }`}
        aria-label="Open chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border-0 bg-card shadow-2xl transition-all duration-300 ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1a2634] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e07a5f]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Lobo Assistant</p>
              <p className="text-xs text-white/60">Always here to help</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "bg-[#2b4162]" : "bg-[#e07a5f]"
                  } text-white`}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${message.role === "user"
                  ? "bg-[#2b4162] text-white"
                  : "bg-muted text-foreground"
                  }`}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p
                  className={`mt-1 text-xs ${message.role === "user" ? "text-white/50" : "text-muted-foreground"
                    }`}
                >
                  {formatMessageTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 rounded-full border-muted bg-muted px-4"
            />
            <Button
              onClick={handleSend}
              size="icon"
              disabled={!input.trim()}
              className="h-10 w-10 shrink-0 rounded-full bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
