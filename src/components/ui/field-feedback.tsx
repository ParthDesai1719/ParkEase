import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldFeedbackStatus = 'error' | 'warning' | 'info' | 'success';

export interface FieldFeedbackProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: FieldFeedbackStatus;
  message?: string;
  suggestion?: string;
}

const statusConfig: Record<
  FieldFeedbackStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    boxClasses: string;
    iconClasses: string;
    messageClasses: string;
    suggestionClasses: string;
  }
> = {
  error: {
    icon: AlertCircle,
    boxClasses:
      'bg-destructive/10 border-destructive/25 text-destructive dark:bg-destructive/20 dark:border-destructive/35 dark:text-red-300 backdrop-blur-md shadow-xs',
    iconClasses: 'text-destructive dark:text-red-400',
    messageClasses: 'text-destructive dark:text-red-300 font-medium text-xs tracking-normal',
    suggestionClasses: 'text-destructive/80 dark:text-red-300/80',
  },
  warning: {
    icon: AlertTriangle,
    boxClasses:
      'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/35 dark:text-amber-300',
    iconClasses: 'text-amber-600 dark:text-amber-400',
    messageClasses: 'text-amber-800 dark:text-amber-200 font-medium',
    suggestionClasses: 'text-amber-700/80 dark:text-amber-300/80',
  },
  info: {
    icon: Info,
    boxClasses:
      'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/35 dark:text-sky-300',
    iconClasses: 'text-sky-600 dark:text-sky-400',
    messageClasses: 'text-sky-800 dark:text-sky-200 font-medium',
    suggestionClasses: 'text-sky-700/80 dark:text-sky-300/80',
  },
  success: {
    icon: CheckCircle2,
    boxClasses:
      'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/35 dark:text-emerald-300',
    iconClasses: 'text-emerald-600 dark:text-emerald-400',
    messageClasses: 'text-emerald-800 dark:text-emerald-200 font-medium',
    suggestionClasses: 'text-emerald-700/80 dark:text-emerald-300/80',
  },
};

export const FieldFeedback: React.FC<FieldFeedbackProps> = ({
  status = 'error',
  message,
  suggestion,
  className,
  ...props
}) => {
  if (!message && !suggestion) {
    return null;
  }

  const config = statusConfig[status];
  const IconComponent = config.icon;

  return (
    <div
      data-slot="field-feedback"
      role={status === 'error' || status === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'mt-1.5 flex flex-col gap-1 rounded-lg border px-3 py-2 text-xs transition-all duration-200 animate-in fade-in-50 slide-in-from-top-1 backdrop-blur-md shadow-xs',
        config.boxClasses,
        className,
      )}
      {...props}
    >
      {message && (
        <div className="flex items-start gap-2">
          <IconComponent className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', config.iconClasses)} />
          <span className={cn('leading-relaxed', config.messageClasses)}>{message}</span>
        </div>
      )}
      {suggestion && (
        <div className={cn('pl-6 text-[11px] leading-relaxed', config.suggestionClasses)}>
          {suggestion}
        </div>
      )}
    </div>
  );
};
