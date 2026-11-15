import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, Info, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldFeedback } from '@/components/ui/field-feedback';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { OtpInput } from '@/components/auth/OtpInput';
import { OtpTimer } from '@/components/auth/OtpTimer';
import {
  customerRegistrationFormSchema,
  type CustomerRegistrationFormValues,
  VEHICLE_TYPES,
} from '@/schemas/auth.schema';
import { requestRegisterOtp, verifyRegisterOtp } from '@/api/auth.api';
import { useAuthStore } from '@/stores/authStore';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [registeredData, setRegisteredData] = useState<CustomerRegistrationFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [emailOtp, setEmailOtp] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CustomerRegistrationFormValues>({
    resolver: zodResolver(customerRegistrationFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      mobileDigits: '',
      vehicleNumber: '',
      vehicleType: 'Car',
      vehicleBrand: '',
      vehicleModel: '',
      termsAccepted: false,
    },
  });

  /**
   * Step 1: Submit Registration Form and Request Dual OTPs
   */
  const onSubmitForm = async (values: CustomerRegistrationFormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await requestRegisterOtp({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        mobileNumber: `+91${values.mobileDigits.trim()}`,
        vehicleNumber: values.vehicleNumber.trim().toUpperCase(),
        vehicleType: values.vehicleType,
        vehicleBrand: values.vehicleBrand.trim(),
        vehicleModel: values.vehicleModel.trim(),
        termsAccepted: values.termsAccepted,
      });

      if (response.success) {
        setRegisteredData(values);
        setStep('otp');
        setEmailOtp('');
        setMobileOtp('');
        setOtpError(null);

        toast.success('Registration initiated!', {
          description: `Verification codes dispatched to Mailpit for ${values.email}`,
        });
      } else {
        setApiError(response.message || 'Registration request could not be processed.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errorObj.response?.data?.message ||
        'Unable to complete registration. Please check your details and try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: Verify Both OTPs and Complete Customer Registration
   */
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!registeredData) return;
    if (emailOtp.length !== 6 || mobileOtp.length !== 6 || isVerifying) return;

    setIsVerifying(true);
    setOtpError(null);

    try {
      const response = await verifyRegisterOtp({
        fullName: registeredData.fullName.trim(),
        email: registeredData.email.trim().toLowerCase(),
        mobileNumber: `+91${registeredData.mobileDigits.trim()}`,
        vehicleNumber: registeredData.vehicleNumber.trim().toUpperCase(),
        vehicleType: registeredData.vehicleType,
        vehicleBrand: registeredData.vehicleBrand.trim(),
        vehicleModel: registeredData.vehicleModel.trim(),
        termsAccepted: registeredData.termsAccepted,
        emailOtp: emailOtp.trim(),
        mobileOtp: mobileOtp.trim(),
      });

      if (response.success && response.data?.user && response.data?.accessToken) {
        const { user, accessToken } = response.data;

        // Establish authenticated session in Zustand store immediately
        setAuth(user, accessToken);

        toast.success(`Welcome to ParkEase, ${user.fullName}!`, {
          description: 'Your customer account and primary vehicle are now active.',
        });

        // Navigate directly to Customer Dashboard — no intermediate Login screen
        navigate('/customer/dashboard', { replace: true });
      } else {
        setOtpError(
          response.message || 'Verification failed. Please check your codes and try again.',
        );
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errorObj.response?.data?.message ||
        'Verification failed. Please check both codes and try again.';
      setOtpError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Resend Both Registration OTPs
   */
  const handleResendCodes = async () => {
    if (!registeredData || isResending) return;
    setIsResending(true);
    setOtpError(null);

    try {
      const response = await requestRegisterOtp({
        fullName: registeredData.fullName.trim(),
        email: registeredData.email.trim().toLowerCase(),
        mobileNumber: `+91${registeredData.mobileDigits.trim()}`,
        vehicleNumber: registeredData.vehicleNumber.trim().toUpperCase(),
        vehicleType: registeredData.vehicleType,
        vehicleBrand: registeredData.vehicleBrand.trim(),
        vehicleModel: registeredData.vehicleModel.trim(),
        termsAccepted: registeredData.termsAccepted,
      });

      if (response.success) {
        toast.success('Verification codes resent!', {
          description: `Fresh verification codes delivered to Mailpit for ${registeredData.email}`,
        });
      } else {
        setOtpError(response.message || 'Unable to resend verification codes.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setOtpError(
        errorObj.response?.data?.message || 'Unable to resend codes. Please check cooldown time.',
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* STEP 1: REGISTRATION FORM */}
      {step === 'form' && (
        <>
          {/* HEADER */}
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Create your ParkEase account
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Set up your account and add your vehicle to get started with easier parking.
            </p>
          </div>

          {apiError && (
            <Alert variant="destructive" className="animate-in fade-in duration-200">
              <AlertTitle className="text-xs font-semibold">Registration Issue</AlertTitle>
              <AlertDescription className="text-xs">{apiError}</AlertDescription>
            </Alert>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reg-name"
                  placeholder="e.g. Parth Desai"
                  className="pl-9"
                  disabled={isLoading}
                  {...register('fullName')}
                />
              </div>
              {errors.fullName && (
                <FieldFeedback status="error" message={errors.fullName.message} />
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-9"
                  disabled={isLoading}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <FieldFeedback status="error" message={errors.email.message} />
              )}
            </div>

            {/* Mobile Number */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-mobile">Mobile Number</Label>
              <div className="flex flex-row items-center flex-nowrap rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-[color,box-shadow] bg-background shadow-xs overflow-hidden w-full">
                <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap bg-muted/60 px-3 py-2 text-sm font-semibold text-muted-foreground border-r border-input select-none">
                  <span role="img" aria-label="India flag">
                    🇮🇳
                  </span>
                  <span>+91</span>
                </div>
                <input
                  id="reg-mobile"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="9099077378"
                  disabled={isLoading}
                  className="flex-1 min-w-0 h-10 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('mobileDigits', {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    },
                  })}
                />
              </div>
              {errors.mobileDigits && (
                <FieldFeedback status="error" message={errors.mobileDigits.message} />
              )}
            </div>

            {/* Vehicle Number & Type (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-vehicle">Vehicle Number</Label>
                <div className="relative">
                  <Car className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="reg-vehicle"
                    placeholder="GJ01AB1234"
                    className="pl-9 uppercase"
                    disabled={isLoading}
                    {...register('vehicleNumber', {
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        e.target.value = e.target.value.toUpperCase();
                      },
                    })}
                  />
                </div>
                {errors.vehicleNumber && (
                  <FieldFeedback status="error" message={errors.vehicleNumber.message} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-vehicletype">Vehicle Type</Label>
                <Controller
                  name="vehicleType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                      <SelectTrigger id="reg-vehicletype">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.vehicleType && (
                  <FieldFeedback status="error" message={errors.vehicleType.message} />
                )}
              </div>
            </div>

            {/* Vehicle Brand & Model (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-vehiclebrand">Vehicle Brand</Label>
                <Input
                  id="reg-vehiclebrand"
                  placeholder="e.g. Honda, Hyundai, Tata"
                  maxLength={50}
                  disabled={isLoading}
                  {...register('vehicleBrand')}
                />
                {errors.vehicleBrand && (
                  <FieldFeedback status="error" message={errors.vehicleBrand.message} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reg-vehiclemodel">Vehicle Model</Label>
                <Input
                  id="reg-vehiclemodel"
                  placeholder="e.g. City, Creta, Nexon EV"
                  maxLength={50}
                  disabled={isLoading}
                  {...register('vehicleModel')}
                />
                {errors.vehicleModel && (
                  <FieldFeedback status="error" message={errors.vehicleModel.message} />
                )}
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-1">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms-check"
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  disabled={isLoading}
                  {...register('termsAccepted')}
                />
                <Label
                  htmlFor="terms-check"
                  className="text-xs text-muted-foreground leading-normal font-normal cursor-pointer"
                >
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>
              {errors.termsAccepted && (
                <FieldFeedback status="error" message={errors.termsAccepted.message} />
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full font-semibold shadow-xs mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                  Initiating Registration...
                </span>
              ) : (
                'Continue to Verification'
              )}
            </Button>
          </form>

          {/* FOOTER LINK */}
          <div className="text-center pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </>
      )}

      {/* STEP 2: DEDICATED DUAL OTP VERIFICATION */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-5 animate-in fade-in duration-200">
          {/* Back to form button */}
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setOtpError(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change registration details</span>
          </button>

          {/* Verification Header */}
          <div className="space-y-1.5 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Verify Your Account
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm max-w-sm mx-auto">
              Please enter the verification codes sent to complete your registration.
            </p>
          </div>

          {/* Recipient summary & V1 explanation card */}
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Registered Email:</span>
              <span className="font-mono text-muted-foreground">{registeredData?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Registered Mobile:</span>
              <span className="font-mono text-muted-foreground">
                +91 {registeredData?.mobileDigits}
              </span>
            </div>
            <div className="pt-2 border-t border-border/60 flex items-start gap-1.5 text-muted-foreground text-[11px] leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
              <span>
                Both your Email OTP and Mobile OTP are delivered directly to Mailpit (http://localhost:8025).
              </span>
            </div>
          </div>

          {otpError && (
            <Alert variant="destructive" className="animate-in fade-in duration-200">
              <AlertTitle className="text-xs font-semibold">Verification Issue</AlertTitle>
              <AlertDescription className="text-xs">{otpError}</AlertDescription>
            </Alert>
          )}

          {/* SECTION 1: EMAIL OTP */}
          <div className="space-y-2.5 rounded-lg border border-border/80 p-4 bg-card shadow-xs">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>Verify Your Email</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit OTP sent to your registered email address.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <OtpInput
                value={emailOtp}
                onChange={setEmailOtp}
                disabled={isVerifying}
                autoFocus={true}
              />
            </div>
          </div>

          {/* SECTION 2: MOBILE NUMBER OTP */}
          <div className="space-y-2.5 rounded-lg border border-border/80 p-4 bg-card shadow-xs">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>Verify Your Mobile Number</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit Mobile OTP delivered to your email in Mailpit.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <OtpInput
                value={mobileOtp}
                onChange={setMobileOtp}
                disabled={isVerifying}
                autoFocus={false}
              />
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <Button
            type="submit"
            className="w-full font-semibold shadow-xs"
            disabled={emailOtp.length !== 6 || mobileOtp.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                Verifying &amp; Creating Account...
              </span>
            ) : (
              'Verify & Create Account'
            )}
          </Button>

          {/* RESEND TIMER & ACTION */}
          <div className="pt-2 border-t border-border/60 text-center">
            <OtpTimer
              initialCooldownSeconds={30}
              initialExpirySeconds={300}
              onResend={handleResendCodes}
              isResending={isResending}
            />
          </div>
        </form>
      )}
    </div>
  );
};
