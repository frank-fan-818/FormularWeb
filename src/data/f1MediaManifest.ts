import manifestJson from './f1-media-manifest.json';

export interface F1MediaEntry {
  file: string;
  aliases: string[];
  filter?: string;
}

export interface F1MediaManifest {
  version: number;
  season: number;
  drivers: Record<string, F1MediaEntry>;
  constructors: Record<string, F1MediaEntry>;
}

export const f1MediaManifest = manifestJson as F1MediaManifest;
