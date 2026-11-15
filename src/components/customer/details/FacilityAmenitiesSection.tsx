import React from 'react';
import {
  ShieldCheck,
  Building2,
  Zap,
  Accessibility,
  UserCheck,
  Sparkles,
  DoorClosed,
  Droplets,
  ArrowUpDown,
  Flame,
  CheckCircle2,
  KeyRound,
  Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FacilityAmenitiesSectionProps {
  amenities: string[];
}

interface AmenityMeta {
  label: string;
  icon: React.ElementType;
  description: string;
}

const AMENITY_REGISTRY: Record<string, AmenityMeta> = {
  'CCTV Surveillance': {
    label: 'CCTV Surveillance',
    icon: ShieldCheck,
    description: '24/7 continuous high-definition camera monitoring across all floors',
  },
  'Covered Parking': {
    label: 'Covered Parking',
    icon: Building2,
    description: 'Full roof shielding protects your vehicle from rain, sun, and hail',
  },
  'EV Charging': {
    label: 'EV Charging Station',
    icon: Zap,
    description: 'Level-2 AC fast-charging bays with standard Type-2 connectors',
  },
  'Disabled Parking': {
    label: 'Accessible / Disabled Parking',
    icon: Accessibility,
    description: 'Extra-wide priority bays located nearest to elevators and exits',
  },
  'Security Staff': {
    label: 'On-Site Security Guards',
    icon: UserCheck,
    description: 'Trained security personnel patrolling facility rounds around the clock',
  },
  'Car Wash': {
    label: 'Car Wash & Detailing',
    icon: Sparkles,
    description: 'On-demand eco-friendly waterless vehicle cleaning service',
  },
  Washroom: {
    label: 'Clean Restrooms',
    icon: DoorClosed,
    description: 'Sanitized public washroom facilities available for drivers and visitors',
  },
  'Drinking Water': {
    label: 'Drinking Water',
    icon: Droplets,
    description: 'RO-filtered clean drinking water dispensers on premises',
  },
  'Lift Access': {
    label: 'Elevator / Lift Access',
    icon: ArrowUpDown,
    description: 'High-capacity passenger elevators connecting all parking levels',
  },
  'Fire Safety System': {
    label: 'Fire Safety & Sprinklers',
    icon: Flame,
    description: 'Automated smoke detection, sprinklers, and emergency exits',
  },
  'Valet Parking': {
    label: 'Valet Service',
    icon: KeyRound,
    description: 'Professional valet drop-off and retrieval at entry concourse',
  },
  'Illuminated Lighting': {
    label: 'Bright LED Lighting',
    icon: Lightbulb,
    description: 'Energy-efficient high-lumen illumination in all lanes and bays',
  },
};

export const FacilityAmenitiesSection: React.FC<FacilityAmenitiesSectionProps> = ({
  amenities = [],
}) => {
  if (amenities.length === 0) {
    return (
      <Card className="rounded-2xl border-border/70 shadow-xs">
        <CardHeader className="p-5 sm:p-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-bold text-foreground">
            Facilities & Amenities
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-2">
          <p className="text-xs sm:text-sm text-muted-foreground">
            Basic parking bays provided. Specific amenities have not been listed for this facility.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Facilities & Amenities
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified on-site equipment and convenience features approved during audit.
            </p>
          </div>

          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full gap-1"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            <span>{amenities.length} Verified Features</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {amenities.map((amenityName) => {
            const meta = AMENITY_REGISTRY[amenityName] ?? {
              label: amenityName,
              icon: CheckCircle2,
              description: 'Verified operational convenience provided at this parking facility',
            };
            const Icon = meta.icon;

            return (
              <div
                key={amenityName}
                className="rounded-xl border border-border/60 bg-card p-3.5 flex items-start gap-3 hover:border-primary/40 transition-colors group"
              >
                <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                    <span>{meta.label}</span>
                  </h4>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
