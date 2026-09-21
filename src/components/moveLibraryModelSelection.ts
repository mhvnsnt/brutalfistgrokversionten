export function preferredMoveLibraryModel(models: string[]): string {
  return models.find((m) => m.startsWith('BANNON_rigged')) ?? models[0] ?? '';
}
