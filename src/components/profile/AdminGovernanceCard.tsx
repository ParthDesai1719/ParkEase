import React from 'react';
import { ShieldCheck, Calendar, Clock, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/types/auth';

interface AdminGovernanceCardProps {
  user: User;
}

export const AdminGovernanceCard: React.FC<AdminGovernanceCardProps> = ({ user }) => {
  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">Administrator Credentials & Governance</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-primary text-xs font-bold"
          >
            System Administrator
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Platform-level governance identifiers and session audit parameters.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5 text-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Administrator System ID
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-foreground">{user._id}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              Account Created
            </p>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'System Origin'}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3 text-primary" />
              Last Session Activity
            </p>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Current Session'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            Per Section 21243 of the ParkEase authoritative specification, administrator roles and permissions cannot be altered through normal profile settings. Platform governance rules are maintained in dedicated administration modules.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
