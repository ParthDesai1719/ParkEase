import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Bold,
  Check,
  CheckCircle2,
  Eye,
  Heading3,
  History,
  Italic,
  List,
  ListOrdered,
  Mail,
  PenLine,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Underline,
  Users,
} from 'lucide-react';
import {
  ownerEmailCenterApi,
  type OwnerEmailCenterOverview,
  type OwnerEmailHistoryItem,
  type OwnerRecipientCategory,
  type OwnerRecipientOption,
} from '@/api/ownerEmailCenter.api';
import { getOwnerParkingLots } from '@/api/parkingLot.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export const OwnerEmailCenterPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State: compose | history | overview
  const activeTab = searchParams.get('tab') || 'compose';

  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  // Facility filter
  const [facilities, setFacilities] = useState<Array<{ _id: string; parkingName: string }>>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all');

  // =========================================================================
  // STATE: OVERVIEW
  // =========================================================================
  const [overview, setOverview] = useState<OwnerEmailCenterOverview>({
    totalEmailsSent: 0,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    deliverySuccessRate: 100,
    activeCustomersCount: 0,
    assignedStaffCount: 0,
    recentEmails: [],
  });
  const [_overviewLoading, setOverviewLoading] = useState(false);

  // =========================================================================
  // STATE: COMPOSE
  // =========================================================================
  const [category, setCategory] = useState<OwnerRecipientCategory>('CUSTOMERS');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientOptions, setRecipientOptions] = useState<OwnerRecipientOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<OwnerRecipientOption[]>([]);

  // Composer fields
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState(
    '<p>Dear Customer / Team Member,</p><p>We would like to share an important operational update regarding your parking facility...</p>',
  );
  const editorRef = useRef<HTMLDivElement>(null);

  // Modals & Action States
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [massConfirmedCheck, setMassConfirmedCheck] = useState(false);
  const [lastSentBanner, setLastSentBanner] = useState<{
    reference: string;
    count: number;
    sentAt: string;
    message: string;
  } | null>(null);

  // =========================================================================
  // STATE: HISTORY
  // =========================================================================
  const [historyItems, setHistoryItems] = useState<OwnerEmailHistoryItem[]>([]);
  const [_historyTotal, setHistoryTotal] = useState(0);
  const [_historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<OwnerEmailHistoryItem | null>(null);

  // History filters
  const historyPage = Number(searchParams.get('page')) || 1;
  const historyLimit = 15;
  const historyStatus = searchParams.get('status') || 'All';
  const historyCategory = searchParams.get('cat') || 'All';
  const historySearch = searchParams.get('search') || '';
  const historyDateFrom = searchParams.get('from') || '';
  const historyDateTo = searchParams.get('to') || '';
  const [historySearchInput, setHistorySearchInput] = useState(historySearch);

  // Load owner facilities
  useEffect(() => {
    const loadFacilities = async () => {
      try {
        const res = await getOwnerParkingLots();
        if (res.data?.parkingLots) {
          setFacilities(res.data.parkingLots.map((l) => ({ _id: l._id, parkingName: l.parkingName })));
        }
      } catch (err) {
        console.warn('Failed to load facilities:', err);
      }
    };
    void loadFacilities();
  }, []);

  // Fetch Overview Data
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await ownerEmailCenterApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.warn('Failed to load overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  // Fetch Recipients
  useEffect(() => {
    let active = true;
    const fetchRecipients = async () => {
      setOptionsLoading(true);
      try {
        const res = await ownerEmailCenterApi.getRecipients({
          category,
          parkingLotId: selectedFacilityId !== 'all' ? selectedFacilityId : undefined,
          search: recipientSearch,
        });
        if (!active) return;
        setRecipientOptions(res.recipients);
      } catch (err) {
        console.warn('Failed to load recipients:', err);
      } finally {
        if (active) setOptionsLoading(false);
      }
    };

    const timer = setTimeout(fetchRecipients, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [category, selectedFacilityId, recipientSearch]);

  const handleCategoryChange = (newCat: OwnerRecipientCategory) => {
    setCategory(newCat);
    setSelectedRecipients([]);
    setRecipientSearch('');
  };

  const handleToggleRecipient = (rec: OwnerRecipientOption) => {
    setSelectedRecipients((prev) => {
      const exists = prev.some((r) => r._id === rec._id);
      if (exists) {
        return prev.filter((r) => r._id !== rec._id);
      } else {
        return [...prev, rec];
      }
    });
  };

  const handleSelectAllRecipients = () => {
    if (selectedRecipients.length === recipientOptions.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients([...recipientOptions]);
    }
  };

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await ownerEmailCenterApi.getHistory({
        page: historyPage,
        limit: historyLimit,
        search: historySearch || undefined,
        deliveryStatus: historyStatus !== 'All' ? historyStatus : undefined,
        recipientCategory: historyCategory !== 'All' ? historyCategory : undefined,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      });
      setHistoryItems(res.emails);
      setHistoryTotal(res.total);
      setHistoryTotalPages(res.totalPages);
    } catch (err) {
      console.warn('Failed to load email history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyLimit, historySearch, historyStatus, historyCategory, historyDateFrom, historyDateTo]);

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

  // Rich Text Editor Helpers
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setContentHtml(editorRef.current.innerHTML);
    }
  };

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = contentHtml;
    }
  }, []);

  // Quick Template Injector
  const applyTemplate = (tplSubject: string, tplBody: string) => {
    setSubject(tplSubject);
    setContentHtml(tplBody);
    if (editorRef.current) {
      editorRef.current.innerHTML = tplBody;
    }
    toast.info('Template applied to composer.');
  };

  // Pre-send validation
  const handlePreSend = () => {
    if (!subject.trim() || subject.trim().length < 3) {
      toast.error('Please enter a valid subject line (at least 3 characters).');
      return;
    }
    if (!contentHtml.trim() || contentHtml.trim().length < 10) {
      toast.error('Please enter sufficient message body content.');
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient from the list.');
      return;
    }
    setMassConfirmedCheck(false);
    setConfirmModalOpen(true);
  };

  // Send Broadcast
  const handleConfirmSend = async () => {
    // Immediately close/destroy the confirmation modal box
    setConfirmModalOpen(false);
    setSendingEmail(true);

    const toastId = toast.loading('Dispatching broadcast email...');
    try {
      const res = await ownerEmailCenterApi.sendEmail({
        recipientCategory: category,
        recipientIds: selectedRecipients.map((r) => r._id),
        subject: subject.trim(),
        content: contentHtml,
        parkingLotId: selectedFacilityId !== 'all' ? selectedFacilityId : undefined,
        massEmailConfirmed: massConfirmedCheck,
      });

      toast.success(res.message, {
        id: toastId,
        description: `Reference: ${res.emailReference}`,
      });

      setLastSentBanner({
        reference: res.emailReference,
        count: res.totalAttempted || selectedRecipients.length,
        sentAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        message: res.message,
      });

      setSelectedRecipients([]);
      setSubject('');
      setContentHtml('<p>Message body...</p>');
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p>Message body...</p>';
      }

      void fetchOverview();
      setActiveTab('history');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send broadcast email';
      toast.error(msg, { id: toastId });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 0. DISPATCH FEEDBACK BANNER */}
      {lastSentBanner && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Email Broadcast Dispatched Successfully
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-primary/30 text-primary font-bold"
                >
                  {lastSentBanner.reference}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastSentBanner.message} Dispatched at {lastSentBanner.sentAt} to{' '}
                <strong>{lastSentBanner.count}</strong> recipient(s).
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLastSentBanner(null)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Facility Email Center</h1>
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">
              Owner Portal
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dispatch official branded communications to your facility customers and assigned security officers.
          </p>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70 self-start sm:self-auto">
          <Button
            size="sm"
            variant={activeTab === 'compose' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
            onClick={() => setActiveTab('compose')}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Compose</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
            onClick={() => setActiveTab('history')}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Overview</span>
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: COMPOSE */}
      {/* ===================================================================== */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: RECIPIENT SELECTION PANEL (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">1. Select Audience &amp; Facility</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose recipients associated with your active facilities.
                </p>
              </div>

              {/* Facility Filter */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Facility Scope
                </label>
                <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="All My Facilities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Authorized Facilities ({facilities.length})
                    </SelectItem>
                    {facilities.map((fac) => (
                      <SelectItem key={fac._id} value={fac._id} className="text-xs">
                        {fac.parkingName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Pills */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={category === 'CUSTOMERS' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange('CUSTOMERS')}
                  className="text-xs font-bold gap-1.5 cursor-pointer h-9"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Customers</span>
                </Button>
                <Button
                  type="button"
                  variant={category === 'SECURITY_STAFF' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCategoryChange('SECURITY_STAFF')}
                  className="text-xs font-bold gap-1.5 cursor-pointer h-9"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Security Staff</span>
                </Button>
              </div>

              {/* Recipient Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder={`Search ${category === 'CUSTOMERS' ? 'customer' : 'staff'} by name or email...`}
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  className="pl-8 text-xs h-9"
                />
              </div>

              {/* Table Toolbar & Select All */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                <span className="text-muted-foreground font-medium">
                  {recipientOptions.length} available • <strong className="text-foreground">{selectedRecipients.length} selected</strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllRecipients}
                  className="text-xs text-primary font-bold h-7 px-2 cursor-pointer"
                >
                  {selectedRecipients.length === recipientOptions.length && recipientOptions.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              {/* Recipient List Box */}
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border border-border/70 rounded-lg p-2 bg-muted/20 divide-y divide-border/40">
                {optionsLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading authorized recipients...</span>
                  </div>
                ) : recipientOptions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No recipients found under this facility scope.
                  </div>
                ) : (
                  recipientOptions.map((rec) => {
                    const isSelected = selectedRecipients.some((r) => r._id === rec._id);
                    return (
                      <div
                        key={rec._id}
                        onClick={() => handleToggleRecipient(rec)}
                        className={cn(
                          'p-2 rounded-md text-xs cursor-pointer flex items-center justify-between transition-colors pt-2 first:pt-0',
                          isSelected
                            ? 'bg-primary/10 border-primary/30 text-foreground font-semibold'
                            : 'hover:bg-muted/50 text-muted-foreground',
                        )}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="font-bold text-foreground truncate">{rec.fullName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{rec.email}</div>
                          {rec.facilityNames && rec.facilityNames.length > 0 && (
                            <div className="text-[10px] text-primary/80 truncate">
                              Lot: {rec.facilityNames.join(', ')}
                            </div>
                          )}
                        </div>
                        <div
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                            isSelected
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border/80 bg-background',
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Quick Templates Card */}
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Quick Template Presets
              </span>
              <div className="space-y-1.5">
                {category === 'CUSTOMERS' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        applyTemplate(
                          'Notice: Scheduled Facility Maintenance & Access Advisory',
                          '<p>Dear Valued Guest,</p><p>Please be advised that maintenance work will be performed at our parking facility this weekend. All primary bays remain accessible, but please follow on-site signage and security guidance.</p><p>Thank you for choosing ParkEase.</p>',
                        )
                      }
                      className="w-full text-xs justify-start font-medium h-8"
                    >
                      🔧 Maintenance &amp; Access Advisory
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        applyTemplate(
                          'Holiday Operating Schedule & Peak Hour Advisory',
                          '<p>Dear Customer,</p><p>Our parking facilities will remain open 24/7 during the upcoming holidays. We recommend booking in advance via the ParkEase app to guarantee your preferred bay.</p><p>Safe travels and happy holidays!</p>',
                        )
                      }
                      className="w-full text-xs justify-start font-medium h-8"
                    >
                      🎉 Holiday Operating Advisory
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        applyTemplate(
                          'Operational Directive: QR Verification & Bay Monitoring',
                          '<p>Security Team,</p><p>Please ensure strict QR scanning at entry and exit points. Perform hourly physical bay inspections to verify that vehicles match their assigned bay numbers.</p><p>Report any discrepancies immediately via the Security Incident tab.</p>',
                        )
                      }
                      className="w-full text-xs justify-start font-medium h-8"
                    >
                      🛡️ QR Verification &amp; Bay Monitoring
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        applyTemplate(
                          'Security Briefing: Peak Hour Traffic Management',
                          '<p>Security Officers,</p><p>We anticipate heavy vehicle ingress between 5:00 PM and 8:00 PM today. Maintain active monitoring at the main boom barrier and direct overstaying vehicles appropriately.</p><p>Management thanks you for your vigilance.</p>',
                        )
                      }
                      className="w-full text-xs justify-start font-medium h-8"
                    >
                      🚦 Peak Traffic Management Brief
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT: EMAIL COMPOSER PANEL (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">2. Compose Email Broadcast</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your message will be sent in official ParkEase branded HTML format.
                </p>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Subject Line</label>
                <Input
                  placeholder="e.g., Facility Advisory: Special Notice for Valued ParkEase Guests"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              {/* Rich-Text Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-muted/40 border border-border/70 text-muted-foreground">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('bold')}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('italic')}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('underline')}
                  title="Underline"
                >
                  <Underline className="w-3.5 h-3.5" />
                </Button>
                <div className="h-4 w-px bg-border/80 mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('formatBlock', '<h3>')}
                  title="Heading"
                >
                  <Heading3 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('insertUnorderedList')}
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 cursor-pointer"
                  onClick={() => executeCommand('insertOrderedList')}
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Contenteditable Body */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Message Body</label>
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  className="min-h-56 max-h-96 overflow-y-auto p-4 rounded-xl border border-input bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="text-xs text-muted-foreground">
                  Targeting <strong className="text-foreground">{selectedRecipients.length}</strong> recipient(s)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewModalOpen(true)}
                    className="text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handlePreSend}
                    disabled={selectedRecipients.length === 0}
                    className="text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Dispatch Email</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: HISTORY */}
      {/* ===================================================================== */}
      {activeTab === 'history' && (
        <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Communication Log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chronological audit trail of all messages sent from your Parking Owner account.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="text-xs font-semibold gap-1.5 self-start cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', historyLoading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* History Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search subject or reference..."
                value={historySearchInput}
                onChange={(e) => setHistorySearchInput(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <Select value={historyStatus} onValueChange={(val) => updateHistoryParam('status', val)}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Delivery Status: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-xs">All Delivery Statuses</SelectItem>
                <SelectItem value="Sent" className="text-xs">Sent / Delivered</SelectItem>
                <SelectItem value="Failed" className="text-xs">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyCategory} onValueChange={(val) => updateHistoryParam('cat', val)}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Audience: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All" className="text-xs">All Audiences</SelectItem>
                <SelectItem value="FACILITY_CUSTOMERS" className="text-xs">Customers</SelectItem>
                <SelectItem value="ALL_STAFF" className="text-xs">Security Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* History Table */}
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Audience</th>
                  <th className="py-2.5 px-3">Recipients</th>
                  <th className="py-2.5 px-3">Facility</th>
                  <th className="py-2.5 px-3">Sent At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading communication history...</span>
                      </div>
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No email records found.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((item) => (
                    <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {item.emailReference}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground max-w-xs truncate">
                        {item.subject}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {item.recipientCategory === 'FACILITY_CUSTOMERS' ? 'Customers' : 'Staff'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-foreground">
                        {item.recipientCount}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                        {item.parkingLotId?.parkingName || 'All Lots'}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={item.deliveryStatus === 'Sent' ? 'default' : 'destructive'}
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {item.deliveryStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmailDetail(item)}
                          className="h-7 px-2 text-xs font-semibold cursor-pointer"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: OVERVIEW */}
      {/* ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Total Emails Sent
              </span>
              <div className="text-2xl font-black text-foreground">{overview.totalEmailsSent}</div>
              <p className="text-[11px] text-muted-foreground">Dispatched from your facility</p>
            </Card>
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Delivery Success Rate
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {overview.deliverySuccessRate}%
              </div>
              <p className="text-[11px] text-muted-foreground">
                {overview.successfulDeliveries} successful • {overview.failedDeliveries} failed
              </p>
            </Card>
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Active Facility Customers
              </span>
              <div className="text-2xl font-black text-primary">{overview.activeCustomersCount}</div>
              <p className="text-[11px] text-muted-foreground">Unique guests with bookings</p>
            </Card>
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Assigned Security Staff
              </span>
              <div className="text-2xl font-black text-foreground">{overview.assignedStaffCount}</div>
              <p className="text-[11px] text-muted-foreground">Officers across your lots</p>
            </Card>
          </div>

          {/* Recent Broadcasts Table */}
          <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Recent Broadcasts</h3>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Audience</th>
                    <th className="py-2.5 px-3">Recipients</th>
                    <th className="py-2.5 px-3">Sent At</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {overview.recentEmails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">
                        No recent broadcasts recorded.
                      </td>
                    </tr>
                  ) : (
                    overview.recentEmails.map((item) => (
                      <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-foreground">
                          {item.emailReference}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground truncate max-w-xs">
                          {item.subject}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {item.recipientCategory === 'FACILITY_CUSTOMERS' ? 'Customers' : 'Staff'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-bold">{item.recipientCount}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={item.deliveryStatus === 'Sent' ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {item.deliveryStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PREVIEW MODAL */}
      {/* ===================================================================== */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>Email Preview: {subject || 'Untitled Message'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              This preview renders the official ParkEase branded template that recipients will see.
            </DialogDescription>
          </DialogHeader>

          {/* Branded Email Canvas Preview */}
          <div className="border border-border/80 rounded-xl overflow-hidden bg-muted/20">
            {/* Header */}
            <div className="bg-primary/95 text-primary-foreground p-4 text-center">
              <h2 className="text-lg font-black tracking-wider uppercase">ParkEase</h2>
              <p className="text-[11px] opacity-90">Facility Management Communication</p>
            </div>
            {/* Body */}
            <div className="p-6 bg-card space-y-4">
              <div className="border-b border-border/60 pb-3">
                <span className="text-[11px] text-muted-foreground font-semibold block">Subject</span>
                <div className="text-sm font-bold text-foreground mt-0.5">{subject || 'No Subject'}</div>
              </div>
              <div
                className="text-xs text-foreground leading-relaxed prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </div>
            {/* Footer */}
            <div className="bg-muted/60 p-4 border-t border-border/60 text-center text-[10px] text-muted-foreground space-y-1">
              <p>You received this official notice as a customer or assigned officer at ParkEase.</p>
              <p>&copy; {new Date().getFullYear()} ParkEase Inc. All rights reserved.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewModalOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* CONFIRM SEND MODAL */}
      {/* ===================================================================== */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Send className="w-4 h-4 text-primary" />
              <span>Confirm Email Broadcast</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              You are about to dispatch an email to{' '}
              <strong className="text-foreground">{selectedRecipients.length}</strong> verified{' '}
              {category.toLowerCase().replace('_', ' ')}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Audience Category:</span>
              <strong className="text-foreground">{category}</strong>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subject:</span>
              <strong className="text-foreground truncate max-w-[200px]">{subject}</strong>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Recipient Count:</span>
              <Badge variant="default" className="text-xs font-bold">
                {selectedRecipients.length} Recipients
              </Badge>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 text-xs">
            <input
              type="checkbox"
              id="mass-confirm"
              checked={massConfirmedCheck}
              onChange={(e) => setMassConfirmedCheck(e.target.checked)}
              className="mt-0.5 rounded cursor-pointer"
            />
            <label htmlFor="mass-confirm" className="text-muted-foreground cursor-pointer">
              I confirm that this message complies with platform communication guidelines and is intended exclusively for authorized recipients.
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={sendingEmail}
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!massConfirmedCheck || sendingEmail}
              onClick={handleConfirmSend}
              className="font-bold gap-1.5"
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* EMAIL DETAIL DOSSIER DIALOG */}
      {/* ===================================================================== */}
      <Dialog open={Boolean(selectedEmailDetail)} onOpenChange={(open) => !open && setSelectedEmailDetail(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedEmailDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Email Dossier: {selectedEmailDetail.emailReference}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Sent on {new Date(selectedEmailDetail.createdAt).toLocaleString('en-IN')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Subject</span>
                    <strong className="text-foreground">{selectedEmailDetail.subject}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Delivery Status</span>
                    <Badge variant={selectedEmailDetail.deliveryStatus === 'Sent' ? 'default' : 'destructive'}>
                      {selectedEmailDetail.deliveryStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Recipient Count</span>
                    <strong className="text-foreground">{selectedEmailDetail.recipientCount}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Facility</span>
                    <strong className="text-foreground">
                      {selectedEmailDetail.parkingLotId?.parkingName || 'All Lots'}
                    </strong>
                  </div>
                </div>

                {/* Recipient Emails Pillbox */}
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Recipient Email Addresses ({selectedEmailDetail.recipientEmails.length})
                  </span>
                  <div className="max-h-24 overflow-y-auto p-2 rounded-lg bg-muted/20 border border-border/60 flex flex-wrap gap-1">
                    {selectedEmailDetail.recipientEmails.map((email) => (
                      <span key={email} className="px-1.5 py-0.5 rounded bg-card border border-border text-[11px]">
                        {email}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Body Content */}
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Message Body
                  </span>
                  <div
                    className="p-3.5 rounded-xl border border-border/80 bg-background leading-relaxed max-h-56 overflow-y-auto prose dark:prose-invert text-xs"
                    dangerouslySetInnerHTML={{ __html: selectedEmailDetail.content }}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedEmailDetail(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerEmailCenterPage;
