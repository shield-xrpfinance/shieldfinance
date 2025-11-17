import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-start gap-3 h-auto p-6 hover-elevate rounded-2xl border-2 border-dashed"
        data-testid="button-toggle-section"
        aria-expanded={isOpen}
        aria-controls="collapsible-content"
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
        {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold">{title}</span>
          {count !== undefined && (
            <span className="text-sm text-muted-foreground font-normal">({count} vaults)</span>
          )}
        </div>
      </Button>

      {isOpen && (
        <div 
          id="collapsible-content" 
          role="region" 
          aria-label={`${title} section`}
          className="space-y-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
