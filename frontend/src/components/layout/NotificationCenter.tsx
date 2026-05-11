import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useNotifications } from "../../hooks/useNotifications";
import type { NotificationRecord } from "../../types/api";

const MOBILE_QUERY = "(max-width: 639px)";

const formatNotificationTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

const NotificationList = ({
  isLoading,
  items,
  markAsRead
}: {
  isLoading: boolean;
  items: NotificationRecord[];
  markAsRead: (id: number) => Promise<NotificationRecord>;
}) => {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No notifications yet.
      </div>
    );
  }

  return (
    <>
      {items.map((notification) => {
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{notification.subject}</p>
              {!notification.readAt ? (
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              {formatNotificationTimestamp(notification.createdAt)}
            </p>
          </>
        );

        return notification.readAt ? (
          <article
            key={notification.id}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            {content}
          </article>
        ) : (
          <button
            key={notification.id}
            type="button"
            className="block w-full rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50"
            onClick={() => void markAsRead(notification.id)}
          >
            {content}
          </button>
        );
      })}
    </>
  );
};

export const NotificationCenter = () => {
  const { items, unreadCount, isLoading, markAsRead, markAllAsRead, isMarkingAllAsRead } =
    useNotifications(8);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const updateMobileState = () => setIsMobile(mediaQuery.matches);

    updateMobileState();
    mediaQuery.addEventListener("change", updateMobileState);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileState);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !isMobile) {
      return;
    }

    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !isMobile || !popoverRef.current) {
        return;
      }

      const focusableElements = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );

      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (!isOpen || isMobile) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isMobile, isOpen]);

  const closeNotifications = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  const panel = (
    <div
      ref={popoverRef}
      id={popoverId}
      role={isMobile ? "dialog" : "region"}
      aria-label="Notifications"
      aria-modal={isMobile ? "true" : undefined}
      tabIndex={-1}
      className={
        isMobile
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[82vh] rounded-t-3xl border border-slate-200 bg-white p-4 shadow-soft"
          : "absolute right-0 z-20 mt-3 w-[min(22rem,calc(100vw-2rem))] max-w-[22rem] rounded-3xl border border-slate-200 bg-white p-4 shadow-soft"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <p className="mt-1 text-xs text-slate-500">
            {unreadCount
              ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs font-semibold text-brand-700 disabled:text-slate-300"
            disabled={!unreadCount || isMarkingAllAsRead}
            onClick={() => void markAllAsRead()}
          >
            Mark all read
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close notifications"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={closeNotifications}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[min(28rem,calc(100vh-13rem))] space-y-3 overflow-y-auto pr-1 sm:max-h-[min(30rem,calc(100vh-12rem))]">
        <NotificationList isLoading={isLoading} items={items} markAsRead={markAsRead} />
      </div>
    </div>
  );

  const mobileSheet =
    isOpen && isMobile
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-40 cursor-default bg-slate-950/40"
              onClick={closeNotifications}
            />
            {panel}
          </>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-controls={popoverId}
        aria-expanded={isOpen}
        aria-haspopup={isMobile ? "dialog" : "true"}
        aria-label={unreadCount ? `Open notifications, ${unreadCount} unread` : "Open notifications"}
        className="relative rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50"
        onClick={() => setIsOpen((current) => !current)}
      >
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}

        <Bell className="h-4 w-4" />
      </button>

      {isOpen && !isMobile ? panel : null}
      {mobileSheet}
    </div>
  );
};
