import { LiquidGlass } from "./ui/liquid-glass";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { User, Bot, FileText, Check, ExternalLink } from "lucide-react";
import { Message } from "@shared/schema";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasAttachments = message.metadata && 
    typeof message.metadata === 'object' && 
    'attachments' in message.metadata;

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-2xl ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-start space-x-3 mb-2">
          {!isUser && (
            <div className="w-8 h-8 bg-bpn-turquoise rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-bpn-black/70">
                {isUser ? "You" : "BPN AI"}
              </span>
              <span className="text-xs text-bpn-black/50">
                {formatTime(message.createdAt)}
              </span>
            </div>
          </div>
          {isUser && (
            <div className="w-8 h-8 bg-bpn-green rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        <LiquidGlass
          className={`p-4 liquid-bubble animate-morphing ${
            isUser 
              ? "message-bubble-user" 
              : "message-bubble-ai"
          }`}
        >
          <div className="space-y-3">
            {hasAttachments && (
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/70">
                  {/* TODO: Display actual attachment info */}
                  Attachment included
                </span>
              </div>
            )}
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>

            {!isUser && (
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    AI Generated
                  </Badge>
                  {message.metadata && 
                   typeof message.metadata === 'object' && 
                   'sources' in message.metadata && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs p-1 h-auto"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Sources
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs p-1 h-auto"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Helpful
                </Button>
              </div>
            )}
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}
