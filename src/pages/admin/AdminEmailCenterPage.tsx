import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bold,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Heading2,
  Heading3,
  History,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mail,
  Minus,
  PenLine,
  Quote,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Strikethrough,
  Trash2,
  Underline,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  adminEmailCenterApi,
  type EmailCenterOverview,
  type EmailHistoryItem,
  type RecipientCategory,
  type RecipientOption,
} from '@/api/adminEmailCenter.api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export const AdminEmailCenterPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: compose | history | overview
  const activeTab = searchParams.get('tab') || 'compose';

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // =========================================================================
  // STATE: OVERVIEW
  // =========================================================================
  const [overview, setOverview] = useState<EmailCenterOverview>({
    totalEmailsSent: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    pendingDeliveries: 0,
    deliverySuccessRate: 100,
    activeCustomersCount: 0,
    activeOwnersCount: 0,
    recentActivity: [],
  });
  const [overviewLoading, setOverviewLoading] = useState(false);

  // =========================================================================
  // STATE: COMPOSE
  // =========================================================================
  const [category, setCategory] = useState<RecipientCategory>('ALL_CUSTOMERS');
  const [specificSearch, setSpecificSearch] = useState('');
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientOption[]>([]);
  const [estimatedCount, setEstimatedCount] = useState(0);

  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState(
    '<p>Hello ParkEase community member,</p><p>We are pleased to inform you of the following platform update...</p>',
  );
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Mass Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [massConfirmedCheck, setMassConfirmedCheck] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Editor ref
  const editorRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // STATE: EMAIL HISTORY
  // =========================================================================
  const [historyItems, setHistoryItems] = useState<EmailHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const historyPage = Number(searchParams.get('page')) || 1;
  const historyLimit = Number(searchParams.get('limit')) || 10;
  const historySearch = searchParams.get('search') || '';
  const historyStatus = searchParams.get('status') || 'All';
  const historyCategory = searchParams.get('cat') || 'All';
  const historyDateFrom = searchParams.get('from') || '';
  const historyDateTo = searchParams.get('to') || '';

  const [historySearchInput, setHistorySearchInput] = useState(historySearch);

  // Single Email Detail Modal
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<EmailHistoryItem | null>(null);

  // =========================================================================
  // DATA FETCHING: OVERVIEW
  // =========================================================================
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await adminEmailCenterApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.warn('Failed to load email center overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  // =========================================================================
  // DATA FETCHING: RECIPIENTS & ESTIMATES
  // =========================================================================
  useEffect(() => {
    let active = true;
    const fetchRecipients = async () => {
      setOptionsLoading(true);
      try {
        const res = await adminEmailCenterApi.searchRecipients(category, specificSearch);
        if (!active) return;
        setEstimatedCount(res.estimatedCount);
        setRecipientOptions(res.recipients);
      } catch (err) {
        console.warn('Failed to load recipients for category:', err);
      } finally {
        if (active) setOptionsLoading(false);
      }
    };

    const timer = setTimeout(fetchRecipients, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [category, specificSearch]);

  // Reset selected recipients when category switches
  const handleCategoryChange = (newCat: RecipientCategory) => {
    setCategory(newCat);
    setSelectedRecipients([]);
    setSpecificSearch('');
  };

  // Toggle specific recipient
  const handleToggleRecipient = (rec: RecipientOption) => {
    setSelectedRecipients((prev) => {
      const exists = prev.some((r) => r._id === rec._id);
      if (exists) {
        return prev.filter((r) => r._id !== rec._id);
      } else {
        return [...prev, rec];
      }
    });
  };

  // Remove recipient pill
  const handleRemoveRecipient = (id: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => r._id !== id));
  };

  // =========================================================================
  // DATA FETCHING: HISTORY
  // =========================================================================
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await adminEmailCenterApi.getEmailHistory({
        page: historyPage,
        limit: historyLimit,
        search: historySearch || undefined,
        deliveryStatus: historyStatus !== 'All' ? historyStatus : undefined,
        recipientCategory: historyCategory !== 'All' ? historyCategory : undefined,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      });
      setHistoryItems(res.emails);
      setHistoryTotal(res.pagination.total);
      setHistoryTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.warn('Failed to load email history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [
    historyPage,
    historyLimit,
    historySearch,
    historyStatus,
    historyCategory,
    historyDateFrom,
    historyDateTo,
  ]);

  useEffect(() => {
    if (activeTab === 'history') {
      void fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // History search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (historySearchInput.trim()) {
        next.set('search', historySearchInput.trim());
      } else {
        next.delete('search');
      }
      next.set('page', '1');
      setSearchParams(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [historySearchInput]);

  const updateHistoryParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'All') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  // Open Email Detail Dossier
  const handleOpenDetail = async (id: string) => {
    setSelectedEmailDetail(null);
    try {
      const detail = await adminEmailCenterApi.getEmailById(id);
      setSelectedEmailDetail(detail);
    } catch (err) {
      toast.error('Failed to retrieve email detail record.');
    }
  };

  // =========================================================================
  // RICH TEXT EDITOR HELPERS
  // =========================================================================
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Enter destination URL (https://...):');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
    }
  };

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, []);

  // Calculate actual target count for display
  const targetCount =
    category === 'ALL_CUSTOMERS' || category === 'ALL_OWNERS'
      ? estimatedCount
      : selectedRecipients.length;

  const isMassEmail =
    category === 'ALL_CUSTOMERS' || category === 'ALL_OWNERS' || selectedRecipients.length > 1;

  // Validate before opening confirm modal
  const handlePreSend = () => {
    if (!subject.trim() || subject.trim().length < 3) {
      toast.error('Please enter a valid subject line (at least 3 characters).');
      return;
    }
    if (!contentHtml.trim() || contentHtml.trim().length < 10) {
      toast.error('Please enter sufficient email message body content.');
      return;
    }
    if ((category === 'SPECIFIC_CUSTOMER' || category === 'SPECIFIC_OWNER') && selectedRecipients.length === 0) {
      toast.error('Please select at least one specific recipient.');
      return;
    }
    if (targetCount === 0) {
      toast.error('No eligible recipients found for this selection.');
      return;
    }

    setMassConfirmedCheck(false);
    setConfirmModalOpen(true);
  };

  // Execute Send
  const handleConfirmSend = async () => {
    if (isMassEmail && !massConfirmedCheck) {
      toast.error('Please check the confirmation box before sending mass broadcasts.');
      return;
    }

    setSendingEmail(true);
    try {
      const recipientIds =
        category === 'SPECIFIC_CUSTOMER' || category === 'SPECIFIC_OWNER'
          ? selectedRecipients.map((r) => r._id)
          : undefined;

      const res = await adminEmailCenterApi.sendEmail({
        recipientCategory: category,
        recipientIds,
        subject: subject.trim(),
        content: contentHtml,
        massEmailConfirmed: isMassEmail ? massConfirmedCheck : true,
      });

      toast.success(res.message || 'Email broadcast dispatched successfully!');
      setConfirmModalOpen(false);

      // Reset form
      setSubject('');
      setContentHtml('<p>Hello,</p><p>We are pleased to inform you...</p>');
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p>Hello,</p><p>We are pleased to inform you...</p>';
      }
      setSelectedRecipients([]);

      // Refresh overview & history
      void fetchOverview();
      void fetchHistory();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to dispatch email broadcast.';
      toast.error(msg);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs font-medium text-muted-foreground">
        <Link to="/admin/dashboard" className="hover:text-foreground transition-colors">
          Admin Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-foreground font-semibold">Communication Center</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Communication Center</h1>
              <p className="text-sm text-muted-foreground">
                Authoritative platform messaging, broadcast announcements, and delivery audit ledger.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchOverview();
              if (activeTab === 'history') void fetchHistory();
            }}
            disabled={overviewLoading || historyLoading}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (overviewLoading || historyLoading) && 'animate-spin')} />
            Sync Deliveries
          </Button>

          {activeTab !== 'compose' && (
            <Button
              size="sm"
              onClick={() => setActiveTab('compose')}
              className="gap-1.5 text-xs h-9 shadow-xs"
            >
              <PenLine className="h-3.5 w-3.5" />
              New Broadcast
            </Button>
          )}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Emails Sent */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Total Dispatched
              <Mail className="h-4 w-4 text-primary" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {overview.totalEmailsSent.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Historical platform logs</p>
          </CardContent>
        </Card>

        {/* Delivery Success Rate */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Delivery Rate
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {overview.deliverySuccessRate}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              {overview.successfulDeliveries} successful deliveries
            </p>
          </CardContent>
        </Card>

        {/* Active Customers */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Active Customers
              <User className="h-4 w-4 text-blue-500" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {overview.activeCustomersCount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Broadcast-eligible pool</p>
          </CardContent>
        </Card>

        {/* Active Owners */}
        <Card className="border border-border/60 shadow-xs bg-card">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Active Owners
              <Users className="h-4 w-4 text-indigo-500" />
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {overview.activeOwnersCount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Verified facility partners</p>
          </CardContent>
        </Card>

        {/* Failed Deliveries */}
        <Card className="border border-border/60 shadow-xs bg-card col-span-2 md:col-span-1">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Delivery Failures
              <AlertTriangle className={cn('h-4 w-4', overview.failedDeliveries > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
            </p>
            <p
              className={cn(
                'text-2xl font-bold tracking-tight font-mono',
                overview.failedDeliveries > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
              )}
            >
              {overview.failedDeliveries}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {overview.failedDeliveries === 0 ? 'Optimal transport health' : 'Needs review in history'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab('compose')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all',
            activeTab === 'compose'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <PenLine className="h-4 w-4" />
          Compose & Broadcast
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all',
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <History className="h-4 w-4" />
          Delivery History & Logs
          {historyTotal > 0 && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px]',
                activeTab === 'history'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {historyTotal}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all',
            activeTab === 'overview'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Performance & Overview
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB A: COMPOSE & BROADCAST (SPLIT-SCREEN) */}
      {/* ===================================================================== */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Composer Form (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 sm:p-6 space-y-5">
                {/* 1. Target Audience Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      1. Select Recipient Category
                    </label>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      Target Pool: {estimatedCount.toLocaleString()} {category.includes('OWNER') ? 'Owners' : 'Customers'}
                    </Badge>
                  </div>

                  {/* 4 Category Pill Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handleCategoryChange('ALL_CUSTOMERS')}
                      className={cn(
                        'p-3 text-left rounded-xl border text-xs font-medium transition-all flex flex-col justify-between gap-2',
                        category === 'ALL_CUSTOMERS'
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/70 hover:border-foreground/30 bg-muted/20 text-muted-foreground',
                      )}
                    >
                      <div className="font-semibold text-foreground">All Customers</div>
                      <div className="text-[10px] opacity-80">Bulk broadcast</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCategoryChange('ALL_OWNERS')}
                      className={cn(
                        'p-3 text-left rounded-xl border text-xs font-medium transition-all flex flex-col justify-between gap-2',
                        category === 'ALL_OWNERS'
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/70 hover:border-foreground/30 bg-muted/20 text-muted-foreground',
                      )}
                    >
                      <div className="font-semibold text-foreground">All Owners</div>
                      <div className="text-[10px] opacity-80">Partner updates</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCategoryChange('SPECIFIC_CUSTOMER')}
                      className={cn(
                        'p-3 text-left rounded-xl border text-xs font-medium transition-all flex flex-col justify-between gap-2',
                        category === 'SPECIFIC_CUSTOMER'
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/70 hover:border-foreground/30 bg-muted/20 text-muted-foreground',
                      )}
                    >
                      <div className="font-semibold text-foreground">Specific Customer</div>
                      <div className="text-[10px] opacity-80">Targeted notice</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCategoryChange('SPECIFIC_OWNER')}
                      className={cn(
                        'p-3 text-left rounded-xl border text-xs font-medium transition-all flex flex-col justify-between gap-2',
                        category === 'SPECIFIC_OWNER'
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border/70 hover:border-foreground/30 bg-muted/20 text-muted-foreground',
                      )}
                    >
                      <div className="font-semibold text-foreground">Specific Owner</div>
                      <div className="text-[10px] opacity-80">Direct dispatch</div>
                    </button>
                  </div>
                </div>

                {/* Specific Recipient Multi-Selector */}
                {(category === 'SPECIFIC_CUSTOMER' || category === 'SPECIFIC_OWNER') && (
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        Search & Pick Recipients
                      </span>
                      {selectedRecipients.length > 0 && (
                        <button
                          onClick={() => setSelectedRecipients([])}
                          className="text-[11px] text-destructive hover:underline"
                        >
                          Clear selected ({selectedRecipients.length})
                        </button>
                      )}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={`Search by name, email, or mobile number...`}
                        value={specificSearch}
                        onChange={(e) => setSpecificSearch(e.target.value)}
                        className="pl-9 h-9 text-xs bg-card"
                      />
                    </div>

                    {/* Selected Pills */}
                    {selectedRecipients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                        {selectedRecipients.map((rec) => (
                          <span
                            key={rec._id}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/25"
                          >
                            <span>{rec.fullName}</span>
                            <span className="text-[10px] opacity-75 font-mono">({rec.email})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipient(rec._id)}
                              className="rounded-full hover:bg-primary/20 p-0.5 text-primary"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dropdown Options List */}
                    <div className="border border-border/70 rounded-lg max-h-48 overflow-y-auto bg-card divide-y divide-border/40">
                      {optionsLoading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Searching verified recipients...
                        </div>
                      ) : recipientOptions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          No matching active recipients found.
                        </div>
                      ) : (
                        recipientOptions.map((opt) => {
                          const isSelected = selectedRecipients.some((r) => r._id === opt._id);
                          return (
                            <div
                              key={opt._id}
                              onClick={() => handleToggleRecipient(opt)}
                              className={cn(
                                'p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors',
                                isSelected ? 'bg-primary/10' : 'hover:bg-muted/40',
                              )}
                            >
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  {opt.fullName}
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {opt.accountStatus}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {opt.email} {opt.mobileNumber && `• ${opt.mobileNumber}`}
                                </div>
                              </div>
                              <div
                                className={cn(
                                  'h-4 w-4 rounded-md border flex items-center justify-center transition-colors',
                                  isSelected
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-muted-foreground/40',
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Subject Line */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      2. Email Subject Line
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {subject.length}/200
                    </span>
                  </div>
                  <Input
                    placeholder="e.g. ParkEase Notice: Scheduled Platform Upgrades & Enhancements"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    className="h-10 text-xs sm:text-sm font-medium"
                  />
                </div>

                {/* 3. Rich-Text Editor Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      3. Message Content Body
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Sanitized HTML output
                    </span>
                  </div>

                  {/* Refined Toolbar */}
                  <div className="border border-border rounded-t-xl bg-muted/40 p-1.5 flex flex-wrap items-center gap-1 text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => executeCommand('bold')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Bold (Ctrl+B)"
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('italic')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Italic (Ctrl+I)"
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('underline')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Underline (Ctrl+U)"
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('strikeThrough')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Strikethrough"
                    >
                      <Strikethrough className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-4 w-px bg-border/80 mx-1" />

                    <button
                      type="button"
                      onClick={() => executeCommand('formatBlock', '<h2>')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Heading 2"
                    >
                      <Heading2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('formatBlock', '<h3>')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Heading 3"
                    >
                      <Heading3 className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-4 w-px bg-border/80 mx-1" />

                    <button
                      type="button"
                      onClick={() => executeCommand('insertUnorderedList')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Bullet List"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('insertOrderedList')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Numbered List"
                    >
                      <ListOrdered className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('formatBlock', '<blockquote>')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Quote Block"
                    >
                      <Quote className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleInsertLink}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Insert Hyperlink"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => executeCommand('insertHorizontalRule')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Horizontal Divider"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <div className="h-4 w-px bg-border/80 mx-1" />

                    <button
                      type="button"
                      onClick={() => executeCommand('removeFormat')}
                      className="p-1.5 rounded-lg hover:bg-background hover:text-foreground text-xs"
                      title="Clear Formatting"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* contentEditable canvas */}
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleEditorInput}
                    className="min-h-[240px] max-h-[380px] overflow-y-auto p-4 rounded-b-xl border border-t-0 border-border bg-card text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                </div>

                {/* Footer Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>
                      Targeting{' '}
                      <strong className="text-foreground font-semibold">
                        {targetCount.toLocaleString()}
                      </strong>{' '}
                      recipient(s)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSubject('');
                        setContentHtml('<p>Hello,</p><p>...</p>');
                        if (editorRef.current) editorRef.current.innerHTML = '<p>Hello,</p><p>...</p>';
                        setSelectedRecipients([]);
                      }}
                      className="text-xs h-9"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Discard
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handlePreSend}
                      disabled={sendingEmail || targetCount === 0}
                      className="text-xs h-9 gap-1.5 shadow-sm px-5"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Broadcast ({targetCount})
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Email Client Mock Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                Live Client Preview
              </span>

              {/* Device view switcher */}
              <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                    previewDevice === 'desktop'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                    previewDevice === 'mobile'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Smartphone className="h-3 w-3 inline mr-1" />
                  Mobile
                </button>
              </div>
            </div>

            {/* Email Client Shell */}
            <div
              className={cn(
                'rounded-2xl border border-border/80 shadow-md bg-card overflow-hidden transition-all mx-auto',
                previewDevice === 'mobile' ? 'max-w-[340px]' : 'w-full',
              )}
            >
              {/* Window Header */}
              <div className="bg-muted/80 px-4 py-2.5 border-b border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  ParkEase Inbox Viewer
                </div>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background/50">
                  Live Preview
                </Badge>
              </div>

              {/* Email Envelope Metadata */}
              <div className="p-3.5 bg-muted/30 border-b border-border/60 text-xs space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground w-12">From:</span>
                  <span className="text-foreground font-medium">
                    ParkEase Platform Operations &lt;noreply@parkease.com&gt;
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground w-12">To:</span>
                  <span className="text-foreground font-mono text-[11px]">
                    {category === 'ALL_CUSTOMERS'
                      ? `All Active Customers (${estimatedCount})`
                      : category === 'ALL_OWNERS'
                      ? `All Parking Partners (${estimatedCount})`
                      : selectedRecipients.length > 0
                      ? selectedRecipients.map((r) => r.email).join(', ')
                      : 'None selected'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground w-12">Subject:</span>
                  <span className="text-foreground font-bold">{subject || '(No subject provided)'}</span>
                </div>
              </div>

              {/* ParkEase-Branded Email Layout Body */}
              <div className="bg-[#f1f5f9] dark:bg-zinc-950 p-4 max-h-[460px] overflow-y-auto">
                <div className="max-w-[480px] mx-auto rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm text-slate-800 dark:text-zinc-200">
                  {/* Top Header */}
                  <div className="bg-[#ffffff] dark:bg-zinc-900 p-4 border-b-4 border-[#1e3a8a] flex items-center justify-between">
                    <div>
                      <img
                        src="/brand/document-logo.png"
                        alt="ParkEase"
                        className="h-9 w-auto object-contain"
                        onError={(e) => {
                          // Fallback text if logo fails in local preview
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="text-[10px] font-bold text-[#64748b] dark:text-zinc-400 tracking-wider uppercase mt-1">
                        Smart Parking Management System
                      </div>
                    </div>
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]">
                        Official Notice
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div
                    className="p-5 text-xs sm:text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: contentHtml || '<p><em>(Email body is empty)</em></p>',
                    }}
                  />

                  {/* Document Footer */}
                  <div className="bg-[#f8fafc] dark:bg-zinc-950 p-4 border-t border-[#e2e8f0] dark:border-zinc-800 text-center text-[11px] text-[#64748b] dark:text-zinc-400 space-y-1">
                    <div className="font-bold text-slate-800 dark:text-zinc-200">
                      ParkEase Platform Operations
                    </div>
                    <div>
                      Support: <span className="text-blue-600">support@parkease.com</span> •{' '}
                      <span className="text-blue-600">www.parkease.com</span>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      © {new Date().getFullYear()} ParkEase. All rights reserved.
                    </div>
                  </div>

                  <img
                    src="/brand/document-footer.png"
                    alt="Official Banner"
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB B: EMAIL HISTORY & AUDIT LEDGER */}
      {/* ===================================================================== */}
      {activeTab === 'history' && (
        <Card className="border border-border/60 shadow-xs bg-card space-y-4">
          <CardContent className="p-5 space-y-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by subject, email, or reference..."
                  value={historySearchInput}
                  onChange={(e) => setHistorySearchInput(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Status Filter */}
              <Select value={historyStatus} onValueChange={(val) => updateHistoryParam('status', val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Delivery Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Delivery Statuses</SelectItem>
                  <SelectItem value="Sent">Sent (Successful)</SelectItem>
                  <SelectItem value="Failed">Failed Deliveries</SelectItem>
                  <SelectItem value="Pending">Pending / Sending</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={historyCategory} onValueChange={(val) => updateHistoryParam('cat', val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Recipient Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Audiences</SelectItem>
                  <SelectItem value="ALL_CUSTOMERS">All Customers</SelectItem>
                  <SelectItem value="ALL_OWNERS">All Parking Owners</SelectItem>
                  <SelectItem value="SPECIFIC_CUSTOMER">Specific Customers</SelectItem>
                  <SelectItem value="SPECIFIC_OWNER">Specific Owners</SelectItem>
                  <SelectItem value="OTHER">System Automated</SelectItem>
                </SelectContent>
              </Select>

              {/* Reset Filter Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setHistorySearchInput('');
                  const next = new URLSearchParams();
                  next.set('tab', 'history');
                  setSearchParams(next);
                }}
                className="h-9 text-xs"
              >
                Reset Filters
              </Button>
            </div>

            {/* Email History Table */}
            <div className="rounded-xl border border-border/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/60">
                    <tr>
                      <th className="px-4 py-3">Subject / Reference</th>
                      <th className="px-4 py-3">Recipient(s) & Audience</th>
                      <th className="px-4 py-3">Target Size</th>
                      <th className="px-4 py-3">Delivery Status</th>
                      <th className="px-4 py-3">Dispatched By</th>
                      <th className="px-4 py-3">Sent Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {historyLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                          Loading email delivery records...
                        </td>
                      </tr>
                    ) : historyItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          No email delivery records match the current filter criteria.
                        </td>
                      </tr>
                    ) : (
                      historyItems.map((item) => (
                        <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                          {/* Subject / Ref */}
                          <td className="px-4 py-3 max-w-[240px]">
                            <div className="font-semibold text-foreground truncate" title={item.subject}>
                              {item.subject}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate">
                              Ref: {item.emailReference}
                            </div>
                          </td>

                          {/* Recipient / Audience */}
                          <td className="px-4 py-3 max-w-[200px]">
                            <Badge variant="outline" className="text-[10px] font-semibold mb-1">
                              {item.recipientCategory === 'ALL_CUSTOMERS'
                                ? 'All Customers'
                                : item.recipientCategory === 'ALL_OWNERS'
                                ? 'All Owners'
                                : item.recipientCategory === 'SPECIFIC_CUSTOMER'
                                ? 'Specific Customer'
                                : item.recipientCategory === 'SPECIFIC_OWNER'
                                ? 'Specific Owner'
                                : item.emailType}
                            </Badge>
                            <div className="text-[11px] text-muted-foreground truncate" title={item.recipientEmails.join(', ')}>
                              {item.recipientEmails.slice(0, 2).join(', ')}
                              {item.recipientEmails.length > 2 && ` +${item.recipientEmails.length - 2} more`}
                            </div>
                          </td>

                          {/* Target Size */}
                          <td className="px-4 py-3 font-mono font-medium">
                            {item.recipientCount} {item.recipientCount === 1 ? 'user' : 'users'}
                          </td>

                          {/* Delivery Status */}
                          <td className="px-4 py-3">
                            {item.deliveryStatus === 'Sent' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                <CheckCircle2 className="h-3 w-3" />
                                Sent
                              </span>
                            ) : item.deliveryStatus === 'Failed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
                                <XCircle className="h-3 w-3" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Clock className="h-3 w-3" />
                                {item.deliveryStatus}
                              </span>
                            )}
                          </td>

                          {/* Dispatched By */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {item.sender?.fullName || item.source}
                            </div>
                            {item.sender?.email && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {item.sender.email}
                              </div>
                            )}
                          </td>

                          {/* Sent Date */}
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {item.sentAt
                              ? new Date(item.sentAt).toLocaleString()
                              : new Date(item.createdAt).toLocaleString()}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDetail(item._id)}
                              className="h-8 text-xs gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
              <div>
                Showing page <strong className="text-foreground">{historyPage}</strong> of{' '}
                <strong className="text-foreground">{historyTotalPages}</strong> ({historyTotal} total records)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage <= 1 || historyLoading}
                  onClick={() => updateHistoryParam('page', String(historyPage - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={historyPage >= historyTotalPages || historyLoading}
                  onClick={() => updateHistoryParam('page', String(historyPage + 1))}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB C: OVERVIEW & PERFORMANCE */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Activity List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-4">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Recent Platform Email Activity
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chronological audit log of latest 10 administrative broadcasts and automated delivery events.
                  </p>
                </div>

                <div className="divide-y divide-border/40">
                  {overview.recentActivity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No email activity recorded yet.
                    </div>
                  ) : (
                    overview.recentActivity.map((log) => (
                      <div key={log._id} className="py-3 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                            {log.subject}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {log.recipientCategory === 'ALL_CUSTOMERS'
                                ? 'All Customers'
                                : log.recipientCategory === 'ALL_OWNERS'
                                ? 'All Owners'
                                : log.recipientCategory}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            To: {log.recipientEmails.slice(0, 3).join(', ')}
                            {log.recipientEmails.length > 3 && ` +${log.recipientEmails.length - 3} more`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Sender: {log.sender?.fullName || log.source} &bull;{' '}
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div>
                          {log.deliveryStatus === 'Sent' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Sent
                            </span>
                          ) : log.deliveryStatus === 'Failed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                              <Clock className="h-3 w-3" />
                              {log.deliveryStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Guidelines & Safeguards (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border border-border/60 shadow-xs bg-card">
              <CardContent className="p-5 space-y-3 text-xs leading-relaxed">
                <div className="border-b border-border/60 pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Security & Compliance Standards
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ParkEase administrative messaging protocols and compliance safeguards.
                  </p>
                </div>

                <div className="space-y-2.5 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      1
                    </div>
                    <p>
                      <strong className="text-foreground">Authoritative Recipient Filtering:</strong> Recipient pools are computed strictly on the backend from verified accounts, preventing cross-tenant leakage.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      2
                    </div>
                    <p>
                      <strong className="text-foreground">Automated HTML Sanitization:</strong> All rich-text inputs are sanitized on the server before dispatch, neutralizing scripts, iframes, and malicious scheme links.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      3
                    </div>
                    <p>
                      <strong className="text-foreground">Mandatory Mass Confirmation:</strong> Broadcasts exceeding one recipient require explicit administrative acknowledgment, logged permanently in the compliance audit trail.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                      4
                    </div>
                    <p>
                      <strong className="text-foreground">Branded Consistency:</strong> All messages are automatically rendered within the official ParkEase corporate layout with official logos and verification badges.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOG: MASS SEND CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Mail className="h-5 w-5 text-primary" />
              Confirm Email Broadcast Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please review the target audience and broadcast details before dispatching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Recipient Summary Card */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Target Audience:</span>
                <Badge variant="outline" className="font-semibold text-[11px]">
                  {category === 'ALL_CUSTOMERS'
                    ? 'All Active Customers'
                    : category === 'ALL_OWNERS'
                    ? 'All Parking Owners'
                    : category === 'SPECIFIC_CUSTOMER'
                    ? 'Specific Customers'
                    : 'Specific Parking Owners'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Estimated Recipients:</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {targetCount.toLocaleString()} user(s)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Subject:</span>
                <span className="font-medium text-foreground truncate max-w-[220px]" title={subject}>
                  {subject}
                </span>
              </div>
            </div>

            {/* Mass Send Warning Banner */}
            {isMassEmail && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  Mass Broadcast Confirmation Required
                </div>
                <p className="text-[11px] leading-relaxed">
                  This action will immediately send this email to all {targetCount.toLocaleString()} recipient(s). Once dispatched, this operation cannot be undone.
                </p>

                <label className="flex items-start gap-2 pt-1.5 cursor-pointer font-medium text-xs">
                  <input
                    type="checkbox"
                    checked={massConfirmedCheck}
                    onChange={(e) => setMassConfirmedCheck(e.target.checked)}
                    className="mt-0.5 rounded border-border"
                  />
                  <span>I confirm that I have reviewed the content and authorize this mass broadcast.</span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalOpen(false)}
              disabled={sendingEmail}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSend}
              disabled={sendingEmail || (isMassEmail && !massConfirmedCheck)}
              className="text-xs gap-1.5"
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Confirm & Send Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* DIALOG: SINGLE EMAIL DOSSIER INSPECTOR */}
      {/* ===================================================================== */}
      <Dialog open={Boolean(selectedEmailDetail)} onOpenChange={(open) => !open && setSelectedEmailDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedEmailDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-base font-bold">
                    Email Delivery Audit Dossier
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-semibold',
                      selectedEmailDetail.deliveryStatus === 'Sent'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : selectedEmailDetail.deliveryStatus === 'Failed'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                    )}
                  >
                    {selectedEmailDetail.deliveryStatus}
                  </Badge>
                </div>
                <DialogDescription className="font-mono text-xs text-muted-foreground">
                  Reference: {selectedEmailDetail.emailReference}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Subject</span>
                    <strong className="text-foreground text-sm font-semibold">
                      {selectedEmailDetail.subject}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Target Category</span>
                    <strong className="text-foreground">
                      {selectedEmailDetail.recipientCategory} ({selectedEmailDetail.recipientCount} recipients)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Dispatched By</span>
                    <strong className="text-foreground">
                      {selectedEmailDetail.sender?.fullName || selectedEmailDetail.source}
                    </strong>
                    {selectedEmailDetail.sender?.email && (
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        {selectedEmailDetail.sender.email}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Sent Timestamp</span>
                    <strong className="text-foreground">
                      {selectedEmailDetail.sentAt
                        ? new Date(selectedEmailDetail.sentAt).toLocaleString()
                        : new Date(selectedEmailDetail.createdAt).toLocaleString()}
                    </strong>
                  </div>
                  {selectedEmailDetail.providerMessageId && (
                    <div className="col-span-2">
                      <span className="text-[11px] text-muted-foreground block">Provider Message-ID</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {selectedEmailDetail.providerMessageId}
                      </span>
                    </div>
                  )}
                  {selectedEmailDetail.failureReason && (
                    <div className="col-span-2 p-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                      <strong>Delivery Failure Reason:</strong> {selectedEmailDetail.failureReason}
                    </div>
                  )}
                </div>

                {/* Recipient Emails */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground block">Recipients List:</span>
                  <div className="max-h-24 overflow-y-auto p-2 rounded-lg border border-border/70 bg-card font-mono text-[11px] text-foreground">
                    {selectedEmailDetail.recipientEmails.join(', ')}
                  </div>
                </div>

                {/* Rendered Body Preview */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted-foreground block">Message Content:</span>
                  <div className="p-4 rounded-xl border border-border/80 bg-card max-h-[280px] overflow-y-auto prose prose-sm dark:prose-invert">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: selectedEmailDetail.htmlBody || selectedEmailDetail.body,
                      }}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmailDetail(null)}
                  className="text-xs"
                >
                  Close Dossier
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmailCenterPage;
