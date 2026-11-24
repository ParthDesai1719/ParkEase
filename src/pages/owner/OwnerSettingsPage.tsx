import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Building2,
  Clock,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Save,
  Phone,
  Mail,
  Lock,
  Loader2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useLiveSync } from '@/hooks/useLiveSync';
import { toast } from 'sonner';
import {
  getOwnerBusinessSettings,
  updateOwnerBusinessSettings,
  type UpdateOwnerBusinessSettingsInput,
} from '@/api/ownerSettings.api';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const OwnerSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedLotId, setSelectedLotId] = useState<string>('');

  // Form State
  const [contactNumber, setContactNumber] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [isOpen24Hours, setIsOpen24Hours] = useState<boolean>(false);
  const [openingTime, setOpeningTime] = useState<string>('08:00');
  const [closingTime, setClosingTime] = useState<string>('22:00');
  const [operatingDays, setOperatingDays] = useState<string[]>(DAYS_OF_WEEK);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(15);
  const [exitGracePeriodMinutes, setExitGracePeriodMinutes] = useState<number>(15);
  const [maxBookingDurationHours, setMaxBookingDurationHours] = useState<number>(24);
  const [allowOnlineBookings, setAllowOnlineBookings] = useState<boolean>(true);
  const [allowWalkInBookings, setAllowWalkInBookings] = useState<boolean>(true);
  const [overstayGracePeriodMinutes, setOverstayGracePeriodMinutes] = useState<number>(15);
  const [overstayChargeMultiplier, setOverstayChargeMultiplier] = useState<number>(1.5);
  const [hourlyRate, setHourlyRate] = useState<number>(0);

  // 1. Fetch Owner Settings
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['owner-business-settings', selectedLotId],
    queryFn: () => getOwnerBusinessSettings(selectedLotId || undefined),
  });

  useLiveSync(() => {
    void refetch();
  });

  const facilities = data?.facilities || [];
  const selectedFacility = data?.selectedFacility;
  const businessProfile = data?.businessProfile;
  const platformGovernance = data?.platformGovernance;

  // Initialize selected lot
  useEffect(() => {
    if (!selectedLotId && facilities.length > 0) {
      setSelectedLotId(facilities[0]._id);
    }
  }, [facilities, selectedLotId]);

  // Sync Form State when selectedFacility changes
  useEffect(() => {
    if (selectedFacility) {
      setContactNumber(selectedFacility.contactNumber || '');
      setSupportEmail(selectedFacility.supportEmail || '');
      setIsOpen24Hours(Boolean(selectedFacility.isOpen24Hours));
      setOpeningTime(selectedFacility.openingTime || '08:00');
      setClosingTime(selectedFacility.closingTime || '22:00');
      setOperatingDays(selectedFacility.operatingDays?.length ? selectedFacility.operatingDays : DAYS_OF_WEEK);
      setGracePeriodMinutes(selectedFacility.gracePeriodMinutes ?? 15);
      setExitGracePeriodMinutes(selectedFacility.exitGracePeriodMinutes ?? 15);
      setMaxBookingDurationHours(selectedFacility.maxBookingDurationHours ?? 24);
      setAllowOnlineBookings(selectedFacility.allowOnlineBookings !== false);
      setAllowWalkInBookings(selectedFacility.allowWalkInBookings !== false);
      setOverstayGracePeriodMinutes(selectedFacility.overstayGracePeriodMinutes ?? 15);
      setOverstayChargeMultiplier(selectedFacility.overstayChargeMultiplier ?? 1.5);
      setHourlyRate(selectedFacility.hourlyRate ?? 0);
    }
  }, [selectedFacility]);

  // 2. Mutation for Saving Settings
  const updateMutation = useMutation({
    mutationFn: (payload: UpdateOwnerBusinessSettingsInput) =>
      updateOwnerBusinessSettings(selectedLotId, payload),
    onSuccess: (updatedFacility) => {
      toast.success(`Operational settings for "${updatedFacility.parkingName}" saved successfully.`);
      void queryClient.invalidateQueries({ queryKey: ['owner-business-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['owner-analytics-dashboard'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update settings.';
      toast.error(msg);
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotId) {
      toast.error('Please select a parking facility.');
      return;
    }

    if (!contactNumber.trim()) {
      toast.error('Support contact number is required.');
      return;
    }

    if (!operatingDays.length) {
      toast.error('At least one operating day must be selected.');
      return;
    }

    const payload: UpdateOwnerBusinessSettingsInput = {
      contactNumber: contactNumber.trim(),
      supportEmail: supportEmail.trim() || null,
      isOpen24Hours,
      openingTime: isOpen24Hours ? '00:00' : openingTime,
      closingTime: isOpen24Hours ? '23:59' : closingTime,
      operatingDays,
      gracePeriodMinutes: Number(gracePeriodMinutes),
      exitGracePeriodMinutes: Number(exitGracePeriodMinutes),
      maxBookingDurationHours: Number(maxBookingDurationHours),
      allowOnlineBookings,
      allowWalkInBookings,
      overstayGracePeriodMinutes: Number(overstayGracePeriodMinutes),
      overstayChargeMultiplier: Number(overstayChargeMultiplier),
      hourlyRate: Number(hourlyRate),
    };

    updateMutation.mutate(payload);
  };

  const toggleOperatingDay = (day: string) => {
    if (operatingDays.includes(day)) {
      if (operatingDays.length === 1) {
        toast.error('At least one operating day must remain active.');
        return;
      }
      setOperatingDays(operatingDays.filter((d) => d !== day));
    } else {
      setOperatingDays([...operatingDays, day]);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold text-xs">
              Facility Governance
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs font-bold">
              OWNER-05
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="h-7 w-7 text-primary" />
            Business &amp; Facility Settings
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Configure permitted business profile, operational schedules, booking parameters, and overstay rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleSaveSettings}
            disabled={updateMutation.isPending || isLoading || facilities.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 h-9 shadow-xs"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Settings...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {isError && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="flex items-center justify-between py-3 px-4 text-rose-600 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{(error as any)?.response?.data?.message || (error as any)?.message || 'Failed to load business settings.'}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 2. FACILITY SWITCHER CARD */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <label className="text-[11px] font-extrabold uppercase text-muted-foreground tracking-wider block">
                Selected Facility to Configure
              </label>
              <div className="mt-1">
                {isLoading ? (
                  <Skeleton className="h-9 w-64 rounded-lg" />
                ) : facilities.length === 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 rounded-lg mt-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>No approved or active parking facilities found for this account.</span>
                    </div>
                    <Link
                      to="/owner/parking/submissions"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-bold text-xs sm:ml-auto"
                    >
                      <span>Submit / View Surveys</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 py-1 text-xs font-bold text-foreground shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[280px]"
                  >
                    {facilities.map((fac) => (
                      <option key={fac._id} value={fac._id}>
                        {fac.parkingName} — {fac.city}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {selectedFacility && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs border-border">
                {selectedFacility.city}, {selectedFacility.state}
              </Badge>
              <Badge
                className={cn(
                  'text-xs font-bold text-white',
                  selectedFacility.parkingStatus === 'Active' ? 'bg-emerald-600' : 'bg-amber-600',
                )}
              >
                {selectedFacility.parkingStatus}
              </Badge>
              {selectedFacility.isVerified && (
                <Badge className="bg-blue-600 text-white text-xs font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 3. SETTINGS FORM GRID */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION A: Business Profile */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
            <CardHeader className="p-5 border-b border-border/70">
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Facility &amp; Business Profile
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Public business contact info displayed to customers on booking receipts and confirmations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Facility Name</label>
                <Input
                  value={selectedFacility?.parkingName || ''}
                  disabled
                  className="bg-muted font-medium text-xs text-muted-foreground"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Official name approved by Platform Governance. Contact admin to request name change.
                </span>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Physical Address</label>
                <Input
                  value={selectedFacility?.address || ''}
                  disabled
                  className="bg-muted font-medium text-xs text-muted-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Support Contact Phone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+919876543210"
                      className="pl-8 text-xs font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Support Email</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="support@parking.com"
                      className="pl-8 text-xs font-semibold"
                      type="email"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[10px] block font-bold uppercase">Time Zone</span>
                  <span className="font-mono font-bold text-foreground text-xs">
                    {selectedFacility?.timezone || businessProfile?.timezone || 'Asia/Kolkata'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[10px] block font-bold uppercase">Billing Currency</span>
                  <span className="font-mono font-bold text-primary text-xs">
                    {selectedFacility?.currency || 'INR (₹)'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION B: Operating Hours */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
            <CardHeader className="p-5 border-b border-border/70">
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Operating Hours &amp; Schedule
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Control customer access windows and gate operational availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* 24/7 Toggle */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground block">Open 24 Hours / 7 Days</span>
                  <span className="text-[11px] text-muted-foreground">
                    Facility accepts entry and bookings continuously around the clock.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen24Hours(!isOpen24Hours)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative cursor-pointer',
                    isOpen24Hours ? 'bg-primary' : 'bg-muted border border-border',
                  )}
                >
                  <span
                    className={cn(
                      'block w-5 h-5 rounded-full bg-white shadow-xs transition-transform absolute top-0.5',
                      isOpen24Hours ? 'left-6.5' : 'left-0.5',
                    )}
                  />
                </button>
              </div>

              {/* Time pickers when not 24/7 */}
              {!isOpen24Hours && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in-50 duration-200">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Opening Time (24h)</label>
                    <Input
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Closing Time (24h)</label>
                    <Input
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Operating Days */}
              <div>
                <label className="font-bold text-foreground block mb-1.5">
                  Operating Days of the Week
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = operatingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleOperatingDay(day)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                            : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Base Pricing Note */}
              <div className="pt-2">
                <label className="font-bold text-foreground block mb-1">Hourly Base Rate (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                    className="pl-7 text-xs font-semibold"
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Base rate per hour applied to standard vehicle reservations.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SECTION C: Booking Configuration */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
            <CardHeader className="p-5 border-b border-border/70">
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Booking &amp; Reservation Parameters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Set customer reservation lead times, grace periods, and channel availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Booking Grace Period (Minutes)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={gracePeriodMinutes}
                    onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                    className="text-xs font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Customer can arrive within this window without slot release.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Exit Grace Period (Minutes)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={exitGracePeriodMinutes}
                    onChange={(e) => setExitGracePeriodMinutes(Number(e.target.value))}
                    className="text-xs font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Time permitted after checkout to reach exit barrier.
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">
                  Maximum Booking Duration (Hours)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={maxBookingDurationHours}
                  onChange={(e) => setMaxBookingDurationHours(Number(e.target.value))}
                  className="text-xs font-semibold"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Upper limit for a single reservation session (max 168 hours = 7 days).
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Online bookings toggle */}
                <div className="p-3 rounded-lg border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">Online Bookings</span>
                    <span className="text-[10px] text-muted-foreground">App &amp; website users</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowOnlineBookings}
                    onChange={(e) => setAllowOnlineBookings(e.target.checked)}
                    className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                  />
                </div>

                {/* Walk-in bookings toggle */}
                <div className="p-3 rounded-lg border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground block">Walk-In Bookings</span>
                    <span className="text-[10px] text-muted-foreground">Security gate drive-ins</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowWalkInBookings}
                    onChange={(e) => setAllowWalkInBookings(e.target.checked)}
                    className="w-4 h-4 accent-orange-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SECTION D: Overstay Configuration */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
            <CardHeader className="p-5 border-b border-border/70">
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Overstay &amp; Penalty Controls
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Automated penalty billing when a vehicle exceeds its booked checkout time.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Overstay Grace Period (Minutes)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={overstayGracePeriodMinutes}
                    onChange={(e) => setOverstayGracePeriodMinutes(Number(e.target.value))}
                    className="text-xs font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    No penalty is charged if customer exits within this window.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">
                    Overstay Charge Multiplier
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min={1}
                    max={5}
                    value={overstayChargeMultiplier}
                    onChange={(e) => setOverstayChargeMultiplier(Number(e.target.value))}
                    className="text-xs font-semibold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Multiplier applied to standard hourly rate (e.g. 1.5x = 150%).
                  </span>
                </div>
              </div>

              {/* Live Overstay Example Box */}
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/25 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Live Billing Example
                </div>
                <p className="text-[11px] text-foreground/80 leading-relaxed font-medium">
                  At base rate of <strong>₹{hourlyRate}/hr</strong> with a <strong>{overstayChargeMultiplier}x</strong> multiplier,
                  vehicles overstaying beyond {overstayGracePeriodMinutes} mins are billed at{' '}
                  <strong className="text-primary font-mono">₹{Math.round(hourlyRate * overstayChargeMultiplier)}/hr</strong> upon exit barcode verification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION E: Platform Governance & Cancellation Rules (Read-Only) */}
        <Card className="rounded-xl border border-border/80 bg-card shadow-2xs">
          <CardHeader className="p-5 border-b border-border/70 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Platform-Governed Policies (Non-Overridable)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Platform-wide consumer protection and compliance standards enforced by Platform Administration.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-border text-muted-foreground text-xs font-mono">
              Admin Governance
            </Badge>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Cancellation &amp; Refund</span>
              <p className="font-semibold text-foreground text-[11px] leading-normal">
                {platformGovernance?.refundPolicyDescription || 'Standard ParkEase cancellation policy applies.'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">No-Show Penalty Rule</span>
              <p className="font-semibold text-foreground text-[11px] leading-normal">
                If customer fails to check in after {platformGovernance?.noShowThresholdPercentage || 50}% of booking window,
                eligible refund is capped at {platformGovernance?.noShowRefundPercentage || 40}%.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Platform Fee &amp; Tax</span>
              {isLoading ? (
                <Skeleton className="h-4 w-36 mt-1" />
              ) : (
                <p className="font-semibold text-foreground text-[11px] leading-normal">
                  GST Tax: {platformGovernance?.taxRatePercentage ?? 18}% &bull; Platform Booking Fee: ₹{platformGovernance?.platformBookingFee ?? 0}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={updateMutation.isPending || isLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 h-10 px-6 shadow-sm"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Facility Operational Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OwnerSettingsPage;
