import React, { useEffect, useState } from 'react';
import { Mail, KeyRound, ArrowRight, Loader2, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { profileApi } from '@/api/profile.api';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types/auth';

interface EmailChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  onSuccess?: (updatedUser: User) => void;
}

export const EmailChangeModal: React.FC<EmailChangeModalProps> = ({
  open,
  onOpenChange,
  currentUser,
  onSuccess,
}) => {
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'ENTER_EMAIL' | 'VERIFY_OTP'>('ENTER_EMAIL');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maskedTarget, setMaskedTarget] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Reset state on modal open
  useEffect(() => {
    if (open) {
      setStep('ENTER_EMAIL');
      setNewEmail('');
      setOtp('');
      setIsLoading(false);
      setCooldown(0);
    }
  }, [open]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (cleanEmail === currentUser.email.toLowerCase()) {
      toast.error('New email address cannot be identical to your current email address.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await profileApi.requestEmailChangeOtp({ newEmail: cleanEmail });
      if (res.success && res.data) {
        toast.success(res.message || 'Verification code sent.');
        setMaskedTarget(res.data.targetEmailMasked);
        setCooldown(res.data.cooldownSeconds || 30);
        setStep('VERIFY_OTP');
      } else {
        toast.error(res.message || 'Failed to send verification code.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to request email change code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await profileApi.verifyEmailChangeOtp({
        newEmail: newEmail.trim().toLowerCase(),
        otp: cleanOtp,
      });

      if (res.success && res.data?.user) {
        const updatedUser = res.data.user;
        toast.success('Email address updated successfully!');
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
        void queryClient.invalidateQueries({ queryKey: ['profile'] });
        void queryClient.invalidateQueries({ queryKey: ['auth-user'] });
        onSuccess?.(updatedUser);
        onOpenChange(false);
      } else {
        toast.error(res.message || 'Verification failed.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">Change Registered Email</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'ENTER_EMAIL'
              ? 'Enter your new email address. A security verification code will be dispatched to your current registered email.'
              : `Enter the 6-digit verification code sent to your registered email (${maskedTarget || currentUser.email}).`}
          </DialogDescription>
        </DialogHeader>

        {step === 'ENTER_EMAIL' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Email</Label>
              <Input
                value={currentUser.email}
                disabled
                className="bg-muted/50 font-mono text-xs text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs font-semibold">
                New Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="new.email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isLoading}
                autoFocus
                required
                className="text-xs"
              />
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex gap-2">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                To protect against account takeovers, verification OTPs are delivered to your existing authorized contact before changes apply.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !newEmail.trim()}
                className="text-xs gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 py-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Security code dispatched!</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  Delivered to <strong>{maskedTarget || currentUser.email}</strong>.
                  Code expires in 5 minutes.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="otp-input" className="text-xs font-semibold">
                  6-Digit Verification Code <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">Updating to: {newEmail}</span>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="otp-input"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoFocus
                  className="pl-9 font-mono tracking-widest text-center text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep('ENTER_EMAIL')}
                disabled={isLoading}
                className="text-[11px] h-7 px-2 text-muted-foreground"
              >
                Change Email Address
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRequestOtp()}
                disabled={isLoading || cooldown > 0}
                className="text-[11px] h-7 px-2 text-primary gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || otp.trim().length !== 6}
                className="text-xs gap-1.5"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Confirm & Update Email'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

