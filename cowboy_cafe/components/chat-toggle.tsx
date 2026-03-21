'use client'

import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatToggleProps {
  isOpen: boolean
  onClick: () => void
}

export function ChatToggle({ isOpen, onClick }: ChatToggleProps) {
  if (isOpen) return null

  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-4 right-4 z-40 rounded-full w-14 h-14 p-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
      aria-label="Open chat"
    >
      <MessageCircle className="w-6 h-6" />
    </Button>
  )
}
