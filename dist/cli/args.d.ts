/**
 * Command-line argument parsing for Elektron LFO CLI
 */
import type { LFOConfig } from '../engine/types';
export interface CLIArgs extends LFOConfig {
    bpm: number;
    help: boolean;
}
export declare function printHelp(): void;
export declare function parseArgs(args: string[]): CLIArgs;
