import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { profileApi } from '@/api/profile.api';
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload';
import { ProfilePersonalForm } from '@/components/profile/ProfilePersonalForm';
import { ProfileContactCard } from '@/components/profile/ProfileContactCard';
import { SecurityAssignmentCard } from '@/components/profile/SecurityAssignmentCard';

export const SecurityProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  });

  const profileUser = profileQuery.data?.data?.user;
  const activeUser = user ? { ...(profileUser || {}), ...user } : profileUser;
  const assignment = profileQuery.data?.data?.assignment;

  if (!activeUser && profileQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!activeUser) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs font-semibold">
              <Shield className="mr-1 h-3 w-3" />
              Security Staff Account
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold"
            >
              <ShieldCheck className="mr-1 h-3 w-3" />
              Active Duty Guard
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Staff Profile &amp; Post Assignment
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            Manage your personal profile details, verified contact credentials, and view your current parking facility assignment.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void profileQuery.refetch()}
            disabled={profileQuery.isFetching}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${profileQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Avatar Banner */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-6">
          <ProfileAvatarUpload
            user={activeUser}
            onAvatarUpdated={(url) => updateUser({ ...activeUser, profileImage: url })}
          />
        </CardContent>
      </Card>

      {/* Assigned Facility Post */}
      <SecurityAssignmentCard assignment={assignment} />

      {/* Personal Form & Contacts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfilePersonalForm user={activeUser} onSuccess={(u) => updateUser(u)} />
        <ProfileContactCard user={activeUser} onUserUpdated={(u) => updateUser(u)} />
      </div>
    </div>
  );
};

export default SecurityProfilePage;

