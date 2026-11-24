import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Layers,
  Mail,
  Percent,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  adminInsightsApi,
  type AdminDashboardData,
  type DashboardPeriod,
} from '@/api/adminInsights.api';
import { AdminInsightsNav } from '@/components/admin/AdminInsightsNav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getSocket } from '@/lib/socket';
import { useLiveSync } from '@/hooks/useLiveSync';

export const AdminDashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);

  const [growthMetric, setGrowthMetric] = useState<'revenue' | 'users' | 'owners' | 'bookings'>('revenue');

  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);

      const res = await adminInsightsApi.getDashboardData(
        period,
        period === 'custom' ? customFrom : undefined,
        period === 'custom' ? customTo : undefined,
      );
      setData(res);

      if (isManual) {
        toast.success('Dashboard metrics refreshed from live database.');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard metrics:', err);
      const msg = err.response?.data?.message || 'Unable to retrieve dashboard metrics.';
      setError(msg);
      if (isManual) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useLiveSync(() => {
    void fetchDashboard(false);
  });

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join_admin');

    const handleUpdate = () => {
      fetchDashboard();
    };

    socket.on('facility_status_changed', handleUpdate);
    socket.on('booking_status_changed', handleUpdate);
    socket.on('slot_status_changed', handleUpdate);
    socket.on('new_notification', handleUpdate);

    return () => {
      socket.off('facility_status_changed', handleUpdate);
      socket.off('booking_status_changed', handleUpdate);
      socket.off('slot_status_changed', handleUpdate);
      socket.off('new_notification', handleUpdate);
    };
  }, [fetchDashboard]);

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  };

  const renderGrowthPill = (growth?: number) => {
    if (growth === undefined) return null;
    const isPositive = growth >= 0;
    return (
      <span
        className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${
          isPositive
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
        }`}
      >
        {isPositive ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
        {Math.abs(growth)}%
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-7 animate-in fade-in-50 duration-300">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP BREADCRUMB & INSIGHTS SUB-NAVIGATION */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold gap-1.5 shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform Administration
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Platform Insights &amp; Command Center
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Real-time multi-tenant monitoring, operational throughput, statutory compliance, and facility lifecycle management.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AdminInsightsNav />
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. DATE FILTER CONTROLS */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['today', 'week', 'month', 'year', 'custom'] as DashboardPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === p
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              {p === 'today'
                ? 'Today'
                : p === 'week'
                ? 'This Week'
                : p === 'month'
                ? 'This Month'
                : p === 'year'
                ? 'This Year'
                : 'Custom'}
            </button>
          ))}
        </div>

        {showCustomPicker && (
          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-32 border-border/80"
            />
            <span className="text-xs text-muted-foreground font-medium">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs w-32 border-border/80"
            />
            <Button size="sm" className="h-8 text-xs px-3 shadow-xs" onClick={() => fetchDashboard()}>
              Apply
            </Button>
          </div>
        )}

        {data?.dateRange && (
          <div className="text-xs font-mono text-muted-foreground sm:ml-auto flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-md border border-border/40">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {new Date(data.dateRange.start).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} —{' '}
              {new Date(data.dateRange.end).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent className="flex items-center justify-between py-3 px-4 text-rose-600 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} className="h-7 text-xs">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. NINE ENTERPRISE KPI CARDS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
        {/* KPI 1: Users */}
        <Link to="/admin/users" className="block group">
          <Card className="border-border/80 bg-card hover:border-sky-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Registered Users
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-500/20 group-hover:scale-110 transition-transform">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground tracking-tight">
                      {data.kpis.users.value.toLocaleString()}
                    </span>
                    {renderGrowthPill(data.kpis.users.changePercentage)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.users.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 2: Owners */}
        <Link to="/admin/owners" className="block group">
          <Card className="border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Parking Owners
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <UserCheck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground tracking-tight">
                      {data.kpis.owners.value.toLocaleString()}
                    </span>
                    {renderGrowthPill(data.kpis.owners.changePercentage)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.owners.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 3: Official Parking Lots */}
        <Link to="/admin/parking-lots" className="block group">
          <Card className="border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Official Parking Lots
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">
                    {data.kpis.parkingLots.value.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.parkingLots.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 4: Bookings */}
        <Link to="/admin/bookings" className="block group">
          <Card className="border-border/80 bg-card hover:border-blue-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Bookings
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                <FileText className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground tracking-tight">
                      {data.kpis.bookings.value.toLocaleString()}
                    </span>
                    {renderGrowthPill(data.kpis.bookings.changePercentage)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.bookings.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 5: Revenue */}
        <Link to="/admin/finance" className="block group">
          <Card className="border-border/80 bg-card hover:border-emerald-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Period Gross Revenue
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      ₹{data.kpis.revenue.value.toLocaleString()}
                    </span>
                    {renderGrowthPill(data.kpis.revenue.changePercentage)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.revenue.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 6: Occupancy */}
        <Link to="/admin/parking-lots" className="block group">
          <Card className="border-border/80 bg-card hover:border-amber-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Platform Occupancy
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Percent className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="text-2xl font-extrabold text-foreground tracking-tight">
                    {data.kpis.occupancy.value}%
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.occupancy.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 7: Payments */}
        <Link to="/admin/payments" className="block group">
          <Card className="border-border/80 bg-card hover:border-purple-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payments Processed
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                <CreditCard className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground tracking-tight">
                      {data.kpis.payments.value.toLocaleString()}
                    </span>
                    {renderGrowthPill(data.kpis.payments.changePercentage)}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.payments.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 8: Reviews */}
        <Link to="/admin/reviews" className="block group">
          <Card className="border-border/80 bg-card hover:border-amber-500/40 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Customer Reviews
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground tracking-tight">
                      {data.kpis.reviews.value.toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-bold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {data.kpis.reviews.averageRating}★
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{data.kpis.reviews.secondaryText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* KPI 9: Pending Owner Approvals (VISUALLY PROMINENT ACTION CARD) */}
        <Link to="/admin/owners" className="block group">
          <Card
            className={`border transition-all duration-200 shadow-xs h-full flex flex-col justify-between ${
              data?.kpis.pendingOwnerApprovals.actionRequired
                ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500 hover:shadow-md ring-1 ring-amber-500/30'
                : 'border-border/80 bg-card hover:border-primary/50 hover:shadow-md'
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Owner Approvals
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${
                data?.kpis.pendingOwnerApprovals.actionRequired
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 animate-pulse'
                  : 'bg-muted text-muted-foreground border-border/80'
              }`}>
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-8 w-24 mb-1" />
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 tracking-tight">
                      {data.kpis.pendingOwnerApprovals.value}
                    </span>
                    {data.kpis.pendingOwnerApprovals.actionRequired && (
                      <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-2 py-0.5 font-bold shadow-2xs">
                        Action Required
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 font-medium">
                    {data.kpis.pendingOwnerApprovals.secondaryText}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. DASHBOARD CHARTS SECTION */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue Over Time */}
        <Card className="lg:col-span-2 border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Revenue Trend
              </CardTitle>
              <CardDescription className="text-xs">
                Platform gross revenue and fees for the selected date range.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
              ₹{data?.kpis.revenue.value.toLocaleString() || 0} Total
            </Badge>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-56 w-full" />
              </div>
            ) : data.charts.revenueTrend.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground">
                <Calendar className="h-8 w-8 mb-2 opacity-40" />
                No revenue records in this period
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                    <Tooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Revenue']}
                      contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Occupancy Donut Chart */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-orange-500" />
              Platform Occupancy
            </CardTitle>
            <CardDescription className="text-xs">
              Live slot status distribution across registered facilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-44 w-44 rounded-full" />
              </div>
            ) : (
              <div className="h-64 w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={data.charts.occupancyDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {data.charts.occupancyDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} slots`, 'Count']} contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="grid grid-cols-2 gap-2 w-full pt-2.5 border-t border-border/60 text-[11px]">
                  {data.charts.occupancyDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}:</span>
                      <span className="font-bold text-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Bookings Over Time (Online vs Walk-in) */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Bookings by Type
            </CardTitle>
            <CardDescription className="text-xs">
              Comparison between Online mobile reservations and Barrier Walk-ins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-60 flex items-center justify-center">
                <Skeleton className="h-52 w-full" />
              </div>
            ) : data.charts.bookingsTrend.length === 0 ? (
              <div className="h-60 flex flex-col items-center justify-center text-xs text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-40" />
                No booking activity in this period
              </div>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.bookingsTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="online" name="Online" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="walkIn" name="Walk-in" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Platform Growth Switcher */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Platform Growth
              </CardTitle>
              <CardDescription className="text-xs">
                Trajectory of registered participants and business volume.
              </CardDescription>
            </div>
            {/* Metric Switcher */}
            <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-lg text-[11px] border border-border/40">
              {(['revenue', 'users', 'owners', 'bookings'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setGrowthMetric(m)}
                  className={`px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
                    growthMetric === m ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="h-60 flex items-center justify-center">
                <Skeleton className="h-52 w-full" />
              </div>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.growthTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }} />
                    <Area
                      type="monotone"
                      dataKey={growthMetric}
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fill="url(#colorGrowth)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. PARKING FACILITY STATUS OVERVIEW & SETUP ATTENTION */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Overview Card */}
        <Card className="lg:col-span-2 border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-500" />
              Parking Facility Lifecycle Status
            </CardTitle>
            <CardDescription className="text-xs">
              Complete status breakdown across submission review, 2D visual layout, and official lot activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Submissions Pipeline */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2.5 uppercase tracking-wider">
                1. Owner Survey Submissions ({data?.facilityStatusOverview.submissions.total || 0})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 hover:bg-muted/60 transition-colors">
                  <span className="text-muted-foreground text-[10px] block font-medium">Draft</span>
                  <span className="font-extrabold text-foreground text-sm">{data?.facilityStatusOverview.submissions.draft || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 transition-colors">
                  <span className="text-sky-600 dark:text-sky-400 text-[10px] block font-medium">Submitted</span>
                  <span className="font-extrabold text-sky-700 dark:text-sky-300 text-sm">{data?.facilityStatusOverview.submissions.submitted || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
                  <span className="text-blue-600 dark:text-blue-400 text-[10px] block font-medium">Under Review</span>
                  <span className="font-extrabold text-blue-700 dark:text-blue-300 text-sm">{data?.facilityStatusOverview.submissions.underReview || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors">
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-medium">Changes Req.</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">{data?.facilityStatusOverview.submissions.changesRequested || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-medium">Approved</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">{data?.facilityStatusOverview.submissions.approved || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition-colors">
                  <span className="text-rose-600 dark:text-rose-400 text-[10px] block font-medium">Rejected</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-300 text-sm">{data?.facilityStatusOverview.submissions.rejected || 0}</span>
                </div>
              </div>
            </div>

            {/* Layouts Pipeline */}
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs font-bold text-muted-foreground mb-2.5 uppercase tracking-wider">
                2. 2D CAD Layouts ({data?.facilityStatusOverview.layouts.total || 0})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[10px] block font-medium">Not Created</span>
                  <span className="font-extrabold text-foreground text-sm">{data?.facilityStatusOverview.layouts.notCreated || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                  <span className="text-muted-foreground text-[10px] block font-medium">Draft</span>
                  <span className="font-extrabold text-foreground text-sm">{data?.facilityStatusOverview.layouts.draft || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <span className="text-blue-600 dark:text-blue-400 text-[10px] block font-medium">Validated</span>
                  <span className="font-extrabold text-blue-700 dark:text-blue-300 text-sm">{data?.facilityStatusOverview.layouts.validated || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-medium">Published</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">{data?.facilityStatusOverview.layouts.published || 0}</span>
                </div>
              </div>
            </div>

            {/* Official Lots Pipeline */}
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs font-bold text-muted-foreground mb-2.5 uppercase tracking-wider">
                3. Official Parking Lots Activation ({data?.facilityStatusOverview.officialLots.total || 0})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] block font-medium">Active (Live)</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">{data?.facilityStatusOverview.officialLots.active || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] block font-medium">Under Maintenance</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">{data?.facilityStatusOverview.officialLots.underMaintenance || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                  <span className="text-slate-600 dark:text-slate-400 text-[10px] block font-medium">Suspended / Inactive</span>
                  <span className="font-extrabold text-slate-700 dark:text-slate-300 text-sm">{data?.facilityStatusOverview.officialLots.suspended || 0}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <span className="text-rose-600 dark:text-rose-400 text-[10px] block font-medium">Deactivated</span>
                  <span className="font-extrabold text-rose-700 dark:text-rose-300 text-sm">{data?.facilityStatusOverview.officialLots.deactivated || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actionable Setup Attention Queue */}
        <Card className="border-border/80 shadow-xs bg-card flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Facility Setup Attention
            </CardTitle>
            <CardDescription className="text-xs">
              Facilities requiring immediate administrative intervention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !data ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : data.facilityAttention.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2" />
                <span className="font-medium text-foreground block mb-0.5">All Systems Operational</span>
                All facilities and submissions are fully setup and operating cleanly.
              </div>
            ) : (
              data.facilityAttention.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2 text-xs hover:border-border transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground leading-tight">{item.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 font-bold uppercase tracking-wider ${
                        item.severity === 'high'
                          ? 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10'
                          : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      {item.severity}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">{item.description}</p>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs w-full justify-between mt-1 shadow-2xs">
                    <Link to={item.actionUrl}>
                      <span>{item.actionText}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 6. OWNER APPROVAL SUMMARY & RECENT ACTIVITY */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Owner Approval Summary */}
        <Card className="border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-orange-500" />
              Owner Approval Summary
            </CardTitle>
            <CardDescription className="text-xs">
              State of parking partner registrations and statutory onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Pending Review Applications</span>
              <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">
                {data?.ownerApprovalSummary.pendingApplications || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">Approved Active Partners</span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                {data?.ownerApprovalSummary.approvedOwners || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground font-medium">Registration Fee Pending (₹999)</span>
              <span className="font-bold text-foreground">
                {data?.ownerApprovalSummary.registrationFeePending || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground font-medium">Suspended Owner Accounts</span>
              <span className="font-bold text-foreground">
                {data?.ownerApprovalSummary.suspendedOwners || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-muted-foreground font-medium">Rejected Applications</span>
              <span className="font-bold text-foreground">
                {data?.ownerApprovalSummary.rejectedApplications || 0}
              </span>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full text-xs h-8 mt-2 shadow-2xs font-medium">
              <Link to="/admin/owners">
                Manage All Owner Applications
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Real Platform Activity */}
        <Card className="lg:col-span-2 border-border/80 shadow-xs bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Recent Live Platform Activity
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time booking and transaction events originating from actual database records.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Feed
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recent Bookings */}
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
                Latest Customer Bookings
              </p>
              {data?.recentActivity.bookings.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                  <FileText className="h-6 w-6 text-muted-foreground/60 mx-auto mb-1.5" />
                  No bookings recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.recentActivity.bookings.map((b) => (
                    <div
                      key={b._id}
                      className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 font-bold bg-background text-foreground border-border/80">
                          {b.bookingReference}
                        </Badge>
                        <div>
                          <p className="font-semibold text-foreground">{b.customerName} <span className="text-muted-foreground font-normal">({b.vehicleNumber})</span></p>
                          <p className="text-[11px] text-muted-foreground">{b.parkingName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-foreground block">₹{b.totalAmount}</span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-semibold ${
                            b.bookingStatus === 'Completed'
                              ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                              : 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                          }`}
                        >
                          {b.bookingStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="pt-3 border-t border-border/60">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Operational Shortcuts
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="text-xs h-8 shadow-2xs gap-1.5">
                  <Link to="/admin/facilities">
                    <Building2 className="h-3.5 w-3.5 text-orange-500" />
                    Review Submissions
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 shadow-2xs gap-1.5">
                  <Link to="/admin/owners">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                    Verify Owners
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 shadow-2xs gap-1.5">
                  <Link to="/admin/email-center">
                    <Mail className="h-3.5 w-3.5 text-blue-500" />
                    Compose Broadcast
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 shadow-2xs gap-1.5">
                  <Link to="/admin/reviews">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    Review Moderation
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="text-xs h-8 shadow-2xs gap-1.5">
                  <Link to="/admin/live-vehicles">
                    <Radio className="h-3.5 w-3.5 text-emerald-500" />
                    Live Vehicles
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
