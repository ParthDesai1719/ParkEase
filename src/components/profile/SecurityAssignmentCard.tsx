import React from 'react';
import { ShieldCheck, MapPin, Building, Calendar, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SecurityAssignmentDetails } from '@/types/profile';

interface SecurityAssignmentCardProps {
  assignment: SecurityAssignmentDetails | null | undefined;
}

export const SecurityAssignmentCard: React.FC<SecurityAssignmentCardProps> = ({ assignment }) => {
  if (!assignment || !assignment.parkingLot) {
    return (
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Facility Assignment
          </CardTitle>
          <CardDescription className="text-xs">
            No active parking facility assignment currently active. Contact your facility owner or platform administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { parkingLot } = assignment;

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">Assigned Parking Facility</CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
          >
            Active Duty
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Official physical parking facility where your security credentials and QR verification permissions are active.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5 text-xs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Building className="h-3 w-3 text-primary" />
              Parking Facility Name
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{parkingLot.lotName}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              Facility Address
            </p>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {parkingLot.physicalAddress}, {parkingLot.city}, {parkingLot.state} - {parkingLot.postalCode}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              Assignment Date
            </p>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString() : 'Active'}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Assignment Duty Role
            </p>
            <p className="mt-1 text-xs font-semibold text-foreground">
              {assignment.assignmentReason || 'On-Site Entry & Exit QR Check'}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Security staff privileges are strictly scoped to live QR entry/exit scanning and bay guidance. Security accounts have no authority to alter parking structures or pricing schedules.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
