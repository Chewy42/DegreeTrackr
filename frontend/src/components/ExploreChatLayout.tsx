import React, { useState } from "react";
import ExploreChat from "./ExploreChat";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { usePageTitle } from "../hooks/usePageTitle";

export default function ExploreChatLayout() {
  usePageTitle("Explore");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full gap-4 p-4">
      <div className="flex-1 min-w-0 bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <ExploreChat sessionId={selectedSessionId} onSessionChange={setSelectedSessionId} />
      </div>
      <div className="hidden xl:flex w-80 flex-col bg-surface rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
        <ChatHistorySidebar 
          currentSessionId={selectedSessionId} 
          onSelectSession={setSelectedSessionId} 
        />
      </div>
    </div>
  );
}
