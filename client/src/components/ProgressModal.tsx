import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, XCircle, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface ProgressStep {
  id: string;
  label: string;
  description?: string;
  estimate?: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  isMilestone?: boolean;
}

interface ProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: ProgressStep[];
  currentStepId: string;
  actions?: Array<{
    label: string;
    variant?: 'default' | 'outline' | 'ghost';
    onClick: () => void;
  }>;
  errorMessage?: string;
  metadata?: React.ReactNode;
}

export default function ProgressModal({
  open,
  onOpenChange,
  title,
  steps,
  currentStepId,
  actions = [],
  errorMessage,
  metadata
}: ProgressModalProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCompletedMilestone, setLastCompletedMilestone] = useState<string | null>(null);

  // Calculate progress percentage
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const progressPercent = (completedSteps / steps.length) * 100;

  // Watch for milestone completions
  useEffect(() => {
    const currentMilestoneComplete = steps.find(
      s => s.isMilestone && s.status === 'complete' && s.id !== lastCompletedMilestone
    );
    
    if (currentMilestoneComplete) {
      setShowCelebration(true);
      setLastCompletedMilestone(currentMilestoneComplete.id);
      setTimeout(() => setShowCelebration(false), 2000);
    }
  }, [steps, lastCompletedMilestone]);

  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-chart-2" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border-2 overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
        </DialogHeader>

        {/* Metadata Section (e.g., Bridge ID) */}
        {metadata && (
          <div className="border-b pb-4">
            {metadata}
          </div>
        )}

        {/* Progress Bar Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Step {completedSteps} of {steps.length}
            </span>
            <span className="font-medium" data-testid="progress-percentage">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Steps List */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {steps.map((step, index) => {
            const isCurrentStep = step.id === currentStepId;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  relative flex items-start gap-3 p-4 rounded-lg border transition-all
                  ${isCurrentStep ? 'bg-primary/5 border-primary/30' : 'border-border/50'}
                  ${step.isMilestone ? 'border-l-4 border-l-primary' : ''}
                `}
                data-testid={`progress-step-${step.id}`}
              >
                {/* Current step pulse effect */}
                {isCurrentStep && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-primary/10"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                {/* Status Icon */}
                <div className="flex-shrink-0 mt-0.5 relative z-10">
                  {getStepIcon(step)}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm">
                      {step.label}
                      {step.isMilestone && (
                        <span className="ml-2 text-xs text-primary inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Milestone
                        </span>
                      )}
                    </h4>
                    {step.estimate && step.status === 'in_progress' && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {step.estimate}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4" data-testid="error-message">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-destructive">Error</h4>
                <p className="text-sm text-destructive/90 mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Milestone Celebration Animation */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-lg"
              data-testid="celebration-animation"
            >
              {/* Sparkle particles */}
              {[...Array(16)].map((_, i) => {
                const angle = (i / 16) * Math.PI * 2;
                const distance = 150;
                return (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: 0, 
                      y: 0, 
                      scale: 0,
                      opacity: 1 
                    }}
                    animate={{
                      x: Math.cos(angle) * distance,
                      y: Math.sin(angle) * distance,
                      scale: [0, 1, 0],
                      opacity: [1, 1, 0],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      ease: "easeOut",
                      delay: i * 0.03
                    }}
                    className="absolute top-1/2 left-1/2"
                  >
                    <Sparkles 
                      className="h-4 w-4 text-primary" 
                      style={{
                        filter: 'drop-shadow(0 0 2px hsl(var(--primary)))'
                      }}
                    />
                  </motion.div>
                );
              })}
              
              {/* Center glow */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.5, 0], opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 w-32 h-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        {actions.length > 0 && (
          <DialogFooter className="gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                onClick={action.onClick}
                data-testid={`button-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
