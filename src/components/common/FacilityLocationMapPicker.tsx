import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, CheckCircle2, MapPin, Search, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface FacilityLocationMapPickerProps {
  latitude: number;
  longitude: number;
  confirmed: boolean;
  addressHint?: string;
  onChange: (lat: number, lng: number, confirmed: boolean) => void;
}

export const FacilityLocationMapPicker: React.FC<FacilityLocationMapPickerProps> = ({
  latitude,
  longitude,
  confirmed,
  addressHint,
  onChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : 23.0225;
    const initialLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : 72.5714;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom ParkEase Orange Pin Icon using L.divIcon
    const pinIcon = L.divIcon({
      className: 'custom-parkease-map-marker',
      html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 14px; height: 14px; background: #ea580c; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(234,88,12,0.6); z-index: 2;"></div>
          <div style="position: absolute; width: 32px; height: 32px; background: rgba(234,88,12,0.25); border-radius: 50%; animation: pulse 2s infinite; z-index: 1;"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([initialLat, initialLng], {
      icon: pinIcon,
      draggable: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)), false);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)), false);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Sync marker position when external props change (e.g. initial fetch)
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - latitude) > 0.0001 ||
        Math.abs(currentPos.lng - longitude) > 0.0001
      ) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom());
      }
    }
  }, [latitude, longitude]);

  // Geocoding search using OpenStreetMap Nominatim
  const handleSearchLocation = async () => {
    const query = searchQuery.trim() || addressHint?.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const resultLat = parseFloat(data[0].lat);
        const resultLng = parseFloat(data[0].lon);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([resultLat, resultLng], 16);
          markerRef.current.setLatLng([resultLat, resultLng]);
        }
        onChange(Number(resultLat.toFixed(6)), Number(resultLng.toFixed(6)), false);
      } else {
        setSearchError('Location not found. Please click directly on the map to place the marker.');
      }
    } catch {
      setSearchError('Search service temporarily unavailable. Click directly on the map to pin.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmLocation = () => {
    onChange(latitude, longitude, true);
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & Confirmation Status */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="mapSearchLocation"
              aria-label="Search area, landmark, or street"
              type="text"
              placeholder="Search area, landmark, or street..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearchLocation();
                }
              }}
              className="pl-9 text-xs sm:text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSearchLocation}
            disabled={isSearching}
            className="shrink-0 text-xs"
          >
            {isSearching ? 'Searching...' : 'Locate'}
          </Button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {confirmed ? (
            <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-600/30 gap-1.5 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Location Confirmed
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmLocation}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm Map Marker
            </Button>
          )}
        </div>
      </div>

      {searchError && <p className="text-xs text-destructive">{searchError}</p>}

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-border/80 shadow-xs">
        <div ref={mapContainerRef} className="h-64 sm:h-80 w-full z-0" />

        {/* Floating Coordinates Tag */}
        <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-border text-[11px] font-mono text-muted-foreground flex items-center gap-2 shadow-xs">
          <Navigation className="h-3 w-3 text-primary" />
          <span>
            Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        Click anywhere on the map or drag the orange marker to pin the physical facility boundary.
        The entrance and exit will be configured later by the Administrator.
      </p>
    </div>
  );
};
