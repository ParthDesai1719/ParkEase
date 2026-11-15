import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Plus,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Camera,
  X,
  FileText,
  Upload,
  User,
  ShieldAlert,
  Car,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  securityApi,
  type SecurityAssignedFacility,
  type SecurityIncident,
  type SecurityIncidentListResult,
} from '@/api/security.api';
import { getSocket } from '@/lib/socket';

const LOCAL_STORAGE_KEY = 'parkease_security_active_lot_id';

const INCIDENT_TYPES = [
  'Invalid QR',
  'Wrong Vehicle',
  'Overstay',
  'Lost Ticket',
  'Vehicle Damage',
  'Other',
] as const;

const PRIORITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

const STATUS_FILTERS = ['ALL', 'Open', 'Under Investigation', 'Resolved', 'Closed'] as const;

export const SecurityIncidentsPage: React.FC = () => {
  // Facility Context
  const [facilities, setFacilities] = useState<SecurityAssignedFacility[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);

  // Incidents Data & Pagination
  const [incidentsData, setIncidentsData] = useState<SecurityIncidentListResult | null>(null);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Create Incident Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newType, setNewType] = useState<string>('Invalid QR');
  const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [newVehicleNumber, setNewVehicleNumber] = useState<string>('');
  const [newBookingReference, setNewBookingReference] = useState<string>('');
  const [newLocation, setNewLocation] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // View / Detail Dialog State
  const [viewedIncident, setViewedIncident] = useState<SecurityIncident | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Resolve Modal State
  const [resolveIncidentId, setResolveIncidentId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const [, startTransition] = useTransition();

  // Active facility object
  const activeFacility = facilities.find((f) => f.parkingLotId === selectedLotId);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchQuery);
        setPage(1);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 1. Load Facilities
  useEffect(() => {
    let isMounted = true;
    async function loadFacilities() {
      try {
        setIsLoadingFacilities(true);
        const facs = await securityApi.getAssignedFacilities();
        if (!isMounted) return;
        setFacilities(facs);

        if (facs.length > 0) {
          const savedLotId = localStorage.getItem(LOCAL_STORAGE_KEY);
          const isValidSaved = savedLotId && facs.some((f) => f.parkingLotId === savedLotId);
          const initialId = isValidSaved ? savedLotId : facs[0].parkingLotId;
          setSelectedLotId(initialId);
          localStorage.setItem(LOCAL_STORAGE_KEY, initialId);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load assigned facilities';
        toast.error(msg);
      } finally {
        if (isMounted) setIsLoadingFacilities(false);
      }
    }

    loadFacilities();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Incidents
  const fetchIncidents = useCallback(async () => {
    if (!selectedLotId) return;
    try {
      setIsLoadingIncidents(true);
      const data = await securityApi.getIncidents({
        parkingLotId: selectedLotId,
        status: selectedStatus,
        severity: selectedPriority,
        incidentType: selectedType,
        search: debouncedSearch,
        page,
        limit,
      });
      setIncidentsData(data);
    } catch (err: unknown) {
      console.warn('Failed to load incidents:', err);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, [selectedLotId, selectedStatus, selectedPriority, selectedType, debouncedSearch, page, limit]);

  useEffect(() => {
    if (selectedLotId && !isLoadingFacilities) {
      fetchIncidents();
    }
  }, [selectedLotId, isLoadingFacilities, fetchIncidents]);

  // 3. Socket.IO Real-time Synchronization
  useEffect(() => {
    const socket = getSocket();
    if (selectedLotId) {
      socket.emit('join_lot', selectedLotId);
    }

    const handleIncidentUpdate = (payload: { parkingLotId?: string }) => {
      if (!payload.parkingLotId || payload.parkingLotId === selectedLotId) {
        fetchIncidents();
      }
    };

    socket.on('incident_updated', handleIncidentUpdate);

    return () => {
      socket.off('incident_updated', handleIncidentUpdate);
    };
  }, [selectedLotId, fetchIncidents]);

  // Handle Facility Switch
  const handleFacilityChange = (lotId: string) => {
    setSelectedLotId(lotId);
    localStorage.setItem(LOCAL_STORAGE_KEY, lotId);
    setPage(1);
  };

  // Image File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (selectedFiles.length + files.length > 5) {
      toast.error('Maximum 5 images allowed per incident report.');
      return;
    }

    const updated = [...selectedFiles, ...files].slice(0, 5);
    setSelectedFiles(updated);

    const previews = updated.map((file) => URL.createObjectURL(file));
    setFilePreviews(previews);
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
  };

  // Reset Create Form
  const resetCreateForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewType('Invalid QR');
    setNewPriority('Medium');
    setNewVehicleNumber('');
    setNewBookingReference('');
    setNewLocation('');
    setSelectedFiles([]);
    setFilePreviews([]);
    setIsCreateOpen(false);
  };

  // Submit Create Incident
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLotId) {
      toast.error('Please select an active parking facility.');
      return;
    }

    if (!newTitle.trim() || newTitle.trim().length < 3) {
      toast.error('Please enter an incident title (at least 3 characters).');
      return;
    }

    if (!newDescription.trim() || newDescription.trim().length < 5) {
      toast.error('Please enter an incident description (at least 5 characters).');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload photos first if attached
      let attachmentUrls: string[] = [];
      if (selectedFiles.length > 0) {
        const uploadRes = await securityApi.uploadIncidentImages(selectedFiles, selectedLotId);
        attachmentUrls = uploadRes.urls;
      }

      const created = await securityApi.createIncident({
        parkingLotId: selectedLotId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        incidentType: newType,
        severity: newPriority,
        vehicleNumber: newVehicleNumber.trim() || undefined,
        bookingReference: newBookingReference.trim() || undefined,
        location: newLocation.trim() || undefined,
        attachments: attachmentUrls,
      });

      toast.success(`Incident ${created.incidentReference} reported successfully!`);
      resetCreateForm();
      fetchIncidents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to report incident';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Update Handler
  const handleStatusChange = async (
    incidentId: string,
    newStatus: 'Open' | 'Under Investigation' | 'Resolved' | 'Closed',
    notes?: string,
  ) => {
    if (!selectedLotId) return;
    try {
      setIsResolving(true);
      const updated = await securityApi.updateIncidentStatus(incidentId, selectedLotId, {
        status: newStatus,
        resolutionNotes: notes,
      });

      toast.success(`Incident ${updated.incidentReference} marked as ${newStatus}.`);

      if (viewedIncident && viewedIncident._id === incidentId) {
        setViewedIncident(updated);
      }

      setResolveIncidentId(null);
      setResolutionNotes('');
      fetchIncidents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update incident status';
      toast.error(msg);
    } finally {
      setIsResolving(false);
    }
  };

  // Priority color styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">Critical</Badge>;
      case 'High':
        return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Medium</Badge>;
      case 'Low':
      default:
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Low</Badge>;
    }
  };

  // Status color styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">Open</Badge>;
      case 'Under Investigation':
        return <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Under Investigation</Badge>;
      case 'Resolved':
        return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Resolved</Badge>;
      case 'Closed':
      default:
        return <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-500">Closed</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* 1. Header & Terminal Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Gate Incident Reports
              </h1>
              <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs font-semibold">
                Security Command
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Record gate infractions, damage, disputes, and physical security occurrences for your assigned post.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Facility Switcher */}
          {isLoadingFacilities ? (
            <Skeleton className="h-9 w-48 rounded-md" />
          ) : facilities.length > 0 ? (
            <div className="w-56">
              <Select value={selectedLotId} onValueChange={handleFacilityChange}>
                <SelectTrigger className="h-9 text-xs bg-card border-border/80">
                  <Building2 className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((fac) => (
                    <SelectItem key={fac.parkingLotId} value={fac.parkingLotId} className="text-xs">
                      {fac.parkingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* "+ Report Incident" Primary Action */}
          <Button
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Report Incident</span>
          </Button>

          <Link to="/security/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Live KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <Card className="border-border/80 bg-card/60 shadow-xs p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Incidents</span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {incidentsData?.summary.total ?? 0}
          </div>
        </Card>

        <Card className="border-border/80 bg-amber-500/5 shadow-xs p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Open</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {incidentsData?.summary.open ?? 0}
          </div>
        </Card>

        <Card className="border-border/80 bg-indigo-500/5 shadow-xs p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Investigating</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {incidentsData?.summary.underInvestigation ?? 0}
          </div>
        </Card>

        <Card className="border-border/80 bg-emerald-500/5 shadow-xs p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {incidentsData?.summary.resolved ?? 0}
          </div>
        </Card>

        <Card className="border-border/80 bg-rose-500/5 shadow-xs p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Critical Priority</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {incidentsData?.summary.critical ?? 0}
          </div>
        </Card>
      </div>

      {/* 3. Search & Filter Bar */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search Reference, Vehicle, Title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9 bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Status */}
              <div className="w-36">
                <Select value={selectedStatus} onValueChange={(val) => { setSelectedStatus(val); setPage(1); }}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s === 'ALL' ? 'All Statuses' : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="w-32">
                <Select value={selectedPriority} onValueChange={(val) => { setSelectedPriority(val); setPage(1); }}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">All Priorities</SelectItem>
                    {PRIORITY_LEVELS.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="w-36">
                <Select value={selectedType} onValueChange={(val) => { setSelectedType(val); setPage(1); }}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Incident Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                    {INCIDENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchIncidents}
                disabled={isLoadingIncidents}
                className="h-9 px-3 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIncidents ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Incidents List & Data Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>Incident Logs</span>
            <Badge variant="outline" className="font-mono text-xs">
              {incidentsData?.pagination.totalCount ?? 0}
            </Badge>
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            Facility: <strong className="text-foreground">{activeFacility?.parkingName || 'Active Post'}</strong>
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingIncidents ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : !incidentsData || incidentsData.incidents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted/30 text-muted-foreground flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">No Incidents Reported</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {debouncedSearch || selectedStatus !== 'ALL' || selectedPriority !== 'ALL' || selectedType !== 'ALL'
                    ? 'No incidents match your current filter settings. Try adjusting your search query.'
                    : 'The selected facility currently has no recorded gate infractions or security incidents.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {incidentsData.incidents.map((inc) => (
                <div
                  key={inc._id}
                  className="p-4.5 hover:bg-muted/15 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left Column: Reference, Date, Title, Badges */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs text-foreground tracking-wide">
                        {inc.incidentReference}
                      </span>
                      {getPriorityBadge(inc.severity)}
                      {getStatusBadge(inc.incidentStatus)}
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {inc.incidentType}
                      </Badge>
                      {inc.attachments.length > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <Camera className="w-2.5 h-2.5" />
                          <span>{inc.attachments.length} {inc.attachments.length === 1 ? 'photo' : 'photos'}</span>
                        </Badge>
                      )}
                    </div>

                    <div className="font-semibold text-sm text-foreground truncate">
                      {inc.title}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-1 max-w-2xl">
                      {inc.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{new Date(inc.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </span>
                      {inc.vehicleNumber && (
                        <span className="flex items-center gap-1 font-mono text-foreground">
                          <Car className="w-3 h-3 text-muted-foreground" />
                          <span>{inc.vehicleNumber}</span>
                        </span>
                      )}
                      {inc.location && (
                        <span>&bull; Location: <strong className="text-foreground">{inc.location}</strong></span>
                      )}
                      <span>&bull; Reported by: <strong className="text-foreground">{inc.reportedBy.fullName}</strong></span>
                    </div>
                  </div>

                  {/* Right Column: Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewedIncident(inc);
                        setIsDetailOpen(true);
                      }}
                      className="gap-1.5 text-xs h-8 px-3"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Button>

                    {inc.incidentStatus !== 'Resolved' && inc.incidentStatus !== 'Closed' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setResolveIncidentId(inc._id);
                          setResolutionNotes('');
                        }}
                        className="gap-1.5 text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* Pagination Footer */}
        {incidentsData && incidentsData.pagination.totalPages > 1 && (
          <div className="p-3.5 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing Page <strong>{incidentsData.pagination.currentPage}</strong> of{' '}
              <strong>{incidentsData.pagination.totalPages}</strong> (Total {incidentsData.pagination.totalCount})
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-7 px-2 text-xs gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= incidentsData.pagination.totalPages}
                className="h-7 px-2 text-xs gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. REPORT INCIDENT MODAL DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>Report Security Gate Incident</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateIncident} className="space-y-4 pt-2">
            {/* Facility Notice */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/80 text-xs text-muted-foreground flex items-center justify-between">
              <span>Facility Post:</span>
              <strong className="text-foreground">{activeFacility?.parkingName || 'Current Post'}</strong>
            </div>

            {/* Type & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="incident-type" className="text-xs font-semibold">
                  Incident Type <span className="text-rose-500">*</span>
                </Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger id="incident-type" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="incident-priority" className="text-xs font-semibold">
                  Priority / Severity <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={newPriority}
                  onValueChange={(val: any) => setNewPriority(val)}
                >
                  <SelectTrigger id="incident-priority" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_LEVELS.map((p) => (
                      <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="incident-title" className="text-xs font-semibold">
                Incident Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="incident-title"
                placeholder="Brief summary e.g. Driver vehicle scratched barrier at exit lane"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={100}
                required
                className="h-9 text-xs"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="incident-desc" className="text-xs font-semibold">
                Detailed Incident Description <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="incident-desc"
                placeholder="Describe sequence of events, persons involved, damages observed, and immediate actions taken..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                required
                className="text-xs resize-none"
              />
            </div>

            {/* Vehicle Number & Booking Reference Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehicle-num" className="text-xs font-semibold">
                  Vehicle Registration <span className="text-muted-foreground text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="vehicle-num"
                  placeholder="e.g. MH02AB1234"
                  value={newVehicleNumber}
                  onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="booking-ref" className="text-xs font-semibold">
                  Booking Reference <span className="text-muted-foreground text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="booking-ref"
                  placeholder="e.g. BK-..."
                  value={newBookingReference}
                  onChange={(e) => setNewBookingReference(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>
            </div>

            {/* Location in Facility */}
            <div className="space-y-1.5">
              <Label htmlFor="incident-loc" className="text-xs font-semibold">
                Location / Zone in Facility <span className="text-muted-foreground text-[10px]">(Optional)</span>
              </Label>
              <Input
                id="incident-loc"
                placeholder="e.g. Exit Barrier 2, Level B1 - Zone C"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Photo Attachments (Max 5) */}
            <div className="space-y-2 pt-1 border-t border-border/60">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-primary" />
                  <span>Attach Evidence Photos</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {selectedFiles.length} of 5 selected
                </span>
              </div>

              {/* Upload Drop Area */}
              {selectedFiles.length < 5 && (
                <label className="border-2 border-dashed border-border/80 hover:border-primary/50 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Click or drag photos here</span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP up to 10MB each</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}

              {/* Image Previews Grid */}
              {filePreviews.length > 0 && (
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {filePreviews.map((preview, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/80 aspect-square bg-black/5">
                      <img src={preview} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-rose-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetCreateForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>{isSubmitting ? 'Reporting...' : 'Submit Incident Report'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. INCIDENT DETAILS DRAWER / MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewedIncident && (
            <div className="space-y-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {viewedIncident.incidentReference}
                      </span>
                      {getPriorityBadge(viewedIncident.severity)}
                      {getStatusBadge(viewedIncident.incidentStatus)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Reported on {new Date(viewedIncident.createdAt).toLocaleString()} &bull; Source: {viewedIncident.incidentSource}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground">
                  {viewedIncident.title}
                </h3>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/70 text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {viewedIncident.description}
                </div>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>Facility & Location</span>
                  </div>
                  <div className="text-muted-foreground space-y-1">
                    <div>Facility: <strong className="text-foreground">{viewedIncident.parkingName}</strong></div>
                    <div>Location: <strong className="text-foreground">{viewedIncident.location || 'Not Specified'}</strong></div>
                    <div>Type: <strong className="text-foreground">{viewedIncident.incidentType}</strong></div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>Reporter & Involved</span>
                  </div>
                  <div className="text-muted-foreground space-y-1">
                    <div>Reported By: <strong className="text-foreground">{viewedIncident.reportedBy.fullName}</strong></div>
                    <div>Vehicle: <strong className="text-foreground font-mono">{viewedIncident.vehicleNumber || 'None'}</strong></div>
                    <div>Booking Ref: <strong className="text-foreground font-mono">{viewedIncident.bookingReference || 'None'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Resolution Notes (if available) */}
              {viewedIncident.resolutionNotes && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Resolution Summary</span>
                  </div>
                  <p className="text-muted-foreground">
                    {viewedIncident.resolutionNotes}
                  </p>
                  {viewedIncident.resolvedAt && (
                    <div className="text-[10px] text-muted-foreground pt-1">
                      Resolved on: {new Date(viewedIncident.resolvedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Photos Gallery */}
              {viewedIncident.attachments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-primary" />
                    <span>Evidence Photos ({viewedIncident.attachments.length})</span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewedIncident.attachments.map((imgUrl, idx) => (
                      <a
                        key={idx}
                        href={imgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative rounded-xl overflow-hidden border border-border/80 aspect-video bg-muted/20 hover:opacity-90 transition-opacity"
                      >
                        <img src={imgUrl} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-white font-mono">
                          Photo {idx + 1}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/80">
                <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  {viewedIncident.incidentStatus === 'Open' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(viewedIncident._id, 'Under Investigation')}
                      disabled={isResolving}
                      className="text-xs"
                    >
                      Start Investigation
                    </Button>
                  )}

                  {viewedIncident.incidentStatus !== 'Resolved' && viewedIncident.incidentStatus !== 'Closed' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setResolveIncidentId(viewedIncident._id);
                        setResolutionNotes('');
                      }}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Resolve Incident
                    </Button>
                  )}

                  {viewedIncident.incidentStatus === 'Resolved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange(viewedIncident._id, 'Closed')}
                      disabled={isResolving}
                      className="text-xs"
                    >
                      Close Incident
                    </Button>
                  )}

                  {(viewedIncident.incidentStatus === 'Resolved' || viewedIncident.incidentStatus === 'Closed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStatusChange(viewedIncident._id, 'Open')}
                      disabled={isResolving}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reopen Incident
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 7. QUICK RESOLVE INCIDENT MODAL */}
      <Dialog open={Boolean(resolveIncidentId)} onOpenChange={(open) => !open && setResolveIncidentId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Resolve Incident</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Please provide resolution notes detailing how this incident was settled, who approved it, or actions performed.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="res-notes" className="text-xs font-semibold">
                Resolution Notes <span className="text-emerald-500">*</span>
              </Label>
              <Textarea
                id="res-notes"
                placeholder="e.g. Overstay settled in cash. Barrier inspection completed and no mechanical fault found."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setResolveIncidentId(null)}
              disabled={isResolving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (resolveIncidentId) {
                  handleStatusChange(resolveIncidentId, 'Resolved', resolutionNotes);
                }
              }}
              disabled={isResolving || !resolutionNotes.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {isResolving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isResolving ? 'Resolving...' : 'Confirm Resolution'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
