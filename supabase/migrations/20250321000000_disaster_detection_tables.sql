-- Create table for satellite image detections
CREATE TABLE IF NOT EXISTS satellite_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_type TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  affected_area DECIMAL(10,2) NOT NULL, -- in sq km
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  vegetation_index DECIMAL(5,4),
  water_detection DECIMAL(5,4),
  building_damage DECIMAL(5,4),
  fire_intensity DECIMAL(5,4),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for social media alerts
CREATE TABLE IF NOT EXISTS social_media_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
  affected_population INTEGER,
  report_count INTEGER DEFAULT 1,
  sentiment_score DECIMAL(5,2),
  urgency_level TEXT CHECK (urgency_level IN ('critical', 'high', 'medium', 'low')),
  keywords TEXT[],
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for social media sources (individual posts)
CREATE TABLE IF NOT EXISTS social_media_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES social_media_alerts(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'facebook', 'instagram', 'reddit')),
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  location_name TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_satellite_detections_disaster_type ON satellite_detections(disaster_type);
CREATE INDEX IF NOT EXISTS idx_satellite_detections_severity ON satellite_detections(severity);
CREATE INDEX IF NOT EXISTS idx_satellite_detections_created_at ON satellite_detections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_satellite_detections_location ON satellite_detections(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_social_media_alerts_disaster_type ON social_media_alerts(disaster_type);
CREATE INDEX IF NOT EXISTS idx_social_media_alerts_urgency ON social_media_alerts(urgency_level);
CREATE INDEX IF NOT EXISTS idx_social_media_alerts_severity ON social_media_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_social_media_alerts_created_at ON social_media_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_media_alerts_location ON social_media_alerts(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_social_media_alerts_verified ON social_media_alerts(verified);

CREATE INDEX IF NOT EXISTS idx_social_media_sources_alert_id ON social_media_sources(alert_id);
CREATE INDEX IF NOT EXISTS idx_social_media_sources_platform ON social_media_sources(platform);
CREATE INDEX IF NOT EXISTS idx_social_media_sources_posted_at ON social_media_sources(posted_at DESC);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_satellite_detections_updated_at
  BEFORE UPDATE ON satellite_detections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_media_alerts_updated_at
  BEFORE UPDATE ON social_media_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE satellite_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_sources ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust based on your security needs)
CREATE POLICY "Enable read access for all users" ON satellite_detections
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON satellite_detections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON social_media_alerts
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON social_media_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON social_media_alerts
  FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON social_media_sources
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON social_media_sources
  FOR INSERT WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE satellite_detections IS 'Stores disaster detections from satellite image analysis using ML';
COMMENT ON TABLE social_media_alerts IS 'Aggregated disaster alerts detected from social media analysis';
COMMENT ON TABLE social_media_sources IS 'Individual social media posts that contribute to alerts';

COMMENT ON COLUMN satellite_detections.vegetation_index IS 'NDVI-like metric for vegetation health (0-1)';
COMMENT ON COLUMN satellite_detections.water_detection IS 'Water presence indicator (0-1)';
COMMENT ON COLUMN satellite_detections.building_damage IS 'Building damage estimate (0-1)';
COMMENT ON COLUMN satellite_detections.fire_intensity IS 'Fire intensity indicator (0-1)';

COMMENT ON COLUMN social_media_alerts.report_count IS 'Number of social media posts reporting this disaster';
COMMENT ON COLUMN social_media_alerts.sentiment_score IS 'Average sentiment score from posts (negative = more urgent)';
COMMENT ON COLUMN social_media_alerts.verified IS 'Whether the alert has been verified by authorities';
