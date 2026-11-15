import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getFacilityImageUrl } from '@/api/customerParking.api';

interface FacilityPhotoGalleryProps {
  parkingName: string;
  images: string[];
}

export const FacilityPhotoGallery: React.FC<FacilityPhotoGalleryProps> = ({
  parkingName,
  images = [],
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  const sliderRef = useRef<HTMLDivElement>(null);

  // Filter valid URLs
  const resolvedImages = images
    .map((img) => getFacilityImageUrl(img))
    .filter((url): url is string => Boolean(url));

  const hasPhotos = resolvedImages.length > 0;
  const displayPhotos = hasPhotos ? resolvedImages : [];

  const openLightbox = (index: number) => {
    setActiveImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const handleLightboxPrev = useCallback(() => {
    setActiveImageIndex((prev) =>
      prev === 0 ? displayPhotos.length - 1 : prev - 1,
    );
  }, [displayPhotos.length]);

  const handleLightboxNext = useCallback(() => {
    setActiveImageIndex((prev) =>
      prev === displayPhotos.length - 1 ? 0 : prev + 1,
    );
  }, [displayPhotos.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') handleLightboxPrev();
      if (e.key === 'ArrowRight') handleLightboxNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, handleLightboxPrev, handleLightboxNext]);

  // Handle scroll detection on linear slider to update active slide index
  const handleSliderScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;

    const scrollLeft = slider.scrollLeft;
    const itemWidth = slider.clientWidth * 0.85; // approximate slide width
    if (itemWidth > 0) {
      const newIndex = Math.round(scrollLeft / itemWidth);
      const clamped = Math.max(0, Math.min(displayPhotos.length - 1, newIndex));
      setCurrentSlideIndex(clamped);
    }
  };

  const scrollToSlide = (index: number) => {
    const slider = sliderRef.current;
    if (!slider) return;

    const slideElements = slider.querySelectorAll<HTMLElement>('[data-slide]');
    const target = slideElements[index];
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      });
      setCurrentSlideIndex(index);
    }
  };

  const scrollPrevSlide = () => {
    const nextIndex = Math.max(0, currentSlideIndex - 1);
    scrollToSlide(nextIndex);
  };

  const scrollNextSlide = () => {
    const nextIndex = Math.min(displayPhotos.length - 1, currentSlideIndex + 1);
    scrollToSlide(nextIndex);
  };

  // 1. Fallback placeholder when no images are uploaded
  if (!hasPhotos) {
    return (
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-50/60 via-background to-orange-100/40 border border-border/80 flex flex-col items-center justify-center p-6 text-center shadow-xs">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-inner">
          <ImageIcon className="h-8 w-8" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          {parkingName}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
          No facility photos uploaded yet. Verified parking slot layout is available.
        </p>
      </div>
    );
  }

  // 2. Single Image: Clean full-width hero with on-tap expand
  if (displayPhotos.length === 1) {
    const photoUrl = displayPhotos[0]!;
    return (
      <>
        <div
          className="relative w-full h-72 sm:h-96 md:h-[440px] rounded-2xl overflow-hidden bg-muted border border-border/70 group cursor-pointer shadow-xs select-none"
          onClick={() => openLightbox(0)}
        >
          {failedImages[0] ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-muted/60 text-muted-foreground p-4 text-center">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50 text-primary" />
              <span className="text-sm font-semibold text-foreground">{parkingName}</span>
              <span className="text-xs text-muted-foreground mt-0.5">Facility Photo</span>
            </div>
          ) : (
            <img
              src={photoUrl}
              alt={`${parkingName} primary view`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
              onError={() => setFailedImages((prev) => ({ ...prev, 0: true }))}
            />
          )}

          {/* Floating Tap to Expand Hint */}
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 rounded-full text-xs font-semibold bg-background/90 backdrop-blur-md border border-border/60 shadow-md text-foreground hover:bg-background"
            >
              <Maximize2 className="h-3.5 w-3.5 text-primary" />
              <span>Tap to Expand</span>
            </Button>
          </div>
        </div>

        {/* Lightbox Modal */}
        {lightboxOpen && renderLightbox()}
      </>
    );
  }

  // 3. Multiple Images: Linear Sequential Scrollable Slider with on-tap expand
  return (
    <>
      <div className="relative group/slider w-full rounded-2xl overflow-hidden">
        {/* Top-Right Photo Counter Badge */}
        <div className="absolute top-4 right-4 z-20">
          <Badge
            variant="secondary"
            className="bg-black/60 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 px-3 py-1 text-xs font-semibold rounded-full shadow-md gap-1.5 select-none"
          >
            <Camera className="h-3.5 w-3.5 text-primary" />
            <span>
              {currentSlideIndex + 1} / {displayPhotos.length} Photos
            </span>
          </Badge>
        </div>

        {/* Navigation Arrow Left (Prev) */}
        {currentSlideIndex > 0 && (
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              scrollPrevSlide();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/90 hover:bg-background text-foreground shadow-lg border border-border/80 backdrop-blur-md transition-all active:scale-95"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Navigation Arrow Right (Next) */}
        {currentSlideIndex < displayPhotos.length - 1 && (
          <Button
            variant="secondary"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              scrollNextSlide();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/90 hover:bg-background text-foreground shadow-lg border border-border/80 backdrop-blur-md transition-all active:scale-95"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Horizontal Scroll Track (Snap-scrolling linear sequence) */}
        <div
          ref={sliderRef}
          onScroll={handleSliderScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar gap-3 sm:gap-4 p-0.5 rounded-2xl"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayPhotos.map((photoUrl, idx) => {
            return (
              <div
                key={idx}
                data-slide
                onClick={() => openLightbox(idx)}
                className="relative shrink-0 w-[90%] sm:w-[80%] md:w-[70%] h-72 sm:h-96 md:h-[420px] rounded-2xl overflow-hidden bg-muted border border-border/70 group cursor-pointer snap-start transition-all duration-300 select-none shadow-xs hover:border-primary/50"
              >
                {failedImages[idx] ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted/70 text-muted-foreground p-4 text-center">
                    <ImageIcon className="h-10 w-10 mb-2 opacity-40 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {parkingName}
                    </span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">
                      Photo {idx + 1}
                    </span>
                  </div>
                ) : (
                  <img
                    src={photoUrl}
                    alt={`${parkingName} - Slide ${idx + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                    onError={() => setFailedImages((prev) => ({ ...prev, [idx]: true }))}
                  />
                )}

                {/* Subtle Hover Gradient & Tap-to-Expand Indicator */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4 text-white">
                  <span className="text-xs font-semibold flex items-center gap-1.5 drop-shadow-md">
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                    <span>Tap to view full screen</span>
                  </span>
                  <span className="text-xs font-medium text-white/90 bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                    {idx + 1} of {displayPhotos.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-3">
          {displayPhotos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToSlide(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentSlideIndex === idx
                  ? 'w-7 bg-primary'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && renderLightbox()}
    </>
  );

  function renderLightbox() {
    const currentUrl = displayPhotos[activeImageIndex]!;

    return (
      <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm sm:text-base truncate max-w-[200px] sm:max-w-md">
              {parkingName}
            </span>
            <span className="text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
              {activeImageIndex + 1} of {displayPhotos.length}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={closeLightbox}
            className="h-9 w-9 p-0 rounded-full text-white/80 hover:text-white hover:bg-white/15"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close gallery</span>
          </Button>
        </div>

        {/* Main Photo Center Container */}
        <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
          {/* Previous Button */}
          {displayPhotos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLightboxPrev}
              className="absolute left-3 sm:left-6 z-10 h-11 w-11 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white border border-white/10 backdrop-blur-xs transition-transform active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Previous photo</span>
            </Button>
          )}

          {/* Current Lightbox Image */}
          <div className="max-w-5xl max-h-[70vh] flex items-center justify-center">
            <img
              src={currentUrl}
              alt={`${parkingName} enlarged preview ${activeImageIndex + 1}`}
              className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl transition-all select-none"
            />
          </div>

          {/* Next Button */}
          {displayPhotos.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLightboxNext}
              className="absolute right-3 sm:right-6 z-10 h-11 w-11 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white border border-white/10 backdrop-blur-xs transition-transform active:scale-95"
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Next photo</span>
            </Button>
          )}
        </div>

        {/* Bottom Filmstrip Thumbnails */}
        {displayPhotos.length > 1 && (
          <div className="shrink-0 p-3 sm:p-4 border-t border-white/10 overflow-x-auto">
            <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto">
              {displayPhotos.map((thumbUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative h-14 w-20 sm:h-16 sm:w-24 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-primary ring-2 ring-primary/40 scale-105 opacity-100'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={thumbUrl}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
};
