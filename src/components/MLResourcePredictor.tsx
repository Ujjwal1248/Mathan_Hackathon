import { useState, useEffect } from 'react';
import { Brain, TrendingUp, Package, Droplets, Home, Users, Loader } from 'lucide-react';
import { getMLModel, type DisasterInput, type ResourcePrediction } from '../lib/mlResourceAllocation';
import { useDisasterStore } from '../store/disaster';

export default function MLResourcePredictor() {
  const { disasters } = useDisasterStore();
  const [selectedDisaster, setSelectedDisaster] = useState<string>('');
  const [prediction, setPrediction] = useState<ResourcePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState({ isTrained: false, isTraining: false });
  const [trainingProgress, setTrainingProgress] = useState(false);

  const mlModel = getMLModel();

  useEffect(() => {
    // Check model status
    const status = mlModel.getStatus();
    setModelStatus(status);

    // Try to load saved model
    mlModel.loadModel().then(() => {
      setModelStatus(mlModel.getStatus());
    });
  }, []);

  const handlePredict = async (disasterId: string) => {
    const disaster = disasters.find(d => d.id === disasterId);
    if (!disaster) return;

    setLoading(true);
    setSelectedDisaster(disasterId);

    try {
      const input: DisasterInput = {
        severity: disaster.severity,
        affectedPopulation: disaster.affected_population || 10000,
        affectedRadius: disaster.affected_radius_km,
        disasterType: disaster.type,
        existingResources: 50 // Default value
      };

      // Train model if not trained
      if (!modelStatus.isTrained) {
        setTrainingProgress(true);
        await mlModel.trainModel(50);
        setModelStatus(mlModel.getStatus());
        setTrainingProgress(false);
      }

      const result = await mlModel.predict(input);
      setPrediction(result);
    } catch (error) {
      console.error('Prediction error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    setTrainingProgress(true);
    try {
      await mlModel.trainModel(100);
      setModelStatus(mlModel.getStatus());
      await mlModel.saveModel();
    } catch (error) {
      console.error('Training error:', error);
    } finally {
      setTrainingProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-lg bg-purple-500/20 backdrop-blur-sm">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">ML Resource Predictor</h2>
              <p className="text-sm text-gray-400">Neural Network-based Resource Allocation</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`px-4 py-2 rounded-lg ${
              modelStatus.isTrained 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              <span className="text-sm font-medium">
                {modelStatus.isTrained ? '✓ Model Trained' : '⚠ Model Not Trained'}
              </span>
            </div>
            
            <button
              onClick={handleTrainModel}
              disabled={trainingProgress || modelStatus.isTraining}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all hover-lift disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {trainingProgress || modelStatus.isTraining ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Training...</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>Train Model</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Model Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="glass-dark p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Architecture</p>
            <p className="text-sm text-white font-medium">Neural Network (3 layers)</p>
          </div>
          <div className="glass-dark p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Training Data</p>
            <p className="text-sm text-white font-medium">1000 synthetic samples</p>
          </div>
          <div className="glass-dark p-4 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Optimization</p>
            <p className="text-sm text-white font-medium">Adam Optimizer</p>
          </div>
        </div>
      </div>

      {/* Disaster Selection */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Select Disaster for Prediction</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {disasters
            .filter(d => d.status === 'active')
            .map(disaster => (
              <button
                key={disaster.id}
                onClick={() => handlePredict(disaster.id)}
                disabled={loading}
                className={`glass-dark p-4 rounded-lg text-left transition-all hover-lift ${
                  selectedDisaster === disaster.id 
                    ? 'border-2 border-purple-500/50' 
                    : 'hover:border-purple-300/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium
                    ${disaster.severity >= 4 ? 'bg-red-500/20 text-red-300' : 
                      disaster.severity >= 3 ? 'bg-yellow-500/20 text-yellow-300' : 
                      'bg-blue-500/20 text-blue-300'}`}>
                    Severity {disaster.severity}
                  </span>
                  {selectedDisaster === disaster.id && loading && (
                    <Loader className="w-4 h-4 animate-spin text-purple-400" />
                  )}
                </div>
                <h4 className="font-semibold text-white mb-1">{disaster.title}</h4>
                <p className="text-sm text-gray-400">{disaster.location_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {disaster.affected_population?.toLocaleString() || 'Unknown'} people affected
                </p>
              </button>
            ))}
        </div>
      </div>

      {/* Prediction Results */}
      {prediction && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">ML Prediction Results</h3>
            <div className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300">
              <span className="text-sm font-medium">
                Confidence: {(prediction.confidence * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Medical Units */}
            <div className="glass-dark p-6 rounded-xl hover-lift">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-red-500/20">
                  <Package className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Medical Units</p>
                  <p className="text-2xl font-bold text-white">{prediction.medicalUnits}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Emergency medical supplies & equipment</p>
            </div>

            {/* Food Packages */}
            <div className="glass-dark p-6 rounded-xl hover-lift">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-green-500/20">
                  <Package className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Food Packages</p>
                  <p className="text-2xl font-bold text-white">{prediction.foodPackages.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Ready-to-eat meal packages</p>
            </div>

            {/* Water */}
            <div className="glass-dark p-6 rounded-xl hover-lift">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Droplets className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Water Supply</p>
                  <p className="text-2xl font-bold text-white">{prediction.waterLiters.toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Liters of potable water</p>
            </div>

            {/* Shelter Kits */}
            <div className="glass-dark p-6 rounded-xl hover-lift">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-yellow-500/20">
                  <Home className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Shelter Kits</p>
                  <p className="text-2xl font-bold text-white">{prediction.shelterKits}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Temporary housing kits</p>
            </div>

            {/* Rescue Teams */}
            <div className="glass-dark p-6 rounded-xl hover-lift">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Rescue Teams</p>
                  <p className="text-2xl font-bold text-white">{prediction.rescueTeams}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">Specialized rescue units</p>
            </div>

            {/* AI Insights */}
            <div className="glass-dark p-6 rounded-xl hover-lift border-2 border-purple-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-3 rounded-lg bg-purple-500/20">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">ML Model</p>
                  <p className="text-lg font-bold text-white">Neural Network</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">TensorFlow.js powered prediction</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
            <p className="text-sm text-purple-200">
              <strong>💡 ML Insight:</strong> This prediction is based on a trained neural network that analyzes 
              disaster severity, affected population, disaster type, and existing resources to optimize allocation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
