import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Document } from "@shared/schema";

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await apiRequest("POST", "/api/documents", formData);
      return response.json();
    },
    onSuccess: (document: Document) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "File uploaded successfully",
        description: `${document.originalName} has been uploaded and is being processed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF, DOCX, DOC, or TXT file",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    try {
      return await uploadMutation.mutateAsync(file);
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  };

  return {
    uploadFile,
    isUploading: uploadMutation.isPending,
    uploadProgress,
  };
}
