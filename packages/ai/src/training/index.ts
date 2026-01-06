/**
 * Training Data Collection Module
 *
 * Tools for collecting (state, action, outcome) data for ML training.
 */

export {
  // Main collector class
  TrainingDataCollector,

  // Feature extraction
  extractFeatures,
  featuresToArray,
  FEATURE_VECTOR_SIZE,

  // Data utilities
  saveTrainingData,
  saveTrainingDataCompact,
  toTensorFormat,
  mergeTrainingData,

  // Types
  type StateFeatures,
  type TrainingSample,
  type GameTrainingData,
  type CollectorConfig,
  type TensorData,

  // Constants
  DEFAULT_COLLECTOR_CONFIG,
} from './TrainingDataCollector';
