import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  RotateCcw,
  Building2,
  Calendar,
  Search,
  Download,
  Printer,
  Ban,
  Receipt,
  Landmark,
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
import { useLiveSync } from '@/hooks/useLiveSync';
import { toast } from 'sonner';
import {
  getOwnerRevenueOverview,
  getOwnerRevenueTransactions,
  type OwnerRevenueOverviewParams,
  type OwnerRevenueTransactionsParams,
  type OwnerPaymentTransactionItem,
} from '@/api/ownerRevenue.api';
import {
  createPdfSectionBlock,
  createPdfManifestTable,
  openParkEasePdfPrintWindow,
} from '@/lib/pdfThemeHelper';
import { cn } from '@/lib/utils';

export const OwnerRevenuePage: React.FC = () => {
  // Query state
  const [selectedLotId, setSelectedLotId] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<string>('this_month');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Transaction table query state
  const [txSearch, setTxSearch] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('all');
  const [txType, setTxType] = useState<string>('all');
  const [txMethod, setTxMethod] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  // 1. Fetch Overview Metrics & Charts
  const overviewParams: OwnerRevenueOverviewParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    rangePreset: rangePreset !== 'custom' ? rangePreset : undefined,
    dateFrom: rangePreset === 'custom' && dateFrom ? dateFrom : undefined,
    dateTo: rangePreset === 'custom' && dateTo ? dateTo : undefined,
  };

  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['owner-revenue-overview', selectedLotId, rangePreset, dateFrom, dateTo],
    queryFn: () => getOwnerRevenueOverview(overviewParams),
  });

  // 2. Fetch Paginated Transactions Table
  const transactionsParams: OwnerRevenueTransactionsParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    paymentStatus: txStatus !== 'all' ? txStatus : undefined,
    paymentType: txType !== 'all' ? txType : undefined,
    paymentMethod: txMethod !== 'all' ? txMethod : undefined,
    search: txSearch.trim() || undefined,
    dateFrom: rangePreset === 'custom' && dateFrom ? dateFrom : undefined,
    dateTo: rangePreset === 'custom' && dateTo ? dateTo : undefined,
    page,
    limit,
  };

  const {
    data: txData,
    isLoading: isLoadingTx,
    refetch: refetchTx,
  } = useQuery({
    queryKey: [
      'owner-revenue-transactions',
      selectedLotId,
      txStatus,
      txType,
      txMethod,
      txSearch,
      page,
      dateFrom,
      dateTo,
      rangePreset,
    ],
    queryFn: () => getOwnerRevenueTransactions(transactionsParams),
  });

  useLiveSync(() => {
    void refetchOverview();
    void refetchTx();
  });

  // CSV Export
  const handleExportCsv = () => {
    if (!txData?.transactions || txData.transactions.length === 0) {
      toast.error('No transactions available to export for the selected filter.');
      return;
    }

    const headers = [
      'Payment Reference',
      'Booking Reference',
      'Parking Facility',
      'Customer Name',
      'Payment Type',
      'Payment Method',
      'Amount (INR)',
      'Payment Status',
      'Refund Amount (INR)',
      'Refund Status',
      'Transaction ID',
      'Date (UTC)',
    ];

    const rows = txData.transactions.map((t: OwnerPaymentTransactionItem) => [
      `"${t.paymentReference}"`,
      `"${t.bookingReference}"`,
      `"${t.parkingLotName}"`,
      `"${t.customerName}"`,
      `"${t.paymentType}"`,
      `"${t.paymentMethod}"`,
      t.amount,
      `"${t.paymentStatus}"`,
      t.refundAmount,
      `"${t.refundStatus || 'N/A'}"`,
      `"${t.transactionId || 'N/A'}"`,
      `"${t.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ParkEase_Revenue_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Revenue report CSV downloaded successfully.');
  };

  // PDF Export
  const handleExportPdf = () => {
    if (!overviewData || !txData) {
      toast.error('Financial data not ready for export.');
      return;
    }

    const kpis = overviewData.kpis;
    const activeLotName =
      selectedLotId === 'all'
        ? 'All Facilities'
        : overviewData.ownerLots.find((l) => l._id === selectedLotId)?.parkingName || 'Facility';

    const metaCards = [
      { label: 'TOTAL GROSS REVENUE', value: `₹${kpis.totalRevenue.toLocaleString('en-IN')}`, subtext: 'Verified Receipts' },
      { label: 'NET OWNER REVENUE', value: `₹${kpis.netRevenue.toLocaleString('en-IN')}`, subtext: 'After Deducting Refunds' },
      { label: 'TOTAL REFUNDS', value: `₹${kpis.refundedAmount.toLocaleString('en-IN')}`, subtext: `${kpis.totalRefundsCount} refunded transactions` },
      { label: 'SUCCESSFUL PAYMENTS', value: `${kpis.successfulPaymentsCount}`, subtext: `${kpis.pendingPaymentsCount} pending` },
    ];

    const summaryBlock = createPdfSectionBlock('FINANCIAL AUDIT SUMMARY', [
      { label: 'Selected Facility Scope', value: activeLotName },
      { label: 'Report Period Filter', value: rangePreset.replace('_', ' ').toUpperCase() },
      { label: 'Total Verified Revenue', value: `₹${kpis.totalRevenue.toLocaleString('en-IN')}`, isTotal: true },
      { label: 'Total Completed Refunds', value: `- ₹${kpis.refundedAmount.toLocaleString('en-IN')}` },
      { label: 'Net Facility Earnings', value: `₹${kpis.netRevenue.toLocaleString('en-IN')}`, isTotal: true },
      { label: 'Pending / Processing Payments', value: `${kpis.pendingPaymentsCount} (₹${kpis.pendingPaymentsAmount.toLocaleString('en-IN')})` },
      { label: 'Cancelled Bookings Count', value: `${kpis.cancellationCount}` },
      { label: 'Settlement Status', value: overviewData.payoutInfo.status },
    ]);

    const manifestTable = createPdfManifestTable(
      [
        { header: 'Ref #', width: '15%' },
        { header: 'Booking Ref', width: '15%' },
        { header: 'Facility', width: '20%' },
        { header: 'Customer', width: '15%' },
        { header: 'Type', width: '12%' },
        { header: 'Method', width: '8%', align: 'center' },
        { header: 'Amount', width: '15%', align: 'right' },
      ],
      txData.transactions.map((tx: OwnerPaymentTransactionItem) => [
        { content: tx.paymentReference, isMono: true },
        { content: tx.bookingReference, isMono: true },
        { content: tx.parkingLotName },
        { content: tx.customerName },
        { content: tx.paymentType },
        { content: tx.paymentMethod, align: 'center' },
        { content: `₹${tx.amount.toLocaleString('en-IN')}`, align: 'right' },
      ]),
    );

    const bodyHtml = `
      ${summaryBlock}
      <div style="margin-top:24px;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;">
          TRANSACTION MANIFEST (Page ${txData.page} of ${txData.totalPages} — Total ${txData.total} Records)
        </div>
        ${manifestTable}
      </div>
    `;

    openParkEasePdfPrintWindow({
      docTitle: 'PARKING OWNER REVENUE & AUDIT STATEMENT',
      docSubtitle: `Official platform financial audit report for ${activeLotName}`,
      documentId: `REV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      statusPill: { text: 'OFFICIAL AUDIT REPORT', variant: 'green' },
      metaCards,
      bodyHtml,
      footerNotes: [
        'ParkEase Verified Financial Report — Generated from authoritative MongoDB payment transaction logs.',
        'Net Revenue reflects gross verified receipts minus processed refunds under platform cancellation policy.',
        'Revenue is settled via direct verified wire transfer according to platform merchant partner agreement.',
      ],
    });
  };

  const kpis = overviewData?.kpis;
  const lots = overviewData?.ownerLots || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* 1. HEADER & GLOBAL CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <DollarSign className="h-7 w-7 text-primary" />
              Revenue &amp; Payouts
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Owner Finance
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time financial performance, payment reconciliations, cancellation metrics, and audited export reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoadingTx || !txData?.transactions?.length}
            className="text-xs gap-1.5 h-9"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={handleExportPdf}
            disabled={isLoadingOverview || !overviewData}
            className="text-xs font-bold gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Download PDF Report
          </Button>
        </div>
      </div>

      {/* 2. FILTER & RANGE CONTROLS BAR */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Facility Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedLotId}
                onChange={(e) => {
                  setSelectedLotId(e.target.value);
                  setPage(1);
                }}
                className="h-9 px-3 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-56"
              >
                <option value="all">All Parking Facilities ({lots.length})</option>
                {lots.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.parkingName}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Preset Selector */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRangePreset(p.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    rangePreset === p.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers */}
          {rangePreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs w-full md:w-auto">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs w-36"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs w-36"
                placeholder="To"
              />
            </div>
          )}
        </div>
      </Card>

      {/* 3. FINANCIAL OVERVIEW KPI TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Revenue */}
        <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Gross Revenue
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {isLoadingOverview ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                `₹${(kpis?.totalRevenue || 0).toLocaleString('en-IN')}`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {kpis?.successfulPaymentsCount || 0} successful transaction(s)
            </p>
          </div>
        </Card>

        {/* Net Revenue */}
        <Card className="rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Net Facility Earnings
            </span>
            <div className="h-9 w-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight text-primary">
              {isLoadingOverview ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                `₹${(kpis?.netRevenue || 0).toLocaleString('en-IN')}`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Gross revenue minus processed refunds
            </p>
          </div>
        </Card>

        {/* Total Refunded */}
        <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Refunds &amp; Returns
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <RotateCcw className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {isLoadingOverview ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                `₹${(kpis?.refundedAmount || 0).toLocaleString('en-IN')}`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {kpis?.totalRefundsCount || 0} refunded transaction(s)
            </p>
          </div>
        </Card>

        {/* Cancellations & Pending */}
        <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cancellations / Pending
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Ban className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2 space-y-0.5">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {isLoadingOverview ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                `${kpis?.cancellationCount || 0}`
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {kpis?.pendingPaymentsCount || 0} pending payment order(s)
            </p>
          </div>
        </Card>
      </div>

      {/* 4. REVENUE CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Over Time Area Chart (8 cols) */}
        <Card className="lg:col-span-8 border border-border/80 bg-card rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue Over Time
              </CardTitle>
              <CardDescription className="text-xs">
                Chronological daily gross receipts and processed customer refunds
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                Refunds
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {isLoadingOverview ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : overviewData?.revenueOverTime?.length ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={overviewData.revenueOverTime}
                    margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="ownerRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="ownerRefGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(val) => `₹${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        fontSize: '12px',
                      }}
                      formatter={(val, name) => [
                        `₹${Number(val).toLocaleString('en-IN')}`,
                        name === 'revenue' ? 'Revenue' : 'Refunds',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#ownerRevGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="refunds"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      fillOpacity={1}
                      fill="url(#ownerRefGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 rounded-xl border border-dashed border-border/70 p-6 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2">
                <Receipt className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs font-bold text-foreground">No Revenue Data in Selected Range</p>
                <p className="text-[11px] max-w-xs">
                  Change the facility or date range preset to view historical revenue and refund trends.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Facility & Status Breakdown (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Revenue by Facility */}
          <Card className="flex-1 border border-border/80 bg-card rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Revenue by Facility
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewData?.revenueByParkingLot?.length ? (
                <div className="space-y-3">
                  {overviewData.revenueByParkingLot.map((lot) => {
                    const pct =
                      (kpis?.totalRevenue || 0) > 0
                        ? Math.round((lot.revenue / (kpis?.totalRevenue || 1)) * 100)
                        : 0;
                    return (
                      <div key={lot.lotId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground truncate max-w-[160px]">
                            {lot.parkingName}
                          </span>
                          <span className="font-bold text-foreground">
                            ₹{lot.revenue.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right">
                          {lot.transactions} transactions ({pct}%)
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-6 text-center">No facility revenue records</p>
              )}
            </CardContent>
          </Card>

          {/* Payout & Settlement Information Card */}
          <Card className="border border-indigo-500/30 bg-indigo-500/5 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Payout &amp; Settlement Info
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {overviewData?.payoutInfo.note}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-indigo-500/20 text-muted-foreground">
              <span>Cadence: <strong>{overviewData?.payoutInfo.settlementCadence}</strong></span>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-500 text-[10px]">
                {overviewData?.payoutInfo.status}
              </Badge>
            </div>
          </Card>
        </div>
      </div>

      {/* 5. PAYMENT BREAKDOWN TRANSACTION TABLE */}
      <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Payment Transaction Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Itemized audit ledger of booking fees, extensions, overstay charges, and refund adjustments
            </CardDescription>
          </div>

          <Badge variant="outline" className="font-mono text-xs h-6 px-2.5">
            Total {txData?.total || 0} Records
          </Badge>
        </CardHeader>

        {/* Table Filters Bar */}
        <div className="p-4 bg-muted/20 border-b border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search reference or txn ID..."
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {/* Status Filter */}
            <select
              value={txStatus}
              onChange={(e) => {
                setTxStatus(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="SUCCESSFUL">Successful</option>
              <option value="PENDING">Pending</option>
              <option value="REFUNDED">Refunded</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Type Filter */}
            <select
              value={txType}
              onChange={(e) => {
                setTxType(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="BOOKING">Booking</option>
              <option value="EXTENSION">Extension</option>
              <option value="OVERSTAY">Overstay</option>
            </select>

            {/* Method Filter */}
            <select
              value={txMethod}
              onChange={(e) => {
                setTxMethod(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="RAZORPAY">Razorpay</option>
              <option value="CASH">Cash at Exit</option>
            </select>
          </div>
        </div>

        {/* Transactions Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingTx ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : txData?.transactions?.length ? (
                txData.transactions.map((tx: OwnerPaymentTransactionItem) => (
                  <tr key={tx._id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">
                      {tx.paymentReference}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {tx.bookingReference}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-[140px] truncate">
                      {tx.parkingLotName}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="font-semibold block">{tx.customerName}</span>
                      <span className="text-[10px] text-muted-foreground block">{tx.customerPhone || tx.customerEmail || ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] font-semibold py-0">
                        {tx.paymentType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                      {tx.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-foreground">
                      ₹{tx.amount.toLocaleString('en-IN')}
                      {tx.refundAmount > 0 && (
                        <span className="block text-[10px] text-amber-600 font-semibold">
                          Ref: ₹{tx.refundAmount.toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={cn(
                          'text-[10px] font-bold uppercase py-0.5',
                          tx.paymentStatus === 'SUCCESSFUL' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                          tx.paymentStatus === 'PENDING' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                          tx.paymentStatus === 'REFUNDED' && 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
                          tx.paymentStatus === 'FAILED' && 'bg-destructive/15 text-destructive border-destructive/30',
                        )}
                      >
                        {tx.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-[11px]">
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground space-y-2">
                    <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">No Transactions Found</p>
                    <p className="text-xs">No payment records match your active facility and status filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {txData && txData.totalPages > 1 && (
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, txData.total)} of {txData.total} records
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs px-3"
              >
                Previous
              </Button>
              <span className="px-2 font-semibold">
                Page {page} of {txData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= txData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 text-xs px-3"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OwnerRevenuePage;
