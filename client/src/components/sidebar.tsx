import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
  Trash2
} from "lucide-react";
import { Chat } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface SidebarProps {
  currentChatId: number | null;
  onChatSelect: (chatId: number) => void;
  onNewChat: () => void;
}

export function Sidebar({ currentChatId, onChatSelect, onNewChat }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [llmMode, setLlmMode] = useState<"online" | "local">("online");
  const [, setLocation] = useLocation();

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

  return (
    <div className="w-80 sidebar-glass flex flex-col relative overflow-hidden">
      {/* Liquid Glass Overlay */}
      <div className="absolute inset-0 liquid-gradient opacity-10"></div>
      
      {/* Header */}
      <div className="relative z-10 p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-bpn-black dark:text-white flex items-center">
            <Brain className="text-bpn-turquoise mr-3" />
            Denyse
          </h1>
          <div className="flex items-center space-x-2">
            {/* LLM Mode Toggle */}
            <LiquidGlass className="rounded-full p-1 animate-morphing">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLlmMode("online")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  llmMode === "online" 
                    ? "bg-bpn-turquoise text-white" 
                    : "text-bpn-black dark:text-white hover:bg-white/20"
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
                    ? "bg-bpn-turquoise text-white" 
                    : "text-bpn-black dark:text-white hover:bg-white/20"
                }`}
              >
                Local
              </Button>
            </LiquidGlass>
          </div>
        </div>
        
        {/* New Chat Button */}
        <Button
          onClick={onNewChat}
          className="w-full liquid-glass-strong rounded-xl p-4 text-bpn-black dark:text-white hover:bg-white/40 transition-all duration-300 group ripple-effect"
          variant="ghost"
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus className="text-bpn-turquoise group-hover:rotate-180 transition-transform duration-300" />
            <span className="font-medium">New Chat</span>
          </div>
        </Button>
      </div>

      {/* Recent Chats */}
      <div className="flex-1 relative z-10">
        <ScrollArea className="h-full">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-bpn-black dark:text-white mb-4 flex items-center">
              <History className="text-bpn-turquoise mr-2" />
              Recent
            </h2>
            
            {chats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-bpn-black/70 dark:text-white/70">No chats yet</p>
                <p className="text-xs text-bpn-black/50 dark:text-white/50 mt-1">Start a new conversation to see it here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat, index) => (
                  <LiquidGlass
                    key={chat.id}
                    className={`rounded-lg p-3 hover:bg-white/30 transition-all duration-300 cursor-pointer group animate-morphing ${
                      currentChatId === chat.id ? "bg-white/40" : ""
                    }`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => onChatSelect(chat.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {chat.title.toLowerCase().includes("pdf") ? (
                          <FileText className="w-4 h-4 text-bpn-turquoise" />
                        ) : chat.title.toLowerCase().includes("bpn") ? (
                          <Globe className="w-4 h-4 text-bpn-green" />
                        ) : (
                          <BarChart className="w-4 h-4 text-bpn-turquoise" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-bpn-black dark:text-white truncate">
                          {chat.title}
                        </p>
                        <p className="text-xs text-bpn-black/70 dark:text-white/70 mt-1">
                          {formatChatDate(chat.updatedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto w-auto hover:bg-red-500/20"
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
      <div className="relative z-10 p-6 border-t border-white/10">
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setLocation("/settings")}
            className="w-full liquid-glass rounded-lg p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start"
          >
            <Settings className="text-bpn-turquoise mr-3" />
            <span className="text-sm font-medium text-bpn-black">Settings</span>
          </Button>
          
          <Button
            variant="ghost"
            className="w-full liquid-glass rounded-lg p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start"
          >
            <HelpCircle className="text-bpn-green mr-3" />
            <span className="text-sm font-medium text-bpn-black">Help</span>
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            className="w-full liquid-glass rounded-lg p-3 text-left hover:bg-white/30 transition-all duration-300 group justify-start"
          >
            <span className="text-sm font-medium text-bpn-black">Sign Out</span>
          </Button>
        </div>
        
        {user && (
          <div className="mt-4 text-center">
            <Badge variant="outline" className="liquid-glass">
              {user.username}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
