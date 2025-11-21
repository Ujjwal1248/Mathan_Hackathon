import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useDisasterStore } from '../store/disaster';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom disaster icon
const createDisasterIcon = (severity: number) => {
  const color = severity >= 4 ? '#ef4444' : severity >= 3 ? '#eab308' : '#3b82f6';
  return L.divIcon({
    html: `
      <div style="position: relative;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
        <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); 
                    background: white; border-radius: 50%; width: 16px; height: 16px; 
                    display: flex; align-items: center; justify-content: center;
                    font-size: 10px; font-weight: bold; color: ${color};">
          ${severity}
        </div>
      </div>
    `,
    className: 'custom-disaster-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

// Custom resource icon
const createResourceIcon = (type: string, status: string) => {
  const iconMap: Record<string, string> = {
    medical: '🏥',
    food: '🍽️',
    water: '💧',
    shelter: '🏠',
    rescue: '🚁',
    transport: '🚚'
  };
  
  const statusColor = status === 'available' ? '#10b981' : 
                      status === 'in-transit' ? '#eab308' : '#3b82f6';
  
  return L.divIcon({
    html: `
      <div style="background: ${statusColor}; border-radius: 50%; width: 30px; height: 30px; 
                  display: flex; align-items: center; justify-content: center; 
                  font-size: 18px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        ${iconMap[type] || '📦'}
      </div>
    `,
    className: 'custom-resource-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

// Custom team icon
const createTeamIcon = (status: string) => {
  const statusColor = status === 'available' ? '#10b981' : 
                      status === 'responding' ? '#eab308' : '#3b82f6';
  
  return L.divIcon({
    html: `
      <div style="background: ${statusColor}; border-radius: 50%; width: 30px; height: 30px; 
                  display: flex; align-items: center; justify-content: center; 
                  font-size: 18px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        👥
      </div>
    `,
    className: 'custom-team-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

interface LeafletMapProps {
  onDisasterSelect?: (id: string) => void;
}

const MAP_STYLES = {
  streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  hybrid: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
};

export default function LeafletMap({ onDisasterSelect }: LeafletMapProps) {
  const { disasters, resources, teams } = useDisasterStore();
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map Style Selector */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <select
          value={mapStyle}
          onChange={(e) => setMapStyle(e.target.value as keyof typeof MAP_STYLES)}
          className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-300 text-sm font-medium hover:bg-white transition-all cursor-pointer"
        >
          <option value="satellite">🛰️ Satellite</option>
          <option value="streets">🗺️ Streets</option>
          <option value="dark">🌙 Dark</option>
          <option value="light">☀️ Light</option>
        </select>
      </div>

      <MapContainer
        center={[20.5937, 78.9629] as [number, number]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url={MAP_STYLES[mapStyle]}
        />
        
        {/* Add streets overlay for satellite view */}
        {mapStyle === 'satellite' && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.3}
          />
        )}

        {/* Disaster Markers with Affected Radius */}
        {disasters.map((disaster) => {
          if (!disaster.location?.coordinates) return null;
          const [lng, lat] = disaster.location.coordinates;

          return (
            <React.Fragment key={disaster.id}>
              {/* Affected radius circle */}
              <Circle
                center={[lat, lng] as [number, number]}
                radius={disaster.affected_radius_km * 1000}
                pathOptions={{
                  color: disaster.severity >= 4 ? '#ef4444' : 
                         disaster.severity >= 3 ? '#eab308' : '#3b82f6',
                  fillColor: disaster.severity >= 4 ? '#ef4444' : 
                            disaster.severity >= 3 ? '#eab308' : '#3b82f6',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
              
              {/* Disaster marker */}
              <Marker
                position={[lat, lng] as [number, number]}
                icon={createDisasterIcon(disaster.severity)}
                eventHandlers={{
                  click: () => onDisasterSelect?.(disaster.id)
                }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-lg mb-1">{disaster.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{disaster.description}</p>
                    <div className="space-y-1">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                        ${disaster.severity >= 4 ? 'bg-red-100 text-red-800' :
                          disaster.severity >= 3 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'}`}>
                        Level {disaster.severity}
                      </div>
                      <p className="text-xs text-gray-500">
                        📍 {disaster.location_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        🎯 Radius: {disaster.affected_radius_km}km
                      </p>
                      {disaster.affected_population && (
                        <p className="text-xs text-gray-500">
                          👥 Population: {disaster.affected_population.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Resource Markers */}
        {resources.map((resource) => {
          if (!resource.location?.coordinates) return null;
          const [lng, lat] = resource.location.coordinates;

          return (
            <Marker
              key={resource.id}
              position={[lat, lng] as [number, number]}
              icon={createResourceIcon(resource.type, resource.status)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-base mb-1">{resource.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                  <div className="space-y-1">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                      ${resource.status === 'available' ? 'bg-green-100 text-green-800' :
                        resource.status === 'in-transit' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'}`}>
                      {resource.status}
                    </div>
                    <p className="text-xs text-gray-500">
                      📦 {resource.quantity} {resource.unit}
                    </p>
                    <p className="text-xs text-gray-500">
                      📍 {resource.location_name}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Team Markers */}
        {teams.map((team) => {
          if (!team.location?.coordinates) return null;
          const [lng, lat] = team.location.coordinates;

          return (
            <Marker
              key={team.id}
              position={[lat, lng] as [number, number]}
              icon={createTeamIcon(team.status)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-base mb-1">{team.name}</h3>
                  <div className="space-y-1">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                      ${team.status === 'available' ? 'bg-green-100 text-green-800' :
                        team.status === 'responding' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'}`}>
                      {team.status}
                    </div>
                    <p className="text-xs text-gray-500">
                      👥 {team.current_members}/{team.capacity} members
                    </p>
                    <p className="text-xs text-gray-500">
                      🏷️ {team.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      📍 {team.location_name}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
