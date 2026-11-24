import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Clock,
  CreditCard,
  TrendingUp,
  Users,
  XCircle,
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
  type AdminAnalyticsData,
  type DashboardPeriod,
} from '@/api/adminInsights.api';
import { AdminInsightsNav } from '@/components/admin/AdminInsightsNav';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const METHOD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

export const AdminAnalyticsPage: React.FC = () => {
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);

  const [analytics, setAnalytics] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);

      const res = await adminInsightsApi.getAnalyticsData(
        period,
        period === 'custom' ? customFrom : undefined,
        period === 'custom' ? customTo : undefined,
      );
      setAnalytics(res);

      if (isManual) {
        toast.success('Analytics refreshed.');
      }
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      const msg = err.response?.data?.message || 'Failed to load platform analytics.';
      setError(msg);
      if (isManual) toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useLiveSync(() => {
    void fetchAnalytics(false);
  });

  const handlePeriodChange = (p: DashboardPeriod) => {
    setPeriod(p);
    setShowCustomPicker(p === 'custom');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in-50 duration-300">
      {/* --------------------------------------------------------------------- */}
      {/* 1. HEADER & NAVIGATION */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Platform Analytics &amp; Deep Trends
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Granular revenue breakdowns, gate barrier peak hours, cancellation audit, and vehicle overstay trends.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AdminInsightsNav />
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. DATE FILTER BAR */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['today', 'week', 'month', 'year', 'custom'] as DashboardPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                period === p
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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
              className="h-8 text-xs w-32"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs w-32"
            />
            <Button size="sm" className="h-8 text-xs px-2.5" onClick={() => fetchAnalytics()}>
              Apply
            </Button>
          </div>
        )}

        {analytics?.dateRange && (
          <div className="text-[11px] font-mono text-muted-foreground sm:ml-auto">
            Period: {new Date(analytics.dateRange.start).toLocaleDateString()} — {new Date(analytics.dateRange.end).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-3 px-4 text-destructive text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchAnalytics(true)} className="h-7 text-xs">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. SECTION 1: REVENUE ANALYTICS */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            Revenue Analytics &amp; Payment Breakdown
          </h2>
          <p className="text-xs text-muted-foreground">
            Daily gross vs net settlements, payment channels, and revenue by transaction category.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Revenue Chart */}
          <Card className="lg:col-span-2 border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Daily Revenue &amp; Refunds</CardTitle>
              <CardDescription className="text-xs">
                Gross collections minus processed customer cancellations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading || !analytics ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-56 w-full" />
                </div>
              ) : analytics.revenueAnalytics.dailyRevenue.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <Calendar className="h-8 w-8 mb-2 opacity-40" />
                  No daily revenue transactions in this period
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.revenueAnalytics.dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.6} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="gross" name="Gross Revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="refunds" name="Refunds" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods Share */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Payment Methods</CardTitle>
              <CardDescription className="text-xs">
                Online gateway vs Cash collected at barrier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading || !analytics ? (
                <div className="h-64 flex items-center justify-center">
                  <Skeleton className="h-44 w-44 rounded-full" />
                </div>
              ) : (
                <div className="h-64 w-full flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={analytics.revenueAnalytics.paymentMethods}
                        dataKey="amount"
                        nameKey="method"
                        innerRadius={45}
                        outerRadius={68}
                        paddingAngle={4}
                      >
                        {analytics.revenueAnalytics.paymentMethods.map((_, index) => (
                          <Cell key={`pm-${index}`} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Amount']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-full pt-2 border-t border-border/40 space-y-1 text-xs">
                    {analytics.revenueAnalytics.paymentMethods.map((pm, idx) => (
                      <div key={pm.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: METHOD_COLORS[idx % METHOD_COLORS.length] }} />
                          <span className="text-muted-foreground">{pm.method}</span>
                        </div>
                        <span className="font-bold text-foreground">
                          ₹{pm.amount.toLocaleString()} ({pm.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. SECTION 2: PLATFORM GROWTH & GATE USAGE */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Platform Growth &amp; Gate Usage
          </h2>
          <p className="text-xs text-muted-foreground">
            Cumulative user registrations and barrier passage peak hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peak Hours (0-23 Histogram) */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Barrier Gate Peak Hours (24h)</CardTitle>
              <CardDescription className="text-xs">
                Physical entry and exit throughput by hour of day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading || !analytics ? (
                <div className="h-60 flex items-center justify-center">
                  <Skeleton className="h-52 w-full" />
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.growthAndUsage.peakHours} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.6} />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="entriesCount" name="Entries" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="exitsCount" name="Exits" fill="#10b981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Parking Lots by Revenue */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Top Facilities by Volume</CardTitle>
              <CardDescription className="text-xs">
                Highest turnover parking lots during this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading || !analytics ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : analytics.growthAndUsage.topParkingLots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-8 text-center">No facility volume in period.</p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 text-xs">
                  {analytics.growthAndUsage.topParkingLots.map((lot, idx) => (
                    <div key={lot.lotId} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground text-xs w-4">#{idx + 1}</span>
                        <div>
                          <p className="font-semibold text-foreground truncate max-w-[170px]">{lot.parkingName}</p>
                          <p className="text-[10px] text-muted-foreground">{lot.bookingsCount} bookings • {lot.occupancyRate}% occ</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-600">₹{lot.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 5. SECTION 3: CANCELLATION & REFUND ANALYTICS */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancellation &amp; Simulated Refund Analytics
          </h2>
          <p className="text-xs text-muted-foreground">
            Analysis of customer cancellations, partner cancellations, no-shows, and refund audit ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Customer Cancelled</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {analytics?.cancellationAnalytics.customerCancelled || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Cancelled via customer app</p>
          </Card>
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Partner / Admin Cancelled</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {analytics?.cancellationAnalytics.ownerCancelled || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Facility maintenance or closures</p>
          </Card>
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">System No-Shows</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {analytics?.cancellationAnalytics.systemCancelledNoShow || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Driver never arrived at gate</p>
          </Card>
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Cancellation Rate</p>
            <p className="text-2xl font-bold text-destructive mt-1">
              {analytics?.cancellationAnalytics.cancellationRate || 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">Of total bookings placed</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cancellation Reasons */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Top Cancellation Reasons</CardTitle>
              <CardDescription className="text-xs">
                Feedback cited during customer cancellation workflows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.cancellationAnalytics.cancellationReasons.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-8 text-center">No cancellation records in period.</p>
              ) : (
                <div className="space-y-2">
                  {analytics?.cancellationAnalytics.cancellationReasons.map((cr, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40 text-xs">
                      <span className="text-foreground truncate max-w-xs font-medium">"{cr.reason}"</span>
                      <Badge variant="secondary" className="text-[10px]">{cr.count} times</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Simulated Refund Distribution */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Refund Policy Distribution</CardTitle>
              <CardDescription className="text-xs">
                Settled refunds under Version 1 simulated refund architecture.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {analytics?.cancellationAnalytics.refundDistribution.map((rd, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-muted-foreground">{rd.label}</span>
                    <span className="font-bold text-foreground">{rd.percentage}% ({rd.count} refunds)</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${rd.percentage}%` }} />
                  </div>
                </div>
              ))}
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 mt-2">
                Note: In Version 1, refunds are simulated and reconciled strictly through digital ledger audit tracking.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 6. SECTION 4: OVERSTAY ANALYTICS */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Vehicle Overstay &amp; Tariff Enforcement
          </h2>
          <p className="text-xs text-muted-foreground">
            Analysis of overdue vehicles, penalty revenue, and repeat overstay violators.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Total Overstays Recorded</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {analytics?.overstayAnalytics.totalOverstays || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Vehicles exceeding booked interval</p>
          </Card>
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Average Overstay Duration</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {analytics?.overstayAnalytics.averageOverstayDurationMinutes || 0} mins
            </p>
            <p className="text-[10px] text-muted-foreground">Beyond scheduled exit barrier</p>
          </Card>
          <Card className="p-4 border-border/80 shadow-xs">
            <p className="text-xs font-semibold text-muted-foreground">Total Overstay Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              ₹{analytics?.overstayAnalytics.totalOverstayRevenue.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-muted-foreground">Collected at barrier or online</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overstay Facilities */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Facilities with Most Overstays</CardTitle>
              <CardDescription className="text-xs">
                Parking lots where vehicles stay beyond reservation end.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.overstayAnalytics.parkingLotsWithMostOverstays.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-8 text-center">No overstay records in period.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {analytics?.overstayAnalytics.parkingLotsWithMostOverstays.map((ol) => (
                    <div key={ol.lotId} className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/40">
                      <span className="font-semibold text-foreground truncate max-w-xs">{ol.parkingName}</span>
                      <div className="text-right">
                        <span className="font-bold text-amber-600 block">{ol.count} overstays</span>
                        <span className="text-[10px] text-muted-foreground">₹{ol.revenue.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overstay Duration Distribution */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground">Overstay Duration Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Time elapsed before driver cleared barrier gate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {analytics?.overstayAnalytics.overstayDistributionHours.map((ob, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-muted-foreground">{ob.range}</span>
                    <span className="font-bold text-foreground">{ob.count} incidents</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${
                          analytics?.overstayAnalytics.totalOverstays
                            ? Math.min(100, Math.round((ob.count / analytics.overstayAnalytics.totalOverstays) * 100))
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
