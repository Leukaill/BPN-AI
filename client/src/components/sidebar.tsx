import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiquidGlass } from "./ui/liquid-glass";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { 
  Brain, 
  Plus, 
  History, 
  Settings, 
  HelpCircle, 
  FileText, 
  Globe, 
  BarChart,
  Trash2,
  X
} from "lucide-react";
import { Chat } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface SidebarProps {
  currentChatId: number | null;
  onChatSelect: (chatId: number) => void;
  onNewChat: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ currentChatId, onChatSelect, onNewChat, isOpen, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [llmMode, setLlmMode] = useState<"online" | "local">("online");
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();

  const { data: chats = [] } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    enabled: !!user,
  });

  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest("DELETE", `/api/chats/${chatId}`);
      // The query will automatically refetch and update the UI
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const formatChatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const sidebarClasses = isMobile 
    ? `fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } sidebar-glass dark:bg-slate-900/50 flex flex-col relative overflow-hidden mobile-safe-area`
    : `w-80 sidebar-glass dark:bg-slate-900/50 flex flex-col relative overflow-hidden`;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 z-40 mobile-overlay"
          onClick={onClose}
        />
      )}
      
      <div className={sidebarClasses}>
        {/* Liquid Glass Overlay */}
        <div className="absolute inset-0 liquid-gradient opacity-10"></div>
      
      {/* Header */}
      <div className="relative z-10 p-4 md:p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-denyse-black dark:text-white flex items-center">
            <Brain className="text-denyse-turquoise mr-2 md:mr-3 w-6 h-6 md:w-8 md:h-8" />
            Denyse
          </h1>
          <div className="flex items-center space-x-2">
            {/* Mobile close button */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="mobile-touch-target p-2 hover:bg-white/20"
              >
                <X className="w-5 h-5 text-denyse-turquoise" />
              </Button>
            )}
            {/* LLM Mode Toggle */}
            <LiquidGlass className="rounded-full p-1 animate-morphing">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLlmMode("online")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  llmMode === "online" 
                    ? "bg-denyse-turquoise text-white" 
                    : "text-denyse-black dark:text-white hover:bg-white/20"
                }`}
              >
                Online
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLlmMode("local")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  llmMode === "local" 
                    ? "bg-denyse-turquoise text-white" 
                    : "text-denyse-black dark:text-white hover:bg-white/20"
                }`}
              >
                Local
              </Button>
            </LiquidGlass>
          </div>
        </div>
        
        {/* New Chat Button */}
        <Button
          onClick={() => {
            onNewChat();
            if (isMobile && onClose) onClose();
          }}
          className="w-full liquid-glass-strong rounded-xl p-3 md:p-4 text-denyse-black dark:text-white hover:bg-white/40 transition-all duration-300 group ripple-effect mobile-touch-target"
          variant="ghost"
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus className="text-denyse-turquoise group-hover:rotate-180 transition-transform duration-300 w-5 h-5" />
            <span className="font-medium text-sm md:text-base">New Chat</span>
          </div>
        </Button>
      </div>

      {/* Recent Chats */}
      <div className="flex-1 relative z-10">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-denyse-black dark:text-white mb-3 md:mb-4 flex items-center">
              <History className="text-denyse-turquoise mr-2 w-4 h-4 md:w-5 md:h-5" />
              Recent
            </h2>
            
            {chats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 dark:text-gray-400">No chats yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Start a new conversation to see it here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat, index) => (
                  <LiquidGlass
                    key={chat.id}
                    className={`rounded-lg p-2 md:p-3 hover:bg-white/30 transition-all duration-300 cursor-pointer group mobile-touch-target ${
                      currentChatId === chat.id ? "bg-white/40" : ""
                    } ${!isMobile ? "animate-morphing" : ""}`}
                    style={!isMobile ? { animationDelay: `${index * 0.1}s` } : {}}
                    onClick={() => {
                      onChatSelect(chat.id);
                      if (isMobile && onClose) onClose();
                    }}
                  >
                    <div className="flex items-start space-x-2 md:space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {chat.title.toLowerCase().includes("pdf") ? (
                          <FileText className="w-3 h-3 md:w-4 md:h-4 text-denyse-turquoise" />
                        ) : chat.title.toLowerCase().includes("bpn") ? (
                          <Globe className="w-3 h-3 md:w-4 md:h-4 text-denyse-green" />
                        ) : (
                          <BarChart className="w-3 h-3 md:w-4 md:h-4 text-denyse-turquoise" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-denyse-black dark:text-white truncate">
                          {chat.title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {formatChatDate(chat.updatedAt.toString())}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 md:transition-opacity p-1 h-auto w-auto hover:bg-red-500/20 mobile-touch-target"
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </LiquidGlass>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom Menu */}
      <div className="relative z-10 p-4 md:p-6 border-t border-white/10">
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => {
              setLocation("/settings");
              if (isMobile && onClose) onClose();
            }}
            className="w-full liquid-glass rounded-lg p-2 md:p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start mobile-touch-target"
          >
            <Settings className="text-denyse-turquoise mr-2 md:mr-3 w-4 h-4" />
            <span className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200">Settings</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full liquid-glass rounded-lg p-2 md:p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start mobile-touch-target"
          >
            <HelpCircle className="text-denyse-green mr-2 md:mr-3 w-4 h-4" />
            <span className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200">Help</span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            className="w-full liquid-glass rounded-lg p-2 md:p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start mobile-touch-target"
          >
            <span className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200">Sign Out</span>
          </Button>
        </div>
        
        {user && (
          <div className="mt-3 md:mt-4 text-center">
            <Badge variant="outline" className="liquid-glass text-xs">
              {user.username}
            </Badge>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
