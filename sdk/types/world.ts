/**
 * WorldMetadata represents the metadata of a world.
 */
export interface WorldMetadata {
  worldId: string;
  accountId: string;
  name: string;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  isPublic: boolean;
}
