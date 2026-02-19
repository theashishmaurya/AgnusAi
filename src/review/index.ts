// Review barrel export

export { ReviewEngine, ReviewEngineOptions } from './engine';
export { OutputFormatter, MarkdownFormatter, JsonFormatter, GhActionsFormatter, getFormatter } from './output';

// Checkpoint exports for incremental reviews
export {
  parseCheckpoint,
  serializeCheckpoint,
  createCheckpoint,
  findCheckpointComment,
  generateCheckpointComment,
  isCheckpointStale,
  validateCheckpointSha,
  CHECKPOINT_MARKER,
  CHECKPOINT_SUFFIX,
  CHECKPOINT_USER_AGENT
} from './checkpoint';
export type { default as CheckpointModule } from './checkpoint';