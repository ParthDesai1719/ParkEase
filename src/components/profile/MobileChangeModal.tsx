import React, { useEffect, useState } from 'react';
import { Phone, KeyRound, ArrowRight, Loader2, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
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

interface MobileChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User;
  onSuccess?: (updatedUser: User) => void;
}

export const MobileChangeModal: React.FC<MobileChangeModalProps> = ({
  open,
  onOpenChange,
  currentUser,
  onSuccess,
}) => {
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'ENTER_MOBILE' | 'VERIFY_OTP'>('ENTER_MOBILE');
  const [newMobile, setNewMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maskedTarget, setMaskedTarget] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Reset state on modal open
  useEffect(() => {
    if (open) {
      setStep('ENTER_MOBILE');
      setNewMobile('');
      setOtp('');
      setIsLoading(false);
      setCooldown(0);
    }
  }, [open]);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const cleanNumber = (val: string): string => {
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    }
    return val.trim();
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const formatted = cleanNumber(newMobile);
    if (!/^\+91\d{10}$/.test(formatted)) {
      toast.error('Please enter a valid 10-digit Indian mobile number (+91XXXXXXXXXX).');
      return;
    }
    if (formatted === currentUser.mobileNumber) {
      toast.error('New mobile number cannot be identical to your current mobile number.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await profileApi.requestMobileChangeOtp({ newMobileNumber: formatted });
      if (res.success && res.data) {
        toast.success(res.message || 'Verification code dispatched.');
        setMaskedTarget(res.data.targetEmailMasked);
        setCooldown(res.data.cooldownSeconds || 30);
        setStep('VERIFY_OTP');
      } else {
        toast.error(res.message || 'Failed to dispatch verification code.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to request mobile change code.');
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

    const formatted = cleanNumber(newMobile);

    try {
      setIsLoading(true);
      const res = await profileApi.verifyMobileChangeOtp({
        newMobileNumber: formatted,
        otp: cleanOtp,
      });

      if (res.success && res.data?.user) {
        const updatedUser = res.data.user;
        toast.success('Mobile number updated successfully!');
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
            <Phone className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">Change Registered Mobile Number</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'ENTER_MOBILE'
              ? 'Enter your new Indian mobile number. Per ParkEase security rules, verification OTP is delivered to your registered email address.'
              : `Enter the 6-digit verification code sent to your registered email (${maskedTarget || currentUser.email}).`}
          </DialogDescription>
        </DialogHeader>

        {step === 'ENTER_MOBILE' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Current Mobile Number</Label>
              <Input
                value={currentUser.mobileNumber}
                disabled
                className="bg-muted/50 font-mono text-xs text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-mobile" className="text-xs font-semibold">
                New Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  +91
                </span>
                <Input
                  id="new-mobile"
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={newMobile.replace(/^\+91/, '')}
                  onChange={(e) => setNewMobile(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  autoFocus
                  required
                  className="pl-12 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Enter 10-digit Indian mobile number.</p>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex gap-2">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Under Version 1 security protocols, contact change verification OTPs are delivered to your primary verified email address.
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
                disabled={isLoading || !newMobile.trim()}
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
                  Verification OTP delivered to <strong>{maskedTarget || currentUser.email}</strong>.
                  Code expires in 5 minutes.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="mobile-otp-input" className="text-xs font-semibold">
                  6-Digit Verification Code <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  New Number: {cleanNumber(newMobile)}
                </span>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="mobile-otp-input"
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
                onClick={() => setStep('ENTER_MOBILE')}
                disabled={isLoading}
                className="text-[11px] h-7 px-2 text-muted-foreground"
              >
                Change Number
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
                  'Confirm & Update Mobile'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

