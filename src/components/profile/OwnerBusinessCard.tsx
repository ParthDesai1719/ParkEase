import React, { useState } from 'react';
import { Building2, MapPin, Mail, Phone, Edit3, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { profileApi } from '@/api/profile.api';
import type { OwnerBusinessDetails } from '@/types/profile';

interface OwnerBusinessCardProps {
  business: OwnerBusinessDetails | null | undefined;
  onBusinessUpdated?: () => void;
}

export const OwnerBusinessCard: React.FC<OwnerBusinessCardProps> = ({
  business,
  onBusinessUpdated,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [businessName, setBusinessName] = useState(business?.businessName || '');
  const [businessAddress, setBusinessAddress] = useState(business?.businessAddress || '');
  const [city, setCity] = useState(business?.city || '');
  const [stateVal, setStateVal] = useState(business?.state || '');
  const [postalCode, setPostalCode] = useState(business?.postalCode || '');
  const [businessEmail, setBusinessEmail] = useState(business?.businessEmail || '');
  const [businessPhone, setBusinessPhone] = useState(business?.businessPhone || '');
  const [businessDescription, setBusinessDescription] = useState(
    business?.businessDescription || '',
  );

  const handleOpenEdit = () => {
    if (business) {
      setBusinessName(business.businessName);
      setBusinessAddress(business.businessAddress);
      setCity(business.city);
      setStateVal(business.state);
      setPostalCode(business.postalCode);
      setBusinessEmail(business.businessEmail);
      setBusinessPhone(business.businessPhone);
      setBusinessDescription(business.businessDescription);
    }
    setEditOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !businessAddress.trim() || !city.trim() || !stateVal.trim()) {
      toast.error('Please fill in all required business address fields.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await profileApi.updatePersonalInfo({
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        city: city.trim(),
        state: stateVal.trim(),
        postalCode: postalCode.trim(),
        businessEmail: businessEmail.trim(),
        businessPhone: businessPhone.trim(),
        businessDescription: businessDescription.trim(),
      });

      if (res.success) {
        toast.success('Business profile updated successfully.');
        setEditOpen(false);
        onBusinessUpdated?.();
      } else {
        toast.error(res.message || 'Failed to update business details.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to update business profile.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!business) {
    return (
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Business Organization
          </CardTitle>
          <CardDescription className="text-xs">
            No registered parking enterprise application on record.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold">Business Profile</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
              >
                <ShieldCheck className="mr-1 h-3 w-3" />
                {business.applicationStatus}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenEdit}
                className="text-xs h-7 gap-1 border-border/80"
              >
                <Edit3 className="h-3 w-3" />
                Edit Details
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            Authoritative parking business and enterprise registration details.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 p-5 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Enterprise Name
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">{business.businessName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{business.businessType}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Registered Application Ref
              </p>
              <p className="mt-1 font-mono text-xs font-bold text-primary">
                {business.applicationReference || 'APP-OFFICIAL'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Staging Capacity: {business.parkingCapacity} Bays
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                Operational Headquarters
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {business.businessAddress}, {business.city}, {business.state} - {business.postalCode}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Mail className="h-3 w-3 text-primary" />
                Support / Business Email
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">{business.businessEmail}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Phone className="h-3 w-3 text-primary" />
                Support / Business Phone
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                {business.businessPhone}
              </p>
            </div>

            {business.businessDescription && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {business.businessDescription}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Edit Business Profile
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update permitted commercial entity and contact information.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="biz-name" className="text-xs font-semibold">
                Business / Enterprise Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="biz-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="biz-addr" className="text-xs font-semibold">
                Business Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="biz-addr"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="biz-city" className="text-xs font-semibold">
                  City
                </Label>
                <Input
                  id="biz-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-state" className="text-xs font-semibold">
                  State
                </Label>
                <Input
                  id="biz-state"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-pin" className="text-xs font-semibold">
                  PIN Code
                </Label>
                <Input
                  id="biz-pin"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  maxLength={6}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="biz-email" className="text-xs font-semibold">
                  Business Email
                </Label>
                <Input
                  id="biz-email"
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-phone" className="text-xs font-semibold">
                  Business Phone
                </Label>
                <Input
                  id="biz-phone"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="biz-desc" className="text-xs font-semibold">
                Business Description
              </Label>
              <textarea
                id="biz-desc"
                rows={3}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(false)}
                disabled={isLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isLoading} className="text-xs gap-1.5">
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Business Details'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

