import { Loader2, CheckCircle2, XCircle, X } from "lucide-react"
import { useJobStore, type ImportJob } from "@/stores/jobStore"

function JobRow({ job }: { job: ImportJob }) {
  const removeJob = useJobStore((s) => s.removeJob)

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/80 backdrop-blur-sm border border-border/40 min-w-0">
      <span className="mt-0.5 shrink-0">
        {job.status === "running" && (
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        )}
        {job.status === "done" && (
          <CheckCircle2 className="h-3.5 w-3.5 text-gp-success" />
        )}
        {job.status === "error" && (
          <XCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate max-w-[180px]">{job.title}</p>
        {job.status === "running" && (
          <p className="text-label text-muted-foreground">Importing…</p>
        )}
        {job.status === "done" && (
          <p className="text-label text-gp-success">Imported</p>
        )}
        {job.status === "error" && (
          <p className="text-label text-destructive truncate max-w-[180px]">
            {job.errorMessage ?? "Error"}
          </p>
        )}
      </div>

      {job.status !== "running" && (
        <button
          onClick={() => removeJob(job.id)}
          className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function JobTrackerCorner() {
  const jobs = useJobStore((s) => s.jobs)

  if (jobs.length === 0) return null

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex flex-col gap-1.5 w-[240px]"
      role="status"
      aria-live="polite"
      aria-label="Import jobs"
    >
      {jobs.slice(-5).map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  )
}
