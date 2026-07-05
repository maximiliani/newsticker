import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  key: string;
}

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const supabase = createClient();

  async function uploadFileToSupabase(file: File) {
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('article_media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('article_media')
        .getPublicUrl(data.path);

      const uploaded: UploadedFile = {
        url: publicUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        key: data.path,
      };

      setProgress(100);
      setUploadedFile(uploaded);
      onUploadComplete?.(uploaded);

      return uploaded;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const message = errorMessage.length > 0 ? errorMessage : 'Something went wrong, please try again later.';

      toast.error(message);
      onUploadError?.(error);
      return undefined;
    } finally {
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile: uploadFileToSupabase,
    uploadingFile,
  };
}

export function getErrorMessage(err: unknown) {
  const unknownError = 'Something went wrong, please try again later.';

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => issue.message);
    return errors.join('\n');
  }
  if (err instanceof Error) {
    return err.message;
  }
  return unknownError;
}

export function showErrorToast(err: unknown) {
  const errorMessage = getErrorMessage(err);
  return toast.error(errorMessage);
}
