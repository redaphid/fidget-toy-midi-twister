import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Pulse Mode
let pulseTimer: NodeJS.Timeout | null = null
let activeControl: number | null = null
let pulseSpeed = 50 // Default speed ms
let currentValue = 0
let direction = 1

export class PulseMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "pulse"
  }

  activate(output: Output, triggeringControl?: number): void {
    console.log(`💓 Activating Pulse mode`)
    this.deactivate(output)

    if (triggeringControl === undefined) {
      console.error("Pulse mode requires a triggering control.")
      triggeringControl = 0 // Default
    }

    activeControl = triggeringControl
    pulseSpeed = 50 // Reset speed
    currentValue = 0
    direction = 1
    console.log(`💓 Pulsing: control ${activeControl}`)
    this.startPulseInterval(output)
  }

  private startPulseInterval(output: Output) {
    if (pulseTimer) clearInterval(pulseTimer)

    pulseTimer = setInterval(() => {
      if (activeControl === null) return // Guard

      currentValue += direction * 5 // Amount to change each step
      if (currentValue >= 127) {
        currentValue = 127
        direction = -1
      } else if (currentValue <= 0) {
        currentValue = 0
        direction = 1
      }

      setLed(output, activeControl, currentValue)
    }, pulseSpeed) // Use dynamic speed
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Only react if the *active* pulsing knob is turned
    if (control === activeControl) {
      // Map knob value (0-127) to speed (e.g., 20ms to 200ms)
      const newSpeed = 20 + ((127 - value) / 127) * 180
      if (Math.abs(newSpeed - pulseSpeed) > 3) {
        // Tolerance
        pulseSpeed = newSpeed
        console.log(`💓 Pulse speed set to: ${pulseSpeed.toFixed(0)}ms`)
        this.startPulseInterval(output) // Restart timer with new speed
      }
      return true // Handled
    }
    return false // Knob turn wasn't the active one
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false // Not handled
  }

  handleMessage(output: Output, chan: number, control: number, value: number): boolean {
    // Pulse mode is automatic, doesn't react to input
    return false
  }

  deactivate(output: Output): void {
    console.log("💓 Deactivated Pulse mode")
    if (pulseTimer) {
      clearInterval(pulseTimer)
      pulseTimer = null
    }
    if (activeControl !== null) {
      setLed(output, activeControl, 0) // Turn off LED
      activeControl = null
    }
    // Reset state variables
    pulseSpeed = 50
    currentValue = 0
    direction = 1
  }
}
