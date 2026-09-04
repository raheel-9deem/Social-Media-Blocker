import { create } from "zustand"

export type BlockedStatus = "allowed" | "blocked"

export interface BlockInfo {
  status: BlockedStatus
  reason: string | null
  unblockAt: string | null
  activeRules: string[]
}

interface BlockState {
  blocks: Record<string, BlockInfo>

  updateBlock: (platformId: string, info: BlockInfo) => void
  setAllBlocks: (blocks: Record<string, BlockInfo>) => void
  reset: () => void
}

export const useBlockingStore = create<BlockState>((set) => ({
  blocks: {},

  updateBlock: (platformId, info) =>
    set((s) => ({ blocks: { ...s.blocks, [platformId]: info } })),

  setAllBlocks: (blocks) => set({ blocks }),

  reset: () => set({ blocks: {} }),
}))
