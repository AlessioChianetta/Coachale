import { Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center space-x-1 text-sm" aria-label="Breadcrumb">
      {/* Home icon */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-gray-600 hover:text-[#1a73e8] dark:text-gray-400 dark:hover:text-blue-400 transition-colors duration-200 hover-underline-animation"
        onClick={items[0]?.onClick}
      >
        <Home className="h-4 w-4" />
        <span className="sr-only md:not-sr-only md:ml-1.5">{items[0]?.label}</span>
      </Button>

      {/* Breadcrumb items */}
      {items.slice(1).map((item, index) => {
        const isLast = index === items.length - 2;
        
        return (
          <div key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600 mx-0.5" />
            {isLast ? (
              // Current page - bold and blue, not clickable
              <span className="px-2 py-1 font-semibold text-[#1a73e8] dark:text-blue-400">
                {item.label}
              </span>
            ) : (
              // Previous pages - clickable, gray with animated underline
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-gray-600 hover:text-[#1a73e8] dark:text-gray-400 dark:hover:text-blue-400 font-normal transition-colors duration-200 hover-underline-animation"
                onClick={item.onClick}
              >
                {item.label}
              </Button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
