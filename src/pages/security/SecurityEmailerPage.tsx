import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bold,
  Building2,
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
  User,
} from 'lucide-react';
import {
  securityEmailerApi,
  type AssignedFacilityOwner,
  type SecurityEmailHistoryItem,
} from '@/api/securityEmailer.api';
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

export const SecurityEmailerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Assigned Owners & Facility Selection
  const [assignedOwners, setAssignedOwners] = useState<AssignedFacilityOwner[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [loadingOwners, setLoadingOwners] = useState(true);

  // Composer fields
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState(
    '<p>Dear Facility Management / Owner,</p><p>Reporting an operational update from on-site security...</p>',
  );
  const editorRef = useRef<HTMLDivElement>(null);

  // Modals & sending state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastSentBanner, setLastSentBanner] = useState<{
    reference: string;
    ownerName: string;
    ownerEmail: string;
    facilityName: string;
    sentAt: string;
    status: 'Sent' | 'Failed';
  } | null>(null);

  // History State
  const [historyItems, setHistoryItems] = useState<SecurityEmailHistoryItem[]>([]);
  const [_historyTotal, setHistoryTotal] = useState(0);
  const [historyPage] = useState(1);
  const [_historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SecurityEmailHistoryItem | null>(null);

  // Fetch assigned owners on mount
  useEffect(() => {
    const fetchOwners = async () => {
      setLoadingOwners(true);
      try {
        const data = await securityEmailerApi.getAssignedOwners();
        setAssignedOwners(data);
        if (data.length > 0) {
          setSelectedLotId(data[0].parkingLotId);
        }
      } catch (err) {
        console.warn('Failed to load assigned facility owner:', err);
        toast.error('Unable to retrieve assigned facility owner.');
      } finally {
        setLoadingOwners(false);
      }
    };
    void fetchOwners();
  }, []);

  const activeOwner = assignedOwners.find((o) => o.parkingLotId === selectedLotId) || null;

  // Rich Text Editor Commands
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
    toast.info('Template applied to message.');
  };

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await securityEmailerApi.getHistory({
        page: historyPage,
        limit: 15,
        search: historySearch || undefined,
      });
      setHistoryItems(res.emails);
      setHistoryTotal(res.total);
      setHistoryTotalPages(res.totalPages);
    } catch (err) {
      console.warn('Failed to load security email history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historySearch]);

  useEffect(() => {
    if (activeTab === 'history') {
      void fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // Pre-send validation
  const handlePreSend = () => {
    if (!activeOwner) {
      toast.error('No assigned facility owner identified.');
      return;
    }
    if (!subject.trim() || subject.trim().length < 3) {
      toast.error('Please enter a valid subject line (at least 3 characters).');
      return;
    }
    if (!contentHtml.trim() || contentHtml.trim().length < 10) {
      toast.error('Please provide sufficient message content.');
      return;
    }
    setConfirmModalOpen(true);
  };

  // Confirm and Send
  const handleConfirmSend = async () => {
    if (!activeOwner) return;

    // Immediately close/destroy the confirmation modal box
    setConfirmModalOpen(false);
    setIsSending(true);

    const toastId = toast.loading('Dispatching message to Facility Owner...');
    try {
      const res = await securityEmailerApi.sendEmailToOwner({
        parkingLotId: activeOwner.parkingLotId,
        subject: subject.trim(),
        content: contentHtml,
      });

      const isDelivered = res.deliveryStatus !== 'Failed';
      if (isDelivered) {
        toast.success(res.message, {
          id: toastId,
          description: `Reference: ${res.emailReference}`,
        });
      } else {
        toast.warning(res.message, {
          id: toastId,
          description: `Reference: ${res.emailReference}`,
        });
      }

      setLastSentBanner({
        reference: res.emailReference,
        ownerName: activeOwner.ownerName,
        ownerEmail: activeOwner.ownerEmail,
        facilityName: activeOwner.parkingLotName,
        sentAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        status: isDelivered ? 'Sent' : 'Failed',
      });

      setSubject('');
      setContentHtml('<p>Message body...</p>');
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p>Message body...</p>';
      }

      setActiveTab('history');
      void fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(msg, { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 0. DISPATCH FEEDBACK BANNER */}
      {lastSentBanner && (
        <div
          className={cn(
            'p-4 rounded-xl border flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xs',
            lastSentBanner.status === 'Sent'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'p-2 rounded-lg mt-0.5',
                lastSentBanner.status === 'Sent'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  {lastSentBanner.status === 'Sent'
                    ? 'Security Email Dispatched to Facility Owner'
                    : 'Security Email Logged (Delivery Pending)'}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono border-primary/30 text-primary font-bold"
                >
                  {lastSentBanner.reference}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sent to <strong>{lastSentBanner.ownerName}</strong> ({lastSentBanner.ownerEmail}) for facility{' '}
                <strong>{lastSentBanner.facilityName}</strong> at {lastSentBanner.sentAt}.
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Facility Owner Emailer</h1>
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary">
              Security Operations
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Direct authenticated communication line to your assigned facility's Parking Owner.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/70 self-start sm:self-auto">
          <Button
            size="sm"
            variant={activeTab === 'compose' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
            onClick={() => setActiveTab('compose')}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Compose to Owner</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            className="text-xs font-bold gap-1.5 h-8 px-3 cursor-pointer"
            onClick={() => setActiveTab('history')}
          >
            <History className="w-3.5 h-3.5" />
            <span>Sent Messages</span>
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: COMPOSE TO OWNER */}
      {/* ===================================================================== */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: AUTOMATICALLY IDENTIFIED RECIPIENT CARD (4 Cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-4">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Designated Recipient
                </span>
                <h3 className="text-sm font-bold text-foreground mt-1">Facility Owner Information</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically mapped to your active security staff assignment.
                </p>
              </div>

              {loadingOwners ? (
                <div className="py-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Identifying assigned facility owner...</span>
                </div>
              ) : assignedOwners.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>No Active Assignment Found</span>
                  </div>
                  <p className="leading-relaxed">
                    You are not currently assigned to any active parking facility. Please contact management or your administrator.
                  </p>
                </div>
              ) : (
                <>
                  {/* Facility Selector (if assigned to multiple facilities) */}
                  {assignedOwners.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Assigned Facility
                      </label>
                      <Select value={selectedLotId} onValueChange={setSelectedLotId}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="Select facility" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignedOwners.map((item) => (
                            <SelectItem key={item.parkingLotId} value={item.parkingLotId} className="text-xs">
                              {item.parkingLotName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Recipient Details Badge Box */}
                  {activeOwner && (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground font-semibold block">Facility Name</span>
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <span>{activeOwner.parkingLotName}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/60 pt-2">
                        <span className="text-[11px] text-muted-foreground font-semibold block">Parking Owner</span>
                        <div className="font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{activeOwner.ownerName}</span>
                        </div>
                      </div>

                      <div className="border-t border-border/60 pt-2">
                        <span className="text-[11px] text-muted-foreground font-semibold block">Verified Email</span>
                        <div className="font-mono text-[11px] text-foreground font-medium flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{activeOwner.ownerEmail}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Recipient locked to assigned owner (verified)</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Quick Templates Card */}
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-4 space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Security Quick Templates
              </span>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyTemplate(
                      'Urgent Security Report: On-Site Vehicle Discrepancy',
                      '<p>Facility Owner,</p><p>Reporting an on-site issue during the active patrol shift. A vehicle was found occupying a bay inconsistent with its QR booking pass. Physical inspection photos have been uploaded to the Security Incidents portal.</p><p>Please advise on authorized management action.</p>',
                    )
                  }
                  className="w-full text-xs justify-start font-medium h-8"
                >
                  🚨 Vehicle Discrepancy Report
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyTemplate(
                      'Daily Security Shift Handover & Barrier Status',
                      '<p>Facility Management,</p><p>Completing operational shift handover. All physical boom barriers and QR scanners functioned normally during the shift. Total walk-in cash collected has been accounted for and logged in the system.</p><p>Handover completed to the next shift officer.</p>',
                    )
                  }
                  className="w-full text-xs justify-start font-medium h-8"
                >
                  📋 Daily Shift Handover Summary
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    applyTemplate(
                      'Maintenance Request: Entry Barrier / Camera Hardware Glitch',
                      '<p>Facility Owner,</p><p>Requesting technician review for the primary entry gate barrier. The mechanism showed intermittent delay during peak ingress today. No damage observed, but preventative servicing is recommended.</p>',
                    )
                  }
                  className="w-full text-xs justify-start font-medium h-8"
                >
                  🔧 Equipment Maintenance Request
                </Button>
              </div>
            </Card>
          </div>

          {/* RIGHT: COMPOSER (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Message Composition</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compose your operational message. It will be sent via official ParkEase branded HTML email.
                </p>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Subject Line</label>
                <Input
                  placeholder="e.g., Security Shift Report: Operational Notice for Facility Management"
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
                  Recipient: <strong className="text-foreground">{activeOwner?.ownerName || 'None'}</strong>{' '}
                  ({activeOwner?.ownerEmail || 'Unassigned'})
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
                    disabled={!activeOwner || isSending}
                    className="text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Owner</span>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SENT HISTORY */}
      {/* ===================================================================== */}
      {activeTab === 'history' && (
        <Card className="rounded-xl border border-border/80 shadow-2xs bg-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Your Sent Communications</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Historical record of emails dispatched by you to facility management.
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

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search subject or reference..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          {/* History Table */}
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Facility</th>
                  <th className="py-2.5 px-3">Recipient Owner</th>
                  <th className="py-2.5 px-3">Sent At</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading sent history...</span>
                      </div>
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No sent messages recorded yet.
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
                      <td className="py-2.5 px-3 text-muted-foreground truncate">
                        {item.parkingLotId?.parkingName || 'Assigned Facility'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground truncate max-w-[150px]">
                        {item.recipientEmails?.[0] || 'Facility Owner'}
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
                          onClick={() => setSelectedHistoryItem(item)}
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
      {/* PREVIEW MODAL */}
      {/* ===================================================================== */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>Email Preview: {subject || 'Untitled Notice'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rendered in official ParkEase format as delivered to the Facility Owner.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-border/80 rounded-xl overflow-hidden bg-muted/20">
            <div className="bg-primary/95 text-primary-foreground p-4 text-center">
              <h2 className="text-lg font-black tracking-wider uppercase">ParkEase</h2>
              <p className="text-[11px] opacity-90">Security Operations Notice</p>
            </div>
            <div className="p-5 bg-card space-y-4">
              <div className="border-b border-border/60 pb-2">
                <span className="text-[11px] text-muted-foreground block">Facility</span>
                <div className="font-bold text-foreground text-xs">{activeOwner?.parkingLotName}</div>
              </div>
              <div className="border-b border-border/60 pb-2">
                <span className="text-[11px] text-muted-foreground block">Subject</span>
                <div className="font-bold text-foreground text-xs">{subject || 'No Subject'}</div>
              </div>
              <div
                className="text-xs text-foreground leading-relaxed prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            </div>
            <div className="bg-muted/60 p-3.5 border-t border-border/60 text-center text-[10px] text-muted-foreground">
              Sent directly by On-Duty Security Officer. &copy; {new Date().getFullYear()} ParkEase.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewModalOpen(false)}>
              Close
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
              <span>Confirm Delivery to Owner</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm dispatch of this operational message to the verified Facility Owner.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Facility:</span>
              <strong className="text-foreground">{activeOwner?.parkingLotName}</strong>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Owner Recipient:</span>
              <strong className="text-foreground">{activeOwner?.ownerName}</strong>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Email:</span>
              <strong className="font-mono text-foreground">{activeOwner?.ownerEmail}</strong>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={isSending}
              onClick={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSending}
              onClick={handleConfirmSend}
              className="font-bold gap-1.5"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm &amp; Send</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* VIEW SENT MESSAGE MODAL */}
      {/* ===================================================================== */}
      <Dialog open={Boolean(selectedHistoryItem)} onOpenChange={(open) => !open && setSelectedHistoryItem(null)}>
        <DialogContent className="max-w-lg">
          {selectedHistoryItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Message Details: {selectedHistoryItem.emailReference}</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Sent on {new Date(selectedHistoryItem.createdAt).toLocaleString('en-IN')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subject:</span>
                    <strong className="text-foreground">{selectedHistoryItem.subject}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recipient Email:</span>
                    <strong className="font-mono text-foreground">{selectedHistoryItem.recipientEmails?.[0]}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Status:</span>
                    <Badge variant={selectedHistoryItem.deliveryStatus === 'Sent' ? 'default' : 'destructive'}>
                      {selectedHistoryItem.deliveryStatus}
                    </Badge>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Message Body
                  </span>
                  <div
                    className="p-3 rounded-xl border border-border/80 bg-background leading-relaxed max-h-48 overflow-y-auto prose dark:prose-invert text-xs"
                    dangerouslySetInnerHTML={{ __html: selectedHistoryItem.content }}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedHistoryItem(null)}>
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

export default SecurityEmailerPage;
