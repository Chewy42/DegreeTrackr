import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FiSend,
  FiPlus,
  FiMessageSquare,
  FiRefreshCw,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../auth/AuthContext";
import {
  getSessionMessagesConvex,
  sendCurrentExploreMessageConvex,
} from "../lib/convex";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
};

type Props = {
  sessionId: string | null;
  onSessionChange: (id: string | null) => void;
};

const DEFAULT_SUGGESTIONS = [
  "What can I do with my major?",
  "Am I on track to graduate?",
  "Show me my degree progress",
];

export default function ExploreChat({ sessionId, onSessionChange }: Props) {
  const { jwt } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeSessionRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  }, []);

  // Load session history from Convex when sessionId changes
  useEffect(() => {
    if (!jwt) return;
    if (isSendingRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    activeSessionRef.current = sessionId;

    if (sessionId) {
      setMessages([]);
      setSuggestions([]);
      setHistoryError(null);
      setHistoryLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      getSessionMessagesConvex(sessionId)
        .then(entries => {
          if (controller.signal.aborted) return;
          if (activeSessionRef.current === sessionId && !isSendingRef.current) {
            setMessages(entries.map(m => ({
              role: m.role,
              content: m.content,
              timestamp: new Date(m.createdAt),
            })));
            setHistoryError(null);
          }
        })
        .catch(err => {
          if (controller.signal.aborted) return;
          console.error(err);
          if (activeSessionRef.current === sessionId) {
            setMessages([]);
            setHistoryError("We couldn't load this chat history. Try refreshing or start a new chat.");
          }
        })
        .finally(() => {
          if (activeSessionRef.current === sessionId) setHistoryLoading(false);
        });
    } else {
      setMessages([]);
      setSuggestions(DEFAULT_SUGGESTIONS);
      setHistoryError(null);
      setHistoryLoading(false);
    }
  }, [sessionId, jwt]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e?: React.FormEvent, msgOverride?: string) => {
    e?.preventDefault();
    const textToSend = msgOverride || input;
    if (!textToSend.trim() || !jwt || loading) return;

    const userMsg = textToSend.trim();
    let currentSessionId = sessionId;

    isSendingRef.current = true;
    setInput("");
    setSuggestions([]);
    setHistoryError(null);
    setLastFailedMessage(null);
    setMessages(prev => [...prev, { role: "user", content: userMsg, timestamp: new Date() }]);
    setLoading(true);

    try {
      const response = await sendCurrentExploreMessageConvex({
        jwt,
        message: userMsg,
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
      });

      activeSessionRef.current = response.session.id;
      if (response.session.id !== currentSessionId) {
        onSessionChange(response.session.id);
      }

      setMessages(response.messages.map(message => ({
        role: message.role,
        content: message.content,
        timestamp: new Date(message.createdAt),
      })));
      setSuggestions(response.suggestions.slice(0, 3));
    } catch (err) {
      console.error(err);
      setLastFailedMessage(userMsg);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date() }]);
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  const handleNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setInput("");
    setLoading(false);
    setHistoryLoading(false);
    setHistoryError(null);
    setLastFailedMessage(null);
    setSuggestions(DEFAULT_SUGGESTIONS);
    activeSessionRef.current = null;
    onSessionChange(null);
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface/80 backdrop-blur-sm z-10">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <span className="bg-brand-100 p-1.5 rounded-lg text-brand-600">
              <FiMessageSquare className="h-4 w-4" />
            </span>
            Explore My Options
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Reflect on your journey and plan your future
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-muted hover:bg-surface-elevated rounded-lg transition-colors border border-border-subtle"
        >
          <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
          New Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref={scrollRef} aria-live="polite" aria-label="Conversation" role="log">
        {historyLoading && (
          <div role="status" aria-live="polite" className="flex items-center justify-center h-full">
            <span className="sr-only">Loading chat history</span>
            <div className="flex gap-1" aria-hidden="true">
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {!historyLoading && historyError && (
          <div role="alert" aria-live="assertive" className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {historyError}
          </div>
        )}

        {!historyLoading && !historyError && messages.length === 0 && !loading && (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-60 mt-10">
            <div className="bg-brand-50 p-4 rounded-full" aria-hidden="true">
              <FiMessageSquare className="h-8 w-8 text-brand-400" />
            </div>
            <div className="max-w-xs">
              <h3 className="text-sm font-medium text-slate-800">Start a new exploration</h3>
              <p className="text-xs text-slate-500 mt-1">
                Ask about your major, career paths, or degree progress.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex w-full ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] lg:max-w-[75%] min-w-0 rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm break-words overflow-hidden ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-br-none"
                  : "bg-surface border border-border-subtle text-text-primary rounded-bl-none"
              }`}
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                className="prose prose-sm max-w-none overflow-hidden break-words prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                  a: ({node, ...props}) => <a className="text-brand-500 hover:underline" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex w-full justify-start">
             <div role="status" aria-live="polite" className="bg-surface border border-border-subtle rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
               <span className="sr-only">AI advisor is responding</span>
               <div className="flex gap-1" aria-hidden="true">
                 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                 <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface border-t border-border-subtle">
        {lastFailedMessage && !loading && (
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={() => handleSend(undefined, lastFailedMessage)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
            >
              <FiRefreshCw className="h-3 w-3" aria-hidden="true" />
              Retry last message
            </button>
          </div>
        )}
        {suggestions.length > 0 && !loading && (
          <div className="flex flex-wrap gap-2 mb-3 px-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(undefined, s)}
                className="text-xs bg-brand-50 text-brand-700 px-3 py-2.5 min-h-[44px] rounded-full hover:bg-brand-100 transition-colors border border-brand-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        
        <form
          onSubmit={(e) => handleSend(e)}
          className="relative flex items-center gap-2 bg-surface-muted p-2 rounded-xl border border-border-subtle focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100 transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your academic journey..."
            aria-label="Message to AI advisor"
	            className="flex-1 min-w-0 bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 text-sm text-text-primary placeholder:text-text-secondary px-2"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-lg hover:from-brand-600 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <FiSend className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
