'use client'

import { useState } from 'react'
import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { MenuSection } from '@/components/menu-section'
import { AboutSection } from '@/components/about-section'
import { Footer } from '@/components/footer'
import { ChatBot, ChatBotTrigger } from '@/components/chatbot'

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <main className="min-h-screen">
      <Header />
      <Hero onOpenChat={() => setIsChatOpen(true)} />
      <MenuSection />
      <AboutSection />
      <Footer />
      
      {/* Chatbot */}
      {!isChatOpen && <ChatBotTrigger onClick={() => setIsChatOpen(true)} />}
      <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </main>
  )
}
