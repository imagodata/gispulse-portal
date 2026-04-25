import { useState, useMemo, useCallback } from "react"
import type { TriggerType } from "@/types/editor"

export interface StepDef {
  id: string
  label: string
  visible: boolean
}

export function useTriggerStepper(triggerType: TriggerType, _canSave: boolean) {
  const [activeStep, setActiveStep] = useState(0)

  const steps = useMemo<StepDef[]>(() => [
    { id: "identity", label: "Identity", visible: true },
    { id: "config", label: "Type & Config", visible: true },
    { id: "spatial", label: "Spatial Ops", visible: triggerType === "dml" },
    { id: "conditions", label: "Conditions", visible: true },
    { id: "actions", label: "Actions", visible: true },
    { id: "review", label: "Review", visible: true },
  ], [triggerType])

  const visibleSteps = useMemo(() => steps.filter((s) => s.visible), [steps])

  const currentStep = visibleSteps[activeStep] ?? visibleSteps[0]
  const isFirst = activeStep === 0
  const isLast = activeStep === visibleSteps.length - 1

  const goNext = useCallback(() => {
    if (!isLast) setActiveStep((s) => Math.min(s + 1, visibleSteps.length - 1))
  }, [isLast, visibleSteps.length])

  const goPrev = useCallback(() => {
    if (!isFirst) setActiveStep((s) => Math.max(s - 1, 0))
  }, [isFirst])

  const goTo = useCallback((index: number) => {
    setActiveStep(Math.max(0, Math.min(index, visibleSteps.length - 1)))
  }, [visibleSteps.length])

  const reset = useCallback(() => setActiveStep(0), [])

  return {
    steps: visibleSteps,
    activeStep,
    currentStep,
    isFirst,
    isLast,
    goNext,
    goPrev,
    goTo,
    reset,
  }
}
