/**
 * NeuralBot - A bot that uses a trained neural network for decisions
 *
 * Uses ONNX Runtime to run inference with a trained ImitatorNet model.
 * The model was trained via behavior cloning on greedy bot gameplay data.
 */

import * as ort from 'onnxruntime-node';
import type { GameState, Action, PlayerId } from '@manacore/engine';
import { getLegalActions } from '@manacore/engine';
import type { Bot } from '../bots/Bot';
import { extractFeatures, featuresToArray } from '../training/TrainingDataCollector';

export interface NeuralBotConfig {
  /** Path to ONNX model file */
  modelPath: string;
  /** Temperature for action sampling (1.0 = deterministic argmax) */
  temperature?: number;
  /** Whether to sample from distribution or take argmax */
  sample?: boolean;
  /** Random seed for sampling */
  seed?: number;
}

/**
 * Bot that uses a trained neural network (ONNX) for decision-making.
 *
 * The network outputs logits for each possible action index.
 * These are masked by legal actions and used to select the best move.
 */
export class NeuralBot implements Bot {
  private session: ort.InferenceSession | null = null;
  private config: Required<NeuralBotConfig>;
  private rng: () => number;

  constructor(config: NeuralBotConfig) {
    this.config = {
      modelPath: config.modelPath,
      temperature: config.temperature ?? 1.0,
      sample: config.sample ?? false,
      seed: config.seed ?? Date.now(),
    };

    // Simple seeded RNG
    let s = this.config.seed;
    this.rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  getName(): string {
    return 'NeuralBot';
  }

  /**
   * Initialize the ONNX session. Must be called before using the bot.
   */
  async initialize(): Promise<void> {
    if (this.session) return;

    this.session = await ort.InferenceSession.create(this.config.modelPath, {
      executionProviders: ['cpu'],
    });

    console.log(`NeuralBot: Loaded model from ${this.config.modelPath}`);
  }

  /**
   * Choose an action using the neural network.
   */
  chooseAction(state: GameState, playerId: PlayerId): Action {
    if (!this.session) {
      throw new Error('NeuralBot not initialized. Call initialize() first.');
    }

    const legalActions = getLegalActions(state, playerId);

    if (legalActions.length === 0) {
      throw new Error('No legal actions available');
    }

    if (legalActions.length === 1) {
      return legalActions[0];
    }

    // Extract features
    const features = extractFeatures(state, playerId);
    const featureArray = featuresToArray(features);

    // Run inference synchronously (we need sync for Bot interface)
    const actionIndex = this.runInferenceSync(featureArray, legalActions.length);

    // Clamp to valid range
    const clampedIndex = Math.min(actionIndex, legalActions.length - 1);
    return legalActions[clampedIndex];
  }

  /**
   * Run inference and return best action index.
   * Note: This uses a sync workaround since Bot interface is sync.
   */
  private runInferenceSync(features: number[], legalCount: number): number {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    // Create input tensor
    const inputTensor = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);

    // Run inference (we need to make this sync somehow)
    // ONNX Runtime Node.js is async, but we can use a cached result pattern
    // For now, we'll use a simple argmax on masked logits

    // Since ONNX Runtime is async and Bot interface is sync,
    // we'll need to pre-compute or use a workaround.
    // For the initial implementation, let's use the async version
    // and require async usage.

    // Actually, let's make a sync wrapper using Atomics or similar
    // For now, return a fallback
    console.warn('NeuralBot: Using fallback action selection (async inference not yet integrated)');
    return 0;
  }

  /**
   * Choose an action asynchronously (preferred method).
   */
  async chooseActionAsync(state: GameState, playerId: PlayerId): Promise<Action> {
    if (!this.session) {
      await this.initialize();
    }

    const legalActions = getLegalActions(state, playerId);

    if (legalActions.length === 0) {
      throw new Error('No legal actions available');
    }

    if (legalActions.length === 1) {
      return legalActions[0];
    }

    // Extract features
    const features = extractFeatures(state, playerId);
    const featureArray = featuresToArray(features);

    // Create input tensor
    const inputTensor = new ort.Tensor('float32', Float32Array.from(featureArray), [1, featureArray.length]);

    // Run inference
    const outputs = await this.session!.run({ features: inputTensor });
    const logits = outputs.logits.data as Float32Array;

    // Apply masking and get best action
    const actionIndex = this.selectAction(logits, legalActions.length);

    return legalActions[actionIndex];
  }

  /**
   * Select action from logits with masking.
   */
  private selectAction(logits: Float32Array, legalCount: number): number {
    // Create masked logits (only keep legal actions)
    const maskedLogits = new Float32Array(legalCount);
    for (let i = 0; i < legalCount; i++) {
      maskedLogits[i] = logits[i];
    }

    // Apply temperature
    if (this.config.temperature !== 1.0) {
      for (let i = 0; i < maskedLogits.length; i++) {
        maskedLogits[i] /= this.config.temperature;
      }
    }

    if (this.config.sample) {
      // Sample from softmax distribution
      return this.sampleFromLogits(maskedLogits);
    } else {
      // Argmax
      return this.argmax(maskedLogits);
    }
  }

  /**
   * Get argmax of array.
   */
  private argmax(arr: Float32Array): number {
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > maxVal) {
        maxVal = arr[i];
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  /**
   * Sample from logits using softmax probabilities.
   */
  private sampleFromLogits(logits: Float32Array): number {
    // Compute softmax
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map((l) => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    const probs = expLogits.map((e) => e / sumExp);

    // Sample
    const r = this.rng();
    let cumProb = 0;
    for (let i = 0; i < probs.length; i++) {
      cumProb += probs[i];
      if (r < cumProb) {
        return i;
      }
    }
    return probs.length - 1;
  }

  /**
   * Close the ONNX session.
   */
  async close(): Promise<void> {
    if (this.session) {
      // Note: onnxruntime-node doesn't have explicit close in older versions
      this.session = null;
    }
  }
}

/**
 * Create a NeuralBot with default model path.
 */
export async function createNeuralBot(
  modelPath: string = './models/imitator-v1/imitator.onnx',
  options: Partial<NeuralBotConfig> = {},
): Promise<NeuralBot> {
  const bot = new NeuralBot({ modelPath, ...options });
  await bot.initialize();
  return bot;
}
