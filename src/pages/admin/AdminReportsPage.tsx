import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  adminInsightsApi,
  type AdminReportQueryParams,
  type AdminReportResult,
  type InsightsFilterOptions,
} from '@/api/adminInsights.api';
import { AdminInsightsNav } from '@/components/admin/AdminInsightsNav';
import { useLiveSync } from '@/hooks/useLiveSync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPdfManifestTable,
  openParkEasePdfPrintWindow,
} from '@/lib/pdfThemeHelper';

type ReportType = 'revenue' | 'occupancy' | 'parking_usage' | 'customer' | 'booking';

const REPORT_TABS: Array<{ id: ReportType; label: string; icon: React.ElementType; description: string }> = [
  {
    id: 'revenue',
    label: 'Revenue Report',
    icon: TrendingUp,
    description: 'Gross platform revenue, transaction fees, refunds, and payment reconciliations.',
  },
  {
    id: 'occupancy',
    label: 'Occupancy Report',
    icon: Layers,
    description: 'Live and historical bay occupancy rates across registered parking facilities.',
  },
  {
    id: 'parking_usage',
    label: 'Parking Usage Report',
    icon: Building2,
    description: 'Vehicle entry/exit logs, stay durations, overstays, and vehicle type turnover.',
  },
  {
    id: 'customer',
    label: 'Customer Report',
    icon: Users,
    description: 'Customer registration growth, booking activity, and lifetime platform spend.',
  },
  {
    id: 'booking',
    label: 'Booking Report',
    icon: FileText,
    description: 'Complete booking ledger including Online and Walk-in customer sessions.',
  },
];

