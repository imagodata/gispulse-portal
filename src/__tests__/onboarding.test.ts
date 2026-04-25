import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isOnboardingDone, markOnboardingDone } from "@/components/OnboardingFlow"

const ONBOARDING_KEY = "gispulse_onboarding_done"

describe("OnboardingFlow — persistence helpers", () => {
  beforeEach(() => {
    localStorage.removeItem(ONBOARDING_KEY)
  })

  afterEach(() => {
    localStorage.removeItem(ONBOARDING_KEY)
  })

  it("isOnboardingDone returns false when key is absent", () => {
    expect(isOnboardingDone()).toBe(false)
  })

  it("isOnboardingDone returns true after markOnboardingDone()", () => {
    markOnboardingDone()
    expect(isOnboardingDone()).toBe(true)
  })

  it("markOnboardingDone sets localStorage key to 'true'", () => {
    markOnboardingDone()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("true")
  })
})
