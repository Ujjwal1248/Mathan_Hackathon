import React, { useEffect, useRef, useState } from 'react';
import Map, { 
  Marker, 
  Popup, 
  Source, 
  Layer,
  NavigationControl,
  FullscreenControl,
  ViewStateChangeEvent,
  MapRef,
  GeolocateControl
} from 'react-map-gl';
import { AlertTriangle, Users, Box, Truck, Shield, Wind } from 'lucide-react';
import { useDisasterStore } from '../store/disaster';
import type { Database } from '../lib/database.types';
import 'mapbox-gl/dist/mapbox-gl.css';

type Disaster = Database['public']['Tables']['disasters']['Row'];
type Resource = Database['public']['Tables']['resources']['Row'];

// Use Mapbox token from env or fallback to public token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZXMiLCJhIjoiY2p0MG01MXRqMW45cjQzb2R6b2ptc3J4MSJ9.zA2W0IkI0c6KaAhJfk9bWg';

const RESOURCE_ICONS = {
  medical: Shield,
  food: Box,
  water: Wind,
  shelter: Box,
  rescue: Users,
  transport: Truck
};

const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12'
};

// Sample GeoJSON data for visualization
const sampleEvacuationZones = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { zone: 'Primary', risk: 'high' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [76.2, 10.8],
          [76.4, 10.8],
          [76.4, 11.0],
          [76.2, 11.0],
          [76.2, 10.8]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { zone: 'Secondary', risk: 'medium' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [80.2, 13.0],
          [80.4, 13.0],
          [80.4, 13.2],
          [80.2, 13.2],
          [80.2, 13.0]
        ]]
      }
    }
  ]
};

const sampleFloodedAreas = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { depth: 'severe' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [76.25, 10.85],
          [76.35, 10.85],
          [76.35, 10.95],
          [76.25, 10.95],
          [76.25, 10.85]
        ]]
      }
    }
  ]
};

const sampleRescueRoutes = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { type: 'rescue' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.27, 10.82],
          [76.29, 10.85],
          [76.31, 10.87],
          [76.33, 10.89]
        ]
      }
    }
  ]
};

interface DisasterMapProps {
  onDisasterSelect?: (id: string) => void;
}

