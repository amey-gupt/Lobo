import { Star, Music, Clock, Heart } from 'lucide-react'

const features = [
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'We source the finest beans and ingredients to bring you authentic western flavors.',
  },
  {
    icon: Music,
    title: 'Live Entertainment',
    description: 'Join us Friday and Saturday nights for live country music and dancing.',
  },
  {
    icon: Clock,
    title: 'Early Hours',
    description: 'Rise and shine, partner! We open at 6am on weekdays for early birds.',
  },
  {
    icon: Heart,
    title: 'Made with Love',
    description: 'Every dish is crafted with care, just like grandma used to make.',
  },
]

export function AboutSection() {
  return (
    <section id="about" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary mb-2">
              Our Story
            </p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground text-balance mb-6">
              Where the West Meets Your Cup
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Born from a love of strong coffee and western hospitality, Cowboy Cafe opened its 
              doors in 2015. Our mission has always been simple: serve great food, pour excellent 
              coffee, and treat every guest like family.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Whether you're grabbing a quick espresso before work or settling in for a hearty 
              dinner with friends, we're here to make you feel at home. Our recipes have been 
              passed down through generations, and we take pride in every plate we serve.
            </p>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-serif text-3xl font-bold text-primary">10+</p>
                <p className="text-muted-foreground">Years Open</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="font-serif text-3xl font-bold text-primary">50K+</p>
                <p className="text-muted-foreground">Happy Customers</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="font-serif text-3xl font-bold text-primary">4.9</p>
                <p className="text-muted-foreground">Star Rating</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div 
                key={feature.title} 
                className="p-6 rounded-lg bg-secondary/50 border border-border"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
