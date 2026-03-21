import { Card, CardContent } from '@/components/ui/card'
import { Coffee, UtensilsCrossed, Cake, Sun } from 'lucide-react'

const menuCategories = [
  {
    title: 'Coffee & Drinks',
    icon: Coffee,
    items: [
      { name: 'Trailblazer Espresso', description: 'Bold, dark roast espresso', price: '$3.50' },
      { name: 'Sunset Latte', description: 'Smooth latte with caramel and vanilla', price: '$5.50' },
      { name: 'Cowpoke Cold Brew', description: '24-hour steeped cold brew', price: '$4.50' },
      { name: 'Desert Rose Tea', description: 'Herbal tea with rose and hibiscus', price: '$4.00' },
    ],
  },
  {
    title: 'Breakfast',
    icon: Sun,
    items: [
      { name: "Rancher's Breakfast", description: 'Eggs, bacon, hash browns, and toast', price: '$12.99' },
      { name: 'Campfire Pancakes', description: 'Fluffy pancakes with maple syrup', price: '$9.99' },
      { name: "Wrangler's Omelette", description: 'Three-egg omelette with peppers and cheese', price: '$11.99' },
    ],
  },
  {
    title: 'Lunch & Dinner',
    icon: UtensilsCrossed,
    items: [
      { name: 'Trail Boss Burger', description: 'Half-pound beef burger with all the fixings', price: '$14.99' },
      { name: 'BBQ Brisket Sandwich', description: 'Slow-smoked brisket on brioche', price: '$15.99' },
      { name: 'Frontier Salad', description: 'Mixed greens with grilled chicken', price: '$12.99' },
      { name: 'Chuckwagon Chili', description: 'Hearty beef and bean chili with cornbread', price: '$10.99' },
    ],
  },
  {
    title: 'Desserts',
    icon: Cake,
    items: [
      { name: 'Cactus Flower Cake', description: 'Chocolate cake with prickly pear frosting', price: '$7.99' },
      { name: 'Apple Pie à la Mode', description: 'Homemade apple pie with vanilla ice cream', price: '$6.99' },
    ],
  },
]

export function MenuSection() {
  return (
    <section id="menu" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-2">
            Our Offerings
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground text-balance">
            The Menu
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            From sunrise to sundown, we've got hearty fare and drinks to fuel your frontier adventures.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {menuCategories.map((category) => (
            <Card key={category.title} className="bg-card border-border overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <category.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-card-foreground">
                    {category.title}
                  </h3>
                </div>
                <div className="space-y-4">
                  {category.items.map((item) => (
                    <div key={item.name} className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-card-foreground">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <span className="font-semibold text-primary whitespace-nowrap">
                        {item.price}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
