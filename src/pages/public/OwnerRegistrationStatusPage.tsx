import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  getPublicRegistrationStatus,
  type PublicRegistrationStatusData,
} from '@/api/admin.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export const OwnerRegistrationStatusPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchedId, setSearchedId] = useState('');
  const [result, setResult] = useState<PublicRegistrationStatusData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setSearchedId(cleanQuery);
    setLoading(true);
    setNotFound(false);
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await getPublicRegistrationStatus(cleanQuery);
      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setNotFound(true);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (apiErr.response?.status === 404) {
        setNotFound(true);
      } else {
        setErrorMessage(
          apiErr.response?.data?.message || apiErr.message || 'Unable to fetch status. Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
      {/* 1. HEADER */}
      <div className="max-w-2xl space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Owner Portal
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Check Registration Status
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Track the live review progress of your parking owner onboarding application directly from the authoritative database.
        </p>
      </div>

      {/* 2. SEARCH FORM */}
      <Card className="border-border/80 bg-card">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-lookup">Application Reference ID or Registered Mobile Number</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="app-lookup"
                    placeholder="e.g. APP-2026-XXXXX or 9999999999"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" disabled={loading} className="font-semibold shrink-0">
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search Status'
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter your application reference code (APP-...) or the 10-digit mobile number submitted during registration.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. DYNAMIC STATUS CARD */}
      {loading && (
        <Card className="border-border/80 bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="pt-4 flex gap-4">
            <Skeleton className="h-10 w-32" />
          </div>
        </Card>
      )}

      {errorMessage && (
        <Card className="border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="text-base font-semibold text-destructive">Lookup Error</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{errorMessage}</p>
        </Card>
      )}

      {notFound && (
        <Card className="border-border/80 bg-card p-8 text-center space-y-4">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">No Application Found</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              We could not find an owner application matching &ldquo;<span className="font-mono text-foreground">{searchedId}</span>&rdquo;.
              Please verify your reference number or mobile number and try again.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/become-owner">Apply as Parking Owner</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </Card>
      )}

      {result && (
        <Card className="border-border/80 bg-card overflow-hidden">
          {/* Status Header Banner */}
          <div className="p-6 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-semibold text-primary">
                  {result.applicationReference}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-sm font-bold text-foreground">{result.businessName}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.businessType} in {result.city}, {result.state} • Capacity: {result.parkingCapacity} slots
              </p>
            </div>

            <div>
              {result.applicationStatus === 'Pending Review' && (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3 py-1 font-semibold text-xs">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Under Review
                </Badge>
              )}
              {result.applicationStatus === 'Submitted' && (
                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 px-3 py-1 font-semibold text-xs">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Submitted
                </Badge>
              )}
              {result.applicationStatus === 'Approved' && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 font-semibold text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Approved
                </Badge>
              )}
              {result.applicationStatus === 'Rejected' && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/30 px-3 py-1 font-semibold text-xs">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Rejected
                </Badge>
              )}
              {result.applicationStatus === 'Draft' && (
                <Badge variant="outline" className="px-3 py-1 text-xs">
                  Draft
                </Badge>
              )}
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Context Status Message */}
            <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                {result.applicationStatus === 'Approved' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Registration Approved
                  </>
                ) : result.applicationStatus === 'Rejected' ? (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    Registration Not Approved
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 text-amber-600" />
                    Application Under Administrator Review
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {result.applicationStatus === 'Approved' &&
                  'Your registration has been fully approved by the platform administrator. Your account now has the Parking Owner role. Please log in to access your dashboard.'}
                {result.applicationStatus === 'Rejected' &&
                  'Your registration application could not be approved at this time. Please see the review notes below or contact platform support.'}
                {(result.applicationStatus === 'Pending Review' || result.applicationStatus === 'Submitted') &&
                  'Your business registration details and submitted proof documents are actively under review by platform administrators. You will be notified via email upon completion.'}
              </p>
            </div>

            {/* Rejection Reason if rejected */}
            {result.applicationStatus === 'Rejected' && result.rejectionReason && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-1.5">
                <span className="text-xs font-semibold text-destructive">Rejection Reason:</span>
                <p className="text-xs text-destructive/90 leading-relaxed">{result.rejectionReason}</p>
              </div>
            )}

            {/* Admin Remarks if present */}
            {result.adminRemarks && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                <span className="text-xs font-semibold text-primary">Administrator Remarks:</span>
                <p className="text-xs text-foreground/90 leading-relaxed">{result.adminRemarks}</p>
              </div>
            )}

            {/* Key Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                <span className="text-muted-foreground text-[11px]">Submitted Date</span>
                <p className="font-semibold text-foreground">
                  {result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('en-IN') : 'Pending'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                <span className="text-muted-foreground text-[11px]">Last Updated</span>
                <p className="font-semibold text-foreground">
                  {result.updatedAt ? new Date(result.updatedAt).toLocaleDateString('en-IN') : '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                <span className="text-muted-foreground text-[11px]">Registration Fee</span>
                <p className="font-semibold text-foreground">
                  ₹{result.registrationFeeAmount}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-1">
                <span className="text-muted-foreground text-[11px]">Payment Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CreditCard className="h-3.5 w-3.5 text-primary" />
                  <span className="font-semibold text-foreground capitalize">
                    {result.paymentStatus.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Document Verification Status Checklist */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-primary" />
                Submitted Document Checklist
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                  <span className="text-muted-foreground">Government ID Proof</span>
                  {result.hasIdentityProof ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                  <span className="text-muted-foreground">Business License</span>
                  {result.hasBusinessLicense ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                  <span className="text-muted-foreground">Property Proof</span>
                  {result.hasPropertyProof ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                      Uploaded
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Missing
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10">
                  <span className="text-muted-foreground">Facility Photos</span>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                    {result.parkingImagesCount} Photo(s)
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Live status verified directly from ParkEase platform database.
              </div>

              <div className="flex items-center gap-2">
                {result.applicationStatus === 'Approved' && (
                  <Button size="sm" asChild>
                    <Link to="/login">
                      Go to Login
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/contact">
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Contact Support
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. HELP & ASSISTANCE */}
      <Card className="border-border/80 bg-muted/20">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Need to register a new parking location?
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore platform revenue models, capacity planning, and partner advantages.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link to="/become-owner">
              Partner Guide
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
