import React, { createContext, useContext } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const InboxContext = createContext();

export function InboxProvider({ children }) {
  const [messages, setMessages] = useLocalStorage("domusrd-messages", []);

  const sendMessage = ({ fromId, fromName, toId, toName, propertyId, propertyTitle, text, replyToId = null }) => {
    const msg = {
      id: Date.now(),
      fromId,
      fromName,
      toId,
      toName,
      propertyId,
      propertyTitle,
      text,
      replyToId,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [msg, ...prev]);
    return msg;
  };

  const replyMessage = ({ originalMsg, fromId, fromName, text }) => {
    return sendMessage({
      fromId,
      fromName,
      toId: originalMsg.fromId,
      toName: originalMsg.fromName,
      propertyId: originalMsg.propertyId,
      propertyTitle: originalMsg.propertyTitle,
      text,
      replyToId: originalMsg.id,
    });
  };

  const markAsRead = (id) => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, read: true } : m)
    );
  };

  const deleteMessage = (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const getInbox = (userId) =>
    messages.filter((m) => m.toId === userId);

  const getSent = (userId) =>
    messages.filter((m) => m.fromId === userId);

  const getUnreadCount = (userId) =>
    messages.filter((m) => m.toId === userId && !m.read).length;

  // Agrupa mensajes en conversaciones por propiedad + participantes
  const getConversations = (userId) => {
    const relevant = messages.filter(
      (m) => m.fromId === userId || m.toId === userId
    );
    const convMap = {};
    relevant.forEach((m) => {
      const otherId = m.fromId === userId ? m.toId : m.fromId;
      const key = `${[userId, otherId].sort().join("-")}-${m.propertyId}`;
      if (!convMap[key]) {
        convMap[key] = {
          key,
          otherId,
          otherName: m.fromId === userId ? m.toName : m.fromName,
          propertyId: m.propertyId,
          propertyTitle: m.propertyTitle,
          messages: [],
          unread: 0,
        };
      }
      convMap[key].messages.push(m);
      if (m.toId === userId && !m.read) convMap[key].unread++;
    });
    return Object.values(convMap).sort(
      (a, b) => new Date(b.messages[0].createdAt) - new Date(a.messages[0].createdAt)
    );
  };

  return (
    <InboxContext.Provider value={{
      messages, sendMessage, replyMessage,
      markAsRead, deleteMessage,
      getInbox, getSent, getUnreadCount, getConversations,
    }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  return useContext(InboxContext);
}