import { useEffect, type RefObject } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps focus inside a container while `active` is true.
 * Also locks body scroll and restores focus on deactivation.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return

    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    // Focus the first focusable element
    const focusFirst = () => {
      const first = container.querySelector<HTMLElement>(FOCUSABLE)
      first?.focus()
    }
    // Delay to allow render
    requestAnimationFrame(focusFirst)

    // Trap tab key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return

      const focusableEls = container!.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusableEls.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus()
    }
  }, [ref, active])
}
