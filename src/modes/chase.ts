import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Chase Mode
let chaseSequence: number[] = []
let chasePosition = 0
let chaseTimer: NodeJS.Timeout | null = null
let chaseSpeed = 150 // Default speed (ms)
let chaseDirection = 1 // 1 for forward, -1 for backward
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class ChaseMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "chase"
  }

  activate(output: Output): void {
    console.log(`🏃 Activating Chase mode on all knobs`)
    this.deactivate(output)

    chaseSequence = [...ALL_KNOBS]
    chasePosition = 0
    chaseSpeed = 150 // Reset speed
    chaseDirection = 1 // Default forward

    clearLeds(output, ALL_KNOBS)
    this.startChaseInterval(output)
  }

  private startChaseInterval(output: Output) {
    if (chaseTimer) clearInterval(chaseTimer)

    chaseTimer = setInterval(() => {
      if (chaseSequence.length === 0) return // Stop if deactivated

      // Calculate previous position based on direction
      const prevOffset = chaseDirection === 1 ? -1 : 1
      const prevPos = (chasePosition + prevOffset + chaseSequence.length) % chaseSequence.length

      // Clear previous LED
      setLed(output, chaseSequence[prevPos], 0)
      // Set current LED
      setLed(output, chaseSequence[chasePosition], 127)

      // Move to next position based on direction
      chasePosition = (chasePosition + chaseDirection + chaseSequence.length) % chaseSequence.length
    }, chaseSpeed) // Use dynamic speed
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map knob value (0-127) to speed (e.g., 50ms to 500ms)
    // Invert value so higher knob value = faster speed
    const newSpeed = 50 + ((127 - value) / 127) * 450
    if (Math.abs(newSpeed - chaseSpeed) > 5) {
      // Add tolerance to avoid restarting timer too often
      chaseSpeed = newSpeed
      console.log(`🏃 Chase speed set to: ${chaseSpeed.toFixed(0)}ms`)
      this.startChaseInterval(output) // Restart timer with new speed
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    chaseDirection *= -1 // Reverse direction
    console.log(`🏃 Chase direction reversed (${chaseDirection === 1 ? "Forward" : "Backward"})`)
    // No need to restart timer, direction is used in the next interval
    return true // Handled button press
  }

  deactivate(output: Output): void {
    console.log("🏃 Deactivated Chase mode")
    if (chaseTimer) {
      clearInterval(chaseTimer)
      chaseTimer = null
    }
    clearLeds(output, ALL_KNOBS)
    chaseSequence = []
    chasePosition = 0
    chaseDirection = 1 // Reset direction
  }
}
