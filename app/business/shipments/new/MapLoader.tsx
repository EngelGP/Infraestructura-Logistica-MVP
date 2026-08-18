'use client';

import { lazy, Suspense } from 'react';
import type { LatLng } from 'leaflet';

// Lazy load del mapa solo en el cliente
const MapWithGeocoder = lazy(() => import('./MapWithGeocoder'));

export default function MapLoader(props: {
  mode: 'origin' | 'dest' | null;
  originCoords: LatLng | null;
  destCoords: LatLng | null;
  onOriginSelect: (coords: LatLng) => void;
  onDestSelect: (coords: LatLng) => void;
}) {
  return (
    <Suspense fallback={
      <div className="h-[350px] w-full bg-slate-100 rounded-md flex items-center justify-center text-slate-400 font-medium">
        Cargando mapa...
      </div>
    }>
      <MapWithGeocoder {...props} />
    </Suspense>
  );
}