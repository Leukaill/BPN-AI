import { LiquidGlass } from "./ui/liquid-glass";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { User, Bot, FileText, Check, ExternalLink } from "lucide-react";
import { Message } from "@shared/schema";

interface FormattedMessageProps {
  content: string;
  isUser: boolean;
}

function FormattedMessage({ content, isUser }: FormattedMessageProps) {
  const formatText = (text: string) => {
    // First, let's handle proper paragraphs by splitting on double newlines
    const sections = text.split('\n\n').filter(section => section.trim());
    
    return sections.map((section, sectionIndex) => {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      
      // Check if this whole section is a list
      const isListSection = lines.every(line => /^[-•*]\s/.test(line) || /^\d+\.\s/.test(line));
      
      if (isListSection) {
        // Handle as a list block
        return (
          <div key={sectionIndex} className="mb-4">
            {lines.map((line, lineIndex) => {
              const content = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
              return (
                <div key={lineIndex} className="ml-4 mb-2 flex items-start space-x-2">
                  <span className={`font-bold mt-1 ${isUser ? 'text-white/80' : 'text-blue-500 dark:text-blue-400'}`}>•</span>
                  <span className="flex-1 leading-relaxed">{content}</span>
                </div>
              );
            })}
          </div>
        );
      }
      
      // Handle as regular content with proper paragraph structure
      return (
        <div key={sectionIndex} className="mb-5">
          {lines.map((line, lineIndex) => {
            // Check different types of content
            const isMainHeader = /^[A-Z\s]{5,}:?$/.test(line) || /^#{1,3}\s/.test(line);
            const isSubheading = line.endsWith(':') && line.length < 60 && !line.includes('?');
            const isNumberedSection = /^\d+\.\s*[A-Z]/.test(line);
            const isKeyValue = line.includes(':') && !line.endsWith(':') && line.length < 100;
            
            // Determine styling and spacing
            let className = '';
            let content = line;
            
            if (isMainHeader) {
              className = 'font-bold text-lg text-blue-600 dark:text-blue-400 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700';
            } else if (isNumberedSection) {
              className = 'font-semibold text-base mb-3 mt-4';
            } else if (isSubheading) {
              className = 'font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-3';
            } else if (isKeyValue) {
              className = 'mb-3 leading-relaxed';
              const [key, ...valueParts] = line.split(':');
              content = `${key.trim()}:`;
              const value = valueParts.join(':').trim();
              return (
                <div key={lineIndex} className={className}>
                  <span className="font-medium">{content}</span>
                  {value && <span className="ml-2 text-gray-700 dark:text-gray-300">{value}</span>}
                </div>
              );
            } else {
              // Regular paragraph text
              className = 'mb-3 leading-relaxed text-gray-800 dark:text-gray-200';
            }
            
            return (
              <div key={lineIndex} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="space-y-2">
      {formatText(content)}
    </div>
  );
}

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`max-w-xs lg:max-w-3xl ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-start space-x-3 mb-2">
          {!isUser && (
            <div className="w-8 h-8 bg-bpn-turquoise rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-foreground/70">
                {isUser ? "You" : "BPN AI"}
              </span>
              <span className="text-xs text-foreground/50">
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
          className={`p-6 rounded-xl shadow-lg ${
            isUser 
              ? "bg-bpn-turquoise/90 text-white ml-12" 
              : "bg-white/95 dark:bg-gray-800/95 text-gray-900 dark:text-white mr-12"
          }`}
        >
          <div className="space-y-4">
            {hasAttachments && (
              <div className="flex items-center space-x-2">
                <FileText className={`w-4 h-4 ${isUser ? "text-white/70" : "text-gray-600 dark:text-gray-300"}`} />
                <span className={`text-xs ${isUser ? "text-white/70" : "text-gray-600 dark:text-gray-300"}`}>
                  Attachment included
                </span>
              </div>
            )}
            
            <div className="prose prose-sm max-w-none">
              <div className={`text-sm leading-relaxed ${isUser ? "text-white" : "text-gray-900 dark:text-white"}`}>
                <FormattedMessage content={message.content} isUser={isUser} />
              </div>
            </div>

            {!isUser && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
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
                      className="text-xs p-1 h-auto text-gray-600 dark:text-gray-300"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Sources
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs p-1 h-auto text-gray-600 dark:text-gray-300"
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
