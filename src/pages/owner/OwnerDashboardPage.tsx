import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  DollarSign,
  TrendingUp,
  Car,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Star,
  Users,
  Navigation,
  Calendar,
  Layers,
  Sparkles,
  MessageSquareQuote,
  Settings,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  getOwnerDashboardAnalytics,
  type OwnerDashboardAnalyticsParams,
} from '@/api/ownerAnalytics.api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

export const OwnerDashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // Filters State
  const [selectedLotId, setSelectedLotId] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'>('this_month');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 1. Fetch Comprehensive Dashboard Analytics
  const queryParams: OwnerDashboardAnalyticsParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    rangePreset,
    dateFrom: rangePreset === 'custom' && dateFrom ? dateFrom : undefined,
    dateTo: rangePreset === 'custom' && dateTo ? dateTo : undefined,
  };

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-analytics-dashboard', selectedLotId, rangePreset, dateFrom, dateTo],
    queryFn: () => getOwnerDashboardAnalytics(queryParams),
  });

  useLiveSync(() => {
    void refetch();
  });

  // 2. Real-Time Socket.IO Synchronization
  useEffect(() => {
    const socket = getSocket();
    const handleSync = () => {
      void queryClient.invalidateQueries({ queryKey: ['owner-analytics-dashboard'] });
    };

    socket.on('facility_status_changed', handleSync);
    socket.on('booking_updated', handleSync);
    socket.on('booking_status_changed', handleSync);
    socket.on('slot_availability_updated', handleSync);
    socket.on('slot_status_changed', handleSync);
    socket.on('live_vehicle_update', handleSync);

    return () => {
      socket.off('facility_status_changed', handleSync);
      socket.off('booking_updated', handleSync);
      socket.off('booking_status_changed', handleSync);
      socket.off('slot_availability_updated', handleSync);
      socket.off('slot_status_changed', handleSync);
      socket.off('live_vehicle_update', handleSync);
    };
  }, [queryClient]);

  const ownerLots = dashboardData?.ownerLots || [];
  const kpis = dashboardData?.kpis;
  const revenueTrends = dashboardData?.revenueTrends || [];
  const floorOccupancy = dashboardData?.floorOccupancy || [];
  const recentBookings = dashboardData?.recentBookings || [];
  const recentReviews = dashboardData?.recentReviews || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 animate-in fade-in-50 duration-300 pb-16">
      {/* --------------------------------------------------------------------- */}
      {/* 1. PROFESSIONAL COMMAND HEADER & CONTROLS */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 font-bold text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              Business Command Center
            </Badge>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            Welcome back, {user?.fullName?.split(' ')[0] || 'Owner'}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            Real-time financial performance, slot occupancy, fleet operations, and customer sentiment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/owner/live-vehicles">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 h-9 shadow-xs"
            >
              <Navigation className="w-4 h-4" />
              Live Vehicle Locator &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {/* ERROR BANNER */}
      {isError && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="flex items-center justify-between py-3 px-4 text-rose-600 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                {(error as any)?.response?.data?.message ||
                  (error as any)?.message ||
                  'Failed to load owner dashboard analytics.'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 text-xs">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* NO ACTIVE LOTS NOTICE */}
      {!isLoading && !isError && ownerLots.length === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>No approved or active parking facilities found for this account. Create or activate a parking lot to start collecting live metrics.</span>
          </div>
          <Link
            to="/owner/parking/submissions"
            className="text-primary hover:underline font-bold text-xs shrink-0"
          >
            Go to Submissions &rarr;
          </Link>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. DASHBOARD-LEVEL FILTER BAR (Facility Switcher + Date Range Presets) */}
      {/* --------------------------------------------------------------------- */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Facility Selector */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">Facility:</span>
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 py-1 text-xs font-bold text-foreground shadow-2xs focus:border-primary focus:outline-none min-w-[220px]"
              >
                <option value="all">All Facilities ({ownerLots.length} Active)</option>
                {ownerLots.map((lot) => (
                  <option key={lot._id} value={lot._id}>
                    {lot.parkingName} ({lot.totalSlots} bays)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-start md:justify-end">
            <span className="text-xs font-bold text-muted-foreground mr-1">Period:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRangePreset(p.id as any)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs',
                  rangePreset === p.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:bg-muted/70',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {rangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-border/70 text-xs animate-in fade-in-50 duration-200">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-bold text-muted-foreground">Custom Range:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs font-semibold w-36 bg-background"
            />
            <span className="text-muted-foreground font-bold">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-xs font-semibold w-36 bg-background"
            />
          </div>
        )}
      </Card>

      {/* --------------------------------------------------------------------- */}
      {/* 3. BUSINESS PERFORMANCE KPI CARDS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross & Net Revenue */}
        <Link to="/owner/revenue" className="block group">
          <Card className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs h-full flex flex-col justify-between hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Revenue
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-24" /> : `₹${(kpis?.totalRevenue || 0).toLocaleString('en-IN')}`}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  ₹{(kpis?.netRevenue || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-muted-foreground text-[11px]">Net Earnings</span>
              </div>
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{kpis?.successfulPayments || 0} Successful Txns</span>
              <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                Financials &rarr;
              </span>
            </div>
          </Card>
        </Link>

        {/* KPI 2: Live Occupancy Rate */}
        <Link to="/owner/live-vehicles" className="block group">
          <Card className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs h-full flex flex-col justify-between hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Occupancy Rate
              </span>
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <Car className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-20" /> : `${kpis?.occupancyRate || 0}%`}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {kpis?.occupiedSlots || 0} / {kpis?.totalSlots || 0}
                </span>
                <span className="text-muted-foreground text-[11px]">Bays Parked</span>
              </div>
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="text-emerald-600 font-bold">{kpis?.availableSlots || 0} Available</span>
              <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                Locator &rarr;
              </span>
            </div>
          </Card>
        </Link>

        {/* KPI 3: Booking Activity */}
        <Link to="/owner/bookings" className="block group">
          <Card className="rounded-xl border border-border/80 bg-card p-5 shadow-2xs h-full flex flex-col justify-between hover:border-primary/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Total Bookings
              </span>
              <div className="p-2 rounded-xl bg-primary/15 text-primary group-hover:scale-105 transition-transform">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-20" /> : kpis?.totalBookings || 0}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className="font-bold text-primary">
                  {kpis?.activeBookings || 0} Active
                </span>
                <span className="text-muted-foreground text-[11px]">In Facility Now</span>
              </div>
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{kpis?.completedBookings || 0} Completed</span>
              <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                Bookings &rarr;
              </span>
            </div>
          </Card>
        </Link>

        {/* KPI 4: Overstay & Fleet Health */}
        <Link to="/owner/vehicles" className="block group">
          <Card
            className={cn(
              'rounded-xl border p-5 shadow-2xs h-full flex flex-col justify-between transition-all',
              kpis?.overstayCount && kpis.overstayCount > 0
                ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500'
                : 'border-border/80 bg-card hover:border-primary/50',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Overstay Alerts
              </span>
              <div
                className={cn(
                  'p-2 rounded-xl group-hover:scale-105 transition-transform',
                  kpis?.overstayCount && kpis.overstayCount > 0
                    ? 'bg-rose-500/20 text-rose-600 animate-pulse'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {isLoading ? <Skeleton className="h-8 w-20" /> : kpis?.overstayCount || 0}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span
                  className={cn(
                    'font-bold text-[11px]',
                    kpis?.overstayCount && kpis.overstayCount > 0 ? 'text-rose-600' : 'text-emerald-600',
                  )}
                >
                  {kpis?.overstayCount && kpis.overstayCount > 0 ? 'Exceeded Grace Period' : 'All Clear — 0 Overstays'}
                </span>
              </div>
            </div>
            <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>Exit Billing Active</span>
              <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                Vehicles &rarr;
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. DUAL CHARTS: REVENUE OVER TIME & OCCUPANCY BREAKDOWN */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Analytics Chart (7 Columns) */}
        <Card className="lg:col-span-7 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Revenue Over Time
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Aggregated verified booking receipts and processed refunds.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs border-border">
              {rangePreset.toUpperCase().replace('_', ' ')}
            </Badge>
          </CardHeader>

          <CardContent className="p-0 flex-1 min-h-[260px] flex items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : revenueTrends.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                No revenue transactions recorded for the selected period.
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ownerRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#ownerRevGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Analytics & Floor Breakdown (5 Columns) */}
        <Card className="lg:col-span-5 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Occupancy Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Current real-time slot state distribution across facilities.
              </CardDescription>
            </div>
            <Link to="/owner/slots">
              <span className="text-xs font-bold text-primary hover:underline">Manage Slots &rarr;</span>
            </Link>
          </CardHeader>

          <CardContent className="p-0 space-y-4">
            {/* 4 Status Chips Strip */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-300">Parked Inside</span>
                <span className="font-mono font-black text-blue-900 dark:text-blue-300">{kpis?.occupiedSlots || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-300">Reserved</span>
                <span className="font-mono font-black text-amber-900 dark:text-amber-300">{kpis?.reservedSlots || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">Available</span>
                <span className="font-mono font-black text-emerald-900 dark:text-emerald-300">{kpis?.availableSlots || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-muted border border-border flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Maintenance</span>
                <span className="font-mono font-bold text-foreground">{kpis?.maintenanceSlots || 0}</span>
              </div>
            </div>

            {/* Floor Breakdown Progress Bars */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Floor-Level Occupancy
              </span>
              {floorOccupancy.length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium py-3">No floor data available.</p>
              ) : (
                floorOccupancy.slice(0, 4).map((floor) => (
                  <div key={floor.floorId} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-foreground">
                      <span>{floor.floorName}</span>
                      <span className="font-mono text-[11px]">
                        {floor.occupiedSlots} / {floor.totalSlots} ({floor.occupancyPercentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          floor.occupancyPercentage > 85 ? 'bg-rose-500' : 'bg-primary',
                        )}
                        style={{ width: `${floor.occupancyPercentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. DUAL ACTIVITY & REPUTATION: RECENT BOOKINGS & CUSTOMER REVIEWS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Business Activity & Live Bookings (7 cols) */}
        <Card className="lg:col-span-7 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between border-b border-border/60">
            <div>
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Live Business Activity
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Most recent customer reservations and drive-in checkout activity.
              </CardDescription>
            </div>
            <Link to="/owner/bookings">
              <span className="text-xs font-bold text-primary hover:underline">View All &rarr;</span>
            </Link>
          </CardHeader>

          <CardContent className="p-0 pt-3">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10 font-medium">
                No recent booking transactions found.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {recentBookings.map((b) => (
                  <div key={b._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {b.vehicleNumber.slice(0, 2) || 'PB'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-foreground truncate">
                          <span className="font-mono text-primary">{b.bookingReference}</span>
                          <span className="text-muted-foreground">&bull;</span>
                          <span className="truncate">{b.customerName}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold truncate mt-0.5">
                          {b.parkingLotName} &bull; Bay: <span className="text-foreground">{b.slotNumber}</span> &bull;{' '}
                          Plate: <span className="font-mono text-foreground">{b.vehicleNumber}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-extrabold text-foreground text-xs block">
                        ₹{b.totalAmount}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-bold py-0 h-4',
                          b.bookingStatus === 'Active' || b.bookingStatus === 'Checked In'
                            ? 'border-blue-500 text-blue-600'
                            : b.bookingStatus === 'Completed'
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        {b.bookingStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Customer Satisfaction & Reviews (5 cols) */}
        <Card className="lg:col-span-5 rounded-xl border border-border/80 bg-card p-5 shadow-2xs flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between border-b border-border/60">
            <div>
              <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Customer Satisfaction
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Reputation score from verified driver visits.
              </CardDescription>
            </div>
            <Link to="/owner/reviews">
              <span className="text-xs font-bold text-primary hover:underline">All Reviews &rarr;</span>
            </Link>
          </CardHeader>

          <CardContent className="p-0 pt-3 space-y-4">
            {/* Score & Awaiting Reply Badge */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-muted-foreground block uppercase">
                  Rating Score
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-foreground">
                    {kpis?.averageRating?.toFixed(1) || '0.0'}
                  </span>
                  <span className="text-muted-foreground text-xs font-bold">/ 5.0</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  From {kpis?.totalReviews || 0} reviews
                </span>
              </div>

              {kpis?.awaitingReplyCount && kpis.awaitingReplyCount > 0 ? (
                <Link to="/owner/reviews">
                  <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-2.5 py-1 shadow-2xs flex items-center gap-1.5 animate-pulse">
                    <Clock className="w-3.5 h-3.5" />
                    {kpis.awaitingReplyCount} Awaiting Reply
                  </Badge>
                </Link>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All Replied
                </Badge>
              )}
            </div>

            {/* Recent Reviews Snippets */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Latest Customer Feedback
              </span>
              {recentReviews.length === 0 ? (
                <p className="text-xs text-muted-foreground font-medium py-3 text-center">
                  No reviews submitted yet.
                </p>
              ) : (
                recentReviews.map((r) => (
                  <div key={r._id} className="p-3 rounded-xl border border-border/70 bg-card text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-foreground">{r.customerName}</span>
                      <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{r.overallRating}.0</span>
                      </div>
                    </div>
                    <p className="text-foreground/80 italic font-medium truncate">&ldquo;{r.comment}&rdquo;</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 6. BUSINESS QUICK ACTIONS BAR */}
      {/* --------------------------------------------------------------------- */}
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-3">
          Business Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Revenue & Payouts', href: '/owner/revenue', icon: DollarSign, color: 'text-emerald-600' },
            { label: 'Vehicle Management', href: '/owner/vehicles', icon: Car, color: 'text-blue-600' },
            { label: 'Live Vehicle Locator', href: '/owner/live-vehicles', icon: Navigation, color: 'text-primary' },
            { label: 'Customer Reviews', href: '/owner/reviews', icon: MessageSquareQuote, color: 'text-amber-600' },
            { label: 'Facility Management', href: '/owner/parking-lots', icon: Building2, color: 'text-indigo-600' },
            { label: 'Staff Management', href: '/owner/staff', icon: Users, color: 'text-sky-600' },
            { label: 'Business Settings', href: '/owner/settings', icon: Settings, color: 'text-primary' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} to={action.href} className="block group">
                <Card className="rounded-xl border border-border/80 bg-card p-3.5 text-center shadow-2xs hover:border-primary/50 transition-all h-full flex flex-col items-center justify-center gap-2">
                  <div className={cn('p-2 rounded-xl bg-muted/60 group-hover:bg-primary/10 transition-colors', action.color)}>
                    <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors leading-tight">
                    {action.label}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboardPage;
