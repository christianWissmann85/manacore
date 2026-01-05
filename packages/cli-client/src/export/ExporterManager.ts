/**
 * ExporterManager - Manages multiple export formats
 *
 * Coordinates exporting results to multiple formats simultaneously.
 */

import type { SimulationResults, ExportFormat, OutputLevel } from '../types';
import { ResultsExporter } from './ResultsExporter';
import { ConsoleExporter } from './ConsoleExporter';
import { JsonExporter } from './JsonExporter';
import { CsvExporter } from './CsvExporter';
import * as path from 'path';
import * as fs from 'fs';

export interface ExportConfig {
  formats: ExportFormat[];
  outputPath?: string;
  pretty?: boolean;
  outputLevel?: OutputLevel;
  logPath?: string;
}

// Default export directory: results/ in project root
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const DEFAULT_RESULTS_DIR = path.join(PROJECT_ROOT, 'results');

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
    // Ensure results directory exists (only if we're exporting to files)
    const hasFileExports = config.formats.some((f) => f !== 'console');
    if (hasFileExports && !config.outputPath) {
      this.ensureResultsDir();
    }

    const exports: Promise<string | void>[] = [];

    for (const format of config.formats) {
      const exporter = this.exporters.get(format);
      if (!exporter) {
        console.warn(`⚠️  Unknown export format: ${format}`);
        continue;
      }

      // Generate output path for file formats
      const outputPath = this.getOutputPath(format, config.outputPath, results.baseSeed);

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
  ): string | undefined {
    if (format === 'console') return undefined;

    if (basePath) {
      // Use provided path, adding extension if needed
      if (basePath.endsWith(`.${format}`)) {
        return basePath;
      }
      return `${basePath}.${format}`;
    }

    // Default path: results/results-seed{seed}-{timestamp}.{format}
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `results-seed${seed}-${timestamp}.${format}`;
    return path.join(DEFAULT_RESULTS_DIR, filename);
  }

  /**
   * Ensure results directory exists
   */
  private ensureResultsDir(): void {
    try {
      if (!fs.existsSync(DEFAULT_RESULTS_DIR)) {
        fs.mkdirSync(DEFAULT_RESULTS_DIR, { recursive: true });
        console.log(
          `📁 Created results directory: ${path.relative(process.cwd(), DEFAULT_RESULTS_DIR)}/`,
        );
      }
    } catch (err) {
      console.error('⚠️  Failed to create results directory:', err);
    }
  }
}
