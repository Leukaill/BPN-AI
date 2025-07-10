import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { KnowledgeBase } from "@shared/schema";

interface KnowledgeBaseStats {
  totalEntries: number;
  totalSize: number;
  fileTypes: { [key: string]: number };
}

export function useKnowledgeBase() {
  const queryClient = useQueryClient();

  // Get user's knowledge base entries
  const knowledgeQuery = useQuery({
    queryKey: ['/api/knowledge-base'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base');
      if (!response.ok) throw new Error('Failed to fetch knowledge base');
      return response.json() as Promise<KnowledgeBase[]>;
    },
  });

  // Get knowledge base stats
  const statsQuery = useQuery({
    queryKey: ['/api/knowledge-base/stats'],
    queryFn: async () => {
      const response = await fetch('/api/knowledge-base/stats');
      if (!response.ok) throw new Error('Failed to fetch knowledge base stats');
      return response.json() as Promise<KnowledgeBaseStats>;
    },
  });

  // Upload file to knowledge base
  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; title?: string }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.title) {
        formData.append('title', data.title);
      }

      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload file');
      }

      return response.json() as Promise<KnowledgeBase>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/stats'] });
    },
  });

  // Delete knowledge base entry
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/knowledge-base/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete knowledge base entry');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/stats'] });
    },
  });

  // Validate file for upload
  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 10MB' };
    }

    if (!allowedTypes.includes(file.mimetype || file.type)) {
      return { isValid: false, error: 'Only PDF, DOCX, DOC, and TXT files are supported' };
    }

    return { isValid: true };
  };

  return {
    knowledge: knowledgeQuery.data || [],
    stats: statsQuery.data,
    isLoading: knowledgeQuery.isLoading || statsQuery.isLoading,
    error: knowledgeQuery.error || statsQuery.error,
    uploadMutation,
    deleteMutation,
    validateFile,
    refetch: () => {
      knowledgeQuery.refetch();
      statsQuery.refetch();
    },
  };
}