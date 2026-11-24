import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  RotateCcw,
  Sliders,
  CalendarClock,
  UserCheck,
  Coins,
  AlertTriangle,
  Sparkles,
  Info,
  Clock,
  ShieldAlert,
  Building,
  RefreshCw,
  IndianRupee,
  Upload,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { settingsApi, getLogoUrl, type SystemSettingsData } from '@/api/settings.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export const PlatformSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settingsData, isLoading, error } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: settingsApi.getSettings,
  });

  const [formData, setFormData] = useState<SystemSettingsData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [previewBaseAmount, setPreviewBaseAmount] = useState<number>(100);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
    }
  }, [settingsData]);

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo image size must be less than 5MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Only PNG, JPG, WebP, and SVG images are permitted.');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const res = await settingsApi.uploadLogo(file);
      handleChange('platformLogoUrl', res.logoUrl);
      queryClient.setQueryData(['adminSettings'], res.settings);
      toast.success('Platform logo uploaded and updated successfully.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload logo image.';
      toast.error(msg);
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    handleChange('platformLogoUrl', '');
    toast.info('Logo removed. Save changes to persist.');
  };

  const updateMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['adminSettings'], updated);
      setFormData(updated);
      toast.success('Platform settings updated successfully.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update platform settings.';
      toast.error(msg);
    },
  });

  if (isLoading || !formData) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground">Failed to Load Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {(error as any)?.message || 'An error occurred while fetching system configuration.'}
        </p>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['adminSettings'] })}
          className="mt-4"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const handleChange = <K extends keyof SystemSettingsData>(key: K, value: SystemSettingsData[K]) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleReset = () => {
    if (settingsData) {
      setFormData(settingsData);
      toast.info('Form reset to server settings.');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData) return;

    // Client-side validations
    if (formData.platformBookingFee < 0) {
      toast.error('Platform booking fee cannot be negative.');
      return;
    }
    if (formData.maximumBookingDurationHours < formData.minimumBookingDurationHours) {
      toast.error('Maximum booking duration cannot be less than minimum booking duration.');
      return;
    }
    if (formData.bookingGracePeriodMinutes < 0) {
      toast.error('Grace period cannot be negative.');
      return;
    }

    updateMutation.mutate(formData);
  };

  const isSaving = updateMutation.isPending;
  const isDirty = JSON.stringify(formData) !== JSON.stringify(settingsData);
  const currentLogo = getLogoUrl(formData.platformLogoUrl);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 animate-in fade-in-50 duration-300">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs font-semibold">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Platform Configuration
            </Badge>
            {formData.maintenanceMode && (
              <Badge className="bg-amber-500 text-white text-xs font-bold animate-pulse">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Maintenance Mode Active
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Platform Settings &amp; Governance
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            Configure system rules, booking constraints, owner onboarding requirements, and platform booking fees.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || isSaving}
            className="text-xs h-9 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={!isDirty || isSaving}
            className="text-xs h-9 gap-1.5 bg-primary text-primary-foreground font-bold shadow-sm"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Maintenance Mode Alert Banner if Active */}
      {formData.maintenanceMode && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Maintenance Mode is currently enabled.</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer registrations and public booking traffic are suspended. Only verified administrators can access platform governance.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="general" className="gap-2 text-xs py-2">
            <Sliders className="h-3.5 w-3.5" />
            General
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2 text-xs py-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Booking Rules
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2 text-xs py-2">
            <UserCheck className="h-3.5 w-3.5" />
            Owner Onboarding
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2 text-xs py-2">
            <Coins className="h-3.5 w-3.5" />
            Financial &amp; Fee
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2 text-xs py-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            Maintenance
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: GENERAL
        ========================================================================= */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/80">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                General Platform Identity &amp; Region
              </CardTitle>
              <CardDescription className="text-xs">
                Branding, application identity, standard timezone, and platform currency.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="applicationName" className="text-xs font-semibold">
                    Platform / Application Name
                  </Label>
                  <Input
                    id="applicationName"
                    value={formData.applicationName || ''}
                    onChange={(e) => handleChange('applicationName', e.target.value)}
                    placeholder="e.g. ParkEase"
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Public platform title displayed across navigation headers and receipts.
                  </p>
                </div>

                {/* Image Picker for Platform Logo */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-semibold text-foreground">
                    Platform Branding Logo
                  </Label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-border/80 bg-muted/10">
                    {/* Visual Preview Box */}
                    <div
                      onClick={() => !isUploadingLogo && fileInputRef.current?.click()}
                      className="relative group w-20 h-20 rounded-xl border-2 border-dashed border-border/90 hover:border-primary/50 cursor-pointer flex items-center justify-center bg-background overflow-hidden shrink-0 shadow-xs transition-colors"
                      title="Click to choose a logo file"
                    >
                      {currentLogo ? (
                        <img
                          src={currentLogo}
                          alt="Platform Logo Preview"
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
                          <ImageIcon className="h-6 w-6 mb-1 text-muted-foreground/60" />
                          <span className="text-[9px] font-semibold">No Logo</span>
                        </div>
                      )}

                      {isUploadingLogo && (
                        <div className="absolute inset-0 bg-background/85 backdrop-blur-xs flex items-center justify-center">
                          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Action Buttons & Guidance */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoFileSelect}
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          id="platform-logo-picker"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="text-xs h-8 gap-1.5"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {formData.platformLogoUrl ? 'Change Logo Image' : 'Choose Logo Image'}
                        </Button>

                        {formData.platformLogoUrl && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleRemoveLogo}
                            disabled={isUploadingLogo}
                            className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        PNG, JPG, WebP, or SVG format (maximum 5MB). The selected logo is stored in platform branding assets and rendered across platform navigation headers and reports.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timezone" className="text-xs font-semibold">
                    Default Platform Timezone
                  </Label>
                  <select
                    id="timezone"
                    value={formData.timezone || 'Asia/Kolkata'}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="UTC">UTC (Universal Time)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Timezone used for schedule boundaries, timestamps, and reports.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="defaultCurrency" className="text-xs font-semibold">
                    Default Currency Code
                  </Label>
                  <Input
                    id="defaultCurrency"
                    value={formData.defaultCurrency || 'INR'}
                    onChange={(e) => handleChange('defaultCurrency', e.target.value.toUpperCase())}
                    placeholder="INR"
                    className="h-9 text-xs uppercase"
                    maxLength={5}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Standard ISO currency code for payments, invoices, and deposits (e.g. INR).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 2: BOOKING RULES
        ========================================================================= */}
        <TabsContent value="booking" className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/80">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                Booking Policies &amp; Duration Constraints
              </CardTitle>
              <CardDescription className="text-xs">
                Enforce operational window constraints, arrival grace periods, and booking channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="bookingGracePeriodMinutes" className="text-xs font-semibold">
                    Arrival Grace Period (Minutes)
                  </Label>
                  <Input
                    id="bookingGracePeriodMinutes"
                    type="number"
                    min={0}
                    value={formData.bookingGracePeriodMinutes ?? 15}
                    onChange={(e) => handleChange('bookingGracePeriodMinutes', Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tolerance window before an arrival is flagged as a No-Show.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="minimumBookingDurationHours" className="text-xs font-semibold">
                    Min Booking Duration (Hours)
                  </Label>
                  <Input
                    id="minimumBookingDurationHours"
                    type="number"
                    min={1}
                    value={formData.minimumBookingDurationHours ?? 1}
                    onChange={(e) => handleChange('minimumBookingDurationHours', Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Lowest permissible duration for an advance parking slot booking.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="maximumBookingDurationHours" className="text-xs font-semibold">
                    Max Booking Duration (Hours)
                  </Label>
                  <Input
                    id="maximumBookingDurationHours"
                    type="number"
                    min={1}
                    value={formData.maximumBookingDurationHours ?? 24}
                    onChange={(e) => handleChange('maximumBookingDurationHours', Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Upper limit for a single reservation (default 24 hours).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bookingAdvanceLimitDays" className="text-xs font-semibold">
                    Advance Window (Days)
                  </Label>
                  <Input
                    id="bookingAdvanceLimitDays"
                    type="number"
                    min={1}
                    value={formData.bookingAdvanceLimitDays ?? 30}
                    onChange={(e) => handleChange('bookingAdvanceLimitDays', Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    How far into the future customers can book slots.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowOnlineBookings" className="text-xs font-bold cursor-pointer">
                      Online Booking Channel
                    </Label>
                    <input
                      type="checkbox"
                      id="allowOnlineBookings"
                      checked={formData.allowOnlineBookings ?? true}
                      onChange={(e) => handleChange('allowOnlineBookings', e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Permits customer reservations via the online portal and customer dashboard.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowWalkInBookings" className="text-xs font-bold cursor-pointer">
                      Security Walk-in Channel
                    </Label>
                    <input
                      type="checkbox"
                      id="allowWalkInBookings"
                      checked={formData.allowWalkInBookings ?? true}
                      onChange={(e) => handleChange('allowWalkInBookings', e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Permits security staff to issue direct cash-first walk-in tickets at the barrier gate.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="allowBookingExtensions" className="text-xs font-bold cursor-pointer">
                      Booking Extensions
                    </Label>
                    <input
                      type="checkbox"
                      id="allowBookingExtensions"
                      checked={formData.allowBookingExtensions ?? true}
                      onChange={(e) => handleChange('allowBookingExtensions', e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Permits customers to extend active parking sessions prior to expiry.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 3: OWNER ONBOARDING
        ========================================================================= */}
        <TabsContent value="owners" className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/80">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Parking Owner Registration &amp; Onboarding
              </CardTitle>
              <CardDescription className="text-xs">
                Registration fees, SLA review targets, onboarding toggles, and refund commitments.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerRegistrationFee" className="text-xs font-semibold">
                    Owner Registration Fee (₹)
                  </Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ownerRegistrationFee"
                      type="number"
                      min={0}
                      value={formData.ownerRegistrationFee ?? 999}
                      onChange={(e) => handleChange('ownerRegistrationFee', Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="pl-9 h-9 text-xs font-mono font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Non-refundable administrative fee collected during parking owner registration (default ₹999).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ownerReviewSlaDays" className="text-xs font-semibold">
                    Owner Review SLA (Days)
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ownerReviewSlaDays"
                      type="number"
                      min={1}
                      value={formData.ownerReviewSlaDays ?? 3}
                      onChange={(e) => handleChange('ownerReviewSlaDays', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Target review SLA for admin approval of owner applications.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2 flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ownerRegistrationEnabled" className="text-xs font-bold cursor-pointer">
                      Registration Open
                    </Label>
                    <input
                      type="checkbox"
                      id="ownerRegistrationEnabled"
                      checked={formData.ownerRegistrationEnabled ?? true}
                      onChange={(e) => handleChange('ownerRegistrationEnabled', e.target.checked)}
                      className="h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    When disabled, prospective parking owners cannot submit new onboarding registrations.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/80">
                <Label htmlFor="refundPolicyDescription" className="text-xs font-semibold">
                  Platform Refund &amp; Cancellation Policy
                </Label>
                <Textarea
                  id="refundPolicyDescription"
                  rows={3}
                  value={formData.refundPolicyDescription || ''}
                  onChange={(e) => handleChange('refundPolicyDescription', e.target.value)}
                  placeholder="Describe platform refund policy for customers and owners..."
                  className="text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Text displayed on booking confirmation screens and terms of service.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 4: FINANCIAL & PLATFORM BOOKING FEE
        ========================================================================= */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Inputs (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/80">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-emerald-500" />
                    Platform Booking Fee &amp; Taxation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure the fixed fee applied to parking reservations and platform tax parameters.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Highlighted Fixed Platform Fee Section */}
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                          Platform Booking Fee (Fixed INR)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="platformBookingFee" className="text-xs font-semibold">
                        Fixed Fee Amount per Booking (₹)
                      </Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="platformBookingFee"
                          type="number"
                          min={0}
                          value={formData.platformBookingFee ?? 0}
                          onChange={(e) =>
                            handleChange('platformBookingFee', Math.max(0, parseInt(e.target.value, 10) || 0))
                          }
                          className="pl-9 h-10 text-sm font-mono font-bold"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Added as a separate line item to all new online bookings and walk-in tickets. Default ₹0.
                      </p>
                    </div>

                    <div className="rounded-lg bg-card/70 border border-border/80 p-3 text-[11px] text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Snapshot Guarantee:</span>
                      </div>
                      <p>
                        Existing confirmed bookings and historical receipts are permanently preserved. Changing this fee only affects new booking computations going forward.
                      </p>
                    </div>
                  </div>

                  {/* Tax Rate Percentage */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="taxRatePercentage" className="text-xs font-semibold">
                        Standard Tax Rate (%)
                      </Label>
                      <div className="relative">
                        <Input
                          id="taxRatePercentage"
                          type="number"
                          min={0}
                          max={100}
                          value={formData.taxRatePercentage ?? 18}
                          onChange={(e) =>
                            handleChange('taxRatePercentage', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))
                          }
                          className="h-9 text-xs font-mono"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Applicable GST / VAT rate displayed on financial summaries and invoices.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="paymentGateway" className="text-xs font-semibold">
                        Payment Gateway Driver
                      </Label>
                      <Input
                        id="paymentGateway"
                        value="RAZORPAY_TEST"
                        disabled
                        className="h-9 text-xs font-mono bg-muted/50 cursor-not-allowed"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Sandbox test mode active via Razorpay Gateway Integration.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Pricing Breakdown Simulator (1 col) */}
            <div className="space-y-4">
              <Card className="border-border/80 shadow-sm sticky top-6 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/80">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    Customer Pricing Preview
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Real-time preview of customer price breakdown with the configured Platform Fee.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sampleBase" className="text-xs font-semibold text-muted-foreground">
                      Sample Parking Base Fare (₹)
                    </Label>
                    <Input
                      id="sampleBase"
                      type="number"
                      min={0}
                      value={previewBaseAmount}
                      onChange={(e) => setPreviewBaseAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2.5 text-xs font-medium">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Base Parking Fare:</span>
                      <span className="font-mono text-foreground font-bold">₹{previewBaseAmount}</span>
                    </div>

                    <div className="flex items-center justify-between text-primary">
                      <span>Platform Booking Fee:</span>
                      <span className="font-mono font-bold">
                        {formData.platformBookingFee > 0 ? `+ ₹${formData.platformBookingFee}` : '₹0 (Free)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Additional Charges:</span>
                      <span className="font-mono text-foreground">₹0</span>
                    </div>

                    <div className="pt-2 border-t border-border/80 flex items-center justify-between text-sm font-bold text-foreground">
                      <span>Total Customer Payable:</span>
                      <span className="font-mono text-base text-emerald-600 dark:text-emerald-400 font-extrabold">
                        ₹{previewBaseAmount + (formData.platformBookingFee || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground leading-relaxed">
                    The platform booking fee is computed strictly on the backend and stored as an immutable snapshot on both the Booking and Payment records.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 5: MAINTENANCE & SYSTEM
        ========================================================================= */}
        <TabsContent value="maintenance" className="space-y-6">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/80">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Maintenance Mode &amp; System Safeguards
              </CardTitle>
              <CardDescription className="text-xs">
                Emergency platform lockouts, session lifetimes, and audit log data retention windows.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Maintenance Toggle */}
              <div
                className={`p-4 rounded-xl border transition-all ${formData.maintenanceMode
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-border/80 bg-muted/20'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${formData.maintenanceMode ? 'text-amber-500' : 'text-muted-foreground'}`}
                      />
                      <span>Platform Maintenance Mode</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Suspends public bookings, reservations, and customer checkouts immediately.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold font-mono">
                      {formData.maintenanceMode ? 'ACTIVE' : 'OFF'}
                    </span>
                    <input
                      type="checkbox"
                      checked={formData.maintenanceMode ?? false}
                      onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                      className="h-5 w-5 rounded border-amber-500 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* System Safeguards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionTimeoutMinutes" className="text-xs font-semibold">
                    Admin Session Timeout (Minutes)
                  </Label>
                  <Input
                    id="sessionTimeoutMinutes"
                    type="number"
                    min={5}
                    value={formData.sessionTimeoutMinutes ?? 60}
                    onChange={(e) => handleChange('sessionTimeoutMinutes', Math.max(5, parseInt(e.target.value, 10) || 5))}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Idle duration before an administrative session expires automatically.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="noShowThresholdPercentage" className="text-xs font-semibold">
                    No-Show Threshold (%)
                  </Label>
                  <Input
                    id="noShowThresholdPercentage"
                    type="number"
                    min={1}
                    max={100}
                    value={formData.noShowThresholdPercentage ?? 50}
                    onChange={(e) =>
                      handleChange('noShowThresholdPercentage', Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))
                    }
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Percentage of slot interval elapsed before automatic No-Show cancellation.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="noShowRefundPercentage" className="text-xs font-semibold">
                    No-Show Refund (%)
                  </Label>
                  <Input
                    id="noShowRefundPercentage"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.noShowRefundPercentage ?? 40}
                    onChange={(e) =>
                      handleChange('noShowRefundPercentage', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))
                    }
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Refund percentage granted on automatic no-show cancellations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
