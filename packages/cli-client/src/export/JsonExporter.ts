/**
 * JsonExporter - Exports results as JSON
 *
 * Provides structured JSON output suitable for:
 * - Data analysis and visualization
 * - Archival and reproducibility
 * - Integration with other tools
 */

import type { SimulationResults } from '../types';
import { ResultsExporter, type ExportOptions } from './ResultsExporter';

export class JsonExporter extends ResultsExporter {
  getFormat(): string {
    return 'json';
  }

  async export(
    results: SimulationResults,
    playerBotName: string,
    opponentBotName: string,
    options?: ExportOptions,
  ): Promise<string> {
    const output = {
      metadata: {
        exportDate: new Date().toISOString(),
        playerBot: playerBotName,
        opponentBot: opponentBotName,
      },
      results,
    };

    const jsonString = options?.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);

    if (options?.outputPath) {
      await Bun.write(options.outputPath, jsonString);
      console.log(`\n📄 Results exported to: ${options.outputPath}`);
      return options.outputPath;
    }

    return jsonString;
  }
}
