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
        className="w-full justify-start gap-2 h-auto p-4 hover-elevate"
        data-testid="button-toggle-section"
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-lg font-semibold">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-muted-foreground font-normal">({count})</span>
          )}
        </span>
      </Button>

      {isOpen && <div className="space-y-3 pl-2">{children}</div>}
    </div>
  );
}
