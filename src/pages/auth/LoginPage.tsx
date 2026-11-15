import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { requestLoginOtp, resendOtp, verifyLoginOtp } from '@/api/auth.api';
import { OtpInput } from '@/components/auth/OtpInput';
import { OtpTimer } from '@/components/auth/OtpTimer';
import { getDashboardRoute, getRoleCode } from '@/components/auth/ProtectedRoute';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldFeedback } from '@/components/ui/field-feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  emailLoginSchema,
  mobileLoginFormSchema,
  type EmailLoginFormValues,
  type MobileLoginFormValues,
} from '@/schemas/auth.schema';
import { useAuthStore } from '@/stores/authStore';
import type { LoginMethod, RequestLoginOtpPayload, VerifyLoginOtpPayload } from '@/types/auth';

type LoginStep = 'identifier' | 'otp';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Authentication State
  const [method, setMethod] = useState<LoginMethod>('email');
  const [step, setStep] = useState<LoginStep>('identifier');
  const [identifier, setIdentifier] = useState<string>('');
  const [otpValue, setOtpValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3);
  const [errorMessage, setErrorMessage] = useState<{
    title?: string;
    message: string;
    code?: string;
    type?: 'destructive' | 'warning' | 'default';
  } | null>(null);

  // Form handling for Email Login
  const emailForm = useForm<EmailLoginFormValues>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: '' },
  });

  // Form handling for Mobile Login
  const mobileForm = useForm<MobileLoginFormValues>({
    resolver: zodResolver(mobileLoginFormSchema),
    defaultValues: { mobileDigits: '' },
  });

  /**
   * Reset errors and switch tabs
   */
  const handleTabChange = (val: string) => {
    setMethod(val as LoginMethod);
    setErrorMessage(null);
  };

  /**
   * Step 1: Request OTP
   */
  const handleRequestOtp = async (data: { email?: string; mobileDigits?: string }) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const payload: RequestLoginOtpPayload =
        method === 'email'
          ? { method: 'email', email: data.email?.trim().toLowerCase() }
          : { method: 'mobile', mobileNumber: `+91${data.mobileDigits?.trim()}` };

      const activeIdentifier = method === 'email' ? payload.email! : payload.mobileNumber!;
      setIdentifier(activeIdentifier);

      const response = await requestLoginOtp(payload);

      if (response.success) {
        setStep('otp');
        setOtpValue('');
        setAttemptsLeft(3);
        toast.success(response.message || 'Verification code sent successfully.', {
          description:
            method === 'email'
              ? `Check your inbox in Mailpit for ${activeIdentifier}`
              : `Verification code delivered to your registered email in Mailpit for ${activeIdentifier}`,
        });
      } else {
        setErrorMessage({ message: response.message || 'Failed to send OTP. Please try again.' });
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { message?: string; errorCode?: string } };
        message?: string;
      };
      const code = apiError.response?.data?.errorCode;
      const msg =
        apiError.response?.data?.message ||
        'Unable to connect to the server. Please check your connection.';

      if (code === 'E014') {
        setErrorMessage({
          title: 'Account Not Found',
          message:
            method === 'email'
              ? 'No account was found with this email address. Please register as a customer to get started.'
              : 'No account was found with this mobile number. Please register as a customer to get started.',
          code,
          type: 'warning',
        });
      } else if (code === 'E007') {
        setErrorMessage({
          title: 'Account Suspended',
          message:
            'Your account has been suspended. Please contact customer support for assistance.',
          code,
          type: 'destructive',
        });
      } else if (code === 'E042') {
        setErrorMessage({
          title: 'Authentication Ineligible',
          message: 'This account is not currently eligible for authentication.',
          code,
          type: 'destructive',
        });
      } else if (code === 'E043') {
        setErrorMessage({
          title: 'Registration Pending Approval',
          message: msg,
          code,
          type: 'warning',
        });
      } else if (code === 'E044') {
        setErrorMessage({
          title: 'Application Rejected',
          message: msg,
          code,
          type: 'destructive',
        });
      } else {
        setErrorMessage({ message: msg, code, type: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: Verify OTP
   */
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpValue.length !== 6 || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const payload: VerifyLoginOtpPayload =
        method === 'email'
          ? { method: 'email', email: identifier, otp: otpValue.trim() }
          : { method: 'mobile', mobileNumber: identifier, otp: otpValue.trim() };

      const response = await verifyLoginOtp(payload);

      if (response.success && response.data?.user && response.data?.accessToken) {
        const { user, accessToken } = response.data;

        // Store authenticated session strictly in memory
        setAuth(user, accessToken);

        toast.success(`Welcome back, ${user.fullName}!`, {
          description: 'Login successful. Redirecting to your dashboard...',
        });

        // Determine role-based destination
        const roleCode = getRoleCode(user);
        const destination = getDashboardRoute(roleCode, user);
        navigate(destination, { replace: true });
      } else {
        setErrorMessage({ message: response.message || 'Authentication failed.' });
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { message?: string; errorCode?: string } };
        message?: string;
      };
      const code = apiError.response?.data?.errorCode;
      const msg = apiError.response?.data?.message || 'Verification failed. Please try again.';

      if (code === 'E015') {
        setAttemptsLeft((prev) => Math.max(0, prev - 1));
        setErrorMessage({
          title: 'Invalid Code',
          message: 'The verification code you entered is incorrect. Please check and try again.',
          code,
          type: 'destructive',
        });
      } else if (code === 'E016') {
        setErrorMessage({
          title: 'Code Expired',
          message: 'Your verification code has expired. Please request a new code.',
          code,
          type: 'warning',
        });
      } else if (code === 'E017') {
        setAttemptsLeft(0);
        setErrorMessage({
          title: 'Maximum Attempts Exceeded',
          message:
            'You have exceeded the maximum number of attempts. Please request a new verification code.',
          code,
          type: 'destructive',
        });
      } else {
        setErrorMessage({ message: msg, code, type: 'destructive' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend OTP Action
   */
  const handleResendOtp = async () => {
    setErrorMessage(null);
    setIsResending(true);

    try {
      const response = await resendOtp({
        identifier,
        type: 'LOGIN',
        deliveryMethod: method === 'email' ? 'Email' : 'SMS',
      });

      if (response.success) {
        setOtpValue('');
        setAttemptsLeft(3);
        toast.success('A new verification code has been dispatched.', {
          description: `Delivered to your registered email in Mailpit for ${identifier}`,
        });
      } else {
        setErrorMessage({ message: response.message || 'Failed to resend code.' });
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { message?: string; errorCode?: string } };
      };
      const msg = apiError.response?.data?.message || 'Unable to resend verification code.';
      setErrorMessage({ message: msg, type: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  /**
   * Return to identifier input to change email or mobile number
   */
  const handleChangeIdentifier = () => {
    setStep('identifier');
    setOtpValue('');
    setErrorMessage(null);
    setAttemptsLeft(3);
  };

  return (
    <div className="w-full space-y-6">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-2 rounded-xl bg-primary/10 text-primary mb-1">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {step === 'identifier' ? 'Welcome Back' : 'Verify Your Identity'}
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {step === 'identifier'
            ? 'Sign in to your ParkEase account using secure passwordless OTP authentication.'
            : method === 'email'
              ? 'Enter the 6-digit verification code sent to your registered email address.'
              : 'Enter the 6-digit verification code sent via SMS to your mobile number.'}
        </p>
      </div>

      {/* Error Alert Display */}
      {errorMessage && (
        <Alert
          variant={errorMessage.type === 'warning' ? 'warning' : 'destructive'}
          className="animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {errorMessage.type === 'warning' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          <div className="ml-2">
            {errorMessage.title && (
              <AlertTitle className="font-semibold">{errorMessage.title}</AlertTitle>
            )}
            <AlertDescription className="text-xs sm:text-sm">
              {errorMessage.message}
              {errorMessage.code === 'E014' && (
                <div className="mt-2">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-90"
                  >
                    Register as a Customer &rarr;
                  </Link>
                </div>
              )}
              {errorMessage.code === 'E043' && (
                <div className="mt-2">
                  <Link
                    to="/owner/registration-status"
                    className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-90"
                  >
                    Track Owner Application Status &rarr;
                  </Link>
                </div>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* STEP 1: IDENTIFIER INPUT */}
      {step === 'identifier' ? (
        <Tabs value={method} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>Mobile Number</span>
            </TabsTrigger>
          </TabsList>

          {/* Email Login Tab */}
          <TabsContent value="email" className="space-y-4 focus-visible:outline-none">
            <form onSubmit={emailForm.handleSubmit(handleRequestOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    autoFocus
                    className="pl-9"
                    disabled={isLoading}
                    {...emailForm.register('email')}
                  />
                </div>
                {emailForm.formState.errors.email && (
                  <FieldFeedback
                    status="error"
                    message={emailForm.formState.errors.email.message}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  We will dispatch a secure 6-digit verification code to your email.
                </p>
              </div>

              <Button type="submit" className="w-full font-semibold shadow-xs" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    Sending Code...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Mobile Login Tab */}
          <TabsContent value="mobile" className="space-y-4 focus-visible:outline-none">
            <form onSubmit={mobileForm.handleSubmit(handleRequestOtp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-mobile">Mobile Number</Label>
                <div className="flex flex-row items-center flex-nowrap rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-[color,box-shadow] bg-background shadow-xs overflow-hidden w-full">
                  <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-muted/60 px-3 py-2 text-sm font-semibold text-muted-foreground border-r border-input select-none">
                    <span role="img" aria-label="India flag">
                      🇮🇳
                    </span>
                    <span>+91</span>
                  </div>
                  <input
                    id="login-mobile"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="9099077378"
                    autoComplete="tel-national"
                    autoFocus
                    disabled={isLoading}
                    className="flex-1 min-w-0 h-10 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    {...mobileForm.register('mobileDigits', {
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      },
                    })}
                  />
                </div>
                {mobileForm.formState.errors.mobileDigits && (
                  <FieldFeedback
                    status="error"
                    message={mobileForm.formState.errors.mobileDigits.message}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  We will dispatch a secure 6-digit verification code to your registered email in Mailpit.
                </p>
              </div>

              <Button type="submit" className="w-full font-semibold shadow-xs" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                    Sending Code...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      ) : (
        /* STEP 2: OTP VERIFICATION */
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          {/* Active Identifier summary */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/80">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                {method === 'email' ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
              </div>
              <div className="truncate">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Sent To
                </p>
                <p className="text-sm font-semibold text-foreground truncate">{identifier}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleChangeIdentifier}
              className="text-xs text-primary hover:text-primary/90 shrink-0 gap-1 font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Change
            </Button>
          </div>

          {/* 6-digit OTP Input */}
          <div className="space-y-3">
            <Label className="block text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Enter 6-Digit Code
            </Label>
            <OtpInput
              value={otpValue}
              onChange={setOtpValue}
              length={6}
              disabled={isLoading || attemptsLeft <= 0}
              error={Boolean(errorMessage && errorMessage.code === 'E015')}
            />
            {attemptsLeft < 3 && attemptsLeft > 0 && (
              <p className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                {attemptsLeft} verification {attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.
              </p>
            )}
          </div>

          {/* Timer and Resend */}
          <OtpTimer onResend={handleResendOtp} isResending={isResending} />

          {/* Submit Action */}
          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full font-semibold shadow-xs"
              disabled={isLoading || otpValue.length !== 6 || attemptsLeft <= 0}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Verify &amp; Sign In
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChangeIdentifier}
              disabled={isLoading}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel &amp; Use Different Contact
            </Button>
          </div>
        </form>
      )}

      {/* Additional Navigation Links */}
      <div className="pt-4 border-t border-border/60 flex flex-col items-center justify-center space-y-2.5 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <UserPlus className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Don&apos;t have an account?</span>
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Register as a Customer
          </Link>
        </p>

        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Parking Facility Owner?</span>
          <Link to="/become-owner" className="font-medium text-foreground hover:underline">
            Partner with ParkEase
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
