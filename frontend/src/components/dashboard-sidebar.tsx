"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sliders,
  MessageSquare,
  Network,
  BarChart3,
  Activity,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Sliders, href: "/", label: "Steering", active: true },
  { icon: MessageSquare, href: "/chat", label: "Models" },
  { icon: Network, href: "#", label: "Vectors" },
  { icon: BarChart3, href: "/metrics", label: "Metrics" },
  { icon: Activity, href: "#", label: "Monitoring" },
  { icon: Settings, href: "#", label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[72px] flex-col items-center bg-sidebar py-6">
      {/* Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={index}
              href={item.href}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto flex flex-col items-center gap-3">
        <div className="h-px w-8 bg-sidebar-border" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent">
          <span className="text-xs font-medium text-sidebar-foreground">L</span>
        </div>
      </div>
    </aside>
  );
}
