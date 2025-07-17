import { LiquidGlass } from "./ui/liquid-glass";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { User, Bot, FileText, Check, ExternalLink } from "lucide-react";
import { Message } from "@shared/schema";
import { DownloadButton } from "./download-button";

interface FormattedMessageProps {
  content: string;
  isUser: boolean;
}

function FormattedMessage({ content, isUser }: FormattedMessageProps) {
  const formatText = (text: string) => {
    // First, check if the message contains download information
    const downloadMatch = text.match(/📁 DOWNLOAD AVAILABLE[\s\S]*?🔗 Download Link: (\/api\/downloads\/[a-f0-9-]+)/);
    
    if (downloadMatch) {
      // Extract download information
      const downloadUrl = downloadMatch[1];
      const filenameMatch = text.match(/• File: ([^\n]+)/);
      const formatMatch = text.match(/• Format: ([^\n]+)/);
      const sizeMatch = text.match(/• Size: ([^\n]+)/);
      const expiresMatch = text.match(/• Expires: ([^\n]+)/);
      
      if (filenameMatch && formatMatch && sizeMatch && expiresMatch) {
        // Split content into main content and download section
        const mainContent = text.split('---')[0].trim();
        
        // Parse main content as normal
        const mainFormatted = formatMainContent(mainContent);
        
        // Add download button
        return [
          ...mainFormatted,
          <DownloadButton
            key="download"
            downloadUrl={downloadUrl}
            filename={filenameMatch[1]}
            format={formatMatch[1]}
            size={sizeMatch[1]}
            expiresAt={expiresMatch[1]}
          />
        ];
      }
    }
    
    // If no download, format as normal
    return formatMainContent(text);
  };

  const formatMainContent = (text: string) => {
    // Split on sentence boundaries and group into logical paragraphs
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    const paragraphs: string[] = [];
    let currentParagraph = '';
    
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      
      // Check if this sentence starts a new section (numbered, headers, etc.)
      const startsNewSection = /^\d+\./.test(trimmedSentence) || 
                               /^[A-Z\s]{5,}:/.test(trimmedSentence) ||
                               /^STEP|^KEY|^IMPORTANT|^NOTE:/i.test(trimmedSentence);
      
      // If we have a current paragraph and this starts a new section, save current paragraph
      if (currentParagraph && startsNewSection) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = trimmedSentence;
      } else if (currentParagraph.length > 300 && trimmedSentence.length > 0) {
        // If current paragraph is getting long, break it
        paragraphs.push(currentParagraph.trim());
        currentParagraph = trimmedSentence;
      } else {
        // Add to current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedSentence;
      }
      
      // If this is the last sentence, add the current paragraph
      if (index === sentences.length - 1 && currentParagraph) {
        paragraphs.push(currentParagraph.trim());
      }
    });
    
    // If no sentences were found, treat as single paragraph
    if (paragraphs.length === 0 && text.trim()) {
      paragraphs.push(text.trim());
    }
    
    return paragraphs.map((paragraph, index) => {
      const trimmedParagraph = paragraph.trim();
      
      // Check different types of content
      const isMainHeader = /^[A-Z\s]{5,}:?$/.test(trimmedParagraph) || /^#{1,3}\s/.test(trimmedParagraph);
      const isNumberedSection = /^\d+\.\s*[A-Z]/.test(trimmedParagraph);
      const isSubheading = trimmedParagraph.endsWith(':') && trimmedParagraph.length < 60;
      const isListContent = /[-•*]\s|^\d+\.\s/.test(trimmedParagraph);
      
      // Determine styling and spacing
      let className = '';
      
      if (isMainHeader) {
        className = 'font-bold text-lg text-blue-600 dark:text-blue-400 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700';
      } else if (isNumberedSection) {
        className = 'font-semibold text-base mb-4 mt-6';
      } else if (isSubheading) {
        className = 'font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-4';
      } else if (isListContent) {
        // Handle list items specially
        const listItems = trimmedParagraph.split(/(?=[-•*]\s|\d+\.\s)/).filter(item => item.trim());
        return (
          <div key={index} className="mb-4">
            {listItems.map((item, itemIndex) => {
              const cleanItem = item.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
              if (!cleanItem) return null;
              
              return (
                <div key={itemIndex} className="ml-4 mb-2 flex items-start space-x-3">
                  <span className={`font-bold mt-1 ${isUser ? 'text-white/80' : 'text-blue-500 dark:text-blue-400'}`}>•</span>
                  <span className="flex-1 leading-relaxed">{cleanItem}</span>
                </div>
              );
            })}
          </div>
        );
      } else {
        // Regular paragraph text with generous spacing
        className = 'mb-5 leading-relaxed text-gray-800 dark:text-gray-200 text-justify';
      }
      
      return (
        <div key={index} className={className}>
          {trimmedParagraph}
        </div>
      );
    });
  };

  return (
    <div className="space-y-3">
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
            <div className="w-8 h-8 bg-denyse-turquoise rounded-full flex items-center justify-center flex-shrink-0">
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
            <div className="w-8 h-8 bg-denyse-green rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        <LiquidGlass
          className={`p-6 rounded-xl shadow-lg ${
            isUser 
              ? "bg-denyse-turquoise/90 text-white ml-12" 
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
