import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Car,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import {
  addCustomerRegisteredVehicle,
  getCustomerRegisteredVehicles,
  type BookingVehicleType,
} from '@/api/customerParking.api';
import { profileApi } from '@/api/profile.api';
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload';
import { ProfilePersonalForm } from '@/components/profile/ProfilePersonalForm';
import { ProfileContactCard } from '@/components/profile/ProfileContactCard';

export const CustomerProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<BookingVehicleType>('Car');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // Fetch complete profile details
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['customer-vehicles'],
    queryFn: getCustomerRegisteredVehicles,
  });

  const addVehicleMutation = useMutation({
    mutationFn: addCustomerRegisteredVehicle,
    onSuccess: () => {
      toast.success('Vehicle registered to your profile.');
      setVehicleNumber('');
      setVehicleBrand('');
      setVehicleModel('');
      setVehicleColor('');
      void queryClient.invalidateQueries({ queryKey: ['customer-vehicles'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-dashboard-overview'] });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message || 'Failed to register vehicle.');
    },
  });

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = vehicleNumber.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!cleaned) {
      toast.error('Please enter a valid vehicle registration number.');
      return;
    }
    if (!vehicleBrand.trim() || !vehicleModel.trim()) {
      toast.error('Please enter both vehicle brand and model.');
      return;
    }
    addVehicleMutation.mutate({
      vehicleNumber: cleaned,
      vehicleType,
      vehicleBrand: vehicleBrand.trim(),
      vehicleModel: vehicleModel.trim(),
      vehicleColor: vehicleColor.trim() || undefined,
    });
  };

  const profileUser = profileQuery.data?.data?.user;
  const activeUser = user ? { ...(profileUser || {}), ...user } : profileUser;

  if (!activeUser && profileQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!activeUser) return null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs font-semibold">
            Customer Profile
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold"
          >
            <ShieldCheck className="mr-1 h-3 w-3" />
            Active Account
          </Badge>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Account Settings & Vehicles
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Manage your personal information, verified contact channels, and registered vehicles for rapid parking bookings.
        </p>
      </div>

      {/* Avatar & Identity Banner */}
      <Card className="border-border/70 shadow-xs">
        <CardContent className="p-6">
          <ProfileAvatarUpload user={activeUser} onAvatarUpdated={(url) => updateUser({ ...activeUser, profileImage: url })} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Details Form */}
        <ProfilePersonalForm user={activeUser} onSuccess={(u) => updateUser(u)} />

        {/* Contact Information & OTP Verification */}
        <ProfileContactCard user={activeUser} onUserUpdated={(u) => updateUser(u)} />
      </div>

      {/* Registered Vehicles Section */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-bold">Registered Vehicles</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              {vehiclesQuery.data?.length || 0} Registered
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Saved vehicles auto-populate during reservation for one-click checkout.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-5">
          {/* Add Vehicle Form */}
          <form
            onSubmit={handleAddVehicle}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
          >
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-3">
              <Plus className="h-3.5 w-3.5 text-primary" />
              Register New Vehicle
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Plate Number *
                </label>
                <Input
                  placeholder="MH01AB1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as BookingVehicleType)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Car">Car</option>
                  <option value="Bike">Bike</option>
                  <option value="SUV">SUV</option>
                  <option value="EV">Electric Vehicle (EV)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Brand / Make *
                </label>
                <Input
                  placeholder="e.g. Hyundai, Honda"
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Model *
                </label>
                <Input
                  placeholder="e.g. Creta, City"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Color (Optional)
                </label>
                <Input
                  placeholder="e.g. Silver, White"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addVehicleMutation.isPending}
                className="gap-1 text-xs h-8"
              >
                <Plus className="h-3 w-3" />
                {addVehicleMutation.isPending ? 'Registering...' : 'Add Vehicle'}
              </Button>
            </div>
          </form>

          {/* Vehicle List */}
          {vehiclesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !vehiclesQuery.data || vehiclesQuery.data.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
              No vehicles registered yet. Add your primary car or bike above for faster checkouts.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vehiclesQuery.data.map((veh) => (
                <div
                  key={veh._id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-all hover:border-primary/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Car className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold tracking-wider text-foreground">
                        {veh.vehicleNumber}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {veh.vehicleBrand} {veh.vehicleModel}
                        {veh.vehicleColor ? ` • ${veh.vehicleColor}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {veh.vehicleType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
