import { create } from "zustand"

export interface ImportJob {
  id: string
  title: string
  status: "running" | "done" | "error"
  errorMessage?: string
}

interface JobState {
  jobs: ImportJob[]
  addJob: (job: ImportJob) => void
  updateJob: (id: string, patch: Partial<ImportJob>) => void
  removeJob: (id: string) => void
}

export const useJobStore = create<JobState>((set) => ({
  jobs: [],
  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),
  updateJob: (id, patch) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}))
