import React from 'react';
import {
  FileText,
  LogIn,
  AlertOctagon,
  Zap,
  Accessibility,
  Moon,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface ParkingRulesAccordionProps {
  facility: CustomerParkingLotResult;
}

export const ParkingRulesAccordion: React.FC<ParkingRulesAccordionProps> = ({
  facility,
}) => {
  const rules = facility.rules;

  const ruleItems = [
    {
      id: 'general',
      title: 'General Parking Code & Etiquette',
      icon: FileText,
      content:
        rules?.rules ||
        'Vehicles must be parked completely within marked bay lines. Engines must be switched off once parked. Parking at your own risk; do not leave valuables unattended in passenger cabins.',
    },
    {
      id: 'entry-exit',
      title: 'Entry & Exit Gate Procedures',
      icon: LogIn,
      content:
        rules?.entryExitInstructions ||
        'Present your digital ParkEase booking QR pass at the boom barrier scanner. An attendant or automated optical scanner will validate entry time. Please retain your booking reference for checkout.',
    },
    {
      id: 'clearance',
      title: 'Vehicle Dimensions & Height Restrictions',
      icon: AlertOctagon,
      content:
        rules?.heightWeightRestrictions ||
        'Maximum facility height clearance is 2.4 meters. Commercial trucks, heavy trailers, and oversized cargo vehicles are prohibited without prior management clearance.',
    },
    {
      id: 'ev',
      title: 'EV Charging Regulations',
      icon: Zap,
      content:
        rules?.evRules ||
        'Designated EV bays are reserved strictly for vehicles during active charging sessions. Once charging reaches 100%, vehicles must be moved to standard bays within 30 minutes to ensure fair availability.',
    },
    {
      id: 'accessible',
      title: 'Accessible & Priority Bay Policy',
      icon: Accessibility,
      content:
        rules?.accessibleParkingRules ||
        'Accessible bays are exclusively designated for drivers or passengers holding valid government-issued disability certificates or official accessibility placards.',
    },
    {
      id: 'overnight',
      title: 'Overnight & Extended Parking Policy',
      icon: Moon,
      content:
        rules?.overnightRules ||
        'Overnight parking is permitted for confirmed reservations. For security compliance, please notify the on-site security supervisor upon entry for stays extending past 12:00 AM.',
    },
    {
      id: 'additional',
      title: 'Safety, Liability & Additional Terms',
      icon: ShieldAlert,
      content:
        rules?.otherInstructions ||
        'Facility maintains 24/7 CCTV surveillance for premises security. ParkEase and facility operators assume no liability for third-party damage or loss of contents. Speed limit inside all aisles is strictly 10 km/h.',
    },
  ];

  return (
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Parking Rules & Entry Instructions
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Please review site instructions before arriving to ensure smooth gate clearance.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 pt-2">
        <Accordion type="single" collapsible defaultValue="general" className="w-full">
          {ruleItems.map((item) => {
            const Icon = item.icon;
            return (
              <AccordionItem key={item.id} value={item.id} className="border-border/60">
                <AccordionTrigger className="hover:no-underline py-3.5 text-xs sm:text-sm font-semibold text-foreground hover:text-primary">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span>{item.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-9 pr-2 pb-3.5">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};
