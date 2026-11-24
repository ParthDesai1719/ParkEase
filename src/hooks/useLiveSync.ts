import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export interface LiveSyncOptions {
  /**
   * Background polling interval in milliseconds while tab is visible.
   * Default: 6000ms (6 seconds).
   */
  intervalMs?: number;

  /**
   * Socket event names to listen to for instant zero-latency updates.
   */
  events?: string[];

  /**
   * Whether live synchronization is enabled. Default: true.
   */
  enabled?: boolean;
}

const DEFAULT_EVENTS = [
  'slot_status_changed',
  'booking_status_changed',
  'facility_status_changed',
  'staff_status_changed',
  'incident_updated',
  'new_notification',
  'admin_notification',
  'slot:status_changed',
  'booking:vehicle_entered',
  'booking:vehicle_exited',
  'parking:occupancy_changed',
];

/**
 * useLiveSync
 *
 * Keeps page state, badges, transition updates, 2D layouts, and data fresh
 * silently in the background without triggering full-page skeleton flicker (ghost reload).
 */
export function useLiveSync(
  onSync: () => void | Promise<void>,
  options: LiveSyncOptions = {},
): void {
  const {
    intervalMs = 6000,
    events = DEFAULT_EVENTS,
    enabled = true,
  } = options;

  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!enabled) return;

    // 1. Instantaneous Socket.IO updates
    const socket = getSocket();
    const handleEvent = () => {
      try {
        void onSyncRef.current();
      } catch (err) {
        console.warn('[useLiveSync] Socket event handler warning:', err);
      }
    };

    events.forEach((ev) => socket.on(ev, handleEvent));

    // 2. Smooth silent heartbeat interval while document is active/visible
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          void onSyncRef.current();
        } catch (err) {
          console.warn('[useLiveSync] Background sync warning:', err);
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
      events.forEach((ev) => socket.off(ev, handleEvent));
    };
  }, [enabled, intervalMs, events]);
}
