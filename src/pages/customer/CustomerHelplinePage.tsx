import React, { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  MessageCircle,
  Mail,
  ShieldAlert,
  Clock,
  MapPin,
  CheckCircle2,
  Send,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LifeBuoy,
  FileQuestion,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useLiveSync } from '@/hooks/useLiveSync';
import {
  getCustomerBookings,
  searchCustomerParkingLots,
  submitCustomerHelpInquiry,
  getCustomerHelpInquiries,
  type CustomerBookingItem,
  type CustomerParkingLotResult,
} from '@/api/customerParking.api';

interface SupportInquirySubmission {
  referenceId: string;
  category: string;
  facilityName: string;
  bookingRef: string;
  priority: string;
  message: string;
  submittedAt: string;
  status?: string;
}

export const CustomerHelplinePage: React.FC = () => {
  const { user } = useAuthStore();

  // Bookings and Facilities State
  const [bookings, setBookings] = useState<CustomerBookingItem[]>([]);
  const [facilities, setFacilities] = useState<CustomerParkingLotResult[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Form State
  const [category, setCategory] = useState<string>('GATE_BARRIER_ISSUE');
  const [bookingRefInput, setBookingRefInput] = useState<string>('');
  const [priority, setPriority] = useState<string>('URGENT');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmation Dialog
  const [submittedInquiry, setSubmittedInquiry] = useState<SupportInquirySubmission | null>(null);
  const [recentInquiries, setRecentInquiries] = useState<SupportInquirySubmission[]>([]);

  // FAQ Accordion Toggle
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // 1. Fetch Customer Bookings & Facility Directory
  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoadingData(true);
    try {
      const [bookingsRes, lotsRes, inquiriesRes] = await Promise.allSettled([
        getCustomerBookings(),
        searchCustomerParkingLots({ search: '' }),
        getCustomerHelpInquiries(),
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.bookings) {
        setBookings(bookingsRes.value.bookings);
        // Autofill with the most recent active or upcoming booking if available
        if (!isSilent) {
          const activeBooking = bookingsRes.value.bookings.find(
            (b) => b.bookingStatus === 'Active' || b.bookingStatus === 'Confirmed',
          );
          if (activeBooking) {
            setBookingRefInput(activeBooking.bookingReference);
            if (activeBooking.parkingLotId) {
              setSelectedFacilityId(activeBooking.parkingLotId);
            }
          }
        }
      }

      if (lotsRes.status === 'fulfilled' && lotsRes.value?.parkingLots) {
        setFacilities(lotsRes.value.parkingLots);
        if (!selectedFacilityId && lotsRes.value.parkingLots.length > 0) {
          setSelectedFacilityId(lotsRes.value.parkingLots[0]._id);
        }
      }

      if (inquiriesRes.status === 'fulfilled' && Array.isArray(inquiriesRes.value)) {
        const mapped = inquiriesRes.value.map((inq) => ({
          referenceId: inq.incidentReference,
          category: inq.incidentType,
          facilityName: typeof inq.parkingLotId === 'object' ? inq.parkingLotId.parkingName : 'Facility Gate',
          bookingRef: inq.location?.replace('Booking: ', '') || 'N/A',
          priority: inq.severity,
          message: inq.description,
          submittedAt: new Date(inq.createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: inq.incidentStatus,
        }));
        setRecentInquiries(mapped);
      }
    } catch (err) {
      console.warn('Failed to load helpline context data:', err);
    } finally {
      if (!isSilent) setLoadingData(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useLiveSync(() => {
    void fetchData(true);
  });

  // Currently Selected Facility Object
  const selectedFacility = useMemo(() => {
    return facilities.find((f) => f._id === selectedFacilityId) || null;
  }, [facilities, selectedFacilityId]);

  // Handle Help Request Submission
  const handleSubmitHelpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter the details of your inquiry or incident.');
      return;
    }

    const targetLotId = selectedFacilityId || (facilities.length > 0 ? facilities[0]._id : '');
    if (!targetLotId) {
      toast.error('Please select a parking facility.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCustomerHelpInquiry({
        parkingLotId: targetLotId,
        bookingReference: bookingRefInput.trim() || undefined,
        category,
        priority,
        message: message.trim(),
      });

      const submission: SupportInquirySubmission = {
        referenceId: res.incidentReference,
        category: res.incidentType,
        facilityName: typeof res.parkingLotId === 'object' ? res.parkingLotId.parkingName : selectedFacility?.parkingName || 'Facility Gate',
        bookingRef: bookingRefInput.trim() || 'N/A',
        priority: res.severity,
        message: res.description,
        submittedAt: new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: res.incidentStatus || 'Pending',
      };

      setSubmittedInquiry(submission);
      setRecentInquiries((prev) => [submission, ...prev]);
      setMessage('');
      toast.success(`Support request dispatched to Security! Reference: ${res.incidentReference}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch request.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // FAQs Definition
  const faqs = [
    {
      q: 'What should I do if another car is parked in my assigned parking slot?',
      a: 'ParkEase features automated atomic overstay resolution. When you arrive at the gate, our system immediately checks if your assigned slot is occupied. If so, you will automatically be reassigned to another free regular bay, or an overflow bay with universal compatibility at zero extra charge. If the facility is 100% full, the system immediately initiates a 100% full refund with zero cancellation penalty. You can also contact the on-site security desk below.',
    },
    {
      q: 'What should I do if the entrance or exit gate barrier does not open?',
      a: 'First, ensure your vehicle is within 1–2 meters of the barrier scanner and hold up your booking QR code facing the camera or pedestal scanner. If the barrier does not open automatically within 5 seconds, use the "Emergency Gate Hotline" button on this page or tap the intercom button on the barrier pillar to alert the on-site guard.',
    },
    {
      q: 'How does overstay billing work, and is there a grace period?',
      a: 'All ParkEase facilities provide a 15-minute grace period after your scheduled booking exit time. If you exceed this window, overstay rates are billed per hour or fraction thereof at the official facility rate. You can settle overstay fees directly in your ParkEase app or via cash/UPI at the exit counter before the barrier opens.',
    },
    {
      q: 'How can I extend my current parking reservation?',
      a: 'You can extend your booking directly from the "My Bookings" page by clicking "Extend Time" on your active booking, provided the bay does not have an immediate subsequent reservation.',
    },
    {
      q: 'Does ParkEase offer roadside emergency assistance in parking facilities?',
      a: 'Yes! If you experience a flat tyre, battery discharge, or vehicle breakdown inside an authorized ParkEase facility, select "Vehicle Breakdown / Roadside Assistance" in the quick request form or call our 24/7 emergency team at +91 98765 43210 for guard dispatch.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-linear-to-br from-card via-card/90 to-blue-950/20 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold gap-1.5 px-3 py-1">
                <LifeBuoy className="h-3.5 w-3.5" />
                24/7 Dedicated Support &amp; Incident Helpline
              </Badge>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold gap-1 px-2.5 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Dispatch Ready
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
              ParkEase Customer Helpline
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Immediate assistance for gate barrier errors, occupied slot conflicts, on-site security contact, billing disputes, and emergency roadside help.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
            <a href="tel:180072753273">
              <Button className="bg-primary text-primary-foreground font-bold text-xs h-10 px-5 gap-2 shadow-md hover:bg-primary/90 cursor-pointer">
                <PhoneCall className="h-4 w-4" />
                <span>Call 1800-PARKEASE</span>
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* 2. FOUR PRIMARY DIRECT CONTACT CHANNELS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Channel 1: 24/7 Toll Free */}
        <Card className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-blue-500/40 text-blue-600">
              Toll-Free
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Central Support Helpline</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">General reservations, pricing &amp; account queries</p>
          </div>
          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
            <span className="font-mono font-black text-sm text-foreground">1800-727-53273</span>
            <a href="tel:180072753273">
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-primary font-semibold">
                Call Now
              </Button>
            </a>
          </div>
        </Card>

        {/* Channel 2: Emergency Gate & Barrier Hotline */}
        <Card className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 space-y-3 hover:border-red-500/50 transition-colors shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <Badge className="bg-red-500 text-white text-[10px] font-bold">
              Immediate Dispatch
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Gate Barrier Emergency</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Barrier stuck, QR scan failure or slot conflict</p>
          </div>
          <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
            <span className="font-mono font-black text-sm text-red-600 dark:text-red-400">+91 98765 43210</span>
            <a href="tel:+919876543210">
              <Button size="sm" className="h-7 px-2.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold">
                Call Guard
              </Button>
            </a>
          </div>
        </Card>

        {/* Channel 3: WhatsApp Support */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3 hover:border-emerald-500/50 transition-colors shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
              Chat in 60s
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">WhatsApp Instant Help</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Fast resolution with photo/receipt sharing</p>
          </div>
          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between">
            <span className="font-mono font-semibold text-xs text-foreground">+91 98765 43210</span>
            <a
              href="https://wa.me/919876543210?text=Hello%20ParkEase%20Helpline%2C%20I%20need%20immediate%20assistance%20with%20my%20parking%20booking."
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10">
                Chat Now
              </Button>
            </a>
          </div>
        </Card>

        {/* Channel 4: Email / Escalations */}
        <Card className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Mail className="h-5 w-5" />
            </div>
            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-600">
              &lt; 30 Mins
            </Badge>
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Official Support Desk</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Refund claims, tax receipts &amp; feedback</p>
          </div>
          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
            <span className="font-mono text-xs text-foreground truncate max-w-[120px]">support@parkease.io</span>
            <a href="mailto:support@parkease.io?subject=ParkEase%20Support%20Request">
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-primary font-semibold">
                Send Email
              </Button>
            </a>
          </div>
        </Card>
      </div>

      {/* 3. TWO-COLUMN LAYOUT: FACILITY DIRECT DESK FINDER & HELP INQUIRY FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: FACILITY DIRECT CONTACT SELECTOR */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-sm bg-card p-5 space-y-4">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Contact Your Specific Facility
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reach the on-site guard booth, gate security supervisor, or parking manager directly.
              </p>
            </div>

            {/* Facility Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select Facility:</label>
              <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder={loadingData ? "Loading facilities..." : "Choose a parking lot..."} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {facilities.map((lot) => (
                    <SelectItem key={lot._id} value={lot._id} className="text-xs">
                      {lot.parkingName} ({lot.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Facility Details Card */}
            {selectedFacility ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3.5 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-foreground">{selectedFacility.parkingName}</span>
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                      Verified Facility
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3 w-3 text-primary shrink-0" />
                    <span>
                      {typeof selectedFacility.address === 'string'
                        ? selectedFacility.address
                        : `${(selectedFacility.address as any)?.street || ''}, ${selectedFacility.city}`}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px]">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Gate Phone:</span>
                    <span className="font-mono font-bold text-foreground">
                      {selectedFacility.contactNumber || 'Not configured'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Operating Hours:</span>
                    <span className="font-medium text-foreground">24 Hours / 7 Days</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Gate Email:</span>
                    <span className="font-medium text-foreground truncate block">
                      {selectedFacility.supportEmail || 'Not configured'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Capacity:</span>
                    <span className="font-mono font-bold text-foreground">{selectedFacility.totalSlots || 120} Bays</span>
                  </div>
                </div>

                {/* Facility Actions */}
                <div className="pt-2 flex flex-wrap gap-2">
                  {selectedFacility.contactNumber ? (
                    <a href={`tel:${selectedFacility.contactNumber}`} className="flex-1">
                      <Button size="sm" className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 cursor-pointer">
                        <PhoneCall className="h-3.5 w-3.5" /> Call Gate ({selectedFacility.contactNumber})
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" disabled variant="outline" className="flex-1 text-xs h-8 gap-1.5 opacity-60">
                      <PhoneCall className="h-3.5 w-3.5" /> Gate Phone Unavailable
                    </Button>
                  )}
                  {selectedFacility.supportEmail ? (
                    <a href={`mailto:${selectedFacility.supportEmail}`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5 cursor-pointer">
                        <Mail className="h-3.5 w-3.5" /> Email Gate
                      </Button>
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${selectedFacility.parkingName} ${selectedFacility.city}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button size="sm" variant="outline" className="w-full text-xs h-8 gap-1.5 cursor-pointer">
                        <ExternalLink className="h-3.5 w-3.5" /> Map Directions
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                Select a facility from the dropdown to view its direct gate contact numbers.
              </p>
            )}

            {/* Quick Active Bookings Autofill Pill */}
            {bookings.length > 0 && (
              <div className="pt-3 border-t border-border/50 space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground block">Your Active / Recent Bookings:</span>
                <div className="flex flex-wrap gap-1.5">
                  {bookings.slice(0, 3).map((b) => (
                    <button
                      key={b.bookingId}
                      type="button"
                      onClick={() => {
                        setBookingRefInput(b.bookingReference);
                        if (b.parkingLotId) setSelectedFacilityId(b.parkingLotId);
                        toast.info(`Autofilled booking ${b.bookingReference}`);
                      }}
                      className="text-[10px] font-mono px-2 py-1 rounded-md border border-border/80 bg-background hover:bg-muted/60 text-foreground transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>{b.bookingReference}</span>
                      <Badge variant="secondary" className="text-[9px] py-0 px-1">
                        {b.bookingStatus}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Recent Submitted Requests on This Session */}
          {recentInquiries.length > 0 && (
            <Card className="rounded-2xl border border-border/80 shadow-sm bg-card p-4 space-y-3">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Submitted Inquiries (This Session)
              </span>
              <div className="space-y-2">
                {recentInquiries.map((inq) => (
                  <div key={inq.referenceId} className="p-2.5 rounded-lg border border-border/60 bg-muted/30 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{inq.referenceId}</span>
                      {(() => {
                        const s = (inq.status || 'Pending').toLowerCase();
                        if (s === 'resolved' || s === 'closed') {
                          return (
                            <Badge className="text-[9px] py-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              Resolved ✓
                            </Badge>
                          );
                        }
                        if (s === 'resolving' || s.includes('investigation')) {
                          return (
                            <Badge className="text-[9px] py-0 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse">
                              Resolving...
                            </Badge>
                          );
                        }
                        return (
                          <Badge className="text-[9px] py-0 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Pending
                          </Badge>
                        );
                      })()}
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-1">{inq.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{inq.facilityName}</span>
                      <span>{inq.submittedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN: QUICK HELP REQUEST / INCIDENT FORM */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border border-border/80 shadow-sm bg-card p-5 sm:p-6 space-y-5">
            <div className="border-b border-border/60 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Submit an Immediate Support Ticket
                </h2>
                <Badge variant="outline" className="text-xs font-mono">
                  Fast Queue
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Our operations desk will receive your request immediately and dispatch resolution instructions.
              </p>
            </div>

            <form onSubmit={handleSubmitHelpRequest} className="space-y-4 text-xs">
              {/* Category & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Issue Category:</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="text-xs h-9 bg-background">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GATE_BARRIER_ISSUE" className="text-xs">
                        🚧 Gate Barrier Not Opening / QR Error
                      </SelectItem>
                      <SelectItem value="SLOT_OCCUPIED_OVERSTAY" className="text-xs">
                        🚗 Assigned Slot Occupied by Overstay Vehicle
                      </SelectItem>
                      <SelectItem value="VEHICLE_ASSISTANCE" className="text-xs">
                        🔧 Breakdown / Battery Jumpstart Assistance
                      </SelectItem>
                      <SelectItem value="BILLING_REFUND" className="text-xs">
                        💳 Overstay Charge / Billing Dispute / Refund
                      </SelectItem>
                      <SelectItem value="SECURITY_SAFETY" className="text-xs">
                        🛡️ Security / Vehicle Damage Incident
                      </SelectItem>
                      <SelectItem value="GENERAL_INQUIRY" className="text-xs">
                        ❓ Other Inquiry
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Urgency Level:</label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="text-xs h-9 bg-background">
                      <SelectValue placeholder="Select Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL" className="text-xs">
                        🟢 Normal Inquiry (&lt; 30 mins)
                      </SelectItem>
                      <SelectItem value="URGENT" className="text-xs font-bold text-amber-600">
                        🟡 Urgent / At Facility Gate (&lt; 5 mins)
                      </SelectItem>
                      <SelectItem value="EMERGENCY" className="text-xs font-bold text-red-600">
                        🔴 Emergency / Stuck at Barrier (&lt; 2 mins)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Booking Reference (Optional) */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>Booking Reference Number (Optional):</span>
                  <span className="text-[10px] text-muted-foreground font-normal">e.g. BK-20261124-ABCD</span>
                </label>
                <Input
                  placeholder="Enter or select your booking reference above..."
                  value={bookingRefInput}
                  onChange={(e) => setBookingRefInput(e.target.value)}
                  className="text-xs h-9 font-mono bg-background"
                />
              </div>

              {/* Message Details */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Describe your issue or request:</label>
                <Textarea
                  rows={4}
                  placeholder="Please specify what happened (e.g. 'I am at Gate 1 at Grand Mall Parking, QR scan says invalid token' or 'Vehicle HR26AB9935 is parked in my assigned bay A-04')..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-xs bg-background resize-none"
                  required
                />
              </div>

              {/* User Contact Confirmation */}
              <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span className="text-[11px]">
                  Dispatching for: <strong className="text-foreground">{user?.fullName || 'Registered Customer'}</strong> ({user?.email})
                </span>
                <span className="text-[10px] font-mono">Protected by ParkEase SLA</span>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-xs h-9 bg-primary text-primary-foreground font-bold gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Transmitting to Operations Desk...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit Request to Operations</span>
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* 4. EMERGENCY SELF-HELP & FAQS ACCORDION */}
      <Card className="rounded-2xl border border-border/80 shadow-sm bg-card p-5 sm:p-6 space-y-4">
        <div className="border-b border-border/60 pb-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            Frequently Asked Questions &amp; Instant Self-Help
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instant answers for common gate barrier, slot overstay, and refund questions.
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaqIndex === idx;
            return (
              <div
                key={faq.q}
                className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs font-bold text-foreground hover:bg-muted/40 cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 5. TICKET SUBMITTED CONFIRMATION DIALOG */}
      <Dialog open={Boolean(submittedInquiry)} onOpenChange={() => setSubmittedInquiry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 flex items-center justify-center mb-1">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Request Dispatched Successfully
            </DialogTitle>
            <DialogDescription className="text-xs">
              Your inquiry has been placed into our priority operations dispatch queue.
            </DialogDescription>
          </DialogHeader>

          {submittedInquiry && (
            <div className="p-3.5 rounded-xl border border-border/70 bg-muted/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ticket Reference ID:</span>
                <span className="font-mono font-bold text-primary text-sm">{submittedInquiry.referenceId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Facility:</span>
                <span className="font-medium text-foreground">{submittedInquiry.facilityName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium text-foreground">{submittedInquiry.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <Badge variant="outline" className="text-[10px]">
                  {submittedInquiry.priority}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                A support agent or on-site supervisor will review your issue immediately.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setSubmittedInquiry(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerHelplinePage;
