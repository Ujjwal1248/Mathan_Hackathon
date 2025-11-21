import Sentiment from 'sentiment';

const sentiment = new Sentiment();

// Simple browser-compatible tokenizer
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

export interface SocialMediaPost {
  id: string;
  text: string;
  author: string;
  location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  platform: 'twitter' | 'facebook' | 'instagram' | 'reddit';
}

export interface DisasterAlert {
  id: string;
  disasterType: 'flood' | 'fire' | 'earthquake' | 'hurricane' | 'landslide' | 'cyclone' | 'tsunami';
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  confidence: number;
  severity: number;
  affectedPopulation: number;
  reportCount: number;
  sentimentScore: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  keywords: string[];
  timestamp: string;
  sources: SocialMediaPost[];
}

class SocialMediaAnalyzer {
  private disasterKeywords: Record<string, string[]> = {
    flood: ['flood', 'flooding', 'water rising', 'inundation', 'waterlogged', 'deluge', 'submerg'],
    fire: ['fire', 'blaze', 'burning', 'flames', 'smoke', 'wildfire', 'forest fire', 'arson'],
    earthquake: ['earthquake', 'tremor', 'seismic', 'quake', 'shaking', 'aftershock', 'epicenter'],
    hurricane: ['hurricane', 'cyclone', 'typhoon', 'storm', 'wind', 'gale', 'tempest'],
    landslide: ['landslide', 'mudslide', 'rockslide', 'slope failure', 'debris flow', 'avalanche'],
    cyclone: ['cyclone', 'tropical storm', 'depression', 'low pressure', 'eye of storm'],
    tsunami: ['tsunami', 'tidal wave', 'seismic sea wave', 'ocean wave']
  };

  private urgencyKeywords = [
    'urgent', 'emergency', 'help', 'sos', 'critical', 'immediate', 'rescue', 
    'trapped', 'danger', 'life threatening', 'evacuate', 'stranded'
  ];

