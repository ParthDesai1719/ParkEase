import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  MessageSquare,
  Send,
  Building2,
  FileText,
  Check,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getOwnerIncidents,
  getOwnerIncidentDetail,
  addOwnerIncidentResponse,
  updateOwnerIncidentStatus,
  type OwnerIncidentItem,
} from '@/api/ownerIncidents.api';
import { cn } from '@/lib/utils';

export const OwnerIncidentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  // Filter States
  const [selectedLotId, setSelectedLotId] = useState<string>(searchParams.get('lotId') || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || 'all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>(searchParams.get('severity') || 'all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Data States
  const [incidents, setIncidents] = useState<OwnerIncidentItem[]>([]);
  const [ownerLots, setOwnerLots] = useState<Array<{ _id: string; parkingName: string }>>([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    underInvestigation: 0,
    resolved: 0,
    closed: 0,
    criticalOrHigh: 0,
  });
  const [pagination, setPagination] = useState({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 15,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsRefreshing] = useState(false);

  // Detail Modal States
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [activeIncident, setActiveIncident] = useState<OwnerIncidentItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Response Form State
  const [responseMessage, setResponseMessage] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Lifecycle Action Modal States
  const [lifecycleModal, setLifecycleModal] = useState<{
    isOpen: boolean;
    targetStatus: 'Under Investigation' | 'Resolved' | 'Closed' | null;
    resolutionNotes: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    targetStatus: null,
    resolutionNotes: '',
    isSubmitting: false,
  });

  // Fetch Incidents List
  const fetchIncidentsData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await getOwnerIncidents({
        parkingLotId: selectedLotId,
        status: selectedStatus,
        severity: selectedSeverity,
        incidentType: selectedType,
        search: searchQuery,
        page,
        limit: 15,
      });

      if (res.success && res.data) {
        setIncidents(Array.isArray(res.data.incidents) ? res.data.incidents : []);
        setSummary(
          res.data.summary || {
            total: 0,
            open: 0,
            underInvestigation: 0,
            resolved: 0,
            closed: 0,
            criticalOrHigh: 0,
          },
        );
        setPagination(
          res.data.pagination || {
            totalCount: 0,
            totalPages: 1,
            currentPage: 1,
            limit: 15,
          },
        );
        setOwnerLots(Array.isArray(res.data.ownerLots) ? res.data.ownerLots : []);
      }
      if (isManual) {
        toast.success('Incident reports updated.');
      }
    } catch (err: unknown) {
      toast.error('Failed to load incident reports.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedLotId, selectedStatus, selectedSeverity, selectedType, searchQuery, page]);

  useEffect(() => {
    fetchIncidentsData();
  }, [fetchIncidentsData]);

  useLiveSync(() => {
    void fetchIncidentsData(true);
  });

  // Open Incident Detail
  const handleOpenDetail = async (incidentId: string) => {
    setActiveIncidentId(incidentId);
    setIsLoadingDetail(true);
    setResponseMessage('');
    try {
      const res = await getOwnerIncidentDetail(incidentId);
      if (res.success && res.data) {
        setActiveIncident(res.data);
      }
    } catch {
      toast.error('Failed to load incident details.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Submit Response
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIncidentId || !responseMessage.trim()) return;

    setIsSubmittingResponse(true);
    try {
      const res = await addOwnerIncidentResponse(activeIncidentId, {
        message: responseMessage.trim(),
      });
      if (res.success && res.data) {
        setActiveIncident(res.data);
        setResponseMessage('');
        toast.success('Response dispatched to on-site security staff.');
        // Refresh background list item
        setIncidents((prev) =>
          prev.map((item) => (item._id === activeIncidentId ? res.data : item)),
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit response.';
      toast.error(message);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Execute Lifecycle Status Change
  const handleExecuteStatusChange = async () => {
    if (!activeIncidentId || !lifecycleModal.targetStatus) return;

    if (
      lifecycleModal.targetStatus === 'Resolved' &&
      !lifecycleModal.resolutionNotes.trim() &&
      !activeIncident?.resolutionNotes
    ) {
      toast.error('Please specify resolution notes before resolving.');
      return;
    }

    setLifecycleModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await updateOwnerIncidentStatus(activeIncidentId, {
        status: lifecycleModal.targetStatus,
        resolutionNotes: lifecycleModal.resolutionNotes.trim() || undefined,
      });

      if (res.success && res.data) {
        setActiveIncident(res.data);
        setIncidents((prev) =>
          prev.map((item) => (item._id === activeIncidentId ? res.data : item)),
        );
        toast.success(`Incident status updated to ${lifecycleModal.targetStatus}.`);
        setLifecycleModal({
          isOpen: false,
          targetStatus: null,
          resolutionNotes: '',
          isSubmitting: false,
        });
        // Refresh summary
        fetchIncidentsData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update incident status.';
      toast.error(msg);
      setLifecycleModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Severity Badge Styler
  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">Critical</Badge>;
      case 'High':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">High</Badge>;
      case 'Medium':
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">Medium</Badge>;
      default:
        return <Badge className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30">Low</Badge>;
    }
  };

  // Status Badge Styler
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 font-semibold">Open</Badge>;
      case 'Under Investigation':
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold">Under Investigation</Badge>;
      case 'Resolved':
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold">Resolved</Badge>;
      case 'Closed':
        return <Badge className="bg-muted text-muted-foreground border border-border font-semibold">Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Incident Reports & Security Coordination
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary font-bold">
              OWNER-06
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time on-site security incident feed, investigation timeline, and operational staff communication.
          </p>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="rounded-xl border border-border/80 p-4 bg-card shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground block">
            Total Incidents
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-black text-foreground">
              {isLoading ? <Skeleton className="h-7 w-12" /> : summary.total}
            </span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">All logged incidents</span>
        </Card>

        <Card className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-400 block">
            Open Reports
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-black text-sky-700 dark:text-sky-300">
              {isLoading ? <Skeleton className="h-7 w-12" /> : summary.open}
            </span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <span className="text-[10px] text-sky-600/80 mt-1 block">Awaiting investigation</span>
        </Card>

        <Card className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
            Investigating
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300">
              {isLoading ? <Skeleton className="h-7 w-12" /> : summary.underInvestigation}
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-[10px] text-amber-600/80 mt-1 block">Active operations</span>
        </Card>

        <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-2xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
            Critical & High
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-300">
              {isLoading ? <Skeleton className="h-7 w-12" /> : summary.criticalOrHigh}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-[10px] text-rose-600/80 mt-1 block">Urgent attention</span>
        </Card>

        <Card className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
            Resolved
          </span>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {isLoading ? <Skeleton className="h-7 w-12" /> : summary.resolved}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[10px] text-emerald-600/80 mt-1 block">Closed & finalized</span>
        </Card>
      </div>

      {/* 3. Filters & Search Bar */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Facility Filter */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Facility</Label>
            <Select value={selectedLotId} onValueChange={(val) => { setSelectedLotId(val); setPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {ownerLots?.map((lot) => (
                  <SelectItem key={lot._id} value={lot._id}>
                    {lot.parkingName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</Label>
            <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Severity Filter */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Severity</Label>
            <Select value={selectedSeverity} onValueChange={(val) => { setSelectedSeverity(val); setPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="Critical">Critical</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Incident Type Filter */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Incident Type</Label>
            <Select value={selectedType} onValueChange={(val) => { setSelectedType(val); setPage(1); }}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Invalid QR">Invalid QR</SelectItem>
                <SelectItem value="Wrong Vehicle">Wrong Vehicle</SelectItem>
                <SelectItem value="Overstay">Overstay</SelectItem>
                <SelectItem value="Lost Ticket">Lost Ticket</SelectItem>
                <SelectItem value="Vehicle Damage">Vehicle Damage</SelectItem>
                <SelectItem value="Parking Dispute">Parking Dispute</SelectItem>
                <SelectItem value="Unauthorized Entry">Unauthorized Entry</SelectItem>
                <SelectItem value="Security Concern">Security Concern</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Query */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Search</Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-3" />
              <Input
                placeholder="Ref, title, keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Incidents Table / List */}
      <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Logged Incident Reports ({pagination.totalCount})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Select an incident to view investigation evidence, linked records, and message security staff.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground text-sm">No Incidents Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No active or historical incidents match your selected filters. All operational facilities report clear.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Facility & Location</th>
                    <th className="py-3 px-4">Type & Title</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reported By</th>
                    <th className="py-3 px-4">Communication</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {incidents.map((inc) => (
                    <tr
                      key={inc._id}
                      onClick={() => handleOpenDetail(inc._id)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        {inc.incidentReference}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground block">{inc.parkingName}</span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {inc.location || 'On-site'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mb-1">
                          {inc.incidentType}
                        </Badge>
                        <p className="font-medium text-foreground truncate">{inc.title}</p>
                      </td>
                      <td className="py-3.5 px-4">{renderSeverityBadge(inc.severity)}</td>
                      <td className="py-3.5 px-4">{renderStatusBadge(inc.incidentStatus)}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-foreground block">
                          {inc.reportedBy?.fullName || 'Security Staff'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(inc.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-[11px]">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          <span className="font-bold text-foreground">
                            {inc.responses?.length || 0}
                          </span>
                          <span className="text-muted-foreground text-[10px]">messages</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(inc._id);
                          }}
                        >
                          Inspect &rarr;
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Showing page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 text-xs cursor-pointer"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. INCIDENT DETAILS & CONVERSATION MODAL */}
      <Dialog
        open={Boolean(activeIncidentId)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveIncidentId(null);
            setActiveIncident(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {isLoadingDetail || !activeIncident ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div>
              {/* Modal Header */}
              <div className="p-5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                      {activeIncident.incidentReference}
                    </span>
                    {renderSeverityBadge(activeIncident.severity)}
                    {renderStatusBadge(activeIncident.incidentStatus)}
                  </div>
                  <h2 className="text-lg font-black text-foreground mt-1.5">{activeIncident.title}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {activeIncident.parkingName} • Reported by {activeIncident.reportedBy.fullName} on{' '}
                    {new Date(activeIncident.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                {/* Status Transition Action Buttons */}
                <div className="flex items-center gap-2">
                  {activeIncident.incidentStatus === 'Open' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold border-amber-500/40 text-amber-600 hover:bg-amber-500/10 cursor-pointer"
                      onClick={() =>
                        setLifecycleModal({
                          isOpen: true,
                          targetStatus: 'Under Investigation',
                          resolutionNotes: '',
                          isSubmitting: false,
                        })
                      }
                    >
                      Investigate
                    </Button>
                  )}

                  {(activeIncident.incidentStatus === 'Open' ||
                    activeIncident.incidentStatus === 'Under Investigation') && (
                    <Button
                      size="sm"
                      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      onClick={() =>
                        setLifecycleModal({
                          isOpen: true,
                          targetStatus: 'Resolved',
                          resolutionNotes: activeIncident.resolutionNotes || '',
                          isSubmitting: false,
                        })
                      }
                    >
                      Resolve Incident
                    </Button>
                  )}

                  {activeIncident.incidentStatus === 'Resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-semibold border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-slate-500/10 cursor-pointer"
                      onClick={() =>
                        setLifecycleModal({
                          isOpen: true,
                          targetStatus: 'Closed',
                          resolutionNotes: activeIncident.resolutionNotes || '',
                          isSubmitting: false,
                        })
                      }
                    >
                      Close & Archive
                    </Button>
                  )}

                  {activeIncident.incidentStatus === 'Closed' && (
                    <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                      Historically Finalized
                    </Badge>
                  )}
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-6">
                {/* A. Quick Linked Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-semibold uppercase">
                      Incident Type
                    </span>
                    <span className="font-bold text-foreground mt-0.5 block">{activeIncident.incidentType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-semibold uppercase">
                      Linked Vehicle
                    </span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block">
                      {activeIncident.vehicleNumber || 'None Specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-semibold uppercase">
                      Booking Reference
                    </span>
                    <span className="font-mono font-bold text-primary mt-0.5 block">
                      {activeIncident.bookingReference || 'No Booking Linked'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block font-semibold uppercase">
                      Linked Customer
                    </span>
                    <span className="font-bold text-foreground mt-0.5 block">
                      {activeIncident.customerName || 'Walk-in / Unknown'}
                    </span>
                  </div>
                </div>

                {/* B. Original Security Incident Report */}
                <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5 text-foreground font-bold">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Original Security Report
                    </span>
                    <span>
                      {new Date(activeIncident.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                    {activeIncident.description}
                  </p>

                  {/* Evidence Attachments */}
                  {activeIncident.attachments && activeIncident.attachments.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[11px] font-bold text-muted-foreground block mb-2">
                        Attached Evidence ({activeIncident.attachments.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {activeIncident.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Evidence Photo #{i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution Notes If Applicable */}
                  {activeIncident.resolutionNotes && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                        Resolution & Investigation Outcome:
                      </span>
                      <p className="text-emerald-900 dark:text-emerald-200">
                        {activeIncident.resolutionNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* C. Chronological Communication & Response Timeline */}
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Operational Coordination Timeline ({activeIncident.responses?.length || 0})
                  </h3>

                  {(!activeIncident.responses || activeIncident.responses.length === 0) ? (
                    <div className="p-6 text-center rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground">
                      No operational responses recorded yet. Write below to coordinate with on-site staff.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeIncident.responses.map((resp) => {
                        const isOwner = resp.authorRole === 'PARKING_OWNER' || resp.authorRole === 'OWNER';
                        return (
                          <div
                            key={resp.responseId}
                            className={cn(
                              'p-3.5 rounded-xl border text-xs space-y-1.5 transition-all',
                              isOwner
                                ? 'bg-primary/5 border-primary/20 ml-6 sm:ml-12'
                                : 'bg-muted/40 border-border/80 mr-6 sm:mr-12',
                            )}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-foreground">{resp.authorName}</span>
                                <Badge
                                  variant={isOwner ? 'default' : 'secondary'}
                                  className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                                >
                                  {isOwner ? 'Parking Owner' : 'Security Officer'}
                                </Badge>
                              </div>
                              <span className="text-muted-foreground text-[10px]">
                                {new Date(resp.createdAt).toLocaleString('en-IN', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </span>
                            </div>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                              {resp.message}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* D. Response Composer (Available if not Closed) */}
                  {activeIncident.incidentStatus !== 'Closed' ? (
                    <form onSubmit={handleSubmitResponse} className="mt-4 pt-3 border-t border-border/60 space-y-2.5">
                      <Label className="text-xs font-bold text-foreground">
                        Post Operational Response / Instructions
                      </Label>
                      <Textarea
                        placeholder="Provide directives, verification status, or guidance for security staff on site..."
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        rows={3}
                        className="text-xs resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          Logged to incident activity and dispatched in real-time to security staff.
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSubmittingResponse || !responseMessage.trim()}
                          className="gap-2 cursor-pointer text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isSubmittingResponse ? 'Sending...' : 'Send to Staff'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 bg-muted/40 rounded-lg text-center text-xs text-muted-foreground border border-border/60">
                      This incident is closed. No further responses can be posted to historically finalized records.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. STATUS TRANSITION CONFIRMATION MODAL */}
      <Dialog
        open={lifecycleModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {lifecycleModal.targetStatus === 'Under Investigation' && 'Begin Incident Investigation'}
              {lifecycleModal.targetStatus === 'Resolved' && 'Resolve Incident Report'}
              {lifecycleModal.targetStatus === 'Closed' && 'Close & Archive Incident'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {lifecycleModal.targetStatus === 'Under Investigation' &&
                'Move this incident into active investigation. Staff will be notified.'}
              {lifecycleModal.targetStatus === 'Resolved' &&
                'Record resolution details and mark the incident as resolved.'}
              {lifecycleModal.targetStatus === 'Closed' &&
                'Historically finalize this incident. No further edits or responses can be submitted once closed.'}
            </DialogDescription>
          </DialogHeader>

          {lifecycleModal.targetStatus === 'Resolved' && (
            <div className="space-y-1.5 py-2">
              <Label className="text-xs font-semibold text-foreground">
                Resolution Notes / Findings <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                placeholder="Detail resolution steps, compensation, gate release, or investigative conclusions..."
                value={lifecycleModal.resolutionNotes}
                onChange={(e) =>
                  setLifecycleModal((prev) => ({ ...prev, resolutionNotes: e.target.value }))
                }
                rows={3}
                className="text-xs"
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={lifecycleModal.isSubmitting}
              onClick={() => setLifecycleModal((prev) => ({ ...prev, isOpen: false }))}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={lifecycleModal.isSubmitting}
              onClick={handleExecuteStatusChange}
              className={cn(
                'text-xs cursor-pointer',
                lifecycleModal.targetStatus === 'Resolved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : lifecycleModal.targetStatus === 'Closed'
                  ? 'bg-slate-700 hover:bg-slate-800 text-white'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {lifecycleModal.isSubmitting
                ? 'Updating...'
                : lifecycleModal.targetStatus === 'Resolved'
                ? 'Confirm Resolution'
                : lifecycleModal.targetStatus === 'Closed'
                ? 'Finalize & Close'
                : 'Confirm Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerIncidentsPage;
