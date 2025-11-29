import { useGeo } from "@/lib/geoContext";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";

export function GeoRestrictionModal() {
  const { isUAE, isLoading, detectionFailed, hasAcknowledged, acknowledgeRestriction, retryDetection } = useGeo();
  const [location, setLocation] = useLocation();
  
  const isAppRoute = location.startsWith('/app');
  
  const shouldShowUAEModal = isUAE && isAppRoute && !hasAcknowledged && !isLoading;
  const shouldShowDetectionFailedModal = detectionFailed && isAppRoute && !hasAcknowledged && !isLoading;

  const handleGoBack = () => {
    setLocation('/');
  };

  if (shouldShowDetectionFailedModal) {
    return (
      <AlertDialog open={true}>
        <AlertDialogContent className="max-w-lg" data-testid="modal-geo-detection-failed">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <AlertDialogTitle className="text-xl">
                Location Verification Required
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p className="text-sm text-muted-foreground">
                  We were unable to verify your location. For regulatory compliance, 
                  we need to confirm you are not accessing this service from a restricted region.
                </p>
                
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Why is this happening?
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This could be due to network issues, VPN usage, or ad blockers interfering 
                    with location detection. Please try again or return to the homepage.
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Shield Finance restricts front-end access for UAE IP addresses pending VASP 
                  licensing under VARA regulations.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleGoBack}
              className="w-full sm:w-auto"
              data-testid="button-geo-failed-go-back"
            >
              Return to Homepage
            </Button>
            <Button 
              onClick={retryDetection}
              className="w-full sm:w-auto"
              data-testid="button-geo-retry"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Detection
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (!shouldShowUAEModal) return null;

  return (
    <AlertDialog open={shouldShowUAEModal}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="modal-geo-restriction">
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex-shrink-0">
              <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="text-xl">
              Geographic Restriction Notice
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="text-sm text-muted-foreground">
                We have detected that you may be accessing Shield Finance from the 
                United Arab Emirates (UAE).
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Regulatory Compliance Notice
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Shield Finance is not currently licensed as a VASP under Dubai's VARA. 
                  Front-end access is restricted for UAE IPs pending licensing.
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong>By proceeding, you acknowledge:</strong>
                </p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>You are responsible for local regulation compliance</li>
                  <li>Smart contracts remain permissionless by design</li>
                  <li>This service is not directed at UAE residents</li>
                  <li>Seek independent legal advice for UAE operations</li>
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                More info:{" "}
                <a 
                  href="https://vara.ae" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  vara.ae <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0 pt-4 border-t mt-4">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            className="w-full sm:w-auto"
            data-testid="button-geo-go-back"
          >
            Return to Homepage
          </Button>
          <AlertDialogAction 
            onClick={acknowledgeRestriction}
            className="w-full sm:w-auto"
            data-testid="button-geo-acknowledge"
          >
            I Acknowledge & Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
