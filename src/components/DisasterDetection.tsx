import { useState, useEffect } from 'react';
import { Upload, Satellite, Twitter, AlertTriangle, MapPin, TrendingUp, Activity, Eye, Loader, CheckCircle } from 'lucide-react';
import { getSatelliteAnalyzer, type SatelliteDetection } from '../lib/satelliteAnalysis';
import { getSocialMediaAnalyzer, type DisasterAlert } from '../lib/socialMediaAnalysis';
import { supabase } from '../lib/supabase';

export default function DisasterDetection() {
  const [activeTab, setActiveTab] = useState<'satellite' | 'social'>('satellite');
  const [satelliteFile, setSatelliteFile] = useState<File | null>(null);
  const [satellitePreview, setSatellitePreview] = useState<string | null>(null);
  const [satelliteAnalyzing, setSatelliteAnalyzing] = useState(false);
  const [satelliteResult, setSatelliteResult] = useState<SatelliteDetection | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  
  const [socialAnalyzing, setSocialAnalyzing] = useState(false);
  const [socialAlerts, setSocialAlerts] = useState<DisasterAlert[]>([]);
  
  const [savedDetections, setSavedDetections] = useState<SatelliteDetection[]>([]);
  const [savedAlerts, setSavedAlerts] = useState<DisasterAlert[]>([]);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      // Load satellite detections
      const { data: satData } = await supabase
        .from('satellite_detections')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (satData) {
        setSavedDetections(satData.map((d: any) => ({
          disasterType: d.disaster_type,
          confidence: d.confidence,
          affectedArea: d.affected_area,
          severity: d.severity,
          coordinates: { lat: d.latitude, lng: d.longitude },
          timestamp: d.created_at,
          analysis: {
            vegetationIndex: d.vegetation_index || 0,
            waterDetection: d.water_detection || 0,
            buildingDamage: d.building_damage || 0,
            fireIntensity: d.fire_intensity || 0
          }
        })));
      }

      // Load social media alerts
      const { data: socialData } = await supabase
        .from('social_media_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (socialData) {
        setSavedAlerts(socialData.map((a: any) => ({
          id: a.id,
          disasterType: a.disaster_type,
          location: a.location_name,
          coordinates: { lat: a.latitude, lng: a.longitude },
          confidence: a.confidence,
          severity: a.severity,
          affectedPopulation: a.affected_population,
          reportCount: a.report_count,
          sentimentScore: a.sentiment_score,
          urgencyLevel: a.urgency_level,
          keywords: a.keywords,
          timestamp: a.created_at,
          sources: []
        })));
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const handleSatelliteFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSatelliteFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSatellitePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const analyzeSatelliteImage = async () => {
    if (!satelliteFile) return;

    setSatelliteAnalyzing(true);
    setSatelliteResult(null);
    setAnalysisProgress('Initializing AI model...');
    
    try {
      const analyzer = getSatelliteAnalyzer();
      
      setAnalysisProgress('Processing image...');
      const result = await analyzer.analyzeImage(satelliteFile);
      
      setAnalysisProgress('Saving results...');
      setSatelliteResult(result);

      // Save to database
      await supabase.from('satellite_detections').insert({
        disaster_type: result.disasterType,
        confidence: result.confidence,
        affected_area: result.affectedArea,
        severity: result.severity,
        latitude: result.coordinates.lat,
        longitude: result.coordinates.lng,
        vegetation_index: result.analysis.vegetationIndex,
        water_detection: result.analysis.waterDetection,
        building_damage: result.analysis.buildingDamage,
        fire_intensity: result.analysis.fireIntensity
      });

      // Create disaster if significant
      if (result.disasterType !== 'none' && result.confidence > 0.5) {
        setAnalysisProgress('Creating disaster alert...');
        await createDisasterFromDetection(result);
      }

      setAnalysisProgress('Complete!');
      loadSavedData();
      
      // Scroll to results after a short delay
      setTimeout(() => {
        const resultsElement = document.getElementById('analysis-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (error) {
      console.error('Satellite analysis error:', error);
      setAnalysisProgress('Error: ' + (error as Error).message);
    } finally {
      setSatelliteAnalyzing(false);
      setTimeout(() => setAnalysisProgress(''), 2000);
    }
  };

  const analyzeSocialMedia = async () => {
    setSocialAnalyzing(true);
    try {
      const analyzer = getSocialMediaAnalyzer();
      
      // Generate mock posts or use real API
      const posts = analyzer.generateMockPosts(50);
      
      // Analyze posts
      const alerts = await analyzer.analyzePosts(posts);
      setSocialAlerts(alerts);

      // Save alerts to database
      for (const alert of alerts) {
        const { data: alertData } = await supabase
          .from('social_media_alerts')
          .insert({
            disaster_type: alert.disasterType,
            location_name: alert.location,
            latitude: alert.coordinates.lat,
            longitude: alert.coordinates.lng,
            confidence: alert.confidence,
            severity: alert.severity,
            affected_population: alert.affectedPopulation,
            report_count: alert.reportCount,
            sentiment_score: alert.sentimentScore,
            urgency_level: alert.urgencyLevel,
            keywords: alert.keywords
          })
          .select()
          .single();

        // Save sources
        if (alertData) {
          for (const source of alert.sources) {
            await supabase.from('social_media_sources').insert({
              alert_id: alertData.id,
              post_id: source.id,
              platform: source.platform,
              author: source.author,
              content: source.text,
              location_name: source.location,
              latitude: source.coordinates?.lat,
              longitude: source.coordinates?.lng,
              posted_at: source.timestamp
            });
          }
        }

        // Create disaster if critical
        if (alert.urgencyLevel === 'critical' || alert.severity >= 4) {
          await createDisasterFromAlert(alert);
        }
      }

      loadSavedData();
    } catch (error) {
      console.error('Social media analysis error:', error);
    } finally {
      setSocialAnalyzing(false);
    }
  };

  const createDisasterFromDetection = async (detection: SatelliteDetection) => {
    const disaster = {
      title: `${detection.disasterType.charAt(0).toUpperCase() + detection.disasterType.slice(1)} Detected via Satellite`,
      description: `AI-detected ${detection.disasterType} from satellite imagery analysis. Confidence: ${(detection.confidence * 100).toFixed(1)}%. Affected area: ${detection.affectedArea.toFixed(2)} sq km.`,
      location_name: `Detected Area (${detection.coordinates.lat.toFixed(4)}, ${detection.coordinates.lng.toFixed(4)})`,
      latitude: detection.coordinates.lat,
      longitude: detection.coordinates.lng,
      type: detection.disasterType === 'hurricane' ? 'cyclone' : detection.disasterType,
      severity: detection.severity,
      status: 'active' as const,
      affected_population: Math.floor(detection.affectedArea * 100),
      affected_radius_km: Math.sqrt(detection.affectedArea / Math.PI)
    };

    // Create in store (will automatically save to Supabase)
    try {
      await supabase.from('disasters').insert({
        ...disaster,
        location: { type: 'Point', coordinates: [disaster.longitude, disaster.latitude] }
      });
    } catch (error) {
      console.error('Error creating disaster:', error);
    }
  };

  const createDisasterFromAlert = async (alert: DisasterAlert) => {
    const disaster = {
      title: `${alert.disasterType.charAt(0).toUpperCase() + alert.disasterType.slice(1)} - Social Media Alert`,
      description: `Disaster detected from ${alert.reportCount} social media reports. Urgency: ${alert.urgencyLevel}. Keywords: ${alert.keywords.join(', ')}`,
      location_name: alert.location,
      latitude: alert.coordinates.lat,
      longitude: alert.coordinates.lng,
      type: alert.disasterType,
      severity: alert.severity,
      status: 'active' as const,
      affected_population: alert.affectedPopulation,
      affected_radius_km: 10
    };

    try {
      await supabase.from('disasters').insert({
        ...disaster,
        location: { type: 'Point', coordinates: [disaster.longitude, disaster.latitude] }
      });
    } catch (error) {
      console.error('Error creating disaster:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 rounded-lg bg-blue-500/20 backdrop-blur-sm">
            <Eye className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">AI Disaster Detection</h2>
            <p className="text-sm text-gray-400">Satellite Image & Social Media Analysis</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mt-6">
          <button
            onClick={() => setActiveTab('satellite')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all ${
              activeTab === 'satellite'
                ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            <Satellite className="w-5 h-5" />
            <span>Satellite Analysis</span>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all ${
              activeTab === 'social'
                ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            <Twitter className="w-5 h-5" />
            <span>Social Media Monitoring</span>
          </button>
        </div>
      </div>

      {/* Satellite Analysis Tab */}
      {activeTab === 'satellite' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Upload Satellite Image</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="mb-2 text-sm text-gray-400">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, JPEG (MAX. 10MB)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleSatelliteFileChange}
                  />
                </label>

                {satelliteFile && (
                  <>
                    <button
                      onClick={analyzeSatelliteImage}
                      disabled={satelliteAnalyzing}
                      className="w-full mt-4 px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-lg rounded-lg transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 shadow-lg border-2 border-blue-400"
                    >
                      {satelliteAnalyzing ? (
                        <>
                          <Loader className="w-6 h-6 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Activity className="w-6 h-6" />
                          <span>🔍 Analyze Image</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSatelliteFile(null);
                        setSatellitePreview(null);
                        setSatelliteResult(null);
                      }}
                      className="w-full mt-3 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all hover-lift border border-red-500/50"
                    >
                      🗑️ Clear Image
                    </button>
                  </>
                )}
                
                {/* Progress Message */}
                {analysisProgress && (
                  <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <p className="text-sm text-blue-300 text-center">
                      {satelliteAnalyzing && <Loader className="w-4 h-4 animate-spin inline mr-2" />}
                      {analysisProgress}
                    </p>
                  </div>
                )}
              </div>

              {satellitePreview && (
                <div className="glass-dark rounded-lg p-4">
                  <img
                    src={satellitePreview}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Analysis Result */}
          {satelliteResult && (
            <div id="analysis-results" className="glass rounded-xl p-6 border-2 border-blue-500/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">Analysis Results</h3>
                {satelliteResult.disasterType === 'none' ? (
                  <div className="flex items-center space-x-2 text-green-300">
                    <CheckCircle className="w-5 h-5" />
                    <span>No Disaster Detected</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-300">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Disaster Detected</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Disaster Type</p>
                  <p className="text-2xl font-bold text-white capitalize">{satelliteResult.disasterType}</p>
                </div>

                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Confidence</p>
                  <p className="text-2xl font-bold text-white">{(satelliteResult.confidence * 100).toFixed(1)}%</p>
                </div>

                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Severity Level</p>
                  <p className="text-2xl font-bold text-white">{satelliteResult.severity}/5</p>
                </div>

                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Affected Area</p>
                  <p className="text-2xl font-bold text-white">{satelliteResult.affectedArea.toFixed(2)} km²</p>
                </div>

                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Location</p>
                  <p className="text-lg font-bold text-white">
                    {satelliteResult.coordinates.lat.toFixed(4)}, {satelliteResult.coordinates.lng.toFixed(4)}
                  </p>
                </div>

                <div className="glass-dark p-6 rounded-xl">
                  <p className="text-sm text-gray-400 mb-2">Detected At</p>
                  <p className="text-lg font-bold text-white">
                    {new Date(satelliteResult.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-dark p-4 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Vegetation Index</p>
                  <p className="text-lg font-semibold text-green-300">
                    {(satelliteResult.analysis.vegetationIndex * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="glass-dark p-4 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Water Detection</p>
                  <p className="text-lg font-semibold text-blue-300">
                    {(satelliteResult.analysis.waterDetection * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="glass-dark p-4 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Building Damage</p>
                  <p className="text-lg font-semibold text-yellow-300">
                    {(satelliteResult.analysis.buildingDamage * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="glass-dark p-4 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">Fire Intensity</p>
                  <p className="text-lg font-semibold text-red-300">
                    {(satelliteResult.analysis.fireIntensity * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Detections */}
          {savedDetections.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Recent Satellite Detections</h3>
              <div className="space-y-3">
                {savedDetections.map((detection, idx) => (
                  <div key={idx} className="glass-dark p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white capitalize">{detection.disasterType}</p>
                      <p className="text-sm text-gray-400">
                        {detection.coordinates.lat.toFixed(4)}, {detection.coordinates.lng.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-300">{(detection.confidence * 100).toFixed(1)}% confidence</p>
                      <p className="text-xs text-gray-500">{new Date(detection.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Social Media Tab */}
      {activeTab === 'social' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Social Media Monitoring</h3>
                <p className="text-sm text-gray-400">Analyze posts from Twitter, Facebook, Instagram & Reddit</p>
              </div>
              <button
                onClick={analyzeSocialMedia}
                disabled={socialAnalyzing}
                className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {socialAnalyzing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    <span>Analyze Social Media</span>
                  </>
                )}
              </button>
            </div>

            {socialAlerts.length > 0 && (
              <div className="space-y-4">
                {socialAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`glass-dark p-6 rounded-xl border-l-4 ${
                      alert.urgencyLevel === 'critical' ? 'border-red-500' :
                      alert.urgencyLevel === 'high' ? 'border-orange-500' :
                      alert.urgencyLevel === 'medium' ? 'border-yellow-500' :
                      'border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-white capitalize">{alert.disasterType}</h4>
                        <div className="flex items-center space-x-2 text-gray-400 mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>{alert.location}</span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        alert.urgencyLevel === 'critical' ? 'bg-red-500/20 text-red-300' :
                        alert.urgencyLevel === 'high' ? 'bg-orange-500/20 text-orange-300' :
                        alert.urgencyLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {alert.urgencyLevel.toUpperCase()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400">Reports</p>
                        <p className="text-lg font-semibold text-white">{alert.reportCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Confidence</p>
                        <p className="text-lg font-semibold text-white">{(alert.confidence * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Severity</p>
                        <p className="text-lg font-semibold text-white">{alert.severity}/5</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Affected</p>
                        <p className="text-lg font-semibold text-white">{alert.affectedPopulation.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {alert.keywords.slice(0, 5).map((keyword, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Alerts */}
          {savedAlerts.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Recent Social Media Alerts</h3>
              <div className="space-y-3">
                {savedAlerts.map((alert) => (
                  <div key={alert.id} className="glass-dark p-4 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white capitalize">{alert.disasterType} - {alert.location}</p>
                      <p className="text-sm text-gray-400">{alert.reportCount} reports • {alert.urgencyLevel} urgency</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-purple-300">Severity {alert.severity}/5</p>
                      <p className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
