import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  className?: string;
}

/**
 * OtpInput Component:
 * Accessible 6-digit segmented OTP input with full paste, keyboard navigation,
 * and auto-focus support conforming to ParkEase standards.
 */
export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  error = false,
  className,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus the first empty box on mount
  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = value.length < length ? value.length : 0;
      inputRefs.current[firstEmptyIndex]?.focus();
    }
  }, [autoFocus, disabled, length, value.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const rawVal = e.target.value;
    const digit = rawVal.replace(/\D/g, '').slice(-1);

    if (!digit) {
      return;
    }

    const nextValue = value.split('');
    nextValue[index] = digit;
    const result = nextValue.join('').slice(0, length);
    onChange(result);

    // Focus next box if available
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const nextValue = value.split('');

      if (value[index]) {
        // Clear current box
        nextValue[index] = '';
        onChange(nextValue.join(''));
      } else if (index > 0) {
        // Move to previous box and clear
        nextValue[index - 1] = '';
        onChange(nextValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);

    if (pastedData.length > 0) {
      onChange(pastedData);
      const focusIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className={cn('flex items-center justify-center gap-2 sm:gap-3', className)}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] || '';
        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete="one-time-code"
            disabled={disabled}
            value={digit}
            onChange={(e) => handleInputChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={cn(
              'h-12 w-11 sm:h-14 sm:w-12 rounded-xl border text-center text-xl font-bold transition-all outline-none select-none',
              'bg-background text-foreground shadow-xs',
              error
                ? 'border-destructive ring-2 ring-destructive/20 dark:border-destructive/80'
                : 'border-input hover:border-muted-foreground/50 focus:border-primary focus:ring-3 focus:ring-primary/20',
              disabled && 'cursor-not-allowed opacity-50 bg-muted/50',
            )}
          />
        );
      })}
    </div>
  );
};
