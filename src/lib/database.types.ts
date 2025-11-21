export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      disasters: {
        Row: {
          id: string
          type: 'earthquake' | 'flood' | 'hurricane' | 'wildfire' | 'tsunami' | 'tornado'
          severity: number
          title: string
          description: string | null
          location: { type: 'Point'; coordinates: [number, number] }
          location_name: string
          affected_radius_km: number
          affected_population: number | null
          status: 'monitoring' | 'active' | 'responding' | 'recovery'
          created_at: string
          updated_at: string
          predicted_path: { type: 'LineString'; coordinates: [number, number][] } | null
          weather_conditions: Json | null
          evacuation_zones: { type: 'Polygon'; coordinates: [number, number][][] }[] | null
        }
        Insert: Omit<Database['public']['Tables']['disasters']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['disasters']['Row']>
      }
      resources: {
        Row: {
          id: string
          type: 'medical' | 'food' | 'water' | 'shelter' | 'rescue' | 'transport'
          name: string
          description: string | null
          quantity: number
          unit: string
          location: { type: 'Point'; coordinates: [number, number] }
          location_name: string
          status: 'available' | 'reserved' | 'in-transit' | 'deployed'
          assigned_to: string | null
          expiry_date: string | null
          created_at: string
          updated_at: string
          tracking_data: Json | null
        }
        Insert: Omit<Database['public']['Tables']['resources']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['resources']['Row']>
      }
      teams: {
        Row: {
          id: string
          name: string
          type: 'medical' | 'rescue' | 'firefighting' | 'police' | 'engineering'
          capacity: number
          current_members: number
          location: { type: 'Point'; coordinates: [number, number] }
          location_name: string
          status: 'available' | 'responding' | 'on-site' | 'resting'
          assigned_to: string | null
          specializations: string[]
          created_at: string
          updated_at: string
          last_active: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at' | 'last_active'>
        Update: Partial<Database['public']['Tables']['teams']['Row']>
      }
      reports: {
        Row: {
          id: string
          disaster_id: string | null
          type: 'incident' | 'damage' | 'rescue-needed' | 'update'
          title: string
          description: string
          location: { type: 'Point'; coordinates: [number, number] }
          location_name: string
          severity: number | null
          status: 'pending' | 'verified' | 'resolved' | 'false-alarm'
          images: string[]
          reporter_id: string | null
          created_at: string
          updated_at: string
          verified_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['reports']['Row']>
      }
      alerts: {
        Row: {
          id: string
          disaster_id: string | null
          type: 'warning' | 'evacuation' | 'update' | 'all-clear'
          title: string
          message: string
          severity: number | null
          affected_area: { type: 'Polygon'; coordinates: [number, number][][] }
          channels: string[]
          status: 'draft' | 'sent' | 'delivered' | 'expired'
          sent_at: string | null
          expires_at: string | null
          created_at: string
          created_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['alerts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['alerts']['Row']>
      }
      satellite_detections: {
        Row: {
          id: string
          disaster_type: string
          confidence: number
          affected_area: number
          severity: number
          latitude: number
          longitude: number
          vegetation_index: number | null
          water_detection: number | null
          building_damage: number | null
          fire_intensity: number | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['satellite_detections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['satellite_detections']['Row']>
      }
      social_media_alerts: {
        Row: {
          id: string
          disaster_type: string
          location_name: string
          latitude: number
          longitude: number
          confidence: number
          severity: number
          affected_population: number | null
          report_count: number
          sentiment_score: number | null
          urgency_level: 'critical' | 'high' | 'medium' | 'low'
          keywords: string[]
          verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['social_media_alerts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['social_media_alerts']['Row']>
      }
      social_media_sources: {
        Row: {
          id: string
          alert_id: string
          post_id: string
          platform: 'twitter' | 'facebook' | 'instagram' | 'reddit'
          author: string
          content: string
          location_name: string | null
          latitude: number | null
          longitude: number | null
          posted_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['social_media_sources']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['social_media_sources']['Row']>
      }
    }
  }
}