export default function DisasterMap({ onDisasterSelect }: DisasterMapProps) {
  const { disasters, teams, resources } = useDisasterStore();
  const [popupInfo, setPopupInfo] = useState<Disaster | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES.satellite);
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 4,
    bearing: 0,
    pitch: 0
  });

  useEffect(() => {
    if (disasters.length > 0 && mapRef.current) {
      const coordinates = disasters
        .filter(d => d.location?.coordinates)
        .map(d => d.location.coordinates as [number, number]);

      if (coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (bounds, coord) => {
            return {
              minLng: Math.min(bounds.minLng, coord[0]),
              maxLng: Math.max(bounds.maxLng, coord[0]),
              minLat: Math.min(bounds.minLat, coord[1]),
              maxLat: Math.max(bounds.maxLat, coord[1])
            };
          },
          {
            minLng: coordinates[0][0],
            maxLng: coordinates[0][0],
            minLat: coordinates[0][1],
            maxLat: coordinates[0][1]
          }
        );

        mapRef.current.fitBounds(
          [
            [bounds.minLng, bounds.minLat],
            [bounds.maxLng, bounds.maxLat]
          ],
          { padding: 50, duration: 1000 }
        );
      }
    }
  }, [disasters]);

  const handleViewStateChange = (event: ViewStateChangeEvent) => {
    setViewState(event.viewState);
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return 'text-red-500';
    if (severity >= 3) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-500';
      case 'in-transit': return 'text-yellow-500';
      case 'deployed': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const renderDisasterMarkers = () => {
    return disasters.map(disaster => {
      if (!disaster.location?.coordinates) return null;
      const [longitude, latitude] = disaster.location.coordinates;
      
      return (
        <React.Fragment key={disaster.id}>
          <Marker
            longitude={longitude}
            latitude={latitude}
            onClick={e => {
              e.originalEvent.stopPropagation();
              setPopupInfo(disaster);
              onDisasterSelect?.(disaster.id);
            }}
          >
            <div className="relative cursor-pointer transform hover:scale-110 transition-transform marker-pulse">
              <AlertTriangle 
                className={`w-8 h-8 ${getSeverityColor(disaster.severity)}`}
              />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                <span className="text-xs font-bold">{disaster.severity}</span>
              </div>
            </div>
          </Marker>
        </React.Fragment>
      );
    });
  };

  const renderResourceMarkers = () => {
    return resources.map(resource => {
      if (!resource.location?.coordinates) return null;
      const [longitude, latitude] = resource.location.coordinates;
      const Icon = RESOURCE_ICONS[resource.type] || Box;

      return (
        <Marker
          key={resource.id}
          longitude={longitude}
          latitude={latitude}
          onClick={e => {
            e.originalEvent.stopPropagation();
            setSelectedResource(resource);
          }}
        >
          <div className="cursor-pointer transform hover:scale-110 transition-transform">
            <Icon className={`w-6 h-6 ${getStatusColor(resource.status)}`} />
          </div>
        </Marker>
      );
    });
  };

  const renderTeamMarkers = () => {
    return teams.map(team => {
      if (!team.location?.coordinates) return null;
      const [longitude, latitude] = team.location.coordinates;

      return (
        <Marker
          key={team.id}
          longitude={longitude}
          latitude={latitude}
        >
          <div className="cursor-pointer transform hover:scale-110 transition-transform">
            <Users className={`w-6 h-6 ${
              team.status === 'available' ? 'text-green-500' :
              team.status === 'responding' ? 'text-yellow-500' :
              'text-blue-500'
            }`} />
          </div>
        </Marker>
      );
    });
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map Style Selector */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <select
          value={mapStyle}
          onChange={(e) => setMapStyle(e.target.value)}
          className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-300 text-sm font-medium hover:bg-white transition-all cursor-pointer"
        >
          <option value={MAP_STYLES.satellite}>🛰️ Satellite</option>
          <option value={MAP_STYLES.streets}>🗺️ Streets</option>
          <option value={MAP_STYLES.outdoors}>🌲 Outdoors</option>
          <option value={MAP_STYLES.light}>☀️ Light</option>
          <option value={MAP_STYLES.dark}>🌙 Dark</option>
        </select>
      </div>

      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-20">
          <div className="text-center p-6">
            <p className="text-xl mb-2">⚠️ Mapbox Token Missing</p>
            <p className="text-sm text-gray-400">Please add VITE_MAPBOX_TOKEN to .env file</p>
          </div>
        </div>
      )}

      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleViewStateChange}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={true}
        reuseMaps={true}
        initialViewState={{
          longitude: 78.9629,
          latitude: 20.5937,
          zoom: 4
        }}
        onLoad={() => console.log('Map loaded successfully')}
        onError={(e) => console.error('Map error:', e)}
      >
      <GeolocateControl 
        position="top-right"
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation={true}
        showUserHeading={true}
        showAccuracyCircle={true}
      />
      <FullscreenControl position="top-right" />
      <NavigationControl position="top-right" showCompass={true} showZoom={true} visualizePitch={true} />

      {/* Render evacuation zones */}
      <Source type="geojson" data={sampleEvacuationZones}>
        <Layer
          id="evacuation-zones-fill"
          type="fill"
          paint={{
            'fill-color': [
              'match',
              ['get', 'risk'],
              'high', 'rgba(255, 0, 0, 0.1)',
              'medium', 'rgba(255, 165, 0, 0.1)',
              'rgba(0, 0, 255, 0.1)'
            ],
            'fill-outline-color': [
              'match',
              ['get', 'risk'],
              'high', '#ff0000',
              'medium', '#ffa500',
              '#0000ff'
            ]
          }}
        />
        <Layer
          id="evacuation-zones-line"
          type="line"
          paint={{
            'line-color': [
              'match',
              ['get', 'risk'],
              'high', '#ff0000',
              'medium', '#ffa500',
              '#0000ff'
            ],
            'line-width': 2,
            'line-dasharray': [2, 2]
          }}
        />
      </Source>

      {/* Render flooded areas */}
      <Source type="geojson" data={sampleFloodedAreas}>
        <Layer
          id="flooded-areas-fill"
          type="fill"
          paint={{
            'fill-color': 'rgba(0, 0, 255, 0.2)',
            'fill-pattern': 'water'
          }}
        />
      </Source>

      {/* Render rescue routes */}
      <Source type="geojson" data={sampleRescueRoutes}>
        <Layer
          id="rescue-routes-line"
          type="line"
          paint={{
            'line-color': '#00ff00',
            'line-width': 3,
            'line-dasharray': [2, 1]
          }}
        />
      </Source>

      {renderDisasterMarkers()}
      {renderResourceMarkers()}
      {renderTeamMarkers()}

      {popupInfo && popupInfo.location?.coordinates && (
        <Popup
          longitude={popupInfo.location.coordinates[0]}
          latitude={popupInfo.location.coordinates[1]}
          anchor="bottom"
          onClose={() => setPopupInfo(null)}
          closeButton={true}
          closeOnClick={false}
          className="disaster-popup"
        >
          <div className="p-3 max-w-xs backdrop-blur-sm bg-white/90">
            <h3 className="font-bold text-lg">{popupInfo.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{popupInfo.description}</p>
            <div className="space-y-2">
              <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                ${popupInfo.severity >= 4 ? 'bg-red-100 text-red-800' :
                  popupInfo.severity >= 3 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'}`}>
                Level {popupInfo.severity}
              </div>
              <p className="text-xs text-gray-500">
                Affected radius: {popupInfo.affected_radius_km}km
              </p>
              {popupInfo.affected_population && (
                <p className="text-xs text-gray-500">
                  Population affected: {popupInfo.affected_population.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </Popup>
      )}

      {selectedResource && selectedResource.location?.coordinates && (
        <Popup
          longitude={selectedResource.location.coordinates[0]}
          latitude={selectedResource.location.coordinates[1]}
          anchor="bottom"
          onClose={() => setSelectedResource(null)}
          closeButton={true}
          closeOnClick={false}
          className="resource-popup"
        >
          <div className="p-3 max-w-xs backdrop-blur-sm bg-white/90">
            <h3 className="font-bold text-lg">{selectedResource.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{selectedResource.description}</p>
            <div className="space-y-2">
              <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                ${getStatusColor(selectedResource.status).replace('text-', 'bg-').replace('500', '100')}
                ${getStatusColor(selectedResource.status).replace('text-', 'text-').replace('500', '800')}`}>
                {selectedResource.status}
              </div>
              <p className="text-xs text-gray-500">
                Quantity: {selectedResource.quantity} {selectedResource.unit}
              </p>
              <p className="text-xs text-gray-500">
                Location: {selectedResource.location_name}
              </p>
            </div>
          </div>
        </Popup>
      )}
    </Map>
    </div>
  );
}