import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useNotifications,
  getNotificationIcon,
  getNotificationColor,
  formatNotificationTime,
  type Notification,
} from "@/hooks/useNotifications";
import { Bell, Check, ArrowDownCircle, ArrowUpCircle, Gift, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  walletAddress: string | null | undefined;
}

function NotificationIcon({ iconName, className }: { iconName: string; className?: string }) {
  const iconProps = { className: cn("h-4 w-4", className) };
  
  switch (iconName) {
    case "arrow-down-circle":
      return <ArrowDownCircle {...iconProps} />;
    case "arrow-up-circle":
      return <ArrowUpCircle {...iconProps} />;
    case "gift":
      return <Gift {...iconProps} />;
    case "zap":
      return <Zap {...iconProps} />;
    case "bell":
    default:
      return <Bell {...iconProps} />;
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
}) {
  const iconName = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type);
  const timeAgo = formatNotificationTime(notification.createdAt);

  return (
    <button
      data-testid={`notification-item-${notification.id}`}
      className={cn(
        "w-full text-left p-3 hover-elevate cursor-pointer transition-colors",
        notification.read ? "bg-transparent" : "bg-muted/50"
      )}
      onClick={() => {
        if (!notification.read) {
          onMarkAsRead(notification.id);
        }
      }}
    >
      <div className="flex gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", colorClass)}>
          <NotificationIcon iconName={iconName} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {notification.title}
            </p>
            {!notification.read && (
              <span
                data-testid={`notification-unread-indicator-${notification.id}`}
                className="flex-shrink-0 h-2 w-2 rounded-full bg-primary mt-1.5"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {timeAgo}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationCenter({ walletAddress }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    isMarking,
  } = useNotifications({
    walletAddress,
    enabled: !!walletAddress,
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              data-testid="badge-unread-count"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
          {notifications.length > 0 && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground"
              onClick={() => markAllAsRead()}
              disabled={isMarking}
              data-testid="button-mark-all-read"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        {!walletAddress ? (
          <div
            className="flex flex-col items-center justify-center py-8 px-4"
            data-testid="notifications-connect-wallet"
          >
            <Bell className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Connect your wallet to see notifications
            </p>
          </div>
        ) : isLoading ? (
          <div
            className="flex items-center justify-center py-8"
            data-testid="notifications-loading"
          >
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 px-4"
            data-testid="notifications-empty"
          >
            <Bell className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              No notifications yet
            </p>
            <p className="text-xs text-muted-foreground text-center mt-1">
              You'll be notified about deposits, withdrawals, and rewards
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
