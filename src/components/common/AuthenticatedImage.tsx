import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { fetchSubmissionFileBlob } from '@/api/facilitySubmission.api';

interface AuthenticatedImageProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt = 'Facility preview',
  className = 'h-full w-full object-cover',
  onClick,
}) => {
  const isDirectUrl = !!src && (src.startsWith('blob:') || src.startsWith('data:'));
  const [blobUrl, setBlobUrl] = useState<string | null>(isDirectUrl ? src : null);
  const [hasError, setHasError] = useState(!src);
  const [isLoading, setIsLoading] = useState(!isDirectUrl && !!src);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!src || isDirectUrl) {
      return;
    }

    const filename = src.split('/').pop();
    if (!filename) {
      return;
    }

    fetchSubmissionFileBlob(filename)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setHasError(true);
        setIsLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src, isDirectUrl]);

  if (isLoading) {
    return (
      <div className="h-full w-full min-h-[5rem] bg-muted/60 flex items-center justify-center text-muted-foreground animate-pulse">
        <ImageIcon className="h-6 w-6 opacity-40" />
      </div>
    );
  }

  if (hasError || !blobUrl) {
    return (
      <div className="h-full w-full min-h-[5rem] bg-muted/40 flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
        <span className="opacity-60">Preview unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  );
};

