import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
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
  X
} from "lucide-react";
import { Message } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatAreaProps {
  currentChatId: number | null;
  onChatCreated: (chatId: number) => void;
}

export function ChatArea({ currentChatId, onChatCreated }: ChatAreaProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedDocument, setUploadedDocument] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
    <div className="flex-1 flex flex-col relative">
      {/* Liquid Glass Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-bpn-white/90 to-bpn-grey/30 backdrop-blur-sm"></div>
      
      {/* Chat Header */}
      <div className="relative z-10 liquid-glass-strong border-b border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="liquid-bubble w-12 h-12 bg-bpn-turquoise rounded-full flex items-center justify-center">
              <Bot className="text-white text-xl" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Denyse</h2>
              <p className="text-sm text-foreground/70">Powered by Advanced Language Models</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <LiquidGlass className="rounded-full px-4 py-2 animate-morphing">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-bpn-green rounded-full animate-pulse"></div>
                <span className="text-sm text-foreground font-medium">Online</span>
              </div>
            </LiquidGlass>
            <Button
              variant="ghost"
              size="sm"
              className="liquid-glass rounded-full p-2 hover:bg-white/40 transition-all duration-300 ripple-effect"
            >
              <MoreVertical className="text-bpn-turquoise" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 relative z-10 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            {!currentChatId && messages.length === 0 ? (
              <div className="max-w-4xl mx-auto">
                {/* Welcome Message */}
                <div className="text-center py-12">
                  <div className="liquid-bubble w-24 h-24 bg-gradient-to-br from-bpn-turquoise to-bpn-green rounded-full mx-auto mb-6 flex items-center justify-center">
                    <Bot className="text-white text-3xl" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground mb-4">
                    Meet Denyse, your personal AI assistant
                  </h2>
                  <p className="text-foreground/70 max-w-2xl mx-auto">
                    I can help you analyze documents, extract information, generate reports, and answer questions using data from your uploaded files and BPN's knowledge base.
                  </p>
                </div>

                {/* Sample Capabilities */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <LiquidGlass className="rounded-xl p-6 hover:bg-white/40 transition-all duration-300 cursor-pointer group animate-morphing">
                    <div className="flex items-start space-x-4">
                      <Upload className="text-bpn-turquoise text-2xl mt-1" />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Document Analysis</h3>
                        <p className="text-sm text-foreground/70">
                          Upload PDFs, DOCX files and extract key information instantly.
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className="rounded-xl p-6 hover:bg-white/40 transition-all duration-300 cursor-pointer group animate-morphing"
                    style={{ animationDelay: '0.5s' }}
                  >
                    <div className="flex items-start space-x-4">
                      <BarChart className="text-bpn-green text-2xl mt-1" />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Report Generation</h3>
                        <p className="text-sm text-foreground/70">
                          Create comprehensive reports using data from multiple sources.
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className="rounded-xl p-6 hover:bg-white/40 transition-all duration-300 cursor-pointer group animate-morphing"
                    style={{ animationDelay: '1s' }}
                  >
                    <div className="flex items-start space-x-4">
                      <FileText className="text-bpn-turquoise text-2xl mt-1" />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">Intelligent Search</h3>
                        <p className="text-sm text-foreground/70">
                          Query information with context and reasoning capabilities.
                        </p>
                      </div>
                    </div>
                  </LiquidGlass>
                  
                  <LiquidGlass 
                    className="rounded-xl p-6 hover:bg-white/40 transition-all duration-300 cursor-pointer group animate-morphing"
                    style={{ animationDelay: '1.5s' }}
                  >
                    <div className="flex items-start space-x-4">
                      <Globe className="text-bpn-green text-2xl mt-1" />
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">BPN Knowledge Base</h3>
                        <p className="text-sm text-foreground/70">
                          Access information scraped from www.bpn.rw automatically.
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
                          <div className="w-2 h-2 bg-bpn-turquoise rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-bpn-green rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-bpn-turquoise rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <span className="text-sm text-foreground/70 ml-2">AI is thinking...</span>
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
      <div className="relative z-10 p-6 border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <LiquidGlass className="rounded-2xl p-1 animate-morphing" variant="strong">
            <div className="flex items-end space-x-4 p-4">
              {/* File Upload */}
              <FileUpload onFileUpload={handleFileUpload} disabled={isUploading} />
              
              {/* Message Input */}
              <div className="flex-1">
                <div className="relative">
                  {/* File Upload Indicator */}
                  {uploadedDocument && (
                    <div className="mb-2 p-2 bg-bpn-turquoise/10 border border-bpn-turquoise/20 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-bpn-turquoise" />
                        <span className="text-sm text-foreground font-medium">
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
                    placeholder={uploadedDocument ? "Ask Denyse about this document..." : "Ask Denyse anything about your documents or BPN..."}
                    className="liquid-input resize-none min-h-[60px] max-h-32 pr-16"
                    disabled={sendMessageMutation.isPending}
                  />
                  {/* Character Counter */}
                  <div className="absolute bottom-2 right-2 text-xs text-foreground/50">
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
                className="bg-bpn-turquoise text-white hover:bg-bpn-turquoise/80 transition-all duration-300 ripple-effect disabled:opacity-50"
              >
                <Send className="group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </div>
          </LiquidGlass>
          
          {/* Footer */}
          <div className="mt-4 text-center">
            <p className="text-xs text-foreground/50">
              Denyse can make mistakes, so double-check important information. 
              <a href="#" className="text-bpn-turquoise hover:underline ml-1">Privacy Policy</a> | 
              <a href="#" className="text-bpn-turquoise hover:underline ml-1">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
