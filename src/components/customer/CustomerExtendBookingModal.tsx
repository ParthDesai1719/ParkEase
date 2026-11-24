import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Banknote,
  Loader2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import {
  getCustomerExtensionQuote,
  initiateCustomerExtension,
  verifyOnlineCustomerExtension,
  cancelOnlineCustomerExtension,
  type CustomerExtensionQuoteResponse,
} from '@/api/customerParking.api';
import { toast } from 'sonner';

export interface ExtendBookingTarget {
  id: string;
  bookingReference: string;
  scheduledExitTime: string;
  parkingLotName?: string;
  parkingRateAtBooking?: number;
  vehicleNumber?: string;
  slotNumber?: string;
}

interface CustomerExtendBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: ExtendBookingTarget | null;
  onSuccess?: () => void;
}

const PRESET_DURATIONS = [
  { label: '30 Mins', value: 30 },
  { label: '1 Hour', value: 60 },
  { label: '2 Hours', value: 120 },
  { label: '3 Hours', value: 180 },
];

export const CustomerExtendBookingModal: React.FC<CustomerExtendBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSuccess,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(60);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>('60');
  const [paymentChoice, setPaymentChoice] = useState<'RAZORPAY' | 'CASH'>('RAZORPAY');

  const [quote, setQuote] = useState<CustomerExtensionQuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);
  const [confirmedDetails, setConfirmedDetails] = useState<{
    newExitTime: string;
    additionalMinutes: number;
    amount: number;
    paymentMethod: string;
  } | null>(null);

  const wasOpenRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload Razorpay SDK script in the background
  const loadRazorpayScript = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  const bookingId = booking?.id;

  // Fetch live extension quote from backend
  const fetchQuote = useCallback(
    async (minutes: number) => {
      if (!bookingId || minutes <= 0) return;
      setIsLoadingQuote(true);
      setQuoteError(null);
      try {
        const res = await getCustomerExtensionQuote(bookingId, minutes);
        setQuote(res);
        if (!res.eligible) {
          setQuoteError(res.reason || 'This extension cannot be completed.');
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || err?.message || 'Failed to calculate extension quote.';
        setQuoteError(msg);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    },
    [bookingId],
  );

  // Initialize modal state ONLY upon initial open transition
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && bookingId) {
      wasOpenRef.current = true;
      setCashConfirmed(false);
      setConfirmedDetails(null);
      setSelectedMinutes(60);
      setIsCustomDuration(false);
      setCustomInput('60');
      setPaymentChoice('RAZORPAY');
      fetchQuote(60);
      // Preload Razorpay script immediately so checkout opens without lag
      loadRazorpayScript().catch(() => {});
    } else if (!isOpen) {
      wasOpenRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    }
  }, [isOpen, bookingId, fetchQuote, loadRazorpayScript]);

  const handlePresetSelect = (minutes: number) => {
    setIsCustomDuration(false);
    setSelectedMinutes(minutes);
    setCustomInput(minutes.toString());
    fetchQuote(minutes);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 15 && num <= 720) {
      setSelectedMinutes(num);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchQuote(num);
      }, 250);
    }
  };

  const handleProceed = async () => {
    if (!booking || !quote || !quote.eligible) return;

    setIsSubmitting(true);
    try {
      if (paymentChoice === 'CASH') {
        // Deferred Cash Collection at Exit
        const res = await initiateCustomerExtension(booking.id, {
          additionalMinutes: selectedMinutes,
          paymentMethod: 'CASH',
        });

        setCashConfirmed(true);
        setConfirmedDetails({
          newExitTime: res.newScheduledExitTime,
          additionalMinutes: res.additionalMinutes,
          amount: res.additionalCharge,
          paymentMethod: 'CASH',
        });
        toast.success(
          `Extension confirmed! Authorized until ${new Date(res.newScheduledExitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
        );
        onSuccess?.();
      } else {
        // Online Payment via Razorpay
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          toast.error('Failed to load secure payment gateway. Please check your connection.');
          setIsSubmitting(false);
          return;
        }

        const res = await initiateCustomerExtension(booking.id, {
          additionalMinutes: selectedMinutes,
          paymentMethod: 'RAZORPAY',
        });

        if (!res.razorpayOrder) {
          throw new Error('Payment gateway order was not returned.');
        }

        const options = {
          key: res.razorpayOrder.keyId,
          amount: res.razorpayOrder.amount * 100,
          currency: res.razorpayOrder.currency || 'INR',
          name: 'ParkEase',
          description: `Booking Extension (+${selectedMinutes} mins) - ${booking.bookingReference}`,
          order_id: res.razorpayOrder.orderId,
          handler: async (response: any) => {
            try {
              setIsSubmitting(true);
              const verifyRes = await verifyOnlineCustomerExtension(booking.id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              setCashConfirmed(true);
              setConfirmedDetails({
                newExitTime: verifyRes.newScheduledExitTime || res.newScheduledExitTime,
                additionalMinutes: selectedMinutes,
                amount: res.additionalCharge,
                paymentMethod: 'RAZORPAY',
              });
              toast.success('Online extension payment verified successfully!');
              onSuccess?.();
            } catch (err: any) {
              const msg =
                err?.response?.data?.message || err?.message || 'Payment verification failed.';
              toast.error(msg);
            } finally {
              setIsSubmitting(false);
            }
          },
          modal: {
            ondismiss: async () => {
              setIsSubmitting(false);
              try {
                await cancelOnlineCustomerExtension(booking.id);
                toast.info('Extension checkout cancelled. Temporary slot hold released.');
              } catch {
                // Ignore cancel errors
              }
            },
          },
          theme: {
            color: '#10b981',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to initiate extension.';
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return dateStr;
    }
  };

  // Instant optimistic estimates for smooth responsiveness
  const currentExitDate = booking?.scheduledExitTime ? new Date(booking.scheduledExitTime) : new Date();
  const optimisticExitTime = new Date(currentExitDate.getTime() + selectedMinutes * 60 * 1000).toISOString();
  const ratePerHour = quote?.ratePerHour ?? (booking?.parkingRateAtBooking || 60);
  const optimisticCharge = quote ? quote.additionalCharge : Math.round(Math.ceil(selectedMinutes / 60) * ratePerHour);
  const displayedExitTime = quote?.proposedScheduledExitTime || optimisticExitTime;
  const displayedCharge = optimisticCharge;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border-border/80 bg-background shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Extend Booking Session
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Ref: <span className="font-mono font-semibold text-foreground">{booking?.bookingReference}</span>
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[11px] bg-background">
              Active Session
            </Badge>
          </div>
        </DialogHeader>

        {cashConfirmed && confirmedDetails ? (
          <div className="p-6 space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">
                Extension Confirmed!
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Your parking session has been extended by{' '}
                <span className="font-semibold text-foreground">{confirmedDetails.additionalMinutes} minutes</span>.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Revised Exit Time:</span>
                <span className="font-bold text-foreground font-mono">
                  {formatDateTime(confirmedDetails.newExitTime)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Additional Charge:</span>
                <span className="font-bold text-foreground font-mono">
                  ₹{confirmedDetails.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Payment Method:</span>
                <Badge variant={confirmedDetails.paymentMethod === 'CASH' ? 'outline' : 'default'} className="text-[10px]">
                  {confirmedDetails.paymentMethod === 'CASH' ? 'Cash at Exit (Pending Collection)' : 'Online (Paid)'}
                </Badge>
              </div>
            </div>

            {confirmedDetails.paymentMethod === 'CASH' && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <strong>Notice:</strong> You are authorized to stay until your revised exit time. Please ensure you hand over{' '}
                  <strong>₹{confirmedDetails.amount.toFixed(2)} cash</strong> to the Security Staff at the exit gate to clear the barrier.
                </p>
              </div>
            )}

            <Button
              className="w-full font-semibold"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Current Schedule Summary */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground">Facility</span>
                <p className="font-semibold text-foreground truncate">
                  {booking?.parkingLotName || 'Parking Facility'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Current Exit Time</span>
                <p className="font-semibold font-mono text-foreground">
                  {formatDateTime(booking?.scheduledExitTime)}
                </p>
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  Additional Duration
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Max 12 hours (720m)
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {PRESET_DURATIONS.map((preset) => {
                  const isSelected = !isCustomDuration && selectedMinutes === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => handlePresetSelect(preset.value)}
                      className={`h-9 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background hover:bg-muted/60 border-border/80 text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCustomDuration(true)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                    isCustomDuration
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Custom Minutes:
                </button>
                {isCustomDuration && (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="number"
                      min={15}
                      max={720}
                      step={15}
                      value={customInput}
                      onChange={handleCustomChange}
                      placeholder="Minutes (15-720)"
                      className="h-8 px-2.5 w-32 rounded-md border border-border bg-background text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">mins</span>
                  </div>
                )}
              </div>
            </div>

            {/* Live Extension Quote Display */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
              {quoteError ? (
                <div className="flex items-start gap-2.5 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/30">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Extension Unavailable:</span>
                    <p className="mt-0.5 leading-relaxed">{quoteError}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      Revised Exit Time:
                      {isLoadingQuote && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </span>
                    <span className="font-bold text-foreground font-mono">
                      {formatDateTime(displayedExitTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Extension Rate:</span>
                    <span className="font-medium text-foreground">
                      ₹{ratePerHour}/hr
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Exit Grace Period:</span>
                    <span className="font-medium text-foreground">
                      {quote?.exitGracePeriodMinutes || 15} mins preserved
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      Total Extension Fee:
                      {quote && quote.eligible && !isLoadingQuote && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 font-normal py-0">
                          <ShieldCheck className="h-3 w-3 mr-0.5 text-emerald-500 inline" />
                          Verified
                        </Badge>
                      )}
                    </span>
                    <span className="text-base font-extrabold text-primary font-mono">
                      ₹{displayedCharge.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Payment Choice Selection */}
            {!quoteError && (
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-foreground">
                  Select Payment Option
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentChoice('RAZORPAY')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      paymentChoice === 'RAZORPAY'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/80 bg-background hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Pay Online</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px]">
                        Instant
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Pay now via Razorpay (UPI, Cards, Netbanking).
                    </p>
                  </div>

                  <div
                    onClick={() => setPaymentChoice('CASH')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      paymentChoice === 'CASH'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/80 bg-background hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-bold text-foreground">Pay Cash at Exit</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/30">
                        Deferred
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Confirmed now. Hand cash to Security Staff at exit gate.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting || isLoadingQuote || Boolean(quote && !quote.eligible)}
                onClick={handleProceed}
                className="text-xs gap-1.5 font-semibold min-w-[145px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {paymentChoice === 'CASH' ? 'Confirming...' : 'Opening gateway...'}
                  </>
                ) : (
                  <>
                    {paymentChoice === 'RAZORPAY' ? 'Pay Online & Extend' : 'Confirm Cash Extension'}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
