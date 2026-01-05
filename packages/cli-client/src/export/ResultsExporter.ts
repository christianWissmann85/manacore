/**
 * ResultsExporter - Abstract base for result export
 *
 * Defines the interface for exporting simulation results in various formats.
 */

import type { SimulationResults, OutputLevel } from '../types';

export interface ExportOptions {
  outputPath?: string;
  pretty?: boolean;
  outputLevel?: OutputLevel;
  logPath?: string;
}

export abstract class ResultsExporter {
  abstract export(
    results: SimulationResults,
    playerBotName: string,
    opponentBotName: string,
    options?: ExportOptions,
  ): Promise<string | void>;

  abstract getFormat(): string;
}
