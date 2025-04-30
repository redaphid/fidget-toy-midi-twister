import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Ripple Mode
let activeControls = new Set<number>()
let animationTimeouts: NodeJS.Timeout[] = []
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class RippleMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "ripple"
  }

  activate(output: Output, triggeringControl?: number): void {
    console.log(`🌊 Activating Ripple mode`)
    this.deactivate(output)

    if (triggeringControl === undefined) {
      console.error("Ripple mode requires a triggering control.")
      triggeringControl = 0 // Default to 0 if none provided
    }

    const centerControl = triggeringControl
    // Simple surrounding logic: +/- 1, +/- 4 (assuming grid)
    // This is a basic example, might need better layout logic
    const surroundingControls = [
      centerControl - 4,
      centerControl - 1,
      centerControl + 1,
      centerControl + 4,
      centerControl - 5,
      centerControl - 3,
      centerControl + 3,
      centerControl + 5, // Diagonals
    ].filter((c) => c >= 0 && c < 16 && c !== centerControl) // Basic bounds check

    const controlsToUse = [centerControl, ...surroundingControls]
    activeControls = new Set(controlsToUse)
    console.log(`🌊 Rippling from ${centerControl} to [${surroundingControls.join(", ")}]`)

    clearLeds(output, ALL_KNOBS) // Clear all first

    // Create ripple
    setLed(output, centerControl, 127)

    surroundingControls.forEach((control, index) => {
      const rippleTimeout = setTimeout(() => {
        setLed(output, control, 127)
        const fadeTimeout = setTimeout(() => {
          setLed(output, control, 0)
        }, 150)
        animationTimeouts.push(fadeTimeout)
      }, 100 * (index + 1)) // Delay ripple based on simple index
      animationTimeouts.push(rippleTimeout)
    })

    // Fade center after ripple completes
    const centerFadeTimeout = setTimeout(() => {
      setLed(output, centerControl, 0)
    }, 100 * (surroundingControls.length + 1) + 150) // Ensure it fades after others
    animationTimeouts.push(centerFadeTimeout)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false // Not handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false // Not handled
  }

  deactivate(output: Output): void {
    console.log("🌊 Deactivated Ripple mode")
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts = []
    clearLeds(output, Array.from(activeControls)) // Clear only affected LEDs
    activeControls.clear()
  }
}
