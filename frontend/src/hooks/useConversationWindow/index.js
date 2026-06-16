import { useState, useEffect, useCallback } from "react";

/**
 * Hook que recibe el objeto `conversationWindow` del ticket y
 * mantiene un contador en tiempo real de hoursRemaining.
 *
 * @param {object|null} conversationWindow - Estado de ventana desde la API
 * @returns {{ isOpen: boolean, type: string, hoursRemaining: number|null, lastIncomingAt: Date|null, isExpiringSoon: boolean }}
 */
const useConversationWindow = (conversationWindow) => {
  const [liveHoursRemaining, setLiveHoursRemaining] = useState(
    conversationWindow?.hoursRemaining ?? null
  );

  // Recalcular hoursRemaining cuando el objeto cambia (socket event)
  useEffect(() => {
    if (conversationWindow?.hoursRemaining != null) {
      setLiveHoursRemaining(conversationWindow.hoursRemaining);
    } else {
      setLiveHoursRemaining(null);
    }
  }, [
    conversationWindow?.hoursRemaining,
    conversationWindow?.lastIncomingAt,
    conversationWindow?.type,
  ]);

  // Decrementar hoursRemaining cada 60 segundos
  useEffect(() => {
    if (liveHoursRemaining == null || liveHoursRemaining <= 0) return;

    const interval = setInterval(() => {
      setLiveHoursRemaining((prev) => {
        if (prev == null || prev <= 0) {
          return 0;
        }
        return Math.max(0, prev - 1 / 60); // Decrement 1 minute
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [liveHoursRemaining]);

  const isOpen = conversationWindow?.isOpen ?? false;
  const type = conversationWindow?.type ?? null;
  const lastIncomingAt = conversationWindow?.lastIncomingAt ?? null;
  const isExpiringSoon = isOpen && liveHoursRemaining != null && liveHoursRemaining < 2;

  return {
    isOpen,
    type,
    hoursRemaining: liveHoursRemaining,
    lastIncomingAt,
    isExpiringSoon,
  };
};

export default useConversationWindow;
