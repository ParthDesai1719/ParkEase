import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Search,
  PlusCircle,
  Eye,
  Edit3,
  CheckCircle2,
  MapPin,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getOwnerParkingLots,
  activateFacility,
  type OfficialParkingLot,
} from '@/api/parkingLot.api';
import { useLiveSync } from '@/hooks/useLiveSync';

const formatAddress = (addr: OfficialParkingLot['address']): string => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.street, addr.city, addr.state].filter(Boolean).join(', ');
};

export const OwnerParkingLotsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [parkingLots, setParkingLots] = useState<OfficialParkingLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');

  // Debounce search query for live asynchronous searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Go-Live Activation State
  const [activatingLot, setActivatingLot] = useState<OfficialParkingLot | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const fetchLots = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      const res = await getOwnerParkingLots({
        search: debouncedSearchQuery.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        limit: 50,
      });

      if (res.success && res.data?.parkingLots) {
        setParkingLots(res.data.parkingLots);
      }
      if (isManual) {
        toast.success('Parking lots list refreshed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load parking lots';
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearchQuery, statusFilter]);

  useEffect(() => {
    void fetchLots();
  }, [fetchLots]);

  useLiveSync(() => {
    void fetchLots(true);
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchLots();
  };

  const handleActivateGoLive = async () => {
    if (!activatingLot) return;
    setIsActivating(true);
    try {
      const res = await activateFacility(activatingLot._id);
      if (res.success) {
        toast.success(`Facility "${activatingLot.parkingName}" is now LIVE! Discoverable by public customers.`);
        setActivatingLot(null);
        void fetchLots();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to activate facility';
      toast.error(msg);
    } finally {
      setIsActivating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-xs">Live & Active</Badge>;
      case 'Inactive':
        return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/30 text-xs">Inactive</Badge>;
      case 'Under Maintenance':
        return <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-xs">Under Maintenance</Badge>;
      case 'Temporarily Closed':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 text-xs">Temporarily Closed</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const getLayoutStatusBadge = (layoutStatus?: string) => {
    switch (layoutStatus) {
      case 'Pending Owner Review':
        return (
          <Badge className="bg-sky-600/10 text-sky-600 border-sky-600/30 text-[11px] gap-1">
            <Eye className="h-3 w-3" /> Layout Pending Review
          </Badge>
        );
      case 'Owner Changes Requested':
        return (
          <Badge className="bg-amber-600/10 text-amber-600 border-amber-600/30 text-[11px] gap-1">
            <ShieldAlert className="h-3 w-3" /> Revisions Requested
          </Badge>
        );
      case 'Owner Confirmed':
        return (
          <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 text-[11px] gap-1">
            <CheckCircle2 className="h-3 w-3" /> Layout Confirmed
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-[11px]">{layoutStatus || 'Draft Plan'}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              Parking Facilities
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {parkingLots.length} Official {parkingLots.length === 1 ? 'Lot' : 'Lots'}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            My Parking Lots
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            View official facility structures, inspect published 2D layouts, and manage operational settings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button asChild size="sm" className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
            <Link to="/owner/parking/submissions/new">
              <PlusCircle className="h-3.5 w-3.5" />
              New Facility
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border/70 rounded-xl p-3 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by facility name, address, or city..."
            className="pl-9 h-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[180px]">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Active">Active / Live</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                <SelectItem value="Temporarily Closed">Temporarily Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 3. PARKING LOTS GRID */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-muted-foreground">
          Loading official parking lots...
        </div>
      ) : parkingLots.length === 0 ? (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary mb-3">
              <Building2 className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-base text-foreground">No Official Parking Lots Found</h3>
            <p className="text-xs text-muted-foreground max-w-md mt-1 mb-5">
              Official parking lots appear here once your submitted facility requests are reviewed, designed, and approved by the platform administration.
            </p>
            <Button asChild size="sm" className="gap-1.5 text-xs font-semibold">
              <Link to="/owner/parking/submissions/new">
                <PlusCircle className="h-3.5 w-3.5" /> Submit Facility Request
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {parkingLots.map((lot) => {
            const isConfirmedNotLive =
              lot.layoutReviewStatus === 'Owner Confirmed' && lot.parkingStatus !== 'Active';

            return (
              <Card
                key={lot._id}
                className="overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header Banner */}
                  <div className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getStatusBadge(lot.parkingStatus)}
                        {getLayoutStatusBadge(lot.layoutReviewStatus)}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-primary">₹{lot.hourlyRate}</span>
                        <span className="text-[10px] text-muted-foreground">/hr</span>
                      </div>
                    </div>

                    <h2 className="font-bold text-base text-foreground tracking-tight line-clamp-1">
                      {lot.parkingName}
                    </h2>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 line-clamp-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {formatAddress(lot.address)}, {lot.city}
                    </p>
                  </div>

                  {/* Card Body Metrics */}
                  <div className="p-5 space-y-4">
                    {/* Capacity Summary */}
                    <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-lg text-center">
                      <div>
                        <div className="text-sm font-bold text-foreground">{lot.totalSlots}</div>
                        <div className="text-[10px] text-muted-foreground">Total Bays</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {lot.availableSlots}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Available</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {lot.occupancyPercentage ?? 0}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Occupancy</div>
                      </div>
                    </div>

                    {/* Operational Details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Floors:</span>
                        <span className="font-medium text-foreground">{lot.totalFloors} {lot.totalFloors === 1 ? 'Floor' : 'Floors'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Hours:</span>
                        <span className="font-medium text-foreground">
                          {lot.isOpen24Hours ? 'Open 24 Hours' : `${lot.openingTime || '00:00'} - ${lot.closingTime || '23:59'}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Grace Period:</span>
                        <span className="font-medium text-foreground">{lot.gracePeriodMinutes ?? 15} mins</span>
                      </div>
                    </div>

                    {/* Amenities Badges */}
                    {lot.amenities && lot.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {lot.amenities.slice(0, 3).map((amenity) => (
                          <span
                            key={amenity}
                            className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                          >
                            {amenity}
                          </span>
                        ))}
                        {lot.amenities.length > 3 && (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{lot.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-3 border-t border-border/60 bg-muted/10 space-y-2">
                  {/* GO LIVE BANNER BUTTON IF READY */}
                  {isConfirmedNotLive && (
                    <Button
                      onClick={() => setActivatingLot(lot)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5 shadow-xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Go-Live Activation
                    </Button>
                  )}

                  <div className="flex items-center gap-2">
                    <Button asChild variant="default" size="sm" className="flex-1 text-xs h-8">
                      <Link to={`/owner/parking-lots/${lot._id}`}>
                        <Building2 className="h-3 w-3 mr-1" /> Details & Structure
                      </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className="text-xs h-8">
                      <Link to={`/owner/parking-lots/${lot._id}/layout`}>
                        <Eye className="h-3 w-3 mr-1" /> Layout
                      </Link>
                    </Button>

                    <Button asChild variant="outline" size="sm" className="text-xs h-8 px-2.5" title="Edit Permitted Business Info">
                      <Link to={`/owner/parking-lots/${lot._id}?tab=edit`}>
                        <Edit3 className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* GO-LIVE ACTIVATION MODAL */}
      <Dialog open={!!activatingLot} onOpenChange={(open) => !open && setActivatingLot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Activate Facility Go-Live
            </DialogTitle>
            <DialogDescription>
              Activating <strong>&quot;{activatingLot?.parkingName}&quot;</strong> will publish the facility to public customer search and allow drivers to book reserved parking slots immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Slots:</span>
              <span className="font-semibold text-foreground">{activatingLot?.totalSlots} bays</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rate:</span>
              <span className="font-semibold text-foreground">₹{activatingLot?.hourlyRate} / hour</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Review Status:</span>
              <span className="font-semibold text-emerald-600">Layout Confirmed by Owner</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setActivatingLot(null)} disabled={isActivating}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleActivateGoLive}
              disabled={isActivating}
            >
              {isActivating ? 'Activating...' : 'Confirm & Go-Live'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
