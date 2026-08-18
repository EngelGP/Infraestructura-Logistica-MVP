'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapWithGeocoderProps {
  mode: 'origin' | 'dest' | null;
  originCoords: L.LatLng | null;
  destCoords: L.LatLng | null;
  onOriginSelect: (latlng: L.LatLng) => void;
  onDestSelect: (latlng: L.LatLng) => void;
  fixedOrigin?: boolean;
  defaultCenter?: [number, number];
}

export default function MapWithGeocoder({
  mode,
  originCoords,
  destCoords,
  onOriginSelect,
  onDestSelect,
  fixedOrigin = false,
  defaultCenter = [12.1364, -86.2514],
}: MapWithGeocoderProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const geocoderControlRef = useRef<any>(null);

  const originIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div style="background-color: #22c55e; width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  const destIcon = new L.DivIcon({
    className: 'bg-transparent',
    html: `<div style="background-color: #ef4444; width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  const updateOriginMarker = (coords: L.LatLng | null) => {
    if (!mapInstanceRef.current) return;
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
    if (coords) {
      originMarkerRef.current = L.marker(coords, { icon: originIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup('Origen (fijo)');
    }
  };

  const updateDestMarker = (coords: L.LatLng | null) => {
    if (!mapInstanceRef.current) return;
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (coords) {
      destMarkerRef.current = L.marker(coords, { icon: destIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup('Destino');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(defaultCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    map.on('click', (e: any) => {
      if (mode === 'dest') {
        onDestSelect(e.latlng);
        updateDestMarker(e.latlng);
      } else if (mode === 'origin' && !fixedOrigin) {
        onOriginSelect(e.latlng);
        updateOriginMarker(e.latlng);
      }
    });

    mapInstanceRef.current = map;

    // Cargar geocoder
    const loadGeocoder = async () => {
      try {
        await import('leaflet-control-geocoder/dist/Control.Geocoder.css');
        await import('leaflet-control-geocoder');
        
        // @ts-ignore - Ignorar error de tipos porque el plugin extiende L.Control
        const geocoderControl = L.Control.geocoder({
          defaultMarkGeocode: false,
          placeholder: 'Buscar dirección...',
          errorMessage: 'No se encontró la dirección',
          limit: 5,
          // @ts-ignore - Ignorar error de tipos para el geocoder
          geocoder: new L.Control.Geocoder.Nominatim({
            geocodingQueryParams: {
              countrycodes: 'ni',
              viewbox: [-86.3, 12.2, -86.1, 12.0],
              bounded: 1
            }
          })
        }).addTo(map);

        geocoderControl.on('markgeocode', (e: any) => {
          const center = e.geocode.center;
          if (mode === 'dest') {
            onDestSelect(center);
            updateDestMarker(center);
            map.setView(center, 15);
          } else if (mode === 'origin' && !fixedOrigin) {
            onOriginSelect(center);
            updateOriginMarker(center);
            map.setView(center, 15);
          }
        });

        geocoderControlRef.current = geocoderControl;
      } catch (error) {
        console.error('Error al cargar el geocoder:', error);
      }
    };

    loadGeocoder();

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Actualizar marcadores cuando cambien las coordenadas
  useEffect(() => {
    updateOriginMarker(originCoords);
  }, [originCoords]);

  useEffect(() => {
    updateDestMarker(destCoords);
  }, [destCoords]);

  // Ajustar zoom para mostrar ambos puntos
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const coords = [];
    if (originCoords) coords.push(originCoords);
    if (destCoords) coords.push(destCoords);
    if (coords.length === 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] });
    } else if (coords.length === 1) {
      map.setView(coords[0], 15);
    } else {
      map.setView(defaultCenter, 13);
    }
  }, [originCoords, destCoords]);

  return <div ref={mapRef} className="h-[350px] w-full rounded-md overflow-hidden border border-slate-300 relative z-0" style={{ background: '#e5e7eb' }} />;
}