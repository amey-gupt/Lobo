import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { MessageCircle, MapPin } from 'lucide-react'

interface HeroProps {
  onOpenChat: () => void
}

export function Hero({ onOpenChat }: HeroProps) {
  return (
    <section className="relative min-h-[80vh] flex items-center">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-cowboy.jpg"
          alt="Cowboy Cafe interior"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/30" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">
            Western-Style Hospitality
          </p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight text-balance mb-6">
            Welcome to<br />
            <span className="text-primary">Cowboy Cafe</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
            Where the coffee is bold, the food is hearty, and the hospitality is as warm as the frontier sun. Saddle up and stay a while, partner.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              onClick={onOpenChat}
            >
              <MessageCircle className="h-5 w-5" />
              Chat with Us
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary/10 gap-2"
            >
              <MapPin className="h-5 w-5" />
              Find Us
            </Button>
          </div>

          <div className="mt-12 flex items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>Open Now</span>
            </div>
            <span>Mon-Fri 6am-9pm</span>
            <span className="hidden sm:inline">Sat-Sun 7am-10pm</span>
          </div>
        </div>
      </div>
    </section>
  )
}
