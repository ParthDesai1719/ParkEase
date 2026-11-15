import React, { useRef, useState } from 'react';
import { Camera, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { profileApi, getAvatarUrl } from '@/api/profile.api';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

interface ProfileAvatarUploadProps {
  user: User;
  onAvatarUpdated?: (newAvatarUrl: string) => void;
}

export const ProfileAvatarUpload: React.FC<ProfileAvatarUploadProps> = ({
  user,
  onAvatarUpdated,
}) => {
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'PE';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB.');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images are allowed.');
      return;
    }

    // Set local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      setIsUploading(true);
      const res = await profileApi.uploadAvatar(file);
      if (res.success && res.data) {
        toast.success('Profile picture updated successfully.');
        const updatedAvatar = res.data.avatarUrl;
        const updatedUser = { ...user, profileImage: updatedAvatar };
        updateUser(updatedUser);

        // Synchronously update query cache and invalidate
        queryClient.setQueryData(['profile'], (old: any) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              user: updatedUser,
            },
          };
        });
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
        void queryClient.invalidateQueries({ queryKey: ['auth-user'] });

        onAvatarUpdated?.(updatedAvatar);
      } else {
        toast.error(res.message || 'Failed to upload profile picture.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to upload profile picture.');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const currentImage = previewUrl || getAvatarUrl(user.profileImage) || undefined;

  return (
    <div className="flex flex-col items-center sm:flex-row sm:items-center gap-5">
      <div className="relative group">
        <Avatar className="h-24 w-24 rounded-full border-2 border-primary/20 shadow-md">
          {currentImage && <AvatarImage src={currentImage} alt={user.fullName} className="object-cover" />}
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
            {initials}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload profile picture"
          className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>

      <div className="space-y-1.5 text-center sm:text-left">
        <h3 className="text-sm font-semibold text-foreground">Profile Picture</h3>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, or WebP up to 5MB. Circular framing applied automatically.
        </p>
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-xs h-8 gap-1.5 border-border/80"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload Photo
              </>
            )}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

