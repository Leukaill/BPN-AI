import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatArea } from "@/components/chat-area";
import { useAuth } from "@/hooks/use-auth";

export default function HomePage() {
  const { user } = useAuth();
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);

  return (
    <div className="h-screen bg-gradient-to-br from-bpn-white via-bpn-grey to-bpn-white overflow-hidden relative">
      {/* Floating Liquid Elements Background */}
      <div className="floating-elements">
        <div className="absolute top-10 left-10 w-32 h-32 bg-bpn-turquoise opacity-20 rounded-full animate-bubble-float"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 bg-bpn-green opacity-15 rounded-full animate-bubble-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-20 h-20 bg-bpn-turquoise opacity-10 rounded-full animate-bubble-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="flex h-full relative z-10">
        <Sidebar 
          currentChatId={currentChatId} 
          onChatSelect={setCurrentChatId}
          onNewChat={() => setCurrentChatId(null)}
        />
        <ChatArea 
          currentChatId={currentChatId} 
          onChatCreated={setCurrentChatId}
        />
      </div>
    </div>
  );
}
