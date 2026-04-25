import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Zap, HardDrive, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useTriggerForm } from "@/components/triggers/hooks/useTriggerForm"
import { useTriggerStepper } from "@/components/triggers/hooks/useTriggerStepper"
import { SEVERITY_LEVELS, TRIGGER_TYPES } from "./constants"
import { StepIdentity } from "./steps/StepIdentity"
import { StepTypeConfig } from "./steps/StepTypeConfig"
import { StepSpatialOps } from "./steps/StepSpatialOps"
import { StepConditions } from "./steps/StepConditions"
import { StepActions } from "./steps/StepActions"
import { StepReview } from "./steps/StepReview"

export function TriggerBuilderModal() {
  const form = useTriggerForm()
  const {
    isEditing, triggerBuilderOpen, closeTriggerBuilder,
    name, severity, setSeverity, triggerType,
    predicates, actions, operations, saving, canSave, handleSave,
  } = form

  const stepper = useTriggerStepper(triggerType, canSave)
  const { steps, activeStep, currentStep, isFirst, isLast, goNext, goPrev, goTo, reset } = stepper

  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (triggerBuilderOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      reset()
      requestAnimationFrame(() => modalRef.current?.focus())
    } else if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [triggerBuilderOpen, reset])

  useEffect(() => {
    if (!triggerBuilderOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTriggerBuilder()
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && isLast && canSave) handleSave()
      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [triggerBuilderOpen, closeTriggerBuilder, isLast, canSave, handleSave])

  const conditionCount = predicates.predicates.length
  const actionCount = actions.length
  const currentSeverity = SEVERITY_LEVELS.find((s) => s.value === severity)!
  const CurrentSeverityIcon = currentSeverity.icon
  const TriggerTypeIcon = TRIGGER_TYPES.find((t) => t.value === triggerType)?.icon ?? HardDrive

  if (!triggerBuilderOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={closeTriggerBuilder}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trigger-builder-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-[1080px] max-h-[85vh] flex flex-col rounded-xl border bg-background shadow-2xl outline-none"
      >
        {/* ================================================================ */}
        {/* Header                                                          */}
        {/* ================================================================ */}
        <div className="flex items-center gap-3 border-b px-5 py-3.5 shrink-0">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="trigger-builder-title" className="text-sm font-semibold leading-tight">
              {isEditing ? "Edit Trigger" : "New Trigger"}
            </h2>
            {name && (
              <p className="text-label-lg text-muted-foreground truncate">{name}</p>
            )}
          </div>

          {/* Severity selector */}
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
            {SEVERITY_LEVELS.map((s) => {
              const SevIcon = s.icon
              return (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  title={s.label}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label-lg font-medium transition-all ${
                    severity === s.value
                      ? `${s.bg} text-white shadow-sm`
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <SevIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={closeTriggerBuilder}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ================================================================ */}
        {/* Stepper bar                                                     */}
        {/* ================================================================ */}
        <div className="border-b px-5 py-3 shrink-0">
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => {
              const isActive = idx === activeStep
              const isComplete = idx < activeStep
              const stepBadge = step.id === "conditions" && conditionCount > 0
                ? conditionCount
                : step.id === "actions" && actionCount > 0
                  ? actionCount
                  : step.id === "spatial" && operations.length > 0
                    ? operations.length
                    : null

              return (
                <div key={step.id} className="flex items-center">
                  {idx > 0 && (
                    <div className={`h-px w-6 mx-1 ${isComplete ? "bg-primary" : "bg-border"}`} />
                  )}
                  <button
                    type="button"
                    onClick={() => goTo(idx)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : isComplete
                          ? "text-primary hover:bg-accent"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {/* Step indicator */}
                    <span className={`flex items-center justify-center h-4 w-4 rounded-full text-label-sm font-bold ${
                      isComplete
                        ? "bg-primary text-primary-foreground"
                        : isActive
                          ? "border-2 border-primary text-primary"
                          : "border border-border text-muted-foreground"
                    }`}>
                      {isComplete ? <Check className="h-2.5 w-2.5" /> : idx + 1}
                    </span>
                    <span className="hidden md:inline">{step.label}</span>
                    {stepBadge && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-label-sm leading-none">
                        {stepBadge}
                      </Badge>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Step content                                                     */}
        {/* ================================================================ */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-5">
              {currentStep.id === "identity" && <StepIdentity form={form} />}
              {currentStep.id === "config" && <StepTypeConfig form={form} />}
              {currentStep.id === "spatial" && <StepSpatialOps form={form} />}
              {currentStep.id === "conditions" && <StepConditions form={form} />}
              {currentStep.id === "actions" && <StepActions form={form} />}
              {currentStep.id === "review" && <StepReview form={form} />}
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================ */}
        {/* Footer                                                          */}
        {/* ================================================================ */}
        <div className="flex items-center justify-between border-t px-5 py-3.5 shrink-0">
          {/* Summary chips */}
          <div className="flex items-center gap-2 text-label-lg text-muted-foreground">
            <span className="flex items-center gap-1">
              <TriggerTypeIcon className="h-3.5 w-3.5" />
              {TRIGGER_TYPES.find((t) => t.value === triggerType)?.label}
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1">
              <CurrentSeverityIcon className={`h-3.5 w-3.5 ${currentSeverity.color}`} />
              {currentSeverity.label}
            </span>
            {operations.length > 0 && (
              <>
                <span className="text-border">|</span>
                <span>{operations.length} op{operations.length !== 1 ? "s" : ""}</span>
              </>
            )}
            {conditionCount > 0 && (
              <>
                <span className="text-border">|</span>
                <span>{conditionCount} condition{conditionCount !== 1 ? "s" : ""}</span>
              </>
            )}
            {actionCount > 0 && (
              <>
                <span className="text-border">|</span>
                <span>{actionCount} action{actionCount !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>

          {/* Navigation + save */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={closeTriggerBuilder} disabled={saving}>
              Cancel
            </Button>

            {!isFirst && (
              <Button variant="outline" size="sm" onClick={goPrev}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Previous
              </Button>
            )}

            {!isLast ? (
              <Button size="sm" onClick={goNext}>
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
