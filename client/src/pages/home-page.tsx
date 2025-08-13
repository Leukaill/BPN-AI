import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { ChatArea } from "@/components/chat-area";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();



  return (
    <div className="h-screen bg-gradient-to-br from-denyse-white via-denyse-grey to-denyse-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-hidden relative mobile-safe-area">
      {/* Floating Liquid Elements Background - Hidden on mobile for performance */}
      <div className="floating-elements hidden md:block">
        <div className="absolute top-10 left-10 w-32 h-32 bg-denyse-turquoise opacity-20 rounded-full animate-bubble-float"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 bg-denyse-green opacity-15 rounded-full animate-bubble-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-20 h-20 bg-denyse-turquoise opacity-10 rounded-full animate-bubble-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Mobile menu button - positioned in chat header */}

      <div className="flex h-full relative z-10">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar 
            currentChatId={currentChatId} 
            onChatSelect={setCurrentChatId}
            onNewChat={() => setCurrentChatId(null)}
            isOpen={true}
            onClose={() => {}}
          />
        )}
        
        {/* Mobile Sidebar */}
        {isMobile && (
          <Sidebar 
            currentChatId={currentChatId} 
            onChatSelect={setCurrentChatId}
            onNewChat={() => setCurrentChatId(null)}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        
        <ChatArea 
          currentChatId={currentChatId} 
          onChatCreated={setCurrentChatId}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />
      </div>
    </div>
  );
}
