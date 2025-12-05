import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export type NotificationType =
  | "deposit"
  | "withdrawal"
  | "reward"
  | "boost"
  | "system";

export interface Notification {
  id: number;
  walletAddress: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  relatedTxHash?: string;
  relatedVaultId?: string;
  relatedPositionId?: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
}

interface UseNotificationsOptions {
  walletAddress: string | null | undefined;
  enabled?: boolean;
  refetchInterval?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export function useNotifications({
  walletAddress,
  enabled = true,
  refetchInterval = 30000,
  limit = 50,
  unreadOnly = false,
}: UseNotificationsOptions) {
  const queryKey = ["/api/user/notifications", walletAddress, limit, unreadOnly];

  const query = useQuery<NotificationsResponse>({
    queryKey,
    queryFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address required");
      }
      const params = new URLSearchParams({
        walletAddress,
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString(),
      });
      const response = await fetch(`/api/user/notifications?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      return response.json();
    },
    enabled: enabled && !!walletAddress,
    refetchInterval,
    staleTime: 10000,
    retry: 2,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("POST", `/api/user/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        throw new Error("Wallet address required");
      }
      return apiRequest("POST", "/api/user/notifications/read-all", { walletAddress });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("DELETE", `/api/user/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
    },
  });

  return {
    ...query,
    notifications: query.data?.notifications || [],
    unreadCount: query.data?.unreadCount || 0,
    markAsRead: markAsReadMutation.mutate,
    markAsReadAsync: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    isMarking: markAsReadMutation.isPending || markAllAsReadMutation.isPending,
    isDeleting: deleteNotificationMutation.isPending,
  };
}

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case "deposit":
      return "arrow-down-circle";
    case "withdrawal":
      return "arrow-up-circle";
    case "reward":
      return "gift";
    case "boost":
      return "zap";
    case "system":
      return "bell";
    default:
      return "bell";
  }
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "deposit":
      return "text-green-500";
    case "withdrawal":
      return "text-blue-500";
    case "reward":
      return "text-yellow-500";
    case "boost":
      return "text-purple-500";
    case "system":
      return "text-gray-500";
    default:
      return "text-gray-500";
  }
}

export function formatNotificationTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return created.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
