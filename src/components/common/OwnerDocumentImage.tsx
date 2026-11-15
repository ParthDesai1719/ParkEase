import React, { useEffect, useState } from 'react';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { ownerApi } from '@/api/owner.api';

interface OwnerDocumentImageProps {
  index: number;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export const OwnerDocumentImage: React.FC<OwnerDocumentImageProps> = ({
  index,
  alt = 'Parking Facility Photo',
  className = 'h-full w-full object-cover',
  onClick,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    ownerApi
      .getRegistrationDocumentBlob('parkingImage', index)
      .then(({ blob }) => {
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
  }, [index]);

  if (isLoading) {
    return (
      <div className="h-full w-full min-h-[5rem] bg-muted/60 flex flex-col items-center justify-center text-muted-foreground animate-pulse rounded-md">
        <ImageIcon className="h-5 w-5 opacity-40 mb-1" />
        <span className="text-[10px] opacity-60">Loading photo...</span>
      </div>
    );
  }

  if (hasError || !blobUrl) {
    return (
      <div className="h-full w-full min-h-[5rem] bg-muted/30 border border-dashed border-border/70 flex flex-col items-center justify-center text-muted-foreground text-[10px] p-2 text-center rounded-md">
        <AlertCircle className="h-4 w-4 text-amber-500/80 mb-1" />
        <span className="opacity-80">Photo unavailable</span>
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
