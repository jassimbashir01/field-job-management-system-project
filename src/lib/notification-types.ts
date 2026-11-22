export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationSnapshot {
  unreadCount: number;
  items: NotificationItem[];
}
