import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Maximize2 } from 'lucide-react';
import {
  type CustomerParkingLotResult,
  getFacilityImageUrl,
} from '@/api/customerParking.api';

interface ParkingSearchMapProps {
  parkingLots: CustomerParkingLotResult[];
  userLocation: { latitude: number; longitude: number } | null;
  selectedLotId?: string | null;
  onSelectLot?: (lot: CustomerParkingLotResult) => void;
  onRequestUserLocation?: () => void;
  className?: string;
}

export const ParkingSearchMap: React.FC<ParkingSearchMapProps> = ({
  parkingLots,
  userLocation,
  selectedLotId,
  onSelectLot,
  onRequestUserLocation,
  className = 'w-full h-full min-h-[450px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.latitude ?? 23.0225; // Default Ahmedabad center
    const initialLng = userLocation?.longitude ?? 72.5714;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      scrollWheelZoom: true,
      zoomControl: false, // We'll position zoom control neatly
    });

    // Clean OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Zoom control in bottom-right corner for clean SaaS look
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;
    const markersMap = markersMapRef.current;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      userMarkerRef.current = null;
      markersMap.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update User Location Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-current-location-marker',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 14px; height: 14px; background: #3b82f6; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 0 12px rgba(59,130,246,0.8); z-index: 3;"></div>
            <div style="position: absolute; width: 34px; height: 34px; background: rgba(59,130,246,0.25); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; z-index: 1;"></div>
            <div style="position: absolute; width: 22px; height: 22px; background: rgba(59,130,246,0.2); border-radius: 50%; z-index: 2;"></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.latitude, userLocation.longitude]);
      } else {
        userMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
          zIndexOffset: 1000,
        })
          .bindTooltip('Your Location', { direction: 'top', offset: [0, -12], className: 'font-semibold text-xs' })
          .addTo(mapInstanceRef.current);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  // Update Parking Lot Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;

    markersLayer.clearLayers();
    markersMapRef.current.clear();

    const bounds = L.latLngBounds([]);

    if (userLocation) {
      bounds.extend([userLocation.latitude, userLocation.longitude]);
    }

    parkingLots.forEach((lot) => {
      const isSelected = lot._id === selectedLotId;
      const isSoldOut = lot.availableSlots <= 0;

      // Airbnb-style Price Pill marker
      const markerHtml = `
        <div class="parkease-saas-pin ${isSelected ? 'active-pin' : ''}" style="
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: ${isSelected ? '6px 12px' : '4px 9px'};
          background: ${isSelected ? '#ff6a00' : isSoldOut ? '#64748b' : '#08132c'};
          color: #ffffff;
          border-radius: 9999px;
          font-weight: 700;
          font-size: ${isSelected ? '13px' : '11px'};
          font-family: inherit;
          box-shadow: ${isSelected ? '0 8px 20px rgba(255,106,0,0.45)' : '0 4px 12px rgba(8,19,44,0.3)'};
          border: 2px solid #ffffff;
          white-space: nowrap;
          cursor: pointer;
          transform: ${isSelected ? 'scale(1.15) translateY(-4px)' : 'scale(1)'};
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          <span>₹${lot.hourlyRate}</span>
          ${isSoldOut ? '<span style="font-size: 9px; opacity: 0.8;">Full</span>' : ''}
        </div>
      `;

      const lotIcon = L.divIcon({
        className: `saas-marker-container-${lot._id}`,
        html: markerHtml,
        iconSize: [isSelected ? 64 : 52, 32],
        iconAnchor: [isSelected ? 32 : 26, 16],
      });

      const marker = L.marker([lot.latitude, lot.longitude], {
        icon: lotIcon,
        zIndexOffset: isSelected ? 800 : 100,
      });

      // Modern Glassmorphic Popup
      const rawCover = lot.parkingImages?.[0];
      const resolvedCoverUrl = rawCover ? getFacilityImageUrl(rawCover) : null;
      const coverPhoto = resolvedCoverUrl
        ? `<div style="position: relative; width: 100%; height: 110px; border-radius: 10px; overflow: hidden; margin-bottom: 8px; background: #e2e8f0;">
             <img src="${resolvedCoverUrl}" alt="${lot.parkingName}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.style.display='none';" />
             <div style="position: absolute; top: 6px; left: 6px; background: rgba(8,19,44,0.85); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 12px; backdrop-filter: blur(4px);">
               ₹${lot.hourlyRate}/hr
             </div>
           </div>`
        : '';

      const distanceBadge =
        lot.distanceKm !== null && lot.distanceKm !== undefined
          ? `<span style="background: rgba(255,106,0,0.12); color: #ff6a00; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700;">📍 ${lot.distanceKm} km</span>`
          : '';

      const ratingBadge =
        lot.averageRating > 0
          ? `<span style="color: #f59e0b; font-weight: 700; font-size: 11px;">★ ${lot.averageRating.toFixed(1)} <span style="color: #64748b; font-weight: normal; font-size: 10px;">(${lot.totalReviews})</span></span>`
          : `<span style="color: #64748b; font-size: 10px;">New</span>`;

      const slotsBadge = isSoldOut
        ? `<span style="color: #ef4444; font-weight: 700; font-size: 11px;">Sold Out</span>`
        : `<span style="color: #10b981; font-weight: 700; font-size: 11px;">${lot.availableSlots} spots available</span>`;

      const popupHtml = `
        <div style="font-family: inherit; width: 230px; padding: 2px;">
          ${coverPhoto}
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 2px;">
            <h4 style="margin: 0; font-size: 13px; font-weight: 700; line-height: 1.25; color: #08132c;">${lot.parkingName}</h4>
            ${distanceBadge}
          </div>
          <p style="margin: 0 0 8px 0; font-size: 11px; color: #64748b; line-height: 1.2; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${lot.address}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-top: 6px; border-top: 1px solid #f1f5f9;">
            ${ratingBadge}
            ${slotsBadge}
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="/customer/parking/${lot._id}" style="flex: 1; text-align: center; background: #f8fafc; color: #334155; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; text-decoration: none; border: 1px solid #e2e8f0; transition: all 0.2s;">Details</a>
            <a href="/customer/parking/${lot._id}/book" style="flex: 1; text-align: center; background: #ff6a00; color: #ffffff; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none; box-shadow: 0 2px 6px rgba(255,106,0,0.35);">Book Now</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        maxWidth: 250,
        className: 'parkease-saas-popup',
      });

      marker.on('click', () => {
        onSelectLot?.(lot);
      });

      markersLayer.addLayer(marker);
      markersMapRef.current.set(lot._id, marker);
      bounds.extend([lot.latitude, lot.longitude]);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Auto-fit bounds if markers exist
    if (bounds.isValid() && parkingLots.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [parkingLots, userLocation, selectedLotId, onSelectLot]);

  // Handle selectedLotId changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLotId) return;
    const selected = parkingLots.find((p) => p._id === selectedLotId);
    if (selected) {
      mapInstanceRef.current.setView([selected.latitude, selected.longitude], 15, {
        animate: true,
      });
      const marker = markersMapRef.current.get(selectedLotId);
      if (marker && !marker.isPopupOpen()) {
        marker.openPopup();
      }
    }
  }, [selectedLotId, parkingLots]);

  // Fit All Bounds Handler
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds([]);
    if (userLocation) bounds.extend([userLocation.latitude, userLocation.longitude]);
    parkingLots.forEach((lot) => bounds.extend([lot.latitude, lot.longitude]));
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-border/80 shadow-sm bg-muted/20 ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" />

      {/* Floating SaaS Map Controls in Top Right */}
      <div className="absolute top-3 right-3 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            if (userLocation && mapInstanceRef.current) {
              mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], 15, {
                animate: true,
              });
            } else if (onRequestUserLocation) {
              onRequestUserLocation();
            }
          }}
          className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-md flex items-center justify-center text-foreground hover:bg-card hover:text-primary transition-all cursor-pointer"
          title={userLocation ? 'Center on My Location' : 'Locate Me'}
        >
          <Compass className={`h-4 w-4 ${userLocation ? 'text-blue-500' : 'text-muted-foreground'}`} />
        </button>

        <button
          type="button"
          onClick={handleFitAll}
          className="h-9 w-9 rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-md flex items-center justify-center text-foreground hover:bg-card hover:text-primary transition-all cursor-pointer"
          title="Fit All Facilities"
        >
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Floating Counter Badge in Top Left */}
      <div className="absolute top-3 left-3 z-[400] pointer-events-none">
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-card/90 backdrop-blur-md border border-border/80 text-foreground shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          {parkingLots.length} {parkingLots.length === 1 ? 'facility' : 'facilities'} on map
        </span>
      </div>
    </div>
  );
};
