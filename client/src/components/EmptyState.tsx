import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionButton?: {
    label: string;
    onClick: () => void;
    testId?: string;
  };
  testId?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionButton,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      data-testid={testId}
    >
      <div className="rounded-full bg-muted p-6 mb-6">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2" data-testid={`${testId}-title`}>
        {title}
      </h3>
      <p className="text-muted-foreground max-w-md mb-6" data-testid={`${testId}-description`}>
        {description}
      </p>
      {actionButton && (
        <Button
          onClick={actionButton.onClick}
          data-testid={actionButton.testId || `${testId}-action-button`}
        >
          {actionButton.label}
        </Button>
      )}
    </div>
  );
}
