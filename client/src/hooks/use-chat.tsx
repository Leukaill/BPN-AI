import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Chat, Message } from "@shared/schema";

export function useChat(chatId: number | null) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/chats", chatId, "messages"],
    enabled: !!chatId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, chatId: targetChatId }: { content: string; chatId: number }) => {
      const response = await apiRequest("POST", `/api/chats/${targetChatId}/messages`, {
        role: "user",
        content,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/chats", variables.chatId, "messages"] 
      });
    },
  });

  const createChatMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/chats", { title });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  return {
    messages,
    messagesLoading,
    sendMessage: sendMessageMutation.mutateAsync,
    createChat: createChatMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    isCreating: createChatMutation.isPending,
  };
}
