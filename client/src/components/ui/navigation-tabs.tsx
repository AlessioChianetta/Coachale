import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavigationTab {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface NavigationTabsProps {
  tabs: NavigationTab[];
  className?: string;
}

export function NavigationTabs({ tabs, className }: NavigationTabsProps) {
  const [location] = useLocation();

  return (
    <div className={cn("flex flex-wrap gap-2 mb-6", className)}>
      {tabs.map((tab) => {
        const isActive = location === tab.href;
        const Icon = tab.icon;
        
        return (
          <Link key={tab.href} href={tab.href}>
            <button
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:shadow-md"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
            </button>
          </Link>
        );
      })}
    </div>
  );
}
