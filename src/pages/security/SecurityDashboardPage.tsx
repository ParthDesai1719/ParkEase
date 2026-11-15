import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode,
  Search,
  Car,
  AlertTriangle,
  UserPlus,
  RefreshCw,
  Building2,
  LogIn,
  LogOut,
  Layers,
  Banknote,
  FileText,
  Activity,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/authStore';
import {
  securityApi,
  type SecurityAssignedFacility,
  type SecurityDashboardStatsData,
} from '@/api/security.api';
import { getSocket } from '@/lib/socket';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

export const SecurityDashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // States
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [stats, setStats] = useState<SecurityDashboardStatsData | null>(null);

  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [overstayModalOpen, setOverstayModalOpen] = useState<boolean>(false);

  // 1. Fetch Assigned Facilities on Mount
  const fetchFacilities = useCallback(async () => {
    try {
      setIsLoadingFacilities(true);
      const facs = await securityApi.getAssignedFacilities();
      setFacilities(facs);

      if (facs.length > 0) {
        const savedLotId = localStorage.getItem(LOCAL_STORAGE_KEY);
        const isValidSaved = savedLotId && facs.some((f) => f.parkingLotId === savedLotId);
        const initialLotId = isValidSaved ? savedLotId : facs[0].parkingLotId;

        setSelectedLotId(initialLotId);
        localStorage.setItem(LOCAL_STORAGE_KEY, initialLotId);
      } else {
        setSelectedLotId('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load assigned facilities.';
      toast.error(msg);
    } finally {
      setIsLoadingFacilities(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  // 2. Fetch Dashboard Statistics for Selected Facility
  const fetchStats = useCallback(
    async (lotId: string, isManual = false) => {
      if (!lotId) {
        setStats(null);
        setIsLoadingStats(false);
        return;
      }

      try {
        if (isManual) setIsRefreshing(true);
        else setIsLoadingStats(true);

        const data = await securityApi.getDashboardStats(lotId);
        setStats(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard statistics.';
        toast.error(msg);
      } finally {
        setIsLoadingStats(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedLotId) {
      fetchStats(selectedLotId);
    }
  }, [selectedLotId, fetchStats]);

  // 3. Facility Switch Handler
  const handleFacilityChange = (newLotId: string) => {
    setSelectedLotId(newLotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, newLotId);
  };

  // 4. Socket.IO Real-Time Telemetry Listener
  useEffect(() => {
    if (!selectedLotId) return;

    const socket = getSocket();

    // Join room for this parking lot
    socket.emit('join_lot', selectedLotId);

    const handleSlotUpdate = (data: { parkingLotId?: string }) => {
      if (!data.parkingLotId || data.parkingLotId === selectedLotId) {
        fetchStats(selectedLotId, true);
      }
    };

    const handleBookingUpdate = (data: { parkingLotId?: string }) => {
      if (!data.parkingLotId || data.parkingLotId === selectedLotId) {
        fetchStats(selectedLotId, true);
      }
    };

    socket.on('slot_status_changed', handleSlotUpdate);
    socket.on('booking_status_changed', handleBookingUpdate);

    return () => {
      socket.off('slot_status_changed', handleSlotUpdate);
      socket.off('booking_status_changed', handleBookingUpdate);
    };
  }, [selectedLotId, fetchStats]);

  const activeFacility = facilities.find((f) => f.parkingLotId === selectedLotId);

  // Helper for activity event badge
  const getActivityBadge = (eventCode: string) => {
    if (eventCode.includes('ENTER') || eventCode.includes('CHECK_IN')) {
      return (
        <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <LogIn className="w-4 h-4" />
        </span>
      );
    }
    if (eventCode.includes('EXIT') || eventCode.includes('CHECK_OUT') || eventCode.includes('COMPLETED')) {
      return (
        <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
          <LogOut className="w-4 h-4" />
        </span>
      );
    }
    if (eventCode.includes('OVERSTAY')) {
      return (
        <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <AlertTriangle className="w-4 h-4" />
        </span>
      );
    }
    if (eventCode.includes('WALK_IN')) {
      return (
        <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
          <UserPlus className="w-4 h-4" />
        </span>
      );
    }
    return (
      <span className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
        <Activity className="w-4 h-4" />
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. HEADER & ACTIVE FACILITY SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold">
              <ShieldCheck className="w-3 h-3 mr-1 inline" />
              Gate Operations Console
            </Badge>
            {activeFacility && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                Active Duty
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Gate Terminal — {user?.fullName || 'Security Officer'}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            {activeFacility
              ? `${activeFacility.parkingName} • ${activeFacility.address}, ${activeFacility.city}`
              : 'Monitor physical vehicle movements, verify digital QR passes, and process on-site driver operations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facility Selector */}
          <div className="w-60">
            {isLoadingFacilities ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : facilities.length > 0 ? (
              <Select value={selectedLotId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="w-full bg-card border-border/80 h-10 text-xs">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => (
                    <SelectItem key={fac.parkingLotId} value={fac.parkingLotId}>
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStats(selectedLotId, true)}
            disabled={!selectedLotId || isLoadingStats || isRefreshing}
            className="h-10 px-3 border-border/80"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {/* Primary Quick Action: Scan QR */}
          <Link to="/security/scan">
            <Button size="sm" className="h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              <span>Scan QR Pass</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* NO ACTIVE ASSIGNMENT STATE */}
      {!isLoadingFacilities && facilities.length === 0 && (
        <Card className="border-border/80 bg-card/60 backdrop-blur p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">No Active Facility Assignments</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your security staff account currently has no active parking lot assignments. Please contact your parking facility owner or platform administrator to assign you to an active gate post.
            </p>
          </div>
          <Link to="/security/profile">
            <Button variant="outline" size="sm" className="text-xs">
              View Staff Profile &amp; Post Status
            </Button>
          </Link>
        </Card>
      )}

      {/* 2. STATS OVERVIEW CARDS (7 REAL METRICS) */}
      {selectedLotId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
          {/* 1. Vehicles Currently Inside */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Inside Bays</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Car className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.vehiclesCurrentlyInside ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Active inside bays</p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Entries Today */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Entries Today</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <LogIn className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-emerald-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.entriesToday ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Gate check-ins</p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Exits Today */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Exits Today</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-blue-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.exitsToday ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Gate check-outs</p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Available Slots */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Available</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-emerald-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.availableSlots ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ready for parking</p>
              </div>
            </CardContent>
          </Card>

          {/* 5. Occupied Slots */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Occupied</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-amber-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.occupiedSlots ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Assigned bays</p>
              </div>
            </CardContent>
          </Card>

          {/* 6. Walk-in Bookings Today */}
          <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm">
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Walk-Ins</span>
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-purple-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.walkinBookingsToday ?? 0}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Cash passes today</p>
              </div>
            </CardContent>
          </Card>

          {/* 7. Current Overstays */}
          <Card
            onClick={() => (stats?.metrics.currentOverstays ? setOverstayModalOpen(true) : null)}
            className={`bg-card/50 backdrop-blur border-border/60 hover:border-border transition-all shadow-sm col-span-2 sm:col-span-1 ${
              stats?.metrics.currentOverstays ? 'cursor-pointer hover:border-rose-500/50' : ''
            }`}
          >
            <CardContent className="p-3.5 space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium uppercase tracking-wider">Overstays</span>
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold tracking-tight text-rose-500">
                  {isLoadingStats ? <Skeleton className="w-10 h-7" /> : stats?.metrics.currentOverstays ?? 0}
                </div>
                <p className="text-[10px] text-rose-400 mt-0.5">
                  {stats?.metrics.currentOverstays ? 'Overdue sessions' : 'Zero overstays'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. OPERATIONAL LOG & QUICK ACTIONS */}
      {selectedLotId && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Live Activity Feed (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Live Gate Telemetry Feed</h2>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">
                Real-Time Socket Sync
              </Badge>
            </div>

            <Card className="border-border/60 bg-card/40 backdrop-blur shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-0">
                {isLoadingStats ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-3 animate-pulse">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-64" />
                        </div>
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ))}
                  </div>
                ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">No recent gate activity</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Scanned QR passes, vehicle check-ins, departures, and walk-in passes will appear here in chronological order.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {stats.recentActivity.map((act) => (
                      <div key={act.id} className="p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                        {getActivityBadge(act.eventCode)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">{act.eventTitle}</p>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(act.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{act.eventDescription}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 border-border/60">
                              {act.bookingReference}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">• Source: {act.eventSource}</span>
                            {act.performedByName && (
                              <span className="text-[10px] text-muted-foreground">• Guard: {act.performedByName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Panel (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Gate Protocols</h2>

            <Card className="border-border/60 bg-card/40 backdrop-blur shadow-sm rounded-xl">
              <CardContent className="p-4 space-y-2.5">
                {/* 1. Scan QR Pass */}
                <Link
                  to="/security/scan"
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Scan QR Pass</p>
                      <p className="text-[10px] text-muted-foreground">Digital booking check-in/out</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>

                {/* 2. Walk-in Driver Pass */}
                <Link
                  to="/security/walk-in"
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-amber-500/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Walk-in Cash Pass</p>
                      <p className="text-[10px] text-muted-foreground">On-site registration &amp; ticket</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                </Link>

                {/* 3. Emergency Manual Lookup */}
                <Link
                  to="/security/manual-lookup"
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-purple-500/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Emergency Lookup</p>
                      <p className="text-[10px] text-muted-foreground">Fallback plate &amp; mobile search</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                </Link>

                {/* 4. Vehicle Movement Logs */}
                <Link
                  to="/security/movement-logs"
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-blue-500/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Movement History</p>
                      <p className="text-[10px] text-muted-foreground">Audit logs &amp; PDF manifest</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </Link>

                {/* 5. Log Gate Incident */}
                <Link
                  to="/security/incidents"
                  className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-rose-500/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Log Gate Incident</p>
                      <p className="text-[10px] text-muted-foreground">Damage, dispute, or infraction</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                </Link>
              </CardContent>
            </Card>

            {/* Operating Guidelines Notice */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                QR Code verification is mandatory for all arriving and exiting drivers. Manual Lookup must only be utilized when digital scans are physically unreadable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* OVERSTAY MODAL DIALOG */}
      <Dialog open={overstayModalOpen} onOpenChange={setOverstayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="w-5 h-5" />
              Active Overstay Alert
            </DialogTitle>
            <DialogDescription className="text-xs">
              There are currently {stats?.metrics.currentOverstays ?? 0} vehicle(s) parked past their scheduled departure time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1">
              <p className="font-semibold text-foreground">Mandatory Exit Settlement Protocol:</p>
              <p className="text-muted-foreground leading-relaxed">
                When an overstay vehicle arrives at the exit gate, the system automatically calculates the overstay fee. Exit verification must not be completed until the fee is verified paid online via Razorpay or collected on-site in cash (for walk-in bookings).
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
