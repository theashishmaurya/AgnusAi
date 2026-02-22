import type { ParsedSymbol, Edge } from '@agnus-ai/shared'

export interface StorageAdapter {
  saveSymbols(symbols: ParsedSymbol[]): Promise<void>
  saveEdges(edges: Edge[]): Promise<void>
  deleteByFile(filePath: string, repoId: string): Promise<void>
  loadAll(repoId: string): Promise<{ symbols: ParsedSymbol[]; edges: Edge[] }>
  saveGraphSnapshot(repoId: string, json: string): Promise<void>
  loadGraphSnapshot(repoId: string): Promise<string | null>
}
