import Link from 'next/link'
import { Coffee, MapPin, Phone, Mail, Clock } from 'lucide-react'

export function Footer() {
  return (
    <footer id="contact" className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Coffee className="h-8 w-8 text-accent" />
              <span className="font-serif text-xl font-bold">Cowboy Cafe</span>
            </Link>
            <p className="text-background/70 text-sm leading-relaxed">
              Where the coffee is bold, the food is hearty, and the hospitality is as warm as the frontier sun.
            </p>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-serif font-semibold text-lg mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-accent" />
              Hours
            </h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li className="flex justify-between">
                <span>Monday - Friday</span>
                <span>6am - 9pm</span>
              </li>
              <li className="flex justify-between">
                <span>Saturday - Sunday</span>
                <span>7am - 10pm</span>
              </li>
              <li className="mt-4 text-accent">
                Happy Hour: 3pm - 6pm daily
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-serif font-semibold text-lg mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-background/70">
              <li className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <span>123 Dusty Trail Road<br />Frontier Town, TX 75001</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-accent" />
                <span>(555) 123-4567</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-accent" />
                <span>howdy@cowboycafe.com</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-serif font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-background/70">
              <li>
                <Link href="#menu" className="hover:text-accent transition-colors">
                  Menu
                </Link>
              </li>
              <li>
                <Link href="#about" className="hover:text-accent transition-colors">
                  Our Story
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-accent transition-colors">
                  Catering
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-accent transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-accent transition-colors">
                  Gift Cards
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/50">
          <p>© {new Date().getFullYear()} Cowboy Cafe. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-accent transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-accent transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
