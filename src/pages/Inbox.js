import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useInbox } from "../context/InboxContext";
import { useToast } from "../context/ToastContext";

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({ name, size = "md" }) {
  const s = size === "sm" ? "w-7 h-7 text-xs rounded-lg" : "w-10 h-10 text-sm rounded-xl";
  return (
    <div className={`${s} bg-blue-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm`}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Inbox() {
  const { currentUser } = useAuth();
  const { getConversations, markAsRead, deleteMessage, replyMessage } = useInbox();
  const { toast } = useToast();
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-200 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-6xl mb-4">🔒</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Inicia sesión para ver tu inbox</h2>
          <Link to="/" className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  const conversations = getConversations(currentUser.id);
  const selectedConv = selected
    ? conversations.find((c) => c.key === selected)
    : null;

  const handleSelect = (conv) => {
    setSelected(conv.key);
    setReplyText("");
    setReplySent(false);
    conv.messages
      .filter((m) => m.toId === currentUser.id && !m.read)
      .forEach((m) => markAsRead(m.id));
  };

  const handleReply = () => {
    if (!replyText.trim() || !selectedConv) return;
    const lastMsg = selectedConv.messages[selectedConv.messages.length - 1];
    replyMessage({
      originalMsg: lastMsg,
      fromId: currentUser.id,
      fromName: currentUser.name,
      text: replyText,
    });
    setReplyText("");
    setReplySent(true);
    toast({ message: "Respuesta enviada ✉️", type: "success" });
    setTimeout(() => setReplySent(false), 2000);
  };

  const handleDelete = (id) => {
    deleteMessage(id);
    if (selectedConv?.messages.length <= 1) setSelected(null);
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 transition-colors duration-300">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              Inbox
              {conversations.reduce((acc, c) => acc + c.unread, 0) > 0 && (
                <span className="bg-red-500 text-white text-sm px-2.5 py-1 rounded-full font-bold">
                  {conversations.reduce((acc, c) => acc + c.unread, 0)}
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {conversations.length === 0 ? "No tienes mensajes" : `${conversations.length} conversación${conversations.length !== 1 ? "es" : ""}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LISTA DE CONVERSACIONES */}
          <div className="lg:col-span-1 space-y-2">
            {conversations.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-md border border-gray-200 dark:border-gray-700">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">No tienes mensajes aún</p>
                <p className="text-gray-400 text-xs mt-1">Los mensajes de tus propiedades aparecerán aquí</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <motion.div
                  key={conv.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => handleSelect(conv)}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-all border-2 ${
                    selected === conv.key
                      ? "border-blue-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={conv.otherName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{conv.otherName}</p>
                        <p className="text-xs text-gray-400 shrink-0">{timeAgo(conv.messages[0].createdAt)}</p>
                      </div>
                      <p className="text-xs text-blue-500 dark:text-blue-400 truncate mt-0.5">🏠 {conv.propertyTitle}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                        {conv.messages[conv.messages.length - 1].text}
                      </p>
                    </div>
                    {conv.unread > 0 && (
                      <span className="bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* DETALLE CONVERSACIÓN */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {selectedConv ? (
                <motion.div
                  key={selectedConv.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col"
                  style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}
                >
                  {/* HEADER CONVERSACIÓN */}
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={selectedConv.otherName} />
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{selectedConv.otherName}</p>
                        <Link to={`/property/${selectedConv.propertyId}`} className="text-xs text-blue-500 hover:underline">
                          🏠 {selectedConv.propertyTitle}
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* MENSAJES */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {[...selectedConv.messages]
                      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                      .map((msg) => {
                        const isMe = msg.fromId === currentUser.id;
                        return (
                          <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                            <Avatar name={msg.fromName} size="sm" />
                            <div className={`max-w-[75%] group`}>
                              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                isMe
                                  ? "bg-blue-600 text-white rounded-tr-sm"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm"
                              }`}>
                                {msg.text}
                              </div>
                              <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                <p className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</p>
                                <button
                                  onClick={() => handleDelete(msg.id)}
                                  className="text-xs text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* REPLY BOX */}
                  <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    {replySent ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 rounded-xl px-4 py-2.5 text-sm font-semibold text-center"
                      >
                        ✅ Mensaje enviado
                      </motion.div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleReply()}
                          placeholder={`Responder a ${selectedConv.otherName}...`}
                          className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                        <button
                          onClick={handleReply}
                          disabled={!replyText.trim()}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-semibold transition text-sm"
                        >
                          Enviar
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center p-12"
                  style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}
                >
                  <p className="text-5xl mb-4">✉️</p>
                  <p className="text-gray-500 dark:text-gray-400 font-semibold">Selecciona una conversación</p>
                  <p className="text-gray-400 text-sm mt-1">para leer y responder mensajes</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}