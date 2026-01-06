/**
 * ExporterManager - Manages multiple export formats
 *
 * Coordinates exporting results to multiple formats simultaneously.
 * Uses centralized output paths from output/paths.ts
 */

import type { SimulationResults, ExportFormat, OutputLevel } from '../types';
import { ResultsExporter } from './ResultsExporter';
import { ConsoleExporter } from './ConsoleExporter';
import { JsonExporter } from './JsonExporter';
import { CsvExporter } from './CsvExporter';
import { getSimulationResultPath, getRelativePath } from '../output/paths';

export interface ExportConfig {
  formats: ExportFormat[];
  outputPath?: string;
  pretty?: boolean;
  outputLevel?: OutputLevel;
  logPath?: string;
  /** Experiment name for output filenames */
  experimentName?: string;
}

export class ExporterManager {
  private exporters: Map<ExportFormat, ResultsExporter>;

  constructor() {
    this.exporters = new Map<ExportFormat, ResultsExporter>([
      ['console', new ConsoleExporter()],
      ['json', new JsonExporter()],
      ['csv', new CsvExporter()],
    ]);
  }

  /**
   * Export results in all requested formats
   */
  async exportResults(
    results: SimulationResults,
    playerBotName: string,
    opponentBotName: string,
    config: ExportConfig,
  ): Promise<void> {
    const exports: Promise<string | void>[] = [];
    const experimentName = config.experimentName || 'simulation';

    for (const format of config.formats) {
      const exporter = this.exporters.get(format);
      if (!exporter) {
        console.warn(`⚠️  Unknown export format: ${format}`);
        continue;
      }

      // Generate output path for file formats
      const outputPath = this.getOutputPath(
        format,
        config.outputPath,
        results.baseSeed,
        experimentName,
      );

      exports.push(
        exporter.export(results, playerBotName, opponentBotName, {
          outputPath,
          pretty: config.pretty,
          outputLevel: config.outputLevel,
          logPath: config.logPath,
        }),
      );
    }

    await Promise.all(exports);
  }

  /**
   * Generate output path for a specific format
   */
  private getOutputPath(
    format: ExportFormat,
    basePath: string | undefined,
    seed: number,
    experimentName: string,
  ): string | undefined {
    if (format === 'console') return undefined;

    if (basePath) {
      // Use provided path, adding extension if needed
      if (basePath.endsWith(`.${format}`)) {
        return basePath;
      }
      return `${basePath}.${format}`;
    }

    // Use centralized output paths: output/simulations/{name}-{seed}.{format}
    if (format === 'json' || format === 'csv') {
      return getSimulationResultPath(experimentName, seed, format);
    }

    return undefined;
  }
}
