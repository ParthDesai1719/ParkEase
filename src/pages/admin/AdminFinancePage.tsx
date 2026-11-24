import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  History,
  Layers,
  Percent,
  Printer,
  RefreshCw,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  adminFinanceApi,
  type AdminFinanceOverview,
  type AdminPaymentListItem,
  type AdminPaymentDetailData,
  type FinanceFilterOptions,
} from '@/api/adminFinance.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createPdfManifestTable,
  createPdfSectionBlock,
  openParkEasePdfPrintWindow,
} from '@/lib/pdfThemeHelper';

export const AdminFinancePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab: 'ledger' (Transactions Directory) vs 'analytics' (Charts & Overview)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics'>(
    tabParam === 'analytics' ? 'analytics' : 'ledger',
  );

  const handleTabChange = (tab: 'ledger' | 'analytics') => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // =========================================================================
  // STATE: OVERVIEW & FILTERS
  // =========================================================================
  const [overview, setOverview] = useState<AdminFinanceOverview>({
    totalRevenue: 0,
    netRevenue: 0,
    totalRefunded: 0,
    platformFeesCollected: 0,
    totalTransactions: 0,
    successfulTransactions: 0,
    refundedTransactions: 0,
    pendingTransactions: 0,
    failedTransactions: 0,
    cashReversalPendingTransactions: 0,
    successRatePercentage: 0,
    paymentMethods: {
      razorpay: { count: 0, amount: 0, percentage: 0 },
      cash: { count: 0, amount: 0, percentage: 0 },
    },
    paymentTypes: {
      booking: { count: 0, amount: 0 },
      extension: { count: 0, amount: 0 },
      overstay: { count: 0, amount: 0 },
      ownerRegistration: { count: 0, amount: 0 },
    },
    paymentStatusDistribution: [],
    refundStatusDistribution: [],
    revenueTrend: [],
  });

  const [, setOverviewLoading] = useState<boolean>(true);
  const [filterOptions, setFilterOptions] = useState<FinanceFilterOptions>({
    parkingLots: [],
    owners: [],
  });

  // Query state derived from searchParams
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.max(1, Number(searchParams.get('limit')) || 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'ALL';
  const paymentType = searchParams.get('paymentType') || 'ALL';
  const paymentMethod = searchParams.get('paymentMethod') || 'ALL';
  const parkingLotId = searchParams.get('parkingLotId') || 'ALL';
  const ownerId = searchParams.get('ownerId') || 'ALL';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  // Local state for 350ms debounced search
  const [searchInput, setSearchInput] = useState<string>(search);

  // Sync search input if URL changes
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        const next = new URLSearchParams(searchParams);
        if (searchInput.trim()) {
          next.set('search', searchInput.trim());
        } else {
          next.delete('search');
        }
        next.set('page', '1');
        setSearchParams(next);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, search, searchParams, setSearchParams]);

  // =========================================================================
  // STATE: PAYMENTS LEDGER LIST
  // =========================================================================
  const [payments, setPayments] = useState<AdminPaymentListItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState<boolean>(true);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  // =========================================================================
  // STATE: SINGLE PAYMENT DOSSIER MODAL
  // =========================================================================
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentDossier, setPaymentDossier] = useState<AdminPaymentDetailData | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch Filter Dropdowns
  useEffect(() => {
    adminFinanceApi
      .getFilterOptions()
      .then(setFilterOptions)
      .catch((err) => console.warn('Failed to load finance filter options:', err));
  }, []);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await adminFinanceApi.getOverview({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        parkingLotId: parkingLotId !== 'ALL' ? parkingLotId : undefined,
        ownerId: ownerId !== 'ALL' ? ownerId : undefined,
        paymentType: paymentType !== 'ALL' ? paymentType : undefined,
        paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
      });
      setOverview(data);
    } catch (err) {
      console.warn('Failed to load finance overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, [dateFrom, dateTo, parkingLotId, ownerId, paymentType, paymentMethod]);

  // Fetch Payments Table Data
  const fetchPayments = useCallback(async (isSilent = false) => {
    if (!isSilent) setPaymentsLoading(true);
    try {
      const res = await adminFinanceApi.getPayments({
        page,
        limit,
        search: search || undefined,
        status: status !== 'ALL' ? status : undefined,
        paymentType: paymentType !== 'ALL' ? paymentType : undefined,
        paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
        parkingLotId: parkingLotId !== 'ALL' ? parkingLotId : undefined,
        ownerId: ownerId !== 'ALL' ? ownerId : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setPayments(res.payments);
      setTotalPages(res.pagination.totalPages);
      setTotalRecords(res.pagination.total);
    } catch (err) {
      console.warn('Failed to load payments ledger:', err);
    } finally {
      if (!isSilent) setPaymentsLoading(false);
    }
  }, [page, limit, search, status, paymentType, paymentMethod, parkingLotId, ownerId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOverview();
    void fetchPayments();
  }, [fetchOverview, fetchPayments]);

  useLiveSync(() => {
    void fetchOverview();
    void fetchPayments(true);
  });

  // Handle Filter Change
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'ALL') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    const next = new URLSearchParams();
    if (activeTab === 'analytics') {
      next.set('tab', 'analytics');
    }
    setSearchParams(next);
  };

  // Open Payment Dossier
  const handleOpenDossier = async (id: string) => {
    setSelectedPaymentId(id);
    setDossierLoading(true);
    setPaymentDossier(null);
    try {
      const data = await adminFinanceApi.getPaymentById(id);
      setPaymentDossier(data);
    } catch (err) {
      console.warn('Failed to load payment dossier:', err);
    } finally {
      setDossierLoading(false);
    }
  };

  const handleCopyText = (text: string, fieldName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export CSV
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await adminFinanceApi.exportCsv({
        search: search || undefined,
        status: status !== 'ALL' ? status : undefined,
        paymentType: paymentType !== 'ALL' ? paymentType : undefined,
        paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
        parkingLotId: parkingLotId !== 'ALL' ? parkingLotId : undefined,
        ownerId: ownerId !== 'ALL' ? ownerId : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `parkease-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('CSV export error:', err);
    } finally {
      setExportingCsv(false);
    }
  };

  // Export PDF Manifest
  const handlePrintManifest = () => {
    if (payments.length === 0) return;

    const tableRows = payments.map((p) => [
      { content: p.paymentReference, isMono: true },
      { content: p.paymentType },
      {
        content: p.customer?.fullName || p.owner?.fullName || p.ownerApplication?.businessName || 'Anonymous / Walk-in',
      },
      { content: p.parkingLot?.parkingName || (p.paymentTypeCode === 'OWNER_REGISTRATION' ? 'Platform Partner' : 'N/A') },
      { content: p.paymentMethod, align: 'center' as const },
      { content: `₹${p.amount.toFixed(2)}`, align: 'right' as const, isMono: true },
      { content: p.paymentStatus, align: 'center' as const },
      { content: p.refundWorkflowState || '—', align: 'center' as const },
      {
        content: p.paymentDate
          ? new Date(p.paymentDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
        align: 'right' as const,
      },
    ]);

    const columns = [
      { header: 'Payment Ref', width: '16%' },
      { header: 'Type', width: '12%' },
      { header: 'Customer / Payer', width: '16%' },
      { header: 'Facility / Entity', width: '16%' },
      { header: 'Method', width: '8%', align: 'center' as const },
      { header: 'Amount', width: '10%', align: 'right' as const },
      { header: 'Status', width: '8%', align: 'center' as const },
      { header: 'Refund State', width: '10%', align: 'center' as const },
      { header: 'Date', width: '10%', align: 'right' as const },
    ];

    const tableHtml = createPdfManifestTable(columns, tableRows);

    openParkEasePdfPrintWindow({
      docTitle: 'Platform Financial Transactions Manifest',
      docSubtitle: 'ParkEase Unified Payment & Revenue Ledger',
      documentId: `FIN-MANIFEST-${new Date().toISOString().slice(0, 10)}`,
      statusPill: {
        text: `${status === 'ALL' ? 'All Statuses' : status} (${payments.length} items)`,
        variant: status === 'SUCCESSFUL' ? 'green' : status === 'REFUNDED' ? 'blue' : status === 'FAILED' ? 'red' : 'amber',
      },
      metaCards: [
        { label: 'Gross Revenue', value: `₹${overview.totalRevenue.toLocaleString()}`, subtext: 'Gross settlements' },
        { label: 'Net Revenue', value: `₹${overview.netRevenue.toLocaleString()}`, subtext: 'After refunds' },
        { label: 'Total Refunds', value: `₹${overview.totalRefunded.toLocaleString()}`, subtext: `${overview.refundedTransactions} reversed` },
        { label: 'Platform Fees', value: `₹${overview.platformFeesCollected.toLocaleString()}`, subtext: 'System booking fees' },
      ],
      bodyHtml: `
        <div style="margin-bottom:14px;font-size:12px;color:#475569;display:flex;justify-content:space-between;align-items:center;">
          <div><strong>Filter Scope:</strong> Status: ${status} &bull; Method: ${paymentMethod} &bull; Type: ${paymentType}</div>
          <div>Page ${page} of ${totalPages} (Total ${totalRecords} records)</div>
        </div>
        ${tableHtml}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management System &bull; Confidential Financial Operations Ledger',
        'Official record for financial accounting, audit trail compliance, and payment reconciliations.',
      ],
    });
  };

  // Export Single Transaction Voucher PDF
  const handlePrintVoucher = (d: AdminPaymentDetailData) => {
    const txSection = createPdfSectionBlock('Transaction Identification & Gateway References', [
      { label: 'Payment Reference', value: d.paymentReference, isMono: true },
      { label: 'Transaction ID', value: d.transactionId || 'N/A', isMono: true },
      { label: 'Gateway Order ID', value: d.gatewayOrderId || 'N/A', isMono: true },
      { label: 'Gateway Payment ID', value: d.gatewayPaymentId || 'N/A', isMono: true },
      { label: 'Payment Type', value: d.paymentType },
      { label: 'Payment Method', value: d.paymentMethod === 'RAZORPAY' ? 'Razorpay Online Gateway' : 'Gate Barrier Cash' },
      { label: 'Canonical Status', value: d.paymentStatus },
      { label: 'Refund Workflow State', value: d.refundWorkflowState || 'None' },
      { label: 'Created At', value: new Date(d.createdAt).toLocaleString() },
      { label: 'Settlement Date', value: d.paymentDate ? new Date(d.paymentDate).toLocaleString() : 'N/A' },
    ]);

    const financialSection = createPdfSectionBlock('Financial Settlement Ledger', [
      { label: 'Gross Transaction Amount', value: `₹${d.amount.toFixed(2)}`, isTotal: true },
      { label: 'Platform Booking Fee', value: `₹${d.platformBookingFee.toFixed(2)}` },
      { label: 'Additional / Overstay Charges', value: `₹${d.additionalCharges.toFixed(2)}` },
      { label: 'Settled Refund Amount', value: `₹${d.refundAmount.toFixed(2)}` },
      {
        label: 'Net Retained Amount',
        value: `₹${Math.max(0, d.amount - d.refundAmount).toFixed(2)}`,
        isTotal: true,
      },
    ]);

    const partySection = createPdfSectionBlock('Associated Customer & Facility Context', [
      { label: 'Payer / Customer Name', value: d.customer?.fullName || d.owner?.fullName || 'N/A' },
      { label: 'Payer Email', value: d.customer?.email || d.owner?.email || 'N/A' },
      { label: 'Contact Mobile', value: d.customer?.mobileNumber || d.owner?.mobileNumber || 'N/A' },
      { label: 'Parking Facility', value: d.parkingLot?.parkingName || (d.paymentTypeCode === 'OWNER_REGISTRATION' ? 'Partner Onboarding' : 'N/A') },
      { label: 'Booking Reference', value: d.booking?.bookingReference || d.ownerApplication?.applicationReference || 'N/A', isMono: true },
      ...(d.bookingDetails?.vehicle?.plateNumber
        ? [{ label: 'Vehicle Plate', value: d.bookingDetails.vehicle.plateNumber, isMono: true }]
        : []),
      ...(d.bookingDetails?.parkingSlot?.slotNumber
        ? [{ label: 'Allocated Bay', value: d.bookingDetails.parkingSlot.slotNumber }]
        : []),
    ]);

    openParkEasePdfPrintWindow({
      docTitle: 'Official Payment Receipt & Financial Voucher',
      docSubtitle: 'ParkEase Smart Parking Platform Financial Settlement',
      documentId: d.paymentReference,
      statusPill: {
        text: d.paymentStatus,
        variant: d.paymentStatus === 'SUCCESSFUL' ? 'green' : d.paymentStatus === 'REFUNDED' ? 'blue' : d.paymentStatus === 'FAILED' ? 'red' : 'amber',
      },
      metaCards: [
        { label: 'Gross Amount', value: `₹${d.amount.toFixed(2)}`, subtext: d.paymentMethod },
        { label: 'Platform Fee', value: `₹${d.platformBookingFee.toFixed(2)}`, subtext: 'Fixed System Fee' },
        { label: 'Refund Amount', value: `₹${d.refundAmount.toFixed(2)}`, subtext: d.refundWorkflowState || 'None' },
        { label: 'Payment Status', value: d.paymentStatus, subtext: 'Authoritative' },
      ],
      bodyHtml: `
        ${txSection}
        ${financialSection}
        ${partySection}
      `,
      footerNotes: [
        'ParkEase Smart Parking Management System &bull; Authoritative Financial Transaction Voucher',
        'Confidential document generated for audit and reconciliation purposes. Simulated refunds apply in Version 1.',
      ],
    });
  };

  // Status Badge Renderers
  const renderPaymentStatusBadge = (st: string) => {
    switch (st) {
      case 'SUCCESSFUL':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" />
            SUCCESSFUL
          </Badge>
        );
      case 'REFUNDED':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold gap-1 text-[11px]">
            <ArrowDownLeft className="h-3 w-3" />
            REFUNDED
          </Badge>
        );
      case 'CASH_REVERSAL_PENDING':
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            CASH REVERSAL PENDING
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            PENDING
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold gap-1 text-[11px]">
            <XCircle className="h-3 w-3" />
            FAILED
          </Badge>
        );
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  };

  const renderRefundWorkflowBadge = (rf?: string | null) => {
    if (!rf) return <span className="text-muted-foreground text-[11px]">—</span>;
    switch (rf) {
      case 'Refund Completed':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Refund Completed
          </Badge>
        );
      case 'Refund Processing':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] animate-pulse">
            Refund Processing
          </Badge>
        );
      case 'Refund Pending':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px]">
            Refund Pending
          </Badge>
        );
      case 'Refund Failed':
        return (
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
            Refund Failed
          </Badge>
        );
      default:
        return <span className="text-muted-foreground text-[11px]">{rf}</span>;
    }
  };

  // Pie chart colors
  const METHOD_COLORS = ['#3b82f6', '#10b981'];
  const STATUS_COLORS: Record<string, string> = {
    SUCCESSFUL: '#10b981',
    REFUNDED: '#3b82f6',
    CASH_REVERSAL_PENDING: '#8b5cf6',
    PENDING: '#f59e0b',
    FAILED: '#ef4444',
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. BREADCRUMBS & FINANCE HEADER */}
      <div className="space-y-3">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
            Admin Dashboard
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-muted-foreground">Governance</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Finance &amp; Payments</span>
        </nav>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                Finance &amp; Payments Management
              </h1>
              <p className="text-sm text-muted-foreground">
                Platform-wide financial settlements, multi-method payments, revenue analytics, and auditable refund tracking.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exportingCsv || paymentsLoading}
                className="gap-1.5 text-xs h-9"
                title="Export filtered transactions to CSV"
              >
                <Download className={`h-4 w-4 ${exportingCsv ? 'animate-spin' : ''}`} />
                Export CSV
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintManifest}
                disabled={payments.length === 0}
                className="gap-1.5 text-xs h-9"
                title="Print or export official PDF manifest"
              >
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
            </div>
          </div>

          {/* Unified Finance Tabs */}
          <div className="flex items-center gap-2 border-b border-border/80 pb-2">
            <button
              onClick={() => handleTabChange('ledger')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'ledger'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Transactions Ledger
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {overview.totalTransactions}
              </Badge>
            </button>

            <button
              onClick={() => handleTabChange('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Financial Analytics &amp; Charts
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP 6 FINANCIAL OVERVIEW KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Gross Revenue */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Gross Revenue
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              ₹{overview.totalRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Successful + Refunded</p>
          </CardContent>
        </Card>

        {/* Net Revenue */}
        <Card className="border border-border/60 shadow-xs bg-emerald-500/5">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              Net Revenue
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 font-mono">
              ₹{overview.netRevenue.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Retained platform cash</p>
          </CardContent>
        </Card>

        {/* Total Refunds */}
        <Card className="border border-border/60 shadow-xs bg-blue-500/5">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center justify-between">
              Total Refunds
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300 font-mono">
              ₹{overview.totalRefunded.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Simulated reversal v1</p>
          </CardContent>
        </Card>

        {/* Platform Fees */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Platform Fees
              <Percent className="h-4 w-4 text-primary" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              ₹{overview.platformFeesCollected.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">System fee collection</p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Success Rate
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {overview.successRatePercentage}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              {overview.successfulTransactions + overview.refundedTransactions} of {overview.totalTransactions}
            </p>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Transactions
              <Layers className="h-4 w-4 text-primary" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {overview.totalTransactions}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {overview.failedTransactions} failed &bull; {overview.pendingTransactions} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* =================================================================== */}
      {/* 3. TAB 1: TRANSACTIONS DIRECTORY (LEDGER) */}
      {/* =================================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search Transaction ID, Payment Ref, Booking Ref, Customer, Plate..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                  {searchInput && (
                    <button
                      onClick={() => setSearchInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="w-full md:w-44">
                  <Select value={status} onValueChange={(val) => updateFilter('status', val)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Payment Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="SUCCESSFUL">Successful</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="REFUNDED">Refunded</SelectItem>
                      <SelectItem value="CASH_REVERSAL_PENDING">Cash Reversal Pending</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Type Filter */}
                <div className="w-full md:w-44">
                  <Select value={paymentType} onValueChange={(val) => updateFilter('paymentType', val)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Payment Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="BOOKING">Booking</SelectItem>
                      <SelectItem value="EXTENSION">Extension</SelectItem>
                      <SelectItem value="OVERSTAY">Overstay</SelectItem>
                      <SelectItem value="OWNER_REGISTRATION">Owner Registration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method Filter */}
                <div className="w-full md:w-36">
                  <Select value={paymentMethod} onValueChange={(val) => updateFilter('paymentMethod', val)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Methods</SelectItem>
                      <SelectItem value="RAZORPAY">Razorpay</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Secondary Filter Row */}
              <div className="flex flex-col gap-3 md:flex-row md:items-center pt-1 border-t border-border/50 text-xs">
                {/* Parking Lot Filter */}
                <div className="flex-1">
                  <Select value={parkingLotId} onValueChange={(val) => updateFilter('parkingLotId', val)}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="All Parking Facilities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Facilities</SelectItem>
                      {filterOptions.parkingLots.map((l) => (
                        <SelectItem key={l._id} value={l._id}>
                          {l.parkingName} {l.city ? `(${l.city})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Owner Filter */}
                <div className="flex-1">
                  <Select value={ownerId} onValueChange={(val) => updateFilter('ownerId', val)}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="All Parking Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Owners</SelectItem>
                      {filterOptions.owners.map((o) => (
                        <SelectItem key={o._id} value={o._id}>
                          {o.fullName} ({o.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                    className="text-xs h-8 w-36"
                    title="From Date"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                    className="text-xs h-8 w-36"
                    title="To Date"
                  />
                </div>

                {/* Reset Filters */}
                {(search || status !== 'ALL' || paymentType !== 'ALL' || paymentMethod !== 'ALL' || parkingLotId !== 'ALL' || ownerId !== 'ALL' || dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="text-xs h-8 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border border-border/60 shadow-xs bg-card overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Transaction ID / Ref</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Payer / Customer</th>
                      <th className="px-4 py-3">Facility / Context</th>
                      <th className="px-4 py-3 text-center">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Payment Status</th>
                      <th className="px-4 py-3 text-center">Refund State</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {paymentsLoading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          Loading financial transactions ledger...
                        </td>
                      </tr>
                    ) : payments.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="font-medium text-foreground">No financial transactions found</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Try adjusting your search criteria, date range, or active filters.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p._id} className="hover:bg-muted/40 transition-colors">
                          {/* Reference */}
                          <td className="px-4 py-3">
                            <div className="font-mono font-semibold text-foreground flex items-center gap-1">
                              {p.transactionId || p.paymentReference}
                              <button
                                onClick={() => handleCopyText(p.transactionId || p.paymentReference, p._id)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy reference"
                              >
                                {copiedField === p._id ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              Ref: {p.paymentReference}
                            </div>
                          </td>

                          {/* Payment Type */}
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] font-semibold">
                              {p.paymentTypeCode === 'OWNER_REGISTRATION'
                                ? 'Owner Fee'
                                : p.paymentTypeCode}
                            </Badge>
                          </td>

                          {/* Payer */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {p.customer?.fullName || p.owner?.fullName || p.ownerApplication?.businessName || 'Walk-in Customer'}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {p.customer?.email || p.owner?.email || p.customer?.mobileNumber || 'N/A'}
                            </div>
                          </td>

                          {/* Facility Context */}
                          <td className="px-4 py-3">
                            <div className="text-foreground">
                              {p.parkingLot?.parkingName || (p.paymentTypeCode === 'OWNER_REGISTRATION' ? 'Partner Onboarding' : 'N/A')}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {p.booking?.bookingReference || p.ownerApplication?.applicationReference || '—'}
                              {p.booking?.vehiclePlate ? ` • ${p.booking.vehiclePlate}` : ''}
                            </div>
                          </td>

                          {/* Method */}
                          <td className="px-4 py-3 text-center">
                            {p.paymentMethod === 'RAZORPAY' ? (
                              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] gap-1">
                                <CreditCard className="h-3 w-3" />
                                Razorpay
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
                                <Banknote className="h-3 w-3" />
                                Cash
                              </Badge>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            ₹{p.amount.toFixed(2)}
                            {p.refundAmount > 0 && (
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-sans font-normal">
                                Ref: ₹{p.refundAmount.toFixed(0)}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            {renderPaymentStatusBadge(p.paymentStatus)}
                          </td>

                          {/* Refund State */}
                          <td className="px-4 py-3 text-center">
                            {renderRefundWorkflowBadge(p.refundWorkflowState)}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.paymentDate
                              ? new Date(p.paymentDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDossier(p._id)}
                              className="h-7 w-7 p-0"
                              title="Inspect Complete Financial Dossier"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-xs">
                <div className="text-muted-foreground">
                  Showing {payments.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                  {Math.min(page * limit, totalRecords)} of {totalRecords} records
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || paymentsLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('page', String(page - 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || paymentsLoading}
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set('page', String(page + 1));
                      setSearchParams(next);
                    }}
                    className="h-7 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. TAB 2: FINANCIAL ANALYTICS & CHARTS */}
      {/* =================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row 1: Daily Revenue & Refunds Trend */}
          <Card className="border border-border/60 shadow-xs bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Revenue &amp; Refunds Settlement Timeline
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Daily time-series comparison of gross revenue receipts versus reversed refunds.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-emerald-500 inline-block" />
                    Gross Revenue (₹)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-blue-500 inline-block" />
                    Refunds (₹)
                  </div>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                {overview.revenueTrend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                    No time-series transaction records for selected range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overview.revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="refundGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          borderColor: 'var(--border)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#revenueGrad)"
                        name="Gross Revenue (₹)"
                      />
                      <Area
                        type="monotone"
                        dataKey="refunds"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#refundGrad)"
                        name="Refunded (₹)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Charts Row 2: Payment Methods & Status Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Methods Distribution */}
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-primary" />
                    Payment Method Volume &amp; Share
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Online gateway (Razorpay) vs Barrier Cash collection share.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="h-52 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Razorpay', value: overview.paymentMethods.razorpay.amount },
                            { name: 'Cash', value: overview.paymentMethods.cash.amount },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          <Cell fill={METHOD_COLORS[0]} />
                          <Cell fill={METHOD_COLORS[1]} />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col justify-center space-y-3 text-xs">
                    <div className="p-2.5 rounded-lg border border-border/60 bg-blue-500/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Razorpay Online</span>
                        <span className="font-mono font-bold">₹{overview.paymentMethods.razorpay.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {overview.paymentMethods.razorpay.count} txns &bull; {overview.paymentMethods.razorpay.percentage}% share
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg border border-border/60 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Barrier Cash</span>
                        <span className="font-mono font-bold">₹{overview.paymentMethods.cash.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {overview.paymentMethods.cash.count} txns &bull; {overview.paymentMethods.cash.percentage}% share
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Status Distribution */}
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    Authoritative Payment Status Distribution
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Canonical backend statuses and volume breakdowns.
                  </p>
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={overview.paymentStatusDistribution}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Transactions Count">
                        {overview.paymentStatusDistribution.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || '#64748b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 3: Payment Types & Refund Workflow States */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Types Breakdown */}
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Percent className="h-5 w-5 text-primary" />
                    Revenue by Payment Type
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Revenue breakdown across Booking, Extension, Overstay, and Partner Onboarding.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Booking */}
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Parking Booking</div>
                      <div className="text-[11px] text-muted-foreground">
                        {overview.paymentTypes.booking.count} reservations
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      ₹{overview.paymentTypes.booking.amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Extension */}
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Booking Extension</div>
                      <div className="text-[11px] text-muted-foreground">
                        {overview.paymentTypes.extension.count} extended stays
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      ₹{overview.paymentTypes.extension.amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Overstay */}
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Overstay Charges</div>
                      <div className="text-[11px] text-muted-foreground">
                        {overview.paymentTypes.overstay.count} gate settlements
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      ₹{overview.paymentTypes.overstay.amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Owner Registration */}
                  <div className="p-3 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-foreground">Owner Registration Fee</div>
                      <div className="text-[11px] text-muted-foreground">
                        {overview.paymentTypes.ownerRegistration.count} onboarded partners (₹999 fee)
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm">
                      ₹{overview.paymentTypes.ownerRegistration.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Refund Workflow States Breakdown */}
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Refund Workflow State Distribution
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Authoritative tracking of refund requests across lifecycle states.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {overview.refundStatusDistribution.map((rf) => (
                    <div
                      key={rf.status}
                      className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {renderRefundWorkflowBadge(rf.status)}
                        <span className="text-muted-foreground text-[11px]">
                          ({rf.count} requests &bull; {rf.percentage}%)
                        </span>
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        ₹{rf.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}

                  <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-[11px] space-y-1">
                    <strong>Version 1 Simulated Refund Policy:</strong> ParkEase Version 1 uses centralized simulated refunds. Stored refund ledgers preserve timestamps, percentages, reasons, and audit trails without representing simulated reversals as live bank transfers.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. TRANSACTION INSPECTION DOSSIER DIALOG */}
      {/* =================================================================== */}
      <Dialog
        open={Boolean(selectedPaymentId)}
        onOpenChange={(open) => !open && setSelectedPaymentId(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-primary">
                <CreditCard className="h-5 w-5" />
                Financial Transaction Dossier
              </span>
              {paymentDossier && renderPaymentStatusBadge(paymentDossier.paymentStatus)}
            </DialogTitle>
            <DialogDescription>
              Authoritative transaction audit record {paymentDossier?.paymentReference}.
            </DialogDescription>
          </DialogHeader>

          {dossierLoading ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              Loading complete transaction ledger...
            </div>
          ) : !paymentDossier ? (
            <div className="py-8 text-center text-rose-500 text-xs">
              Unable to load transaction dossier.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Financial Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-lg border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground">Gross Amount</div>
                  <div className="text-base font-bold font-mono text-foreground">
                    ₹{paymentDossier.amount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Platform Booking Fee</div>
                  <div className="text-base font-bold font-mono text-foreground">
                    ₹{paymentDossier.platformBookingFee.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Settled Refund</div>
                  <div className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                    ₹{paymentDossier.refundAmount.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Payment Method</div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    {paymentDossier.paymentMethod === 'RAZORPAY' ? (
                      <>
                        <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                        Razorpay
                      </>
                    ) : (
                      <>
                        <Banknote className="h-3.5 w-3.5 text-emerald-500" />
                        Gate Cash
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Transaction Gateway & References */}
              <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                  <Shield className="h-4 w-4 text-primary" />
                  Transaction Identification &amp; References
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Payment Reference: </span>
                    <strong className="font-mono">{paymentDossier.paymentReference}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transaction ID: </span>
                    <strong className="font-mono">{paymentDossier.transactionId || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gateway Order ID: </span>
                    <span className="font-mono">{paymentDossier.gatewayOrderId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gateway Payment ID: </span>
                    <span className="font-mono">{paymentDossier.gatewayPaymentId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment Type: </span>
                    <strong>{paymentDossier.paymentType}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gateway Signature: </span>
                    <span>{paymentDossier.gatewaySignatureProvided ? 'Verified (Secure)' : 'N/A (Cash)'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created Timestamp: </span>
                    <span>{new Date(paymentDossier.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Settlement Timestamp: </span>
                    <span>{paymentDossier.paymentDate ? new Date(paymentDossier.paymentDate).toLocaleString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Customer & Facility Context */}
              <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
                <h4 className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                  <User className="h-4 w-4 text-primary" />
                  Payer &amp; Facility Context
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Customer / Payer: </span>
                    <strong>{paymentDossier.customer?.fullName || paymentDossier.owner?.fullName || paymentDossier.ownerApplication?.businessName || 'Anonymous Walk-in'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payer Email: </span>
                    <span>{paymentDossier.customer?.email || paymentDossier.owner?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parking Facility: </span>
                    <strong>{paymentDossier.parkingLot?.parkingName || (paymentDossier.paymentTypeCode === 'OWNER_REGISTRATION' ? 'Partner Network' : 'N/A')}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Booking / Application Ref: </span>
                    <strong className="font-mono">{paymentDossier.booking?.bookingReference || paymentDossier.ownerApplication?.applicationReference || 'N/A'}</strong>
                  </div>
                  {paymentDossier.bookingDetails?.vehicle?.plateNumber && (
                    <div>
                      <span className="text-muted-foreground">Vehicle: </span>
                      <strong className="font-mono">{paymentDossier.bookingDetails.vehicle.plateNumber}</strong>{' '}
                      <span className="text-muted-foreground">({paymentDossier.bookingDetails.vehicle.model || paymentDossier.bookingDetails.vehicle.vehicleType || 'Car'})</span>
                    </div>
                  )}
                  {paymentDossier.bookingDetails?.parkingSlot?.slotNumber && (
                    <div>
                      <span className="text-muted-foreground">Assigned Bay: </span>
                      <strong>{paymentDossier.bookingDetails.parkingSlot.slotNumber}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Refunds Ledger History */}
              <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
                <h4 className="font-bold text-foreground flex items-center justify-between border-b border-border/50 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    Refund Ledger History ({paymentDossier.refunds.length})
                  </span>
                  {renderRefundWorkflowBadge(paymentDossier.refundWorkflowState)}
                </h4>

                {paymentDossier.refunds.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] py-2">
                    No refund transactions initiated for this payment.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {paymentDossier.refunds.map((r, i) => (
                      <div
                        key={r.refundReference || i}
                        className="p-2.5 rounded border border-border/60 bg-muted/20 space-y-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="font-mono">{r.refundReference}</span>
                          <span className="text-blue-600 font-mono font-bold">₹{r.refundAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>Status: <strong>{r.refundStatus}</strong></span>
                          <span>Initiated: {new Date(r.initiatedAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Reason: </span>
                          <span className="italic">{r.refundReason}</span>
                        </div>
                        {r.initiatedBy && (
                          <div className="text-[10px] text-muted-foreground">
                            Authorizing Agent: {r.initiatedBy.fullName} ({r.initiatedBy.email})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Booking Timeline History if present */}
              {paymentDossier.bookingTimeline && paymentDossier.bookingTimeline.length > 0 && (
                <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-card">
                  <h4 className="font-bold text-foreground flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                    <History className="h-4 w-4 text-primary" />
                    Reservation Lifecycle Events
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {paymentDossier.bookingTimeline.map((ev, i) => (
                      <div key={i} className="flex items-start justify-between text-[11px] p-1.5 rounded bg-muted/20">
                        <div>
                          <strong className="text-foreground">{ev.eventType}</strong>
                          <div className="text-muted-foreground text-[10px]">{ev.eventDescription}</div>
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground font-mono shrink-0">
                          {new Date(ev.eventTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => paymentDossier && handlePrintVoucher(paymentDossier)}
              disabled={!paymentDossier}
              className="gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Download Voucher (PDF)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPaymentId(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFinancePage;
