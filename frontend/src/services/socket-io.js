import openSocket from "socket.io-client";
import { getNodeUrl } from "../config";

const sharedSockets = new Map();

// Marker passed to connect/disconnect handlers while the shared socket goes
// through a maintenance reconnect (used to clear stale server-side rooms).
// Handlers must NEVER be suppressed: components rejoin their rooms in these
// callbacks. Connectivity observers use the marker to stay silent instead.
const MAINTENANCE_EVENT = { __maintenance: true };

const getStoredToken = () => {
  const storedToken = localStorage.getItem("token");
  return storedToken ? JSON.parse(storedToken) : null;
};

// The socket query is fixed at creation time. Keep the token in sync with
// localStorage so reconnects don't use a stale token after refresh_token.
const refreshSocketToken = entry => {
  try {
    if (entry.socket.io && entry.socket.io.opts) {
      entry.socket.io.opts.query = {
        ...entry.socket.io.opts.query,
        token: getStoredToken(),
      };
    }
  } catch (err) {
    // keep previous token
  }
};

const normalizeEventData = (event, data) => {
  if (event !== "appMessage" || !data?.message?.ticket) {
    return data;
  }

  return {
    ...data,
    ticket: data.ticket || data.message.ticket,
    contact:
      data.contact || data.message.ticket.contact || data.message.contact,
  };
};

const createSharedSocket = (key, userId, token) => {
  const socket = openSocket(getNodeUrl(), {
    transports: ["websocket"],
    query: {
      token,
      ...(userId && { userId }),
    },
  });

  const entry = {
    socket,
    consumers: new Set(),
    maintenanceReconnect: false,
    reconnectTimer: null,
  };

  sharedSockets.set(key, entry);
  return entry;
};

function connectToSocket(userId) {
  const token = getStoredToken();
  const key = userId ? `presence:${userId}` : "application";
  const entry =
    sharedSockets.get(key) || createSharedSocket(key, userId, token);
  refreshSocketToken(entry);
  const listeners = [];
  let disconnected = false;
  let joinedRoom = false;

  const consumer = {
    on(event, handler) {
      if (disconnected) return consumer;

      const wrappedHandler = data =>
        // Internal reconnects only exist to clear stale Socket.IO rooms.
        // connect/disconnect are never swallowed: components must always
        // rejoin their rooms. Observers receive a marker to stay silent.
        entry.maintenanceReconnect &&
        (event === "connect" || event === "disconnect")
          ? handler(MAINTENANCE_EVENT)
          : handler(normalizeEventData(event, data));

      listeners.push({ event, handler, wrappedHandler });
      entry.socket.on(event, wrappedHandler);

      // A shared socket may already be connected when a component mounts.
      // Preserve the previous behavior where its connect callback joins rooms.
      if (event === "connect" && entry.socket.connected) {
        Promise.resolve().then(() => {
          if (!disconnected) handler();
        });
      }

      return consumer;
    },

    off(event, handler) {
      for (let index = listeners.length - 1; index >= 0; index -= 1) {
        const listener = listeners[index];
        if (
          listener.event === event &&
          (!handler || listener.handler === handler)
        ) {
          entry.socket.off(listener.event, listener.wrappedHandler);
          listeners.splice(index, 1);
        }
      }
      return consumer;
    },

    emit(event, ...args) {
      if (
        event === "joinChatBox" ||
        event === "joinNotification" ||
        event === "joinTickets"
      ) {
        joinedRoom = true;
      }
      entry.socket.emit(event, ...args);
      return consumer;
    },

    disconnect() {
      if (disconnected) return consumer;
      disconnected = true;

      listeners.forEach(({ event, wrappedHandler }) => {
        entry.socket.off(event, wrappedHandler);
      });
      listeners.length = 0;
      entry.consumers.delete(consumer);

      if (entry.consumers.size === 0) {
        if (entry.reconnectTimer) {
          clearTimeout(entry.reconnectTimer);
          entry.reconnectTimer = null;
        }
        entry.socket.disconnect();
        sharedSockets.delete(key);
      } else if (joinedRoom) {
        // Socket.IO rooms can only be left by the server. Reconnecting clears
        // rooms no longer used; remaining consumers rejoin in their callbacks.
        // Several components can unmount in the same render, so coalesce their
        // cleanup into one maintenance reconnect. The delay also absorbs
        // unmount/remount bursts so the socket doesn't reconnect in a loop.
        if (!entry.reconnectTimer) {
          entry.reconnectTimer = setTimeout(() => {
            entry.reconnectTimer = null;

            if (entry.consumers.size === 0 || !entry.socket.connected) {
              return;
            }

            entry.maintenanceReconnect = true;
            entry.socket.once("connect", () => {
              Promise.resolve().then(() => {
                entry.maintenanceReconnect = false;
              });
            });
            refreshSocketToken(entry);
            entry.socket.disconnect();
            entry.socket.connect();
          }, 300);
        }
      }

      return consumer;
    },
  };

  entry.consumers.add(consumer);
  return consumer;
}

export default connectToSocket;
