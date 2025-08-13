import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { useIsMobile } from "@/hooks/use-mobile";
import { LiquidGlass } from "./ui/liquid-glass";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { MessageBubble } from "./message-bubble";
import { FileUpload } from "./file-upload";
import { VoiceInput } from "./voice-input";
import { 
  Bot, 
  Send, 
  Paperclip, 
  Mic, 
  FileText, 
  Upload, 
  BarChart, 
  Globe,
  MoreVertical,
  X,
  Menu
} from "lucide-react";
import { Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  currentChatId: number | null;
  onChatCreated: (chatId: number) => void;
  onToggleSidebar?: () => void;
}

export function ChatArea({ currentChatId, onChatCreated, onToggleSidebar }: ChatAreaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/chats", currentChatId, "messages"],
    enabled: !!currentChatId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentChatId) {
        // Create new chat first
        const chatResponse = await apiRequest("POST", "/api/chats", {
          title: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
        });
        const chat = await chatResponse.json();
        onChatCreated(chat.id);
        
        // Send message to new chat
        const messageResponse = await apiRequest("POST", `/api/chats/${chat.id}/messages`, {
          role: "user",
          content,
        });
        return messageResponse.json();
      } else {
        // Send message to existing chat
        const response = await apiRequest("POST", `/api/chats/${currentChatId}/messages`, {
          role: "user",
          content,
        });
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      if (currentChatId) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chats", currentChatId, "messages"] 
        });
      }
      setMessage("");
    },
  });

  const handleSendMessage = () => {
    if (message.trim()) {
      let finalMessage = message;
      
      // If there's an uploaded document, include it in the message context
      if (uploadedDocument) {
        finalMessage = `${message}\n\n[Document: ${uploadedDocument.originalName} - ID: ${uploadedDocument.id}]`;
      }
      
      sendMessageMutation.mutate(finalMessage);
      
      // Clear uploaded file state after sending
      setUploadedFile(null);
      setUploadedDocument(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await apiRequest("POST", "/api/knowledge-base/upload", formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Upload failed");
      }
      
      const document = await response.json();
      
      // Store the uploaded file and document for later use
      setUploadedFile(file);
      setUploadedDocument(document);
      
      // Add file info to the message input
      setMessage(`[📄 ${document.originalName} uploaded] `);
      
      // Show success notification
      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded and processed`,
      });
      
    } catch (error: any) {
      console.error("File upload failed:", error);
      
      // Enhanced error handling for different error types
      let errorMessage = "Failed to upload file";
      
      if (error.message?.includes("rate limit") || error.message?.includes("Too many")) {
        errorMessage = "Upload rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message?.includes("File Too Large")) {
        errorMessage = "File is too large. Please select a file smaller than 50MB.";
      } else if (error.message?.includes("Invalid file")) {
        errorMessage = "Invalid file type or format. Please check file requirements.";
      } else if (error.message?.includes("malicious")) {
        errorMessage = "File contains potentially unsafe content and cannot be uploaded.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleVoiceInput = (transcript: string) => {
    setMessage(transcript);
  };

  return (
    <div className={`flex-1 flex flex-col relative mobile-keyboard-adjust ${isMobile ? 'w-full' : ''}`}>
      {/* Liquid Glass Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-denyse-white/90 to-denyse-grey/30 dark:from-slate-800/50 dark:to-slate-900/30 backdrop-blur-sm"></div>
      
      {/* Chat Header */}
      <div className="relative z-10 liquid-glass-strong border-b border-white/10 p-4 md:p-6 mobile-safe-area">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Mobile hamburger menu integrated into header */}
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleSidebar}
                className="mobile-glass p-2 mobile-touch-target mr-2 hover:bg-white/20 rounded-lg"
              >
                <Menu className="w-5 h-5 text-denyse-turquoise" />
              </Button>
            )}
            
            <div className="liquid-bubble w-10 h-10 md:w-12 md:h-12 bg-denyse-turquoise rounded-full flex items-center justify-center">
              <Bot className="text-white text-lg md:text-xl" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Denyse</h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-slate-300 hidden sm:block">Powered by Advanced Language Models</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3">
            <LiquidGlass className="rounded-full px-3 md:px-4 py-1 md:py-2 hidden sm:block">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-denyse-green rounded-full animate-pulse"></div>
                <span className="text-xs md:text-sm text-gray-900 dark:text-slate-200 font-medium">Online</span>
              </div>
            </LiquidGlass>
            <Button
              variant="ghost"
              size="sm"
              className="liquid-glass rounded-full p-2 hover:bg-white/40 transition-all duration-300 ripple-effect mobile-touch-target"
            >
              <MoreVertical className="text-denyse-turquoise w-4 h-4 md:w-5 md:h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 relative z-10 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-6">
            {!currentChatId && messages.length === 0 ? (
              <div className="max-w-4xl mx-auto">
                {/* Welcome Message */}
                <div className={`text-center px-4 relative ${isMobile ? 'py-6' : 'py-8 md:py-16'}`}>
                  {/* Mobile-optimized animated background elements */}
                  {isMobile && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-1/4 left-1/6 w-20 h-20 bg-denyse-turquoise/15 rounded-full blur-lg animate-pulse"></div>
                      <div className="absolute bottom-1/3 right-1/6 w-24 h-24 bg-denyse-green/15 rounded-full blur-lg animate-pulse" style={{animationDelay: '1s'}}></div>
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    <div className={`liquid-bubble bg-gradient-to-br from-denyse-turquoise via-blue-500 to-denyse-green rounded-full mx-auto flex items-center justify-center shadow-2xl ring-4 ring-white/20 dark:ring-slate-700/20 ${isMobile ? 'w-16 h-16 mb-4' : 'w-20 h-20 md:w-28 md:h-28 mb-6 md:mb-8'}`}>
                      <Bot className={`text-white drop-shadow-lg ${isMobile ? 'text-lg' : 'text-2xl md:text-4xl'}`} />
                    </div>
                    
                    <div className={`space-y-3 ${isMobile ? '' : 'md:space-y-6'}`}>
                      <h2 className={`font-bold bg-gradient-to-r from-denyse-turquoise via-blue-600 to-denyse-green bg-clip-text text-transparent ${isMobile ? 'text-2xl mb-3' : 'text-3xl md:text-4xl lg:text-5xl mb-4 md:mb-6'}`}>
                        Meet Denyse
                      </h2>
                      <div className="inline-block">
                        <p className={`text-gray-700 dark:text-slate-300 font-medium mb-2 ${isMobile ? 'text-base' : 'text-lg md:text-xl'}`}>
                          Your AI-Powered M&E Assistant
                        </p>
                        <div className="h-0.5 bg-gradient-to-r from-denyse-turquoise to-denyse-green rounded-full"></div>
                      </div>
                      
                      <p className={`text-gray-600 dark:text-slate-400 mx-auto leading-relaxed ${isMobile ? 'text-sm max-w-sm' : 'text-sm md:text-base max-w-3xl'}`}>
                        I specialize in Monitoring & Evaluation, helping you analyze documents, extract insights, 
                        and generate comprehensive reports with AI.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sample Capabilities */}
                <div className={`grid grid-cols-1 mx-auto ${isMobile ? 'gap-3 mb-6 max-w-sm' : 'md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-12 max-w-4xl'}`}>
                  <LiquidGlass className={`hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-500 cursor-pointer group border border-white/30 dark:border-slate-700/30 hover:border-denyse-turquoise/30 mobile-touch-target relative overflow-hidden ${isMobile ? 'rounded-xl p-4 hover:shadow-lg' : 'rounded-2xl p-6 md:p-8 hover:shadow-xl hover:shadow-denyse-turquoise/10'}`}>
                    {!isMobile && <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-denyse-turquoise/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}
                    <div className={`flex items-start relative z-10 ${isMobile ? 'space-x-3' : 'space-x-4 md:space-x-5'}`}>
                      <div className={`flex-shrink-0 bg-gradient-to-br from-denyse-turquoise to-blue-500 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 ${isMobile ? 'w-10 h-10 group-hover:scale-105' : 'w-12 h-12 md:w-14 md:h-14 rounded-2xl group-hover:scale-110'}`}>
                        <Upload className={`text-white ${isMobile ? 'text-sm' : 'text-lg md:text-xl'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-gray-900 dark:text-white mb-1 group-hover:text-denyse-turquoise transition-colors duration-300 ${isMobile ? 'text-sm' : 'text-base md:text-lg mb-2'}`}>
                          Document Analysis
                        </h3>
                        <p className={`text-gray-600 dark:text-gray-400 leading-relaxed ${isMobile ? 'text-xs' : 'text-sm md:text-base'}`}>
                          {isMobile ? 'Upload PDFs, DOCX files for instant M&E analysis.' : 'Upload PDFs, DOCX files and extract key M&E insights instantly with AI-powered analysis.'}
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className={`hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-500 cursor-pointer group border border-white/30 dark:border-slate-700/30 hover:border-denyse-green/30 mobile-touch-target relative overflow-hidden ${isMobile ? 'rounded-xl p-4 hover:shadow-lg' : 'rounded-2xl p-6 md:p-8 hover:shadow-xl hover:shadow-denyse-green/10'}`}
                    style={{ animationDelay: '0.2s' }}
                  >
                    {!isMobile && <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-denyse-green/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}
                    <div className={`flex items-start relative z-10 ${isMobile ? 'space-x-3' : 'space-x-4 md:space-x-5'}`}>
                      <div className={`flex-shrink-0 bg-gradient-to-br from-denyse-green to-green-500 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 ${isMobile ? 'w-10 h-10 group-hover:scale-105' : 'w-12 h-12 md:w-14 md:h-14 rounded-2xl group-hover:scale-110'}`}>
                        <BarChart className={`text-white ${isMobile ? 'text-sm' : 'text-lg md:text-xl'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-gray-900 dark:text-white mb-1 group-hover:text-denyse-green transition-colors duration-300 ${isMobile ? 'text-sm' : 'text-base md:text-lg mb-2'}`}>
                          M&E Report Generation
                        </h3>
                        <p className={`text-gray-600 dark:text-gray-400 leading-relaxed ${isMobile ? 'text-xs' : 'text-sm md:text-base'}`}>
                          {isMobile ? 'Generate M&E reports with indicators and assessments.' : 'Create comprehensive M&E reports with indicators, outcomes, and impact assessments.'}
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className={`hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-500 cursor-pointer group border border-white/30 dark:border-slate-700/30 hover:border-denyse-turquoise/30 mobile-touch-target relative overflow-hidden ${isMobile ? 'rounded-xl p-4 hover:shadow-lg' : 'rounded-xl p-4 md:p-6 hover:bg-white/40 md:animate-morphing'}`}
                    style={{ animationDelay: '1s' }}
                  >
                    <div className={`flex items-start relative z-10 ${isMobile ? 'space-x-3' : 'space-x-3 md:space-x-4'}`}>
                      <div className={`flex-shrink-0 bg-gradient-to-br from-denyse-turquoise to-blue-500 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 ${isMobile ? 'w-10 h-10 group-hover:scale-105' : 'w-10 h-10'}`}>
                        <FileText className={`text-white ${isMobile ? 'text-sm' : 'text-lg'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-gray-900 dark:text-white mb-1 group-hover:text-denyse-turquoise transition-colors duration-300 ${isMobile ? 'text-sm' : 'text-sm md:text-base'}`}>
                          Intelligent Search
                        </h3>
                        <p className={`text-gray-600 dark:text-gray-400 leading-relaxed ${isMobile ? 'text-xs' : 'text-xs md:text-sm'}`}>
                          {isMobile ? 'Query with context and AI reasoning.' : 'Query information with context and reasoning capabilities.'}
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className={`hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all duration-500 cursor-pointer group border border-white/30 dark:border-slate-700/30 hover:border-denyse-green/30 mobile-touch-target relative overflow-hidden ${isMobile ? 'rounded-xl p-4 hover:shadow-lg' : 'rounded-xl p-4 md:p-6 hover:bg-white/40 md:animate-morphing'}`}
                    style={{ animationDelay: '1.5s' }}
                  >
                    <div className={`flex items-start relative z-10 ${isMobile ? 'space-x-3' : 'space-x-3 md:space-x-4'}`}>
                      <div className={`flex-shrink-0 bg-gradient-to-br from-denyse-green to-green-500 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 ${isMobile ? 'w-10 h-10 group-hover:scale-105' : 'w-10 h-10'}`}>
                        <Globe className={`text-white ${isMobile ? 'text-sm' : 'text-lg'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-bold text-gray-900 dark:text-white mb-1 group-hover:text-denyse-green transition-colors duration-300 ${isMobile ? 'text-sm' : 'text-sm md:text-base'}`}>
                          Knowledge Base
                        </h3>
                        <p className={`text-gray-600 dark:text-gray-400 leading-relaxed ${isMobile ? 'text-xs' : 'text-xs md:text-sm'}`}>
                          {isMobile ? 'Access your company knowledge automatically.' : 'Access information from your company\'s knowledge base automatically.'}
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-8">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="max-w-xs lg:max-w-2xl">
                      <LiquidGlass className="rounded-xl p-4 animate-pulse">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-denyse-turquoise rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-denyse-green rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-denyse-turquoise rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 ml-2">let me think</span>
                        </div>
                      </LiquidGlass>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className={`relative z-10 border-t border-white/10 ${isMobile ? 'p-3' : 'p-3 md:p-6'}`}>
        <div className="max-w-4xl mx-auto">
          <LiquidGlass className={`p-1 ${isMobile ? 'rounded-xl' : 'rounded-2xl md:animate-morphing'}`} variant="strong">
            <div className={`flex items-end p-3 ${isMobile ? 'space-x-2' : 'space-x-2 md:space-x-4 md:p-4'}`}>
              {/* File Upload */}
              <FileUpload onFileUpload={handleFileUpload} disabled={isUploading} />
              
              {/* Message Input */}
              <div className="flex-1">
                <div className="relative">
                  {/* File Upload Indicator */}
                  {uploadedDocument && (
                    <div className="mb-2 p-2 bg-denyse-turquoise/10 border border-denyse-turquoise/20 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-denyse-turquoise" />
                        <span className="text-sm text-gray-900 dark:text-slate-200 font-medium">
                          {uploadedDocument.originalName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Ready to analyze
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            setUploadedDocument(null);
                            setMessage("");
                          }}
                          className="p-1 h-auto ml-auto"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={uploadedDocument ? "Ask Denyse about this document..." : "Ask Denyse anything..."}
                    className="liquid-input mobile-input resize-none min-h-[50px] md:min-h-[60px] max-h-32 pr-12 md:pr-16 text-sm md:text-base"
                    disabled={sendMessageMutation.isPending}
                  />
                  {/* Character Counter */}
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-slate-400">
                    {message.length}/2000
                  </div>
                </div>
              </div>

              {/* Voice Input */}
              <VoiceInput onTranscript={handleVoiceInput} />

              {/* Send Button */}
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="bg-denyse-turquoise text-white mobile-touch-target hover:bg-denyse-turquoise/80 transition-all duration-300 ripple-effect disabled:opacity-50"
              >
                <Send className="group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </div>
          </LiquidGlass>
          
          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Denyse can make mistakes, so double-check important information. 
              <a href="#" className="text-denyse-turquoise hover:underline ml-1">Privacy Policy</a> | 
              <a href="#" className="text-denyse-turquoise hover:underline ml-1">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
