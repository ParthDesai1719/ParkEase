import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Compass,
  ExternalLink,
  Phone,
  Mail,
  Building,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CustomerParkingLotResult } from '@/api/customerParking.api';

interface FacilityLocationMapProps {
  facility: CustomerParkingLotResult;
}

export const FacilityLocationMap: React.FC<FacilityLocationMapProps> = ({
  facility,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const {
    parkingName,
    address,
    city,
    state,
    postalCode,
    country,
    latitude,
    longitude,
    distanceKm,
    contactNumber,
    supportEmail,
    availableSlots,
  } = facility;

  const hasValidCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  const fullAddress = `${address}, ${city}, ${state} ${postalCode}, ${country}`;

  const openNavigation = () => {
    const url = hasValidCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!mapContainerRef.current || !hasValidCoords) return;

    // Destroy any existing instance before initializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Custom ParkEase Orange Pin
    const pinHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          background: #ff6a00;
          color: white;
          padding: 6px 10px;
          border-radius: 20px;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 4px 14px rgba(255, 106, 0, 0.45);
          display: flex;
          align-items: center;
          gap: 4px;
          border: 2px solid #ffffff;
          white-space: nowrap;
        ">
          <span>${parkingName}</span>
          <span style="background: rgba(255,255,255,0.25); border-radius: 10px; padding: 1px 6px; font-size: 10px;">
            ${availableSlots} free
          </span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #ff6a00;
          margin-top: -1px;
        "></div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: pinHtml,
      className: 'parkease-facility-pin',
      iconSize: [140, 40],
      iconAnchor: [70, 40],
    });

    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 2px;">
        <strong style="color: #0f172a; font-size: 13px;">${parkingName}</strong><br/>
        <span style="color: #64748b;">${address}, ${city}</span><br/>
        <span style="color: #10b981; font-weight: 700; display: inline-block; margin-top: 4px;">
          ✓ ${availableSlots} operational slots available
        </span>
      </div>
    `);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, hasValidCoords, parkingName, address, city, availableSlots]);

  return (
    <Card className="rounded-2xl border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-2 border-b border-border/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold text-foreground">
              Location & Facility Map
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accurate geo-coordinates and verified driving directions.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={openNavigation}
            className="h-8 px-3 text-xs font-semibold rounded-lg gap-1.5 border-border hover:bg-muted text-foreground"
          >
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span>Open in Google Maps</span>
            <ExternalLink className="h-3 w-3 text-muted-foreground ml-0.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Interactive Map Display */}
        {hasValidCoords ? (
          <div className="relative w-full h-72 sm:h-80 rounded-xl overflow-hidden border border-border/70 shadow-inner">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Float Distance Badge on Map */}
            {distanceKm !== null && distanceKm !== undefined && (
              <div className="absolute top-3 left-3 z-[400] bg-background/95 backdrop-blur-md border border-border/70 text-foreground px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>{distanceKm.toFixed(1)} km from your current GPS</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-48 rounded-xl bg-muted/60 border border-border/60 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 text-muted-foreground/60" />
            <p className="text-sm font-semibold">Map coordinates not registered</p>
            <p className="text-xs mt-1">Please use the address listed below for navigation.</p>
          </div>
        )}

        {/* Address and Contact Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Address Details */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>Full Facility Address</span>
            </div>
            <p className="text-xs sm:text-sm text-foreground/90 font-medium">
              {address}
            </p>
            <p className="text-xs text-muted-foreground">
              {city}, {state} {postalCode}, {country}
            </p>
          </div>

          {/* Helpdesk & Support Contact */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <Building className="h-3.5 w-3.5 text-primary" />
              <span>Attendant & Helpdesk Desk</span>
            </div>

            <div className="space-y-1.5 text-xs">
              {contactNumber ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${contactNumber}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {contactNumber}
                  </a>
                  <span className="text-[11px] text-muted-foreground">(On-Site Attendant)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>On-site attendant on premise</span>
                </div>
              )}

              {supportEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${supportEmail}`}
                    className="font-medium text-foreground hover:underline truncate"
                  >
                    {supportEmail}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