export const AdminReportsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Report Type
  const reportParam = (searchParams.get('type') as ReportType) || 'revenue';
  const [selectedReport, setSelectedReport] = useState<ReportType>(reportParam);

  // Filter States
  const [dateFrom, setDateFrom] = useState<string>(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState<string>(searchParams.get('dateTo') || '');
  const [parkingLotId, setParkingLotId] = useState<string>(searchParams.get('parkingLotId') || 'ALL');
  const [ownerId, setOwnerId] = useState<string>(searchParams.get('ownerId') || 'ALL');
  const [bookingStatus, setBookingStatus] = useState<string>(searchParams.get('bookingStatus') || 'ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>(searchParams.get('paymentStatus') || 'ALL');
  const [bookingType, setBookingType] = useState<string>(searchParams.get('bookingType') || 'ALL');
  const [vehicleType, setVehicleType] = useState<string>(searchParams.get('vehicleType') || 'ALL');

  // Pagination
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [limit] = useState<number>(Number(searchParams.get('limit')) || 20);

  // Options
  const [filterOptions, setFilterOptions] = useState<InsightsFilterOptions>({
    parkingLots: [],
    owners: [],
  });

  // Data & Loading States
  const [reportResult, setReportResult] = useState<AdminReportResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Filter Dropdowns
  useEffect(() => {
    adminInsightsApi
      .getFilterOptions()
      .then((opts) => setFilterOptions(opts))
      .catch((err) => console.error('Failed to load filter options:', err));
  }, []);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('type', selectedReport);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (parkingLotId !== 'ALL') params.set('parkingLotId', parkingLotId);
    if (ownerId !== 'ALL') params.set('ownerId', ownerId);
    if (bookingStatus !== 'ALL') params.set('bookingStatus', bookingStatus);
    if (paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
    if (bookingType !== 'ALL') params.set('bookingType', bookingType);
    if (vehicleType !== 'ALL') params.set('vehicleType', vehicleType);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    setSearchParams(params, { replace: true });
  }, [
    selectedReport,
    dateFrom,
    dateTo,
    parkingLotId,
    ownerId,
    bookingStatus,
    paymentStatus,
    bookingType,
    vehicleType,
    page,
    limit,
    setSearchParams,
  ]);

  // Fetch Report Data from Authoritative Backend
  const generateReport = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const queryParams: AdminReportQueryParams = {
        reportType: selectedReport,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        parkingLotId: parkingLotId !== 'ALL' ? parkingLotId : undefined,
        ownerId: ownerId !== 'ALL' ? ownerId : undefined,
        bookingStatus: bookingStatus !== 'ALL' ? bookingStatus : undefined,
        paymentStatus: paymentStatus !== 'ALL' ? paymentStatus : undefined,
        bookingType: bookingType !== 'ALL' ? bookingType : undefined,
        vehicleType: vehicleType !== 'ALL' ? vehicleType : undefined,
        page,
        limit,
      };

      const result = await adminInsightsApi.getReportData(queryParams);
      setReportResult(result);
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      if (!isSilent) {
        const msg = err.response?.data?.message || 'Report generation failed.';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [
    selectedReport,
    dateFrom,
    dateTo,
    parkingLotId,
    ownerId,
    bookingStatus,
    paymentStatus,
    bookingType,
    vehicleType,
    page,
    limit,
  ]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  useLiveSync(() => {
    void generateReport(true);
  });

  const handleReportTypeChange = (type: ReportType) => {
    setSelectedReport(type);
    setPage(1);
  };

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setParkingLotId('ALL');
    setOwnerId('ALL');
    setBookingStatus('ALL');
    setPaymentStatus('ALL');
    setBookingType('ALL');
    setVehicleType('ALL');
    setPage(1);
  };

  // Export CSV Action
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await adminInsightsApi.exportReportCsv({
        reportType: selectedReport,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        parkingLotId: parkingLotId !== 'ALL' ? parkingLotId : undefined,
        ownerId: ownerId !== 'ALL' ? ownerId : undefined,
        bookingStatus: bookingStatus !== 'ALL' ? bookingStatus : undefined,
        paymentStatus: paymentStatus !== 'ALL' ? paymentStatus : undefined,
        bookingType: bookingType !== 'ALL' ? bookingType : undefined,
        vehicleType: vehicleType !== 'ALL' ? vehicleType : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parkease-${selectedReport}-report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('CSV report downloaded successfully.');
    } catch (err: any) {
      toast.error('Failed to export CSV report.');
    } finally {
      setExportingCsv(false);
    }
  };

  // Export PDF Action
  const handleExportPdf = () => {
    if (!reportResult) return;

    const manifestTableHtml = createPdfManifestTable(
      reportResult.columns.map((c) => ({
        header: c.label,
        align: (c.align as 'left' | 'center' | 'right') || 'left',
      })),
      reportResult.rows.map((row: Record<string, any>) =>
        reportResult.columns.map((c) => ({
          content: String(row[c.key] ?? 'N/A'),
          align: (c.align as 'left' | 'center' | 'right') || 'left',
        }))
      ),
    );

    // Format metadata summary cards
    const summaryCards = Object.entries(reportResult.summary).map(([k, v]) => ({
      label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
      value: typeof v === 'number' && k.toLowerCase().includes('revenue') ? `₹${v.toLocaleString()}` : String(v),
    }));

    openParkEasePdfPrintWindow({
      docTitle: `Official ${reportResult.reportType}`,
      docSubtitle: `System-generated compliance report. Period: ${reportResult.dateRange.start} — ${reportResult.dateRange.end}`,
      statusPill: {
        text: 'Authoritative Verified Report',
        variant: 'blue',
      },
      metaCards: summaryCards.slice(0, 4),
      bodyHtml: manifestTableHtml,
      footerNotes: [
        'ParkEase Platform Administration Compliance & Governance Division.',
        'This report is generated directly from authoritative database records.',
        'Document ID: REF-' + Date.now().toString(36).toUpperCase(),
      ],
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & SUB-NAVIGATION */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Platform Reports Center
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Generate and export operational, financial, occupancy, and customer reports from authoritative records.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <AdminInsightsNav />
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. REPORT TYPE SELECTOR PILLS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleReportTypeChange(tab.id)}
              className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                  : 'border-border/80 bg-card hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                {isSelected && <Badge className="text-[9px] px-1 py-0 bg-primary">Active</Badge>}
              </div>
              <div>
                <p className={`text-xs font-bold ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>
                  {tab.label}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-tight">
                  {tab.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. DYNAMIC REPORT FILTERS PANEL */}
      {/* --------------------------------------------------------------------- */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Filter className="h-4 w-4 text-primary" />
              Dynamic Report Criteria
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-muted-foreground h-7 px-2 gap-1 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Date From */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="h-8 text-xs"
              />
            </div>

            {/* Parking Lot (Revenue, Occupancy, Usage, Booking) */}
            {(selectedReport === 'revenue' ||
              selectedReport === 'occupancy' ||
              selectedReport === 'parking_usage' ||
              selectedReport === 'booking') && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Parking Facility</label>
                <Select value={parkingLotId} onValueChange={(val) => { setParkingLotId(val); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Facilities" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="ALL">All Facilities</SelectItem>
                    {filterOptions.parkingLots.map((lot) => (
                      <SelectItem key={lot._id} value={lot._id}>
                        {lot.parkingName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Parking Owner (Revenue, Occupancy, Booking) */}
            {(selectedReport === 'revenue' || selectedReport === 'occupancy' || selectedReport === 'booking') && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Parking Owner</label>
                <Select value={ownerId} onValueChange={(val) => { setOwnerId(val); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Owners" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="ALL">All Owners</SelectItem>
                    {filterOptions.owners.map((owner) => (
                      <SelectItem key={owner._id} value={owner._id}>
                        {owner.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment Status (Revenue, Booking) */}
            {(selectedReport === 'revenue' || selectedReport === 'booking') && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Payment Status</label>
                <Select value={paymentStatus} onValueChange={(val) => { setPaymentStatus(val); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Payment Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Payment Statuses</SelectItem>
                    <SelectItem value="SUCCESSFUL">SUCCESSFUL</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                    <SelectItem value="FAILED">FAILED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Booking Status (Booking) */}
            {selectedReport === 'booking' && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Booking Status</label>
                <Select value={bookingStatus} onValueChange={(val) => { setBookingStatus(val); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Booking Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Overstay">Overstay</SelectItem>
                    <SelectItem value="No Show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Booking Type (Revenue, Usage, Booking) */}
            {(selectedReport === 'revenue' || selectedReport === 'parking_usage' || selectedReport === 'booking') && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Booking Type</label>
                <Select value={bookingType} onValueChange={(val) => { setBookingType(val); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Booking Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Booking Types</SelectItem>
                    <SelectItem value="ONLINE">Online Mobile App</SelectItem>
                    <SelectItem value="WALK_IN">Barrier Walk-in Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-md">
          {error}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. SUMMARY METRIC CARDS */}
      {/* --------------------------------------------------------------------- */}
      {reportResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(reportResult.summary).map(([key, value]) => {
            const formattedLabel = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
            const isRevenue = key.toLowerCase().includes('revenue') || key.toLowerCase().includes('fees') || key.toLowerCase().includes('spent');
            return (
              <Card key={key} className="p-3 border-border/80 bg-card shadow-xs">
                <p className="text-[11px] font-semibold text-muted-foreground">{formattedLabel}</p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {typeof value === 'number' && isRevenue ? `₹${value.toLocaleString()}` : String(value)}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. REPORT DATA TABLE & EXPORTS */}
      {/* --------------------------------------------------------------------- */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {reportResult?.reportType || 'Report Ledger'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Authoritative records generated {reportResult ? new Date(reportResult.generatedAt).toLocaleTimeString() : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv || loading || !reportResult || reportResult.rows.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={loading || !reportResult || reportResult.rows.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              Print / PDF
            </Button>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                {reportResult?.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={reportResult?.columns.length || 8} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Generating authoritative backend report...
                  </td>
                </tr>
              ) : !reportResult || reportResult.rows.length === 0 ? (
                <tr>
                  <td colSpan={reportResult?.columns.length || 8} className="py-12 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-foreground">No records matched the selected criteria</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Try clearing filters or selecting a broader date range.
                    </p>
                  </td>
                </tr>
              ) : (
                reportResult.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    {reportResult.columns.map((col) => {
                      const val = row[col.key];
                      const isAmount = col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('gross') || col.key.toLowerCase().includes('fee') || col.key.toLowerCase().includes('spent');

                      return (
                        <td
                          key={col.key}
                          className={`py-3 px-4 whitespace-nowrap ${
                            col.align === 'right'
                              ? 'text-right font-medium'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          {col.key.toLowerCase().includes('status') ? (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {val}
                            </Badge>
                          ) : col.key.toLowerCase().includes('ref') ? (
                            <span className="font-mono text-[11px] font-semibold">{val}</span>
                          ) : isAmount && typeof val === 'number' ? (
                            `₹${val.toLocaleString()}`
                          ) : (
                            String(val ?? 'N/A')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-side Pagination Bar */}
        {reportResult && (
          <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing {reportResult.pagination.total === 0 ? 0 : (page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, reportResult.pagination.total)} of {reportResult.pagination.total} records
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-7 text-xs px-2"
              >
                <ChevronLeft className="h-3 w-3 mr-0.5" />
                Previous
              </Button>
              <span className="text-foreground font-semibold px-2">
                Page {page} of {reportResult.pagination.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(reportResult.pagination.totalPages, p + 1))}
                disabled={page >= reportResult.pagination.totalPages || loading}
                className="h-7 text-xs px-2"
              >
                Next
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminReportsPage;
