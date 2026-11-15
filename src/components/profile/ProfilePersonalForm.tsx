import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, User as UserIcon, Calendar, Globe, Clock, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { profileApi } from '@/api/profile.api';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';
import type { UpdatePersonalInfoPayload } from '@/types/profile';

interface ProfilePersonalFormProps {
  user: User;
  onSuccess?: (updatedUser: User) => void;
}

export const ProfilePersonalForm: React.FC<ProfilePersonalFormProps> = ({ user, onSuccess }) => {
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(user.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState<string>(
    user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
  );
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | 'Prefer Not To Say'>(
    user.gender || 'Prefer Not To Say',
  );
  const [preferredLanguage, setPreferredLanguage] = useState<'English' | 'Hindi' | 'Gujarati'>(
    (user.preferredLanguage as 'English' | 'Hindi' | 'Gujarati') || 'English',
  );
  const [timezone, setTimezone] = useState(user.timezone || 'Asia/Kolkata');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setDateOfBirth(user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
      setGender(user.gender || 'Prefer Not To Say');
      setPreferredLanguage((user.preferredLanguage as 'English' | 'Hindi' | 'Gujarati') || 'English');
      setTimezone(user.timezone || 'Asia/Kolkata');
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdatePersonalInfoPayload) => profileApi.updatePersonalInfo(payload),
    onSuccess: (res) => {
      if (res.success && res.data?.user) {
        const updatedUser = res.data.user;
        toast.success('Personal details saved successfully.');
        updateUser(updatedUser);
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
        onSuccess?.(updatedUser);
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
        void queryClient.invalidateQueries({ queryKey: ['auth-user'] });
      } else {
        toast.error(res.message || 'Failed to update personal details.');
      }
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to update personal details.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 3) {
      toast.error('Full name must be at least 3 characters.');
      return;
    }
    if (cleanName.length > 100) {
      toast.error('Full name must not exceed 100 characters.');
      return;
    }

    updateMutation.mutate({
      fullName: cleanName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
      gender,
      preferredLanguage,
      timezone: timezone.trim() || 'Asia/Kolkata',
    });
  };

  const isDirty =
    fullName.trim() !== (user.fullName || '').trim() ||
    dateOfBirth !== (user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '') ||
    gender !== (user.gender || 'Prefer Not To Say') ||
    preferredLanguage !== (user.preferredLanguage || 'English') ||
    timezone.trim() !== (user.timezone || 'Asia/Kolkata').trim();

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-bold">Personal Information</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Manage your personal identity and regional account preferences.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fullname" className="text-xs font-semibold">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full legal name"
                required
                minLength={3}
                maxLength={100}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dob" className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Date of Birth
              </Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-xs font-semibold">
                Gender
              </Label>
              <select
                id="gender"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as 'Male' | 'Female' | 'Other' | 'Prefer Not To Say')
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Prefer Not To Say">Prefer Not To Say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lang" className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-muted-foreground" />
                Preferred Language
              </Label>
              <select
                id="lang"
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value as 'English' | 'Hindi' | 'Gujarati')
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिंदी)</option>
                <option value="Gujarati">Gujarati (ગુજરાતી)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tz" className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                Timezone
              </Label>
              <Input
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending || !isDirty}
              className="text-xs gap-1.5"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : isDirty ? (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

