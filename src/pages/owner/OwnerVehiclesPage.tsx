import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Car,
  Search,
  Download,
  Building2,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getOwnerVehiclesOverview,
  getOwnerVehiclesList,
  type OwnerVehiclesOverviewParams,
  type OwnerVehiclesListParams,
  type OwnerVehicleListItem,
} from '@/api/ownerVehicles.api';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useLiveSync } from '@/hooks/useLiveSync';

export const OwnerVehiclesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedLotId, setSelectedLotId] = useState<string>('all');
  const [movementStatus, setMovementStatus] = useState<string>('all');
  const [vehicleType, setVehicleType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [dateFrom] = useState<string>('');
  const [dateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const limit = 15;

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    const handleSync = () => {
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicles-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['owner-vehicles-list'] });
    };

    socket.on('slot_availability_updated', handleSync);
    socket.on('booking_updated', handleSync);
    socket.on('live_vehicle_update', handleSync);

    return () => {
      socket.off('slot_availability_updated', handleSync);
      socket.off('booking_updated', handleSync);
      socket.off('live_vehicle_update', handleSync);
    };
  }, [queryClient]);

  // 1. Fetch Overview KPIs
  const overviewParams: OwnerVehiclesOverviewParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['owner-vehicles-overview', selectedLotId, dateFrom, dateTo],
    queryFn: () => getOwnerVehiclesOverview(overviewParams),
  });

  // 2. Fetch Paginated List
  const listParams: OwnerVehiclesListParams = {
    parkingLotId: selectedLotId !== 'all' ? selectedLotId : undefined,
    movementStatus: movementStatus !== 'all' ? movementStatus : undefined,
    vehicleType: vehicleType !== 'all' ? vehicleType : undefined,
    search: search.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit,
  };

  const {
    data: listData,
    isLoading: isLoadingList,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['owner-vehicles-list', selectedLotId, movementStatus, vehicleType, search, dateFrom, dateTo, page],
    queryFn: () => getOwnerVehiclesList(listParams),
  });

  useLiveSync(() => {
    void refetchOverview();
    void refetchList();
  });

  const handleExportCsv = () => {
    if (!listData?.vehicles || listData.vehicles.length === 0) {
      toast.error('No vehicle records to export.');
      return;
    }

    const headers = [
      'Vehicle Plate',
      'Vehicle Type',
      'Brand & Model',
      'Color',
      'Customer Name',
      'Customer Contact',
      'Booking Ref',
      'Parking Facility',
      'Floor',
      'Zone',
      'Slot',
      'Entry Time',
      'Exit Time',
      'Stay Duration (min)',
      'Overstay (min)',
      'Movement Status',
    ];

    const rows = listData.vehicles.map((v: OwnerVehicleListItem) => [
      `"${v.vehicleNumber}"`,
      `"${v.vehicleType}"`,
      `"${v.vehicleBrand} ${v.vehicleModel}"`,
      `"${v.vehicleColor || 'N/A'}"`,
      `"${v.customerName}"`,
      `"${v.customerPhone || 'N/A'}"`,
      `"${v.bookingReference}"`,
      `"${v.parkingLotName}"`,
      `"${v.floorName}"`,
      `"${v.zoneCode}"`,
      `"${v.slotNumber}"`,
      `"${v.entryTime || 'N/A'}"`,
      `"${v.exitTime || 'N/A'}"`,
      v.stayDurationMinutes,
      v.overstayMinutes,
      `"${v.movementStatus}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ParkEase_Vehicle_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Vehicle operations log downloaded as CSV.');
  };

  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const kpis = overviewData?.kpis;
  const lots = overviewData?.ownerLots || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 animate-in fade-in-50 duration-300 pb-16">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <Car className="h-7 w-7 text-primary" />
              Vehicle Management
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Facility Fleet Operations
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Monitor real-time vehicle movements, customer stay durations, overstays, and entry/exit audit logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoadingList || !listData?.vehicles?.length}
            className="text-xs gap-1.5 h-9"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Export CSV
          </Button>

          <Button
            size="sm"
            asChild
            className="text-xs font-bold gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Link to="/owner/live-vehicles">
              <Navigation className="h-3.5 w-3.5" />
              Open Live Vehicle Locator &rarr;
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. OPERATIONAL KPI SUMMARY TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Vehicles */}
        <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Total Fleet
          </span>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            {isLoadingOverview ? <Skeleton className="h-7 w-16" /> : kpis?.totalVehicles || 0}
          </p>
          <span className="text-[10px] text-muted-foreground">Across owner facilities</span>
        </Card>

        {/* Currently Inside */}
        <Card className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Currently Inside
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {isLoadingOverview ? <Skeleton className="h-7 w-16" /> : kpis?.vehiclesInside || 0}
          </p>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400">Parked in bay</span>
        </Card>

        {/* Expected / In Transit */}
        <Card className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
            Expected / Reserved
          </span>
          <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-1">
            {isLoadingOverview ? <Skeleton className="h-7 w-16" /> : kpis?.vehiclesExpected || 0}
          </p>
          <span className="text-[10px] text-blue-600/80 dark:text-blue-400">Entry pending</span>
        </Card>

        {/* Overstaying */}
        <Card className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Overstaying
            </span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            {isLoadingOverview ? <Skeleton className="h-7 w-16" /> : kpis?.vehiclesOverstaying || 0}
          </p>
          <span className="text-[10px] text-amber-600/80 dark:text-amber-400">Exceeded grace period</span>
        </Card>

        {/* Departed */}
        <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Departed
          </span>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            {isLoadingOverview ? <Skeleton className="h-7 w-16" /> : kpis?.vehiclesDeparted || 0}
          </p>
          <span className="text-[10px] text-muted-foreground">Completed exit gate</span>
        </Card>
      </div>

      {/* 3. FILTER & SEARCH CONTROLS */}
      <Card className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Facility Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={selectedLotId}
                onChange={(e) => {
                  setSelectedLotId(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-52"
              >
                <option value="all">All Facilities ({lots.length})</option>
                {lots.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.parkingName}
                  </option>
                ))}
              </select>
            </div>

            {/* Movement Status Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: 'All Movements' },
                { id: 'Vehicle Inside', label: 'Inside' },
                { id: 'Entry Pending', label: 'Expected' },
                { id: 'Overstayed', label: 'Overstaying' },
                { id: 'Vehicle Exited', label: 'Departed' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMovementStatus(tab.id);
                    setPage(1);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    movementStatus === tab.id
                      ? 'bg-primary text-primary-foreground shadow-2xs'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Vehicle Type Filter */}
            <select
              value={vehicleType}
              onChange={(e) => {
                setVehicleType(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 rounded-lg border border-border bg-background text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Vehicle Types</option>
              <option value="Car">Car</option>
              <option value="Bike">Bike</option>
              <option value="SUV">SUV</option>
              <option value="EV">EV</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search plate, customer, slot..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>
      </Card>

      {/* 4. VEHICLES TABLE */}
      <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Vehicle Plate</th>
                <th className="px-4 py-3">Vehicle Info</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Booking Ref</th>
                <th className="px-4 py-3">Facility</th>
                <th className="px-4 py-3">Bay &amp; Floor</th>
                <th className="px-4 py-3">Entry Time</th>
                <th className="px-4 py-3">Stay Duration</th>
                <th className="px-4 py-3 text-center">Movement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingList ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : listData?.vehicles?.length ? (
                listData.vehicles.map((v: OwnerVehicleListItem) => (
                  <tr key={v._id} className="hover:bg-muted/20 transition-colors">
                    {/* Plate */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs px-2 py-0.5 rounded border border-border bg-background shadow-2xs text-foreground">
                          {v.vehicleNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {v.vehicleType}
                        </Badge>
                      </div>
                    </td>

                    {/* Info */}
                    <td className="px-4 py-3 text-foreground">
                      <span className="font-semibold block">{v.vehicleBrand} {v.vehicleModel}</span>
                      {v.vehicleColor && (
                        <span className="text-[10px] text-muted-foreground block">{v.vehicleColor}</span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3 text-foreground">
                      <span className="font-semibold block">{v.customerName}</span>
                      <span className="text-[10px] text-muted-foreground block">{v.customerPhone || v.customerEmail || ''}</span>
                    </td>

                    {/* Booking */}
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {v.bookingReference}
                    </td>

                    {/* Facility */}
                    <td className="px-4 py-3 text-foreground max-w-[130px] truncate font-medium">
                      {v.parkingLotName}
                    </td>

                    {/* Bay & Floor */}
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-primary block">
                        Bay {v.slotNumber}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {v.floorName} • Zone {v.zoneCode}
                      </span>
                    </td>

                    {/* Entry Time */}
                    <td className="px-4 py-3 text-muted-foreground text-[11px]">
                      {v.entryTime ? (
                        new Date(v.entryTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short',
                        })
                      ) : (
                        <span className="text-muted-foreground/60 italic">Expected Arrival</span>
                      )}
                    </td>

                    {/* Stay Duration */}
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {v.movementStatus === 'Vehicle Inside' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatMinutes(v.stayDurationMinutes)}
                        </span>
                      ) : v.movementStatus === 'Overstayed' ? (
                        <span className="text-amber-600 dark:text-amber-400 font-mono">
                          Overstay: {formatMinutes(v.overstayMinutes)}
                        </span>
                      ) : v.movementStatus === 'Vehicle Exited' ? (
                        <span className="text-muted-foreground font-mono">
                          Total: {formatMinutes(v.stayDurationMinutes)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* Movement Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className={cn(
                          'text-[10px] font-bold uppercase py-0.5',
                          v.movementStatus === 'Vehicle Inside' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                          v.movementStatus === 'Entry Pending' && 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
                          v.movementStatus === 'Overstayed' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                          v.movementStatus === 'Vehicle Exited' && 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
                          v.movementStatus === 'Cancelled' && 'bg-destructive/15 text-destructive border-destructive/30',
                        )}
                      >
                        {v.movementStatus}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground space-y-2">
                    <Car className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm font-semibold text-foreground">No Vehicle Movement Records</p>
                    <p className="text-xs">No active or historical vehicles found matching your active filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {listData && listData.totalPages > 1 && (
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, listData.total)} of {listData.total} vehicles
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
                Page {page} of {listData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= listData.totalPages}
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

export default OwnerVehiclesPage;
