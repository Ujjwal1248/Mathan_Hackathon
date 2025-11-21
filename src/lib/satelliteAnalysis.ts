export interface SatelliteDetection {
  disasterType: 'flood' | 'fire' | 'earthquake' | 'hurricane' | 'landslide' | 'none';
  confidence: number;
  affectedArea: number; // in sq km
  severity: number; // 1-5
  coordinates: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  analysis: {
    vegetationIndex: number;
    waterDetection: number;
    buildingDamage: number;
    fireIntensity: number;
  };
}

class SatelliteImageAnalyzer {
  private isReady = false;

  async initialize() {
    if (this.isReady) return;

    console.log('🛰️ Initializing Satellite Image Analyzer...');

    // Create a very lightweight model - no training needed!
    // Uses simple color analysis instead of heavy CNN
    this.isReady = true;
    console.log('✅ Satellite Image Analyzer Ready!');
  }

  async analyzeImage(imageFile: File): Promise<SatelliteDetection> {
    if (!this.isReady) {
      console.log('⏳ Initializing analyzer...');
      await this.initialize();
    }

    console.log('🔍 Analyzing image:', imageFile.name);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = async () => {
            console.log('📸 Image loaded, analyzing colors...');
            
            // Fast color-based analysis - NO HEAVY MODEL!
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Canvas not supported'));
              return;
            }

            // Resize to small size for fast processing
            canvas.width = 100;
            canvas.height = 100;
            ctx.drawImage(img, 0, 0, 100, 100);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, 100, 100);
            const data = imageData.data;
            
            // Calculate average RGB
            let r = 0, g = 0, b = 0;
            const pixels = data.length / 4;
            
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
            }
            
            r /= pixels;
            g /= pixels;
            b /= pixels;
            
            // Normalize to 0-1
            r /= 255;
            g /= 255;
            b /= 255;
            
            console.log('🎨 Average colors:', { r: r.toFixed(3), g: g.toFixed(3), b: b.toFixed(3) });
            
            // Simple rule-based classification
            let disasterType: SatelliteDetection['disasterType'] = 'none';
            let confidence = 0.6;
            
            // Flood detection - Blue dominant
            if (b > r && b > g && b > 0.4) {
              disasterType = 'flood';
              confidence = Math.min(0.95, 0.5 + (b - Math.max(r, g)) * 2);
            }
            // Fire detection - Red dominant
            else if (r > g && r > b && r > 0.5) {
              disasterType = 'fire';
              confidence = Math.min(0.95, 0.5 + (r - Math.max(g, b)) * 1.5);
            }
            // Hurricane - Gray/white (high all channels)
            else if (r > 0.6 && g > 0.6 && b > 0.6) {
              disasterType = 'hurricane';
              confidence = Math.min(0.9, 0.6 + (Math.min(r, g, b) - 0.6) * 2);
            }
            // Landslide - Brown (moderate red/green, low blue)
            else if (r > 0.4 && g > 0.3 && b < 0.3 && r > b) {
              disasterType = 'landslide';
              confidence = Math.min(0.85, 0.5 + ((r + g) / 2 - b) * 1.2);
            }
            // Earthquake - Gray debris
            else if (Math.abs(r - g) < 0.1 && Math.abs(g - b) < 0.1 && r < 0.5) {
              disasterType = 'earthquake';
              confidence = 0.7;
            }
            // None - Green vegetation
            else if (g > r && g > b) {
              disasterType = 'none';
              confidence = Math.min(0.9, 0.5 + (g - Math.max(r, b)) * 1.5);
            }

            // Calculate metrics
            const analysis = {
              vegetationIndex: Math.max(0, Math.min(1, g - ((r + b) / 2))),
              waterDetection: Math.max(0, Math.min(1, b - ((r + g) / 2) + 0.3)),
              buildingDamage: Math.max(0, Math.min(1, (r - g) * 1.5)),
              fireIntensity: Math.max(0, Math.min(1, (r * 0.7 + (1 - b) * 0.3)))
            };
            
            const affectedArea = this.estimateAffectedArea(analysis, disasterType);
            const severity = this.calculateSeverity(confidence, analysis, disasterType);

            console.log('✅ Analysis complete:', { disasterType, confidence: (confidence * 100).toFixed(1) + '%' });

            resolve({
              disasterType,
              confidence,
              affectedArea,
              severity,
              coordinates: {
                lat: 20.5937 + (Math.random() - 0.5) * 10,
                lng: 78.9629 + (Math.random() - 0.5) * 10
              },
              timestamp: new Date().toISOString(),
              analysis
            });
          };
          
          img.onerror = () => {
            console.error('❌ Failed to load image');
            reject(new Error('Failed to load image'));
          };
          img.src = e.target?.result as string;
        } catch (error) {
          console.error('❌ Analysis error:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        console.error('❌ Failed to read file');
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(imageFile);
    });
  }

  private estimateAffectedArea(analysis: SatelliteDetection['analysis'], type: string): number {
    // Estimate affected area based on disaster type and analysis
    const baseArea = 10; // 10 sq km base
    
    switch (type) {
      case 'flood':
        return baseArea * (1 + analysis.waterDetection * 50);
      case 'fire':
        return baseArea * (1 + analysis.fireIntensity * 30);
      case 'earthquake':
        return baseArea * (1 + analysis.buildingDamage * 40);
      case 'hurricane':
        return baseArea * (1 + (analysis.waterDetection + analysis.buildingDamage) * 20);
      case 'landslide':
        return baseArea * (1 + analysis.buildingDamage * 25);
      default:
        return 0;
    }
  }

  private calculateSeverity(confidence: number, analysis: SatelliteDetection['analysis'], type: string): number {
    if (type === 'none') return 0;
    
    let severityScore = confidence;
    
    // Adjust based on analysis metrics
    switch (type) {
      case 'flood':
        severityScore += analysis.waterDetection * 0.3;
        break;
      case 'fire':
        severityScore += analysis.fireIntensity * 0.4;
        break;
      case 'earthquake':
        severityScore += analysis.buildingDamage * 0.5;
        break;
      case 'hurricane':
        severityScore += (analysis.waterDetection + analysis.buildingDamage) * 0.2;
        break;
      case 'landslide':
        severityScore += analysis.buildingDamage * 0.3;
        break;
    }
    
    // Convert to 1-5 scale
    return Math.min(5, Math.max(1, Math.ceil(severityScore * 5)));
  }

  getStatus() {
    return { isReady: this.isReady };
  }
}

// Singleton instance
let analyzerInstance: SatelliteImageAnalyzer | null = null;

export function getSatelliteAnalyzer(): SatelliteImageAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SatelliteImageAnalyzer();
  }
  return analyzerInstance;
}