  private indianCities: Record<string, { lat: number; lng: number }> = {
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'delhi': { lat: 28.7041, lng: 77.1025 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'kerala': { lat: 10.8505, lng: 76.2711 },
    'wayanad': { lat: 11.6854, lng: 76.1320 },
    'uttarakhand': { lat: 30.0668, lng: 79.0193 },
    'assam': { lat: 26.2006, lng: 92.9376 },
    'odisha': { lat: 20.9517, lng: 85.0985 },
    'bihar': { lat: 25.0961, lng: 85.3131 },
    'rajasthan': { lat: 27.0238, lng: 74.2179 },
    'kashmir': { lat: 34.0837, lng: 74.7973 }
  };

  async analyzePosts(posts: SocialMediaPost[]): Promise<DisasterAlert[]> {
    const alerts: Map<string, DisasterAlert> = new Map();

    for (const post of posts) {
      const analysis = this.analyzePost(post);
      
      if (analysis.isDisasterRelated) {
        const key = `${analysis.disasterType}-${analysis.location}`;
        
        if (alerts.has(key)) {
          const existing = alerts.get(key)!;
          existing.reportCount++;
          existing.sources.push(post);
          existing.confidence = Math.min(1, existing.confidence + 0.05);
          existing.sentimentScore = (existing.sentimentScore + analysis.sentimentScore) / 2;
          
          // Update severity based on new reports
          existing.severity = this.calculateSeverity(existing);
        } else {
          alerts.set(key, {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            disasterType: analysis.disasterType!,
            location: analysis.location,
            coordinates: analysis.coordinates,
            confidence: analysis.confidence,
            severity: analysis.severity,
            affectedPopulation: this.estimateAffectedPopulation(analysis.location),
            reportCount: 1,
            sentimentScore: analysis.sentimentScore,
            urgencyLevel: analysis.urgencyLevel,
            keywords: analysis.keywords,
            timestamp: new Date().toISOString(),
            sources: [post]
          });
        }
      }
    }

    return Array.from(alerts.values())
      .filter(alert => alert.reportCount >= 2 || alert.urgencyLevel === 'critical')
      .sort((a, b) => b.confidence - a.confidence);
  }

  private analyzePost(post: SocialMediaPost) {
    const text = post.text.toLowerCase();
    const tokens = tokenize(text);
    
    // Detect disaster type
    let disasterType: DisasterAlert['disasterType'] | null = null;
    let maxMatches = 0;
    const matchedKeywords: string[] = [];

    for (const [type, keywords] of Object.entries(this.disasterKeywords)) {
      const matches = keywords.filter(keyword => text.includes(keyword));
      if (matches.length > maxMatches) {
        maxMatches = matches.length;
        disasterType = type as DisasterAlert['disasterType'];
        matchedKeywords.push(...matches);
      }
    }

    // Extract location
    const location = this.extractLocation(text, post.location);
    const coordinates = this.getCoordinates(location);

    // Sentiment analysis
    const sentimentResult = sentiment.analyze(text);
    const sentimentScore = sentimentResult.score;

    // Check urgency
    const urgencyCount = this.urgencyKeywords.filter(keyword => text.includes(keyword)).length;
    const urgencyLevel: DisasterAlert['urgencyLevel'] = 
      urgencyCount >= 3 ? 'critical' :
      urgencyCount >= 2 ? 'high' :
      urgencyCount >= 1 ? 'medium' : 'low';

    // Calculate confidence
    const confidence = this.calculateConfidence(maxMatches, urgencyCount, sentimentScore, tokens.length);

    // Calculate severity
    const severity = this.calculateInitialSeverity(urgencyLevel, sentimentScore, maxMatches);

    return {
      isDisasterRelated: disasterType !== null && maxMatches > 0,
      disasterType,
      location,
      coordinates,
      confidence,
      severity,
      sentimentScore,
      urgencyLevel,
      keywords: matchedKeywords
    };
  }

  private extractLocation(text: string, providedLocation?: string): string {
    if (providedLocation) return providedLocation;

    // Search for known Indian cities/states in text
    for (const city of Object.keys(this.indianCities)) {
      if (text.includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }

    // Look for location patterns
    const locationPatterns = [
      /in ([a-z]+)/i,
      /at ([a-z]+)/i,
      /from ([a-z]+)/i,
      /near ([a-z]+)/i
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }

    return 'Unknown Location';
  }

  private getCoordinates(location: string): { lat: number; lng: number } {
    const locationLower = location.toLowerCase();
    
    if (this.indianCities[locationLower]) {
      return this.indianCities[locationLower];
    }

    // Default to random coordinates in India
    return {
      lat: 20.5937 + (Math.random() - 0.5) * 15,
      lng: 78.9629 + (Math.random() - 0.5) * 15
    };
  }

  private calculateConfidence(
    keywordMatches: number,
    urgencyCount: number,
    sentimentScore: number,
    textLength: number
  ): number {
    let confidence = 0;

    // Keyword matches (0-0.4)
    confidence += Math.min(0.4, keywordMatches * 0.1);

    // Urgency indicators (0-0.3)
    confidence += Math.min(0.3, urgencyCount * 0.1);

    // Negative sentiment indicates disaster (0-0.2)
    if (sentimentScore < 0) {
      confidence += Math.min(0.2, Math.abs(sentimentScore) * 0.02);
    }

    // Text length credibility (0-0.1)
    if (textLength >= 10 && textLength <= 100) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  private calculateInitialSeverity(
    urgencyLevel: DisasterAlert['urgencyLevel'],
    sentimentScore: number,
    keywordMatches: number
  ): number {
    let severity = 1;

    switch (urgencyLevel) {
      case 'critical': severity = 5; break;
      case 'high': severity = 4; break;
      case 'medium': severity = 3; break;
      case 'low': severity = 2; break;
    }

    // Adjust based on sentiment (more negative = more severe)
    if (sentimentScore < -5) severity = Math.min(5, severity + 1);
    
    // Adjust based on keyword matches
    if (keywordMatches >= 3) severity = Math.min(5, severity + 1);

    return severity;
  }

  private calculateSeverity(alert: DisasterAlert): number {
    let severity = alert.severity;

    // Increase severity based on report count
    if (alert.reportCount >= 10) severity = Math.min(5, severity + 1);
    else if (alert.reportCount >= 5) severity = Math.min(5, severity + 0.5);

    // Adjust based on average sentiment
    if (alert.sentimentScore < -10) severity = Math.min(5, severity + 1);

    return Math.ceil(severity);
  }

  private estimateAffectedPopulation(location: string): number {
    // Estimate based on location type
    const locationLower = location.toLowerCase();
    
    const majorCities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'kolkata'];
    if (majorCities.some(city => locationLower.includes(city))) {
      return Math.floor(Math.random() * 50000) + 10000;
    }

    return Math.floor(Math.random() * 10000) + 1000;
  }

  // Generate mock social media posts for testing
  generateMockPosts(count: number = 20): SocialMediaPost[] {
    const templates = [
      { text: 'Heavy flooding in {location}! Water levels rising rapidly. Need immediate help! #Flood #Emergency', type: 'flood' },
      { text: 'Massive fire outbreak in {location}. Smoke visible from miles away. Evacuate now! #Fire #Disaster', type: 'fire' },
      { text: 'Strong earthquake felt in {location}! Buildings shaking. Everyone stay safe! #Earthquake', type: 'earthquake' },
      { text: 'Cyclone hitting {location} with strong winds. Trees falling everywhere. Stay indoors! #Cyclone', type: 'hurricane' },
      { text: 'Landslide reported in {location}. Roads blocked. People trapped. Send help urgently! #Landslide', type: 'landslide' },
      { text: 'Severe flooding continues in {location}. Many families stranded on rooftops. #FloodRelief', type: 'flood' },
      { text: 'Forest fire spreading rapidly near {location}. Wildlife and villages at risk. #ForestFire', type: 'fire' },
      { text: 'Another tremor felt in {location}. Buildings damaged. Medical help needed. #EarthquakeAlert', type: 'earthquake' },
      { text: 'Hurricane warning for {location}! Winds expected to reach 150 km/h. Evacuate coastal areas! #Storm', type: 'hurricane' },
      { text: 'Flash floods in {location} after heavy rain. Cars submerged. Rescue operations underway. #Flood', type: 'flood' }
    ];

    const locations = Object.keys(this.indianCities);
    const platforms: SocialMediaPost['platform'][] = ['twitter', 'facebook', 'instagram', 'reddit'];
    const posts: SocialMediaPost[] = [];

    for (let i = 0; i < count; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const locationName = location.charAt(0).toUpperCase() + location.slice(1);
      
      posts.push({
        id: `post-${Date.now()}-${i}`,
        text: template.text.replace('{location}', locationName),
        author: `User${Math.floor(Math.random() * 1000)}`,
        location: locationName,
        coordinates: this.indianCities[location],
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        platform: platforms[Math.floor(Math.random() * platforms.length)]
      });
    }

    return posts;
  }
}

// Singleton instance
let analyzerInstance: SocialMediaAnalyzer | null = null;

export function getSocialMediaAnalyzer(): SocialMediaAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SocialMediaAnalyzer();
  }
  return analyzerInstance;
}
