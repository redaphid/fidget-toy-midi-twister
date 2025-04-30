import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Ripple Mode
let activeControls = new Set<number>()
let animationTimeouts: NodeJS.Timeout[] = []
let centerControl: number | null = null
let rippleSpeed = 100 // ms delay per step
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

    centerControl = triggeringControl
    rippleSpeed = 100 // Reset speed
    this.triggerRipple(output)
  }

  private triggerRipple(output: Output) {
    if (centerControl === null) return // Guard

    // Clear previous animation timeouts
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts = []
    activeControls.clear()

    // Define surrounding controls (can be refined)
    const surroundingControls = [centerControl - 4, centerControl - 1, centerControl + 1, centerControl + 4, centerControl - 5, centerControl - 3, centerControl + 3, centerControl + 5].filter((c) => c >= 0 && c < 16 && c !== centerControl)

    const controlsToUse = [centerControl, ...surroundingControls]
    activeControls = new Set(controlsToUse)
    console.log(`🌊 Rippling from ${centerControl} at ${rippleSpeed}ms/step`)

    clearLeds(output, ALL_KNOBS)

    setLed(output, centerControl, 127)

    surroundingControls.forEach((control, index) => {
      const rippleTimeout = setTimeout(() => {
        setLed(output, control, 127)
        const fadeTimeout = setTimeout(() => {
          setLed(output, control, 0)
        }, 150) // Fade duration
        animationTimeouts.push(fadeTimeout)
      }, rippleSpeed * (index + 1)) // Use dynamic speed
      animationTimeouts.push(rippleTimeout)
    })

    const centerFadeTimeout = setTimeout(() => {
      if (centerControl !== null) setLed(output, centerControl, 0)
    }, rippleSpeed * (surroundingControls.length + 1) + 150)
    animationTimeouts.push(centerFadeTimeout)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Only the center control affects speed
    if (control === centerControl) {
      // Map 0-127 to 30ms-300ms delay
      const newSpeed = 30 + (value / 127) * 270
      if (Math.abs(newSpeed - rippleSpeed) > 5) {
        // Tolerance
        rippleSpeed = newSpeed
        console.log(`🌊 Ripple speed set to: ${rippleSpeed.toFixed(0)}ms/step`)
        // Optional: Re-trigger ripple immediately on speed change?
        // this.triggerRipple(output)
      }
      return true // Handled
    }
    return false
  }

  handleButtonPress(output: Output, control: number): boolean {
    // Pressing center button could re-trigger ripple?
    if (control === centerControl) {
      console.log("🌊 Re-triggering ripple")
      this.triggerRipple(output)
      return true
    }
    return false
  }

  deactivate(output: Output): void {
    console.log("🌊 Deactivated Ripple mode")
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts = []
    clearLeds(output, Array.from(activeControls))
    activeControls.clear()
    centerControl = null
    rippleSpeed = 100
  }
}
