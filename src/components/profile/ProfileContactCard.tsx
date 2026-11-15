import React, { useState } from 'react';
import { Mail, Phone, ShieldCheck, Edit3, KeyRound, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmailChangeModal } from './EmailChangeModal';
import { MobileChangeModal } from './MobileChangeModal';
import type { User } from '@/types/auth';

interface ProfileContactCardProps {
  user: User;
  onUserUpdated?: (updatedUser: User) => void;
}

export const ProfileContactCard: React.FC<ProfileContactCardProps> = ({
  user,
  onUserUpdated,
}) => {
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  return (
    <>
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">Contact & Security Verification</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Registered contact channels for passwordless authentication and notifications.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 p-5 text-xs">
          {/* Email row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Email Address
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] py-0 h-4"
                  >
                    <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                    Verified Primary Email
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEmailModalOpen(true)}
              className="text-xs h-8 gap-1.5 self-start sm:self-center border-border/80"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Change Email
            </Button>
          </div>

          {/* Mobile row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Registered Mobile Number
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {user.mobileNumber}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] py-0 h-4"
                  >
                    <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                    Verified Mobile Contact
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMobileModalOpen(true)}
              className="text-xs h-8 gap-1.5 self-start sm:self-center border-border/80"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Change Number
            </Button>
          </div>

          {/* Passwordless security callout */}
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
            <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Passwordless Security Active</p>
              <p className="mt-0.5">
                ParkEase uses enterprise passwordless authentication. Contact updates require OTP validation to prevent account takeovers.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmailChangeModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        currentUser={user}
        onSuccess={onUserUpdated}
      />

      <MobileChangeModal
        open={mobileModalOpen}
        onOpenChange={setMobileModalOpen}
        currentUser={user}
        onSuccess={onUserUpdated}
      />
    </>
  );
};

