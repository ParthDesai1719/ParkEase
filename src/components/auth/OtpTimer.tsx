import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OtpTimerProps {
  initialExpirySeconds?: number;
  initialCooldownSeconds?: number;
  onResend: () => Promise<void> | void;
  isResending?: boolean;
}

export const OtpTimer: React.FC<OtpTimerProps> = ({
  initialExpirySeconds = 300, // 5 minutes
  initialCooldownSeconds = 30, // 30 seconds
  onResend,
  isResending = false,
}) => {
  const [expiryTime, setExpiryTime] = useState(initialExpirySeconds);
  const [cooldownTime, setCooldownTime] = useState(initialCooldownSeconds);

  // Expiry countdown timer
  useEffect(() => {
    if (expiryTime <= 0) return;

    const timer = setInterval(() => {
      setExpiryTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryTime]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldownTime <= 0) return;

    const timer = setInterval(() => {
      setCooldownTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownTime]);

  const handleResend = async () => {
    if (cooldownTime > 0 || isResending) return;
    await onResend();
    // Reset timers after successful resend
    setCooldownTime(initialCooldownSeconds);
    setExpiryTime(initialExpirySeconds);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = expiryTime <= 0;

  return (
    <div className="flex flex-col items-center gap-3 text-sm">
      {/* Validity timer */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {isExpired ? (
          <span className="font-semibold text-destructive">Verification code has expired</span>
        ) : (
          <span>
            Code valid for{' '}
            <strong className="font-medium text-foreground">{formatTime(expiryTime)}</strong>
          </span>
        )}
      </div>

      {/* Resend button & cooldown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Didn&apos;t receive code?</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={cooldownTime > 0 || isResending}
          onClick={handleResend}
          className="h-auto p-0 text-xs font-semibold text-primary disabled:text-muted-foreground disabled:no-underline"
        >
          {isResending ? (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sending...
            </span>
          ) : cooldownTime > 0 ? (
            `Resend OTP in ${cooldownTime}s`
          ) : (
            'Resend OTP'
          )}
        </Button>
      </div>
    </div>
  );
};
