import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ImageIcon,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/authStore';
import {
  ownerApi,
  type OwnerRegistrationDocumentsData,
} from '@/api/owner.api';
import { profileApi } from '@/api/profile.api';
import { OwnerDocumentImage } from '@/components/common/OwnerDocumentImage';
import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload';
import { ProfilePersonalForm } from '@/components/profile/ProfilePersonalForm';
import { ProfileContactCard } from '@/components/profile/ProfileContactCard';
import { OwnerBusinessCard } from '@/components/profile/OwnerBusinessCard';
import type { ProfileData } from '@/types/profile';

interface InspectingDocState {
  title: string;
  categoryLabel: string;
  docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage';
  index?: number;
  fileName?: string;
  isImage: boolean;
}

export const OwnerProfilePage: React.FC = () => {
  const { user, updateUser } = useAuthStore();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [registrationDocs, setRegistrationDocs] = useState<OwnerRegistrationDocumentsData | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Inspector modal state
  const [inspectingDoc, setInspectingDoc] = useState<InspectingDocState | null>(null);
  const [docBlobUrl, setDocBlobUrl] = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      const res = await profileApi.getProfile();
      if (res.success && res.data) {
        setProfileData(res.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load profile details:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true);
      setDocsError(null);
      const data = await ownerApi.getRegistrationDocuments();
      setRegistrationDocs(data);
    } catch (err: unknown) {
      setDocsError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to document repository server.',
      );
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadDocuments();
  }, [loadProfile, loadDocuments]);

  // Load document blob for secure modal inspector
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!inspectingDoc) return;

    const loadBlob = async () => {
      try {
        setDocLoading(true);
        setDocError(null);
        setZoomLevel(1);
        setRotation(0);

        const { blob, mimeType } = await ownerApi.getRegistrationDocumentBlob(
          inspectingDoc.docType,
          inspectingDoc.index,
        );

        if (!active) return;
        setDocMimeType(mimeType);
        createdUrl = URL.createObjectURL(blob);
        setDocBlobUrl(createdUrl);
      } catch (err: unknown) {
        if (!active) return;
        setDocError(
          err instanceof Error
            ? err.message
            : 'Failed to stream secure document from repository.',
        );
      } finally {
        if (active) setDocLoading(false);
      }
    };

    void loadBlob();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [inspectingDoc]);

  const openDocumentInspector = (doc: InspectingDocState) => {
    setInspectingDoc(doc);
  };

  const closeDocumentInspector = () => {
    if (docBlobUrl) {
      URL.revokeObjectURL(docBlobUrl);
    }
    setDocBlobUrl(null);
    setDocMimeType(null);
    setInspectingDoc(null);
    setDocError(null);
  };

  const handleDownload = async (
    docType: 'identityProof' | 'businessLicense' | 'propertyProof' | 'parkingImage',
    index?: number,
    fileName?: string,
  ) => {
    try {
      await ownerApi.downloadRegistrationDocument(docType, index, fileName);
      toast.success('Document downloaded successfully.');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to download document file.',
      );
    }
  };

  const profileUser = profileData?.user;
  const activeUser = user ? { ...(profileUser || {}), ...user } : profileUser;
  const docCount = (registrationDocs?.documents?.length || 0) + (registrationDocs?.photos?.items?.length || 0);

  return (
    <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2 text-muted-foreground hover:text-foreground gap-1.5"
            >
              <Link to="/owner/dashboard">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </Link>
            </Button>
            <span className="text-muted-foreground/40">&bull;</span>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Parking Owner Account
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Partner Profile &amp; Enterprise Settings
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">
            Manage your personal profile, verified contact channels, business entity details, and compliance documents.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadProfile();
              void loadDocuments();
            }}
            disabled={isLoadingDocs || isLoadingProfile}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDocs || isLoadingProfile ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {activeUser && (
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-6">
            <ProfileAvatarUpload
              user={activeUser}
              onAvatarUpdated={(url) => updateUser({ ...activeUser, profileImage: url })}
            />
          </CardContent>
        </Card>
      )}

      {/* 2. TABS: Personal & Contacts | Business Profile | Verification Documents */}
      <Tabs defaultValue="personal" className="w-full space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="personal" className="text-xs">
            Personal &amp; Contact
          </TabsTrigger>
          <TabsTrigger value="business" className="text-xs">
            Business Profile
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">
            Documents ({docCount || '3'})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Personal & Contact Settings */}
        <TabsContent value="personal" className="space-y-6">
          {activeUser && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ProfilePersonalForm user={activeUser} onSuccess={(u) => updateUser(u)} />
              <ProfileContactCard user={activeUser} onUserUpdated={(u) => updateUser(u)} />
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Business Information */}
        <TabsContent value="business" className="space-y-6">
          <OwnerBusinessCard
            business={profileData?.business}
            onBusinessUpdated={() => {
              void loadProfile();
              void loadDocuments();
            }}
          />
        </TabsContent>

        {/* Tab 3: Verification Documents & Legal Proofs */}
        <TabsContent value="documents" className="space-y-6">
          {isLoadingDocs ? (
            <div className="p-16 text-center text-xs text-muted-foreground border rounded-xl bg-card flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Retrieving registered business profile and cryptographic records...</span>
            </div>
          ) : docsError ? (
            <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <h3 className="text-base font-semibold text-destructive">Failed to load registration documents</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">{docsError}</p>
              <Button variant="outline" size="sm" onClick={() => void loadDocuments()}>
                Retry Connection
              </Button>
            </Card>
          ) : registrationDocs?.hasApplication ? (
            <div className="space-y-6">
              {/* Mandatory Documents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {registrationDocs.documents.map((doc) => (
                  <Card
                    key={doc.category}
                    className="border-border/80 flex flex-col justify-between overflow-hidden shadow-xs hover:border-border transition-colors"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          {doc.category === 'identityProof'
                            ? 'Legal Identification'
                            : doc.category === 'businessLicense'
                            ? 'Commercial License'
                            : 'Premises Title'}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                          {doc.verificationStatus}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{doc.label}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {doc.maskedIdNumber ? `${doc.governmentIdType || 'ID'}: ${doc.maskedIdNumber}` : doc.fileName}
                        </p>
                      </div>
                      <div className="h-40 w-full rounded-md border border-border/60 bg-muted/20 overflow-hidden flex flex-col items-center justify-center p-3 text-center">
                        <FileText className="h-10 w-10 text-primary/70 mb-2" />
                        <span className="text-xs font-mono font-semibold text-foreground truncate max-w-[180px]">
                          {doc.fileName}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-semibold">
                          Format: {doc.documentType}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/20 border-t border-border/80 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs flex-1 gap-1.5"
                        onClick={() =>
                          openDocumentInspector({
                            title: doc.label,
                            categoryLabel: doc.category,
                            docType: doc.category,
                            fileName: doc.fileName,
                            isImage: doc.documentType === 'Image',
                          })
                        }
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDownload(doc.category, undefined, doc.fileName)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Facility Images Section */}
              {registrationDocs.photos?.items?.length > 0 && (
                <Card className="border-border/80 shadow-xs">
                  <CardHeader className="border-b border-border/60 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Registered Facility Photographs ({registrationDocs.photos.items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {registrationDocs.photos.items.map((img, idx) => (
                        <div
                          key={img.index}
                          className="group relative rounded-lg border border-border overflow-hidden bg-muted/20 flex flex-col"
                        >
                          <div className="h-32 w-full flex items-center justify-center overflow-hidden">
                            <OwnerDocumentImage
                              index={img.index}
                              alt={`Photo ${idx + 1}`}
                            />
                          </div>
                          <div className="p-2 bg-background/90 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Photo #{idx + 1}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  openDocumentInspector({
                                    title: `Facility Image #${idx + 1}`,
                                    categoryLabel: 'Facility Photo',
                                    docType: 'parkingImage',
                                    index: img.index,
                                    fileName: img.fileName,
                                    isImage: true,
                                  })
                                }
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleDownload('parkingImage', img.index, img.fileName)}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="p-8 text-center text-xs text-muted-foreground border-dashed">
              No registration documents found for this account.
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 3. MODAL DOCUMENT INSPECTOR DIALOG */}
      <Dialog open={!!inspectingDoc} onOpenChange={(open) => !open && closeDocumentInspector()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
          <DialogHeader className="p-4 border-b border-border/80 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {inspectingDoc?.title || 'Document Inspection'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {inspectingDoc?.categoryLabel} &bull; Stored securely under ParkEase partner vault
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Controls Bar for images */}
          <div className="px-4 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-1.5">
              {inspectingDoc?.isImage && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom In
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                    Zoom Out
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Rotate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                    onClick={() => {
                      setZoomLevel(1);
                      setRotation(0);
                    }}
                  >
                    Reset
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {docBlobUrl && (
                <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <a href={docBlobUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Tab
                  </a>
                </Button>
              )}
              {inspectingDoc && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() =>
                    handleDownload(
                      inspectingDoc.docType,
                      inspectingDoc.index,
                      inspectingDoc.fileName,
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              )}
            </div>
          </div>

          {/* Modal Preview Area */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[420px] bg-muted/10">
            {docLoading ? (
              <div className="text-center space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="text-xs text-muted-foreground">Streaming verified document from storage...</p>
              </div>
            ) : docError ? (
              <div className="p-6 text-center space-y-2 border border-destructive/30 bg-destructive/5 rounded-lg max-w-md">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto" />
                <p className="text-xs font-semibold text-destructive">{docError}</p>
                <p className="text-[11px] text-muted-foreground">
                  The document could not be retrieved from authenticated storage. Please try again.
                </p>
              </div>
            ) : docBlobUrl ? (
              docMimeType?.includes('pdf') || inspectingDoc?.fileName?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={docBlobUrl}
                  title="PDF Preview"
                  className="w-full h-[550px] border rounded bg-background"
                />
              ) : (
                <div
                  className="transition-transform duration-150 ease-out"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  }}
                >
                  <img
                    src={docBlobUrl}
                    alt={inspectingDoc?.title || 'Document preview'}
                    className="max-h-[500px] max-w-full object-contain rounded border shadow-md bg-background"
                  />
                </div>
              )
            ) : null}
          </div>

          <DialogFooter className="p-3 border-t border-border/80 bg-muted/10 shrink-0">
            <Button variant="outline" size="sm" onClick={closeDocumentInspector}>
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerProfilePage;
