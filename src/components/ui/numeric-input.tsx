import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> {
  value: number | undefined | null;
  onChangeValue: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  allowNegative?: boolean;
  precision?: number;
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChangeValue,
      min,
      max,
      step = 1,
      allowDecimals = true,
      allowNegative = false,
      precision,
      className,
      onFocus,
      onBlur,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    // Internal string buffer so the user can freely type, delete, backspace, and type decimals
    const [text, setText] = React.useState<string>(() =>
      value !== undefined && value !== null && !isNaN(value) ? String(value) : '',
    );
    const [isFocused, setIsFocused] = React.useState(false);
    const lastEmittedValueRef = React.useRef<number | undefined | null>(value);

    // Sync external value when not focused, or when element selection/prop changes externally
    React.useEffect(() => {
      if (!isFocused) {
        const nextText = value !== undefined && value !== null && !isNaN(value) ? String(value) : '';
        setText(nextText);
        lastEmittedValueRef.current = value;
      } else if (value !== undefined && value !== null && value !== lastEmittedValueRef.current) {
        // Parent value changed from an outside action even while focused
        const currentParsed = parseFloat(text);
        if (isNaN(currentParsed) || Math.abs(currentParsed - value) > 0.0001) {
          setText(String(value));
          lastEmittedValueRef.current = value;
        }
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow empty string so user can clear the box and type freely
      if (raw === '') {
        setText('');
        return;
      }

      // Regex filter: allow only numbers, optional minus (if negative allowed), optional single decimal point
      let regex: RegExp;
      if (allowNegative && allowDecimals) {
        regex = /^-?\d*\.?\d*$/;
      } else if (allowNegative && !allowDecimals) {
        regex = /^-?\d*$/;
      } else if (!allowNegative && allowDecimals) {
        regex = /^\d*\.?\d*$/;
      } else {
        regex = /^\d*$/;
      }

      if (!regex.test(raw)) {
        // Disallow non-numeric characters (letters, symbols, double dots, etc.)
        return;
      }

      setText(raw);

      // Intermediate states: user is actively typing a minus, decimal point, or trailing dot
      if (raw === '-' || raw === '.' || raw === '-.' || raw.endsWith('.')) {
        return;
      }

      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        lastEmittedValueRef.current = parsed;
        onChangeValue(parsed);
      }
    };

    const commitValue = () => {
      let finalNum: number;
      const parsed = parseFloat(text);

      if (isNaN(parsed) || text.trim() === '' || text === '-' || text === '.') {
        // Fallback to min, previous valid value, or 0
        finalNum = min !== undefined ? min : (value ?? 0);
      } else {
        finalNum = parsed;
        if (min !== undefined && finalNum < min) finalNum = min;
        if (max !== undefined && finalNum > max) finalNum = max;
        if (precision !== undefined) {
          finalNum = Number(finalNum.toFixed(precision));
        }
      }

      setText(String(finalNum));
      lastEmittedValueRef.current = finalNum;
      onChangeValue(finalNum);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      commitValue();
      onBlur?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitValue();
        e.currentTarget.blur();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = (step || 1) * (e.key === 'ArrowUp' ? 1 : -1);
        const current = parseFloat(text) || 0;
        let next = current + delta;
        if (allowDecimals) {
          next = Math.round(next * 1000) / 1000;
        }
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        setText(String(next));
        lastEmittedValueRef.current = next;
        onChangeValue(next);
      }
      onKeyDown?.(e);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        pattern={allowDecimals ? '[0-9]*\\.?[0-9]*' : '[0-9]*'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs font-mono text-foreground shadow-xs transition-colors outline-none',
          'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className,
        )}
        {...props}
      />
    );
  },
);

NumericInput.displayName = 'NumericInput';
