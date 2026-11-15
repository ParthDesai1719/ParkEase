import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import {
  Building2,
  User,
  FileCheck2,
  ShieldCheck,
  Mail,
  Smartphone,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  FileText,
  Clock,
  Lock,
  RefreshCw,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ownerApi,
  type OwnerRegistrationConfig,
  type OwnerRegistrationFormData,
  type VerifyPaymentResult,
} from '@/api/owner.api';

// Step enumeration: exactly 9 steps
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const BUSINESS_TYPES = [
  'Commercial Parking',
  'Shopping Mall',
  'Hospital',
  'Hotel',
  'Airport',
  'Railway Station',
  'Residential Society',
  'Educational Institution',
  'Other',
];

const GOV_ID_TYPES = ['Aadhaar', 'PAN', 'Driving Licence', 'Passport'];

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'An unexpected error occurred.';
};

export const OwnerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  // 1. Configuration from Backend
  const [config, setConfig] = useState<OwnerRegistrationConfig | null>(null);

  // 2. Wizard Navigation
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // 3. Form Data State
  const [formData, setFormData] = useState<OwnerRegistrationFormData>({
    businessName: '',
    businessType: 'Commercial Parking',
    businessAddress: '',
    city: '',
    state: '',
    postalCode: '',
    parkingCapacity: 50,
    businessDescription: '',
    ownerName: '',
    businessEmail: '',
    businessPhone: '',
    governmentIdType: 'PAN',
    governmentIdNumber: '',
    identityProofUrl: '',
    businessLicenseUrl: '',
    propertyProofUrl: '',
    parkingImageUrls: [],
    termsAccepted: false,
  });

  // 4. File Upload Trackers
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [docFileNames, setDocFileNames] = useState<Record<string, string>>({});

  // 5. Registration State
  const [appReference, setAppReference] = useState<string>('');
  const [registrationSubmitting, setRegistrationSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 6. OTP States
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpTimer, setEmailOtpTimer] = useState(0);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);

  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpTimer, setMobileOtpTimer] = useState(0);
  const [mobileOtpVerifying, setMobileOtpVerifying] = useState(false);

  // 7. Payment State
  const [paymentInitiating, setPaymentInitiating] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [paymentResult, setPaymentResult] = useState<VerifyPaymentResult | null>(null);

  // Load platform configuration
  useEffect(() => {
    let mounted = true;
    ownerApi
      .getConfig()
      .then((cfg) => {
        if (mounted) setConfig(cfg);
      })
      .catch((err) => {
        console.error('Failed to load owner registration config:', err);
        if (mounted) {
          setConfig({
            ownerRegistrationFee: 999,
            defaultCurrency: 'INR',
            paymentGateway: 'RAZORPAY_TEST',
            razorpayKeyId: '',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Cooldown timer tick for OTPs
  useEffect(() => {
    if (emailOtpTimer <= 0) return;
    const interval = setInterval(() => setEmailOtpTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [emailOtpTimer]);

  useEffect(() => {
    if (mobileOtpTimer <= 0) return;
    const interval = setInterval(() => setMobileOtpTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [mobileOtpTimer]);

  // Load Razorpay checkout script
  useEffect(() => {
    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Form field handler
  const handleChange = <K extends keyof OwnerRegistrationFormData>(
    field: K,
    value: OwnerRegistrationFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  // Upload file helper
  const handleFileUpload = async (
    key: 'identityProofUrl' | 'businessLicenseUrl' | 'propertyProofUrl' | 'parkingImage',
    file: File,
  ) => {
    try {
      setUploadingDoc(key);
      setFormError(null);

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds the 5MB maximum limit.');
      }

      const res = await ownerApi.uploadDocument(file);

      if (key === 'parkingImage') {
        setFormData((prev) => ({
          ...prev,
          parkingImageUrls: [...prev.parkingImageUrls, res.filePath].slice(0, 5),
        }));
        setDocFileNames((prev) => ({
          ...prev,
          [`parkingImage_${Date.now()}`]: res.fileName,
        }));
      } else {
        setFormData((prev) => ({ ...prev, [key]: res.filePath }));
        setDocFileNames((prev) => ({ ...prev, [key]: res.fileName }));
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'File upload failed.');
    } finally {
      setUploadingDoc(null);
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    if (!formData.businessName.trim()) return 'Please enter your Business Name.';
    if (formData.businessName.trim().length > 150) return 'Business Name cannot exceed 150 characters.';
    if (!formData.businessAddress.trim()) return 'Please enter the Business Address.';
    if (!formData.city.trim()) return 'Please enter the City.';
    if (!formData.state.trim()) return 'Please enter the State.';
    if (!/^[1-9][0-9]{5}$/.test(formData.postalCode.trim())) {
      return 'Please enter a valid 6-digit Indian PIN Code.';
    }
    if (!formData.parkingCapacity || Number(formData.parkingCapacity) <= 0) {
      return 'Parking Capacity must be a positive integer.';
    }
    if (!formData.businessDescription.trim()) {
      return 'Please provide a brief Business Description.';
    }
    return null;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    if (!formData.ownerName.trim()) return 'Please enter the Owner Full Name.';
    if (!formData.businessEmail.trim() || !/^\S+@\S+\.\S+$/.test(formData.businessEmail.trim())) {
      return 'Please enter a valid Email Address.';
    }
    const cleanPhone = formData.businessPhone.trim().replace(/[\s-]/g, '').replace(/^\+91/, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return 'Please enter a valid 10-digit Indian Mobile Number.';
    }
    if (!formData.governmentIdNumber.trim()) {
      return 'Please enter the Government Identity Number.';
    }
    return null;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    if (!formData.identityProofUrl) return 'Government ID Proof document is required.';
    if (!formData.businessLicenseUrl) return 'Business Registration / License document is required.';
    if (!formData.propertyProofUrl) return 'Property Ownership or Rental Proof document is required.';
    if (formData.parkingImageUrls.length === 0) return 'At least one Parking Facility image is required.';
    return null;
  };

  // Step 4: Submit Registration Draft & proceed to Step 5 (Email OTP)
  const handleProceedToEmailOtp = async () => {
    if (!formData.termsAccepted) {
      setFormError('You must explicitly accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    try {
      setRegistrationSubmitting(true);
      setFormError(null);

      const res = await ownerApi.createDraft(formData);
      setAppReference(res.applicationReference);
      setEmailOtpTimer(30);
      setCurrentStep(5);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Failed to initialize registration.');
    } finally {
      setRegistrationSubmitting(false);
    }
  };

  // Step 5: Verify Email OTP & transition to Step 6 (Mobile OTP)
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setFormError('Please enter the 6-digit Email verification OTP.');
      return;
    }

    try {
      setEmailOtpVerifying(true);
      setFormError(null);

      await ownerApi.verifyEmailOtp(appReference, emailOtp.trim());
      setMobileOtpTimer(30);
      setCurrentStep(6);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Email OTP verification failed.');
    } finally {
      setEmailOtpVerifying(false);
    }
  };

  const handleResendEmailOtp = async () => {
    try {
      setFormError(null);
      const res = await ownerApi.requestEmailOtp(appReference);
      setEmailOtpTimer(res.cooldownSeconds || 30);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Failed to resend Email OTP.');
    }
  };

  // Step 6: Verify Mobile OTP & transition to Step 7 (Summary)
  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp.trim() || mobileOtp.trim().length !== 6) {
      setFormError('Please enter the 6-digit Mobile verification OTP.');
      return;
    }

    try {
      setMobileOtpVerifying(true);
      setFormError(null);

      await ownerApi.verifyMobileOtp(appReference, mobileOtp.trim());
      setCurrentStep(7);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Mobile OTP verification failed.');
    } finally {
      setMobileOtpVerifying(false);
    }
  };

  const handleResendMobileOtp = async () => {
    try {
      setFormError(null);
      const res = await ownerApi.requestMobileOtp(appReference);
      setMobileOtpTimer(res.cooldownSeconds || 30);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Failed to resend Mobile OTP.');
    }
  };

  // Step 8: Launch Razorpay Checkout Modal
  const handleInitiatePayment = async () => {
    try {
      setPaymentInitiating(true);
      setFormError(null);

      const orderData = await ownerApi.createPaymentOrder(appReference);

      if (typeof window.Razorpay === 'function') {
        const options = {
          key: orderData.keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency,
          name: 'ParkEase',
          description: 'Parking Owner Platform Registration Fee',
          order_id: orderData.orderId,
          prefill: {
            name: orderData.ownerName,
            email: orderData.email,
            contact: orderData.contact,
          },
          theme: {
            color: '#16a34a',
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              setPaymentVerifying(true);
              const result = await ownerApi.verifyPayment({
                applicationReference: appReference,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              setPaymentResult(result);

              // Immediately log out the user and throw out to home page as requested
              try {
                await logout();
              } catch {
                useAuthStore.getState().clearAuth();
              }

              toast.success(
                `Payment verified! Application ${result.applicationReference} has been submitted for administrator review. You have been logged out.`,
                { duration: 6000 },
              );

              navigate('/', { replace: true });
            } catch (vErr: unknown) {
              setFormError(getErrorMessage(vErr) || 'Payment signature verification failed.');
            } finally {
              setPaymentVerifying(false);
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentInitiating(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Razorpay SDK failed to load. Please verify your internet connection.');
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err) || 'Failed to initiate payment.');
    } finally {
      setPaymentInitiating(false);
    }
  };

  const registrationFee = config?.ownerRegistrationFee ?? 999;
  const currencySymbol = config?.defaultCurrency === 'INR' ? '₹' : (config?.defaultCurrency ?? '₹');

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      {/* 1. Header Banner */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-3 py-1 font-semibold text-xs">
          Partner Onboarding Portal
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Parking Owner Registration
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Complete your partner profile, upload ownership verification documents, verify your identity,
          and pay the one-time platform registration fee to submit your facility for administrative review.
        </p>
      </div>

      {/* 2. 9-Step Visual Progress Bar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm overflow-x-auto">
        <div className="flex items-start w-full min-w-[700px] px-1 sm:px-2">
          {[
            { step: 1, label: 'Business', icon: Building2 },
            { step: 2, label: 'Owner', icon: User },
            { step: 3, label: 'Documents', icon: Upload },
            { step: 4, label: 'Terms', icon: FileCheck2 },
            { step: 5, label: 'Email OTP', icon: Mail },
            { step: 6, label: 'Mobile OTP', icon: Smartphone },
            { step: 7, label: 'Summary', icon: FileSpreadsheet },
            { step: 8, label: 'Payment', icon: CreditCard },
            { step: 9, label: 'Success', icon: CheckCircle2 },
          ].map((item, idx) => {
            const Icon = item.icon;
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;

            return (
              <div key={item.step} className="relative flex-1 flex flex-col items-center">
                {/* Left connecting line (for steps > 1) */}
                {idx > 0 && (
                  <div
                    className={`absolute top-[18px] -translate-y-1/2 left-0 right-[calc(50%+22px)] h-0.5 rounded-full transition-all ${
                      currentStep >= item.step ? 'bg-primary' : 'bg-border/60'
                    }`}
                  />
                )}

                {/* Right connecting line (for steps < 9) */}
                {idx < 8 && (
                  <div
                    className={`absolute top-[18px] -translate-y-1/2 left-[calc(50%+22px)] right-0 h-0.5 rounded-full transition-all ${
                      currentStep > item.step ? 'bg-primary' : 'bg-border/60'
                    }`}
                  />
                )}

                {/* Circle Icon Badge */}
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isCurrent
                      ? 'bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>

                {/* Step Label */}
                <span
                  className={`text-[10px] sm:text-[11px] mt-2 font-medium whitespace-nowrap text-center select-none transition-colors ${
                    isCurrent
                      ? 'text-primary font-bold'
                      : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Global Error Display */}
      {formError && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-3 text-destructive animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold text-sm">Action Required</p>
            <p>{formError}</p>
          </div>
        </div>
      )}

      {/* 4. Multi-Step Form Container */}
      <Card className="border-border/80 bg-card shadow-sm overflow-hidden">
        {/* STEP 1: BUSINESS INFORMATION */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Building2 className="h-4 w-4" /> Step 1 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Business Information</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your commercial or private parking facility details.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="businessName" className="text-xs font-semibold">
                  Business / Facility Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessName"
                  placeholder="e.g. Apex Metro Parking Solutions"
                  value={formData.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  maxLength={150}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="businessType" className="text-xs font-semibold">
                  Business Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.businessType}
                  onValueChange={(val) => handleChange('businessType', val)}
                >
                  <SelectTrigger id="businessType">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="parkingCapacity" className="text-xs font-semibold">
                  Planned Slot Capacity <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="parkingCapacity"
                  type="number"
                  min={1}
                  placeholder="e.g. 150"
                  value={formData.parkingCapacity || ''}
                  onChange={(e) => handleChange('parkingCapacity', parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="businessAddress" className="text-xs font-semibold">
                  Physical Street Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessAddress"
                  placeholder="e.g. Plot 42, Sector 18, Commercial Belt"
                  value={formData.businessAddress}
                  onChange={(e) => handleChange('businessAddress', e.target.value)}
                  maxLength={300}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs font-semibold">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="e.g. Gurugram"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="state" className="text-xs font-semibold">
                  State <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="state"
                  placeholder="e.g. Haryana"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="postalCode" className="text-xs font-semibold">
                  PIN Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="postalCode"
                  placeholder="6-digit PIN code"
                  value={formData.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="businessDescription" className="text-xs font-semibold">
                  Business &amp; Facility Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="businessDescription"
                  rows={3}
                  placeholder="Describe your parking facility, multi-level/surface structure, security provisions, and entry points..."
                  value={formData.businessDescription}
                  onChange={(e) => handleChange('businessDescription', e.target.value)}
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={() => {
                  const err = validateStep1();
                  if (err) setFormError(err);
                  else {
                    setFormError(null);
                    setCurrentStep(2);
                  }
                }}
              >
                Continue to Owner Information
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: OWNER INFORMATION */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <User className="h-4 w-4" /> Step 2 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Owner &amp; Identity Profile</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter contact and official government identification details for account verification.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ownerName" className="text-xs font-semibold">
                  Full Legal Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ownerName"
                  placeholder="As per government identity document"
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="businessEmail" className="text-xs font-semibold">
                  Registered Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="businessEmail"
                  type="email"
                  placeholder="owner@business.com"
                  value={formData.businessEmail}
                  onChange={(e) => handleChange('businessEmail', e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Verification OTPs and administrative notifications will be sent to this email.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="businessPhone" className="text-xs font-semibold">
                  Mobile Number (India) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-2 border border-border bg-muted/40 rounded-md text-xs font-semibold shrink-0">
                    +91
                  </div>
                  <Input
                    id="businessPhone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={formData.businessPhone.replace(/^\+91/, '')}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      handleChange('businessPhone', digits);
                    }}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="governmentIdType" className="text-xs font-semibold">
                  Government Identity Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.governmentIdType}
                  onValueChange={(val) => handleChange('governmentIdType', val)}
                >
                  <SelectTrigger id="governmentIdType">
                    <SelectValue placeholder="Select ID Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOV_ID_TYPES.map((idType) => (
                      <SelectItem key={idType} value={idType}>
                        {idType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="governmentIdNumber" className="text-xs font-semibold">
                  Government ID Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="governmentIdNumber"
                  placeholder="e.g. PAN / Aadhaar Number"
                  value={formData.governmentIdNumber}
                  onChange={(e) => handleChange('governmentIdNumber', e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => {
                  const err = validateStep2();
                  if (err) setFormError(err);
                  else {
                    setFormError(null);
                    setCurrentStep(3);
                  }
                }}
              >
                Continue to Verification Documents
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION DOCUMENTS */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Upload className="h-4 w-4" /> Step 3 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Verification Documents</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Upload business proof, property ownership documents, and facility photos (PDF or JPG/PNG/WebP, max 5MB each).
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Document 1: Government ID */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    Government ID Proof <span className="text-destructive">*</span>
                  </Label>
                  {formData.identityProofUrl && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Scanned copy of your {formData.governmentIdType || 'Government ID'}.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    disabled={uploadingDoc === 'identityProofUrl'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('identityProofUrl', file);
                    }}
                    className="text-xs cursor-pointer"
                  />
                </div>
                {docFileNames.identityProofUrl && (
                  <p className="text-[11px] text-primary truncate">Uploaded: {docFileNames.identityProofUrl}</p>
                )}
              </div>

              {/* Document 2: Business License */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    Business License / Registration <span className="text-destructive">*</span>
                  </Label>
                  {formData.businessLicenseUrl && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Shop Act License, GST Certificate, or Trade Registration.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    disabled={uploadingDoc === 'businessLicenseUrl'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('businessLicenseUrl', file);
                    }}
                    className="text-xs cursor-pointer"
                  />
                </div>
                {docFileNames.businessLicenseUrl && (
                  <p className="text-[11px] text-primary truncate">Uploaded: {docFileNames.businessLicenseUrl}</p>
                )}
              </div>

              {/* Document 3: Property Ownership */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Property Proof / Lease Deed <span className="text-destructive">*</span>
                  </Label>
                  {formData.propertyProofUrl && (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Registered Title Deed, Electricity Bill, or Lease Agreement.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    disabled={uploadingDoc === 'propertyProofUrl'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('propertyProofUrl', file);
                    }}
                    className="text-xs cursor-pointer"
                  />
                </div>
                {docFileNames.propertyProofUrl && (
                  <p className="text-[11px] text-primary truncate">Uploaded: {docFileNames.propertyProofUrl}</p>
                )}
              </div>

              {/* Document 4: Parking Photos */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Upload className="h-4 w-4 text-primary" />
                    Parking Facility Photos <span className="text-destructive">*</span>
                  </Label>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                    {formData.parkingImageUrls.length} / 5 Uploaded
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Clear photos showing entry gate, parking slots, and facility layout.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    disabled={uploadingDoc === 'parkingImage' || formData.parkingImageUrls.length >= 5}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('parkingImage', file);
                    }}
                    className="text-xs cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => {
                  const err = validateStep3();
                  if (err) setFormError(err);
                  else {
                    setFormError(null);
                    setCurrentStep(4);
                  }
                }}
              >
                Review Terms &amp; Conditions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: TERMS & REVIEW */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <FileCheck2 className="h-4 w-4" /> Step 4 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Terms &amp; Policies Review</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Please review your registration details and accept the platform terms before initiating identity verification.
              </CardDescription>
            </CardHeader>

            {/* Profile Recap Summary */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Facility:</span>{' '}
                  <span className="font-semibold text-foreground">{formData.businessName}</span> ({formData.businessType})
                </div>
                <div>
                  <span className="text-muted-foreground">Owner:</span>{' '}
                  <span className="font-semibold text-foreground">{formData.ownerName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-semibold text-foreground">{formData.businessEmail}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mobile:</span>{' '}
                  <span className="font-semibold text-foreground">+91 {formData.businessPhone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{' '}
                  <span className="font-semibold text-foreground">{formData.city}, {formData.state} - {formData.postalCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Capacity:</span>{' '}
                  <span className="font-semibold text-foreground">{formData.parkingCapacity} slots</span>
                </div>
              </div>
            </div>

            {/* Terms and Checkboxes */}
            <div className="p-4 rounded-xl border border-border/80 bg-card space-y-4">
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  By submitting this application, you certify that you are the lawful owner or authorized operator of the
                  parking facility described above. All submitted documents and proofs are subject to strict administrative
                  verification.
                </p>
                <p>
                  You acknowledge that payment of the one-time platform registration fee does not automatically approve or
                  activate your Parking Owner account. Official facility creation and dashboard authorization remain under
                  Administrator control.
                </p>
              </div>

              <div className="pt-2 border-t border-border/60">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.termsAccepted}
                    onChange={(e) => handleChange('termsAccepted', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-foreground leading-relaxed">
                    I explicitly agree to the{' '}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline font-semibold">
                      Terms &amp; Conditions
                    </Link>
                    ,{' '}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline font-semibold">
                      Privacy Policy
                    </Link>
                    , and Platform Governance Policies of ParkEase.
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleProceedToEmailOtp} disabled={registrationSubmitting || !formData.termsAccepted}>
                {registrationSubmitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Application Draft...
                  </>
                ) : (
                  <>
                    Proceed to Email OTP Verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: EMAIL OTP VERIFICATION */}
        {currentStep === 5 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Mail className="h-4 w-4" /> Step 5 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Verify Owner Email Address</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                We sent a 6-digit verification code to <span className="font-semibold text-foreground">{formData.businessEmail}</span>.
              </CardDescription>
            </CardHeader>

            <div className="max-w-md mx-auto space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="emailOtp" className="text-xs font-semibold">
                  6-Digit Email Verification Code
                </Label>
                <Input
                  id="emailOtp"
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-xl tracking-widest h-12"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Code expires in 5 minutes</span>
                {emailOtpTimer > 0 ? (
                  <span>Resend in {emailOtpTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendEmailOtp}
                    className="text-primary font-semibold hover:underline"
                  >
                    Resend Email OTP
                  </button>
                )}
              </div>

              <Button
                className="w-full h-11"
                onClick={handleVerifyEmailOtp}
                disabled={emailOtpVerifying || emailOtp.length !== 6}
              >
                {emailOtpVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Verifying Code...
                  </>
                ) : (
                  <>
                    Verify Email OTP
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6: MOBILE OTP VERIFICATION */}
        {currentStep === 6 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Smartphone className="h-4 w-4" /> Step 6 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Verify Owner Mobile Number</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Mobile verification for <span className="font-semibold text-foreground">+91 {formData.businessPhone}</span>.
              </CardDescription>
            </CardHeader>

            {/* V1 Rule Notice */}
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-700 dark:text-blue-300 space-y-1 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                V1 Platform Delivery Notice
              </div>
              <p>
                In accordance with Version 1 platform rules, your Mobile Verification OTP has been securely delivered to your
                registered email address (<span className="font-mono">{formData.businessEmail}</span>) with clear labeling
                for the mobile verification challenge.
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="mobileOtp" className="text-xs font-semibold">
                  6-Digit Mobile Verification Code
                </Label>
                <Input
                  id="mobileOtp"
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={mobileOtp}
                  onChange={(e) => setMobileOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-xl tracking-widest h-12"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Code expires in 5 minutes</span>
                {mobileOtpTimer > 0 ? (
                  <span>Resend in {mobileOtpTimer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendMobileOtp}
                    className="text-primary font-semibold hover:underline"
                  >
                    Resend Mobile OTP
                  </button>
                )}
              </div>

              <Button
                className="w-full h-11"
                onClick={handleVerifyMobileOtp}
                disabled={mobileOtpVerifying || mobileOtp.length !== 6}
              >
                {mobileOtpVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Verifying Code...
                  </>
                ) : (
                  <>
                    Verify Mobile OTP &amp; Unlock Payment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 7: REGISTRATION SUMMARY */}
        {currentStep === 7 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <FileSpreadsheet className="h-4 w-4" /> Step 7 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Registration Summary &amp; Fee</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Identity verified. Review the platform fee breakdown before proceeding to payment checkout.
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Left Column: Verification Badges */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Verification Milestones
                  </h2>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email Verification:</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Mobile Verification:</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Application Reference:</span>
                      <span className="font-mono font-semibold text-primary">{appReference}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2 text-xs">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Facility Overview
                  </h2>
                  <p className="font-bold text-foreground">{formData.businessName}</p>
                  <p className="text-muted-foreground">
                    {formData.businessType} • {formData.parkingCapacity} slot capacity
                  </p>
                  <p className="text-muted-foreground">
                    {formData.city}, {formData.state} - {formData.postalCode}
                  </p>
                </div>
              </div>

              {/* Right Column: Platform Registration Fee Breakdown */}
              <div className="p-6 rounded-xl border border-primary/20 bg-primary/5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Fee Breakdown
                    </span>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      One-time Platform Fee
                    </Badge>
                  </div>

                  <div className="space-y-2 text-xs pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Platform Registration Fee:</span>
                      <span className="font-semibold text-foreground">
                        {currencySymbol}{registrationFee}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Applicable Platform Tax:</span>
                      <span className="font-semibold text-foreground">{currencySymbol}0</span>
                    </div>
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-extrabold">
                      <span className="text-foreground">Total Payable Amount:</span>
                      <span className="text-primary text-lg">
                        {currencySymbol}{registrationFee}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-2">
                    This registration fee is non-refundable and covers administrative review and account onboarding.
                    Payment does not automatically activate your facility.
                  </p>
                </div>

                <Button className="w-full h-11" onClick={() => setCurrentStep(8)}>
                  Proceed to Razorpay Payment
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: RAZORPAY TEST PAYMENT */}
        {currentStep === 8 && (
          <div className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <CreditCard className="h-4 w-4" /> Step 8 of 9
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">Pay Registration Fee</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Complete your ₹{registrationFee} platform registration payment via Razorpay Test Mode.
              </CardDescription>
            </CardHeader>

            <div className="max-w-md mx-auto p-6 rounded-2xl border border-border/80 bg-muted/10 text-center space-y-6">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount Due</p>
                <p className="text-3xl font-extrabold text-foreground">{currencySymbol}{registrationFee}</p>
                <p className="text-[11px] text-muted-foreground">
                  Reference: <span className="font-mono text-foreground font-semibold">{appReference}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border/60 bg-card text-xs text-muted-foreground text-left space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Razorpay Test Mode Active
                </div>
                <p className="text-[11px]">
                  Use Razorpay Test Cards / UPI / Netbanking to complete this demonstration transaction.
                </p>
              </div>

              <Button
                className="w-full h-12 text-sm font-semibold"
                onClick={handleInitiatePayment}
                disabled={paymentInitiating || paymentVerifying}
              >
                {paymentInitiating || paymentVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing Payment...
                  </>
                ) : (
                  <>
                    Open Razorpay Checkout ({currencySymbol}{registrationFee})
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 9: REGISTRATION SUCCESS */}
        {currentStep === 9 && paymentResult && (
          <div className="p-6 sm:p-10 space-y-8 text-center animate-in fade-in">
            <div className="h-20 w-20 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs px-3 py-1 font-semibold">
                Payment Verified &amp; Submitted
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Application Successfully Submitted!
              </h2>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Your parking owner registration application for <strong>{paymentResult.businessName}</strong> has been
                successfully received. Our platform administrators will review your submitted verification documents.
              </p>
            </div>

            {/* Receipt / Details Card */}
            <div className="max-w-xl mx-auto rounded-2xl border border-border/80 bg-muted/20 p-6 text-left space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  Registration Receipt
                </span>
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                  <Clock className="h-3 w-3 mr-1" /> Under Review
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Application ID:</span>
                  <p className="font-mono font-bold text-primary mt-0.5">{paymentResult.applicationReference}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment ID:</span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">{paymentResult.paymentId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Registration Fee:</span>
                  <p className="font-bold text-foreground mt-0.5">
                    {currencySymbol}{paymentResult.amount} (Paid)
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee Status:</span>
                  <p className="font-semibold text-emerald-600 capitalize mt-0.5">
                    {paymentResult.paymentStatus.toLowerCase()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted Date:</span>
                  <p className="font-semibold text-foreground mt-0.5">
                    {new Date(paymentResult.submittedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Review Time:</span>
                  <p className="font-semibold text-foreground mt-0.5">24–48 Business Hours</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild className="font-semibold">
                <Link to={`/owner/registration-status?query=${paymentResult.applicationReference}`}>
                  Track Application Status
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Go to Login</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
