import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Check, CheckCheck, Gift, Zap, ArrowUpRight, ArrowDownRight, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useNotifications, 
  type Notification, 
  type NotificationType,
  formatNotificationTime 
} from "@/hooks/useNotifications";
import { useWallet } from "@/lib/walletContext";
import { cn } from "@/lib/utils";

function getNotificationRoute(type: NotificationType): string {
  switch (type) {
    case "deposit":
      return "/app/portfolio";
    case "withdrawal":
      return "/app/transactions";
    case "reward":
      return "/app/airdrop";
    case "boost":
      return "/app/stake";
    case "system":
    default:
      return "/app";
  }
}

function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "deposit":
      return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    case "withdrawal":
      return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
    case "reward":
      return <Gift className="h-4 w-4 text-yellow-500" />;
    case "boost":
      return <Zap className="h-4 w-4 text-purple-500" />;
    case "system":
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsReadAsync,
  onNavigate,
  isMarking,
}: {
  notification: Notification;
  onMarkAsRead: (id: number) => void;
  onMarkAsReadAsync: (id: number) => Promise<unknown>;
  onNavigate: (route: string) => void;
  isMarking: boolean;
}) {
  const route = getNotificationRoute(notification.type);

  const handleClick = async () => {
    if (!notification.read) {
      try {
        await onMarkAsReadAsync(notification.id);
      } catch {
        // If marking as read fails, still navigate
      }
    }
    onNavigate(route);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer group hover-elevate",
        !notification.read && "bg-primary/5",
        isMarking && "opacity-50 pointer-events-none"
      )}
      onClick={handleClick}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          !notification.read && "font-medium"
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatNotificationTime(notification.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            data-testid={`button-mark-read-${notification.id}`}
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="h-4 w-4 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { address, evmAddress, isConnected } = useWallet();
  const walletAddress = address || evmAddress;
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsReadAsync,
    markAllAsRead,
    isMarking,
  } = useNotifications({
    walletAddress,
    enabled: isConnected && !!walletAddress,
    refetchInterval: 30000,
    limit: 50,
  });

  const handleNavigate = (route: string) => {
    setIsOpen(false);
    setLocation(route);
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              disabled={isMarking}
              className="text-xs h-7"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="space-y-1 p-1">
              {[1, 2, 3].map((i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                We'll notify you about deposits, rewards, and boosts
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onMarkAsReadAsync={markAsReadAsync}
                  onNavigate={handleNavigate}
                  isMarking={isMarking}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              {unreadCount > 0 
                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                : 'All caught up!'
              }
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
