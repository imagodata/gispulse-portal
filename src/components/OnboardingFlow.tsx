import { useEffect, useState, useCallback } from "react"
import { navigateToView } from "@/router"
import {
  LayoutDashboard, Map, Workflow, Database, HardDrive,
  ChevronRight, ChevronLeft, X,
} from "lucide-react"
import { GISPulseLogo } from "@/components/GISPulseLogo"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_KEY = "gispulse_onboarding_done"

export function isOnboardingDone(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true"
}

export function markOnboardingDone(): void {
  localStorage.setItem(ONBOARDING_KEY, "true")
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  view?: string
  /** CSS selector for the highlighted element (best effort) */
  highlightSelector?: string
  tips?: string[]
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to GISPulse",
    description:
      "GISPulse is a modular geospatial engine for running business rules, transforms and triggers on spatial datasets. Let's take a quick tour.",
    icon: <GISPulseLogo animated size={28} className="text-primary" />,
    tips: [
      "You can skip this tour at any time",
      "Re-open this guide from the Help menu",
    ],
  },
  {
    id: "explorer",
    title: "Explorer workspace",
    description:
      "The Explorer gives you an overview of your project — recent datasets, job activity, and quick actions. It's your home base.",
    icon: <LayoutDashboard size={28} className="text-blue-500" />,
    view: "explorer",
    highlightSelector: "[aria-label='Explorer workspace']",
    tips: ["Click the grid icon in the Activity Bar on the left to access Explorer"],
  },
  {
    id: "map",
    title: "Map workspace",
    description:
      "Visualise your datasets on an interactive map. Toggle layer visibility, change colors, measure distances and draw shapes.",
    icon: <Map size={28} className="text-green-500" />,
    view: "map",
    highlightSelector: "[data-value='map']",
    tips: ["Drag-and-drop GeoJSON / GPKG files directly onto the map to import them"],
  },
  {
    id: "editor",
    title: "Node Editor — Workflows",
    description:
      "Design spatial processing pipelines visually. Chain dataset sources, transforms, capabilities and outputs into a directed acyclic graph.",
    icon: <Workflow size={28} className="text-purple-500" />,
    view: "editor",
    tips: ["Use Ctrl+K to search for nodes", "Right-click on the canvas to add nodes"],
  },
  {
    id: "catalog",
    title: "Catalog",
    description:
      "Browse and add external data — WMS/WFS services, open data repositories, coordinate projections, and basemaps.",
    icon: <Database size={28} className="text-orange-500" />,
    view: "catalog",
    tips: ["Drag a catalog entry onto the map to add it as a layer"],
  },
  {
    id: "data",
    title: "Datasets & Layers",
    description:
      "Import, inspect and manage your spatial datasets. Each dataset can have multiple layers — select one to see it on the map and in the table.",
    icon: <HardDrive size={28} className="text-cyan-500" />,
    highlightSelector: "[aria-label='Datasets']",
    tips: [
      "Use Ctrl+I to open the inspector on any selected feature",
      "Right-click a feature on the map to open it in the table or SQL console",
    ],
  },
]

// ---------------------------------------------------------------------------
// Highlight overlay — positions a ring around the target element
// ---------------------------------------------------------------------------

function HighlightRing({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const el = document.querySelector(selector)
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect(r)
  }, [selector])

  if (!rect) return null

  const pad = 6
  return (
    <div
      className="pointer-events-none fixed z-[10000] rounded-md border-2 border-primary shadow-[0_0_0_4px_oklch(0.205_0_0_/_0.15)] transition-all duration-300"
      style={{
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full h-1 bg-border rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-300"
        style={{ width: `${((current + 1) / total) * 100}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface OnboardingFlowProps {
  /** Called when the flow completes or is skipped */
  onDone: () => void
}

export function OnboardingFlow({ onDone }: OnboardingFlowProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const isFirst = stepIndex === 0

  const goTo = useCallback(
    (idx: number) => {
      const target = STEPS[idx]
      setStepIndex(idx)
      if (target?.view) {
        navigateToView(target.view)
      }
    },
    [],
  )

  const handleNext = useCallback(() => {
    if (isLast) {
      markOnboardingDone()
      onDone()
    } else {
      goTo(stepIndex + 1)
    }
  }, [isLast, stepIndex, goTo, onDone])

  const handlePrev = useCallback(() => {
    if (!isFirst) goTo(stepIndex - 1)
  }, [isFirst, stepIndex, goTo])

  const handleSkip = useCallback(() => {
    markOnboardingDone()
    onDone()
  }, [onDone])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext()
      if (e.key === "ArrowLeft") handlePrev()
      if (e.key === "Escape") handleSkip()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleNext, handlePrev, handleSkip])

  // Activate view for current step on mount
  useEffect(() => {
    if (step?.view) navigateToView(step.view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Dimming backdrop (partial — let the app show through) */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none bg-background/20"
        aria-hidden="true"
      />

      {/* Highlight ring for current step */}
      {step.highlightSelector && (
        <HighlightRing selector={step.highlightSelector} />
      )}

      {/* Card — bottom-right anchored */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`Onboarding step ${stepIndex + 1} of ${STEPS.length}: ${step.title}`}
        className="fixed bottom-6 right-6 z-[9991] w-[360px] rounded-xl border bg-popover shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-label font-semibold uppercase tracking-widest text-muted-foreground">
            Getting started — {stepIndex + 1} / {STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Skip onboarding"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5">
          <ProgressBar current={stepIndex} total={STEPS.length} />
        </div>

        {/* Content */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-0.5">{step.icon}</div>
            <div>
              <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </div>

          {step.tips && step.tips.length > 0 && (
            <ul className="flex flex-col gap-1 mt-1">
              {step.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/60" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === stepIndex
                  ? "w-4 bg-primary"
                  : i < stepIndex
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-border"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t bg-muted/30">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft size={13} /> Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={isLast ? "Finish onboarding" : "Next step"}
            >
              {isLast ? "Get started" : "Next"}
              {!isLast && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
