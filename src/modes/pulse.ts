import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Pulse Mode
let pulseTimer: NodeJS.Timeout | null = null
let activeControl: number | null = null

export class PulseMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "pulse"
  }

  activate(output: Output, triggeringControl?: number): void {
    console.log(`💓 Activating Pulse mode`)
    this.deactivate(output)

    if (triggeringControl === undefined) {
      console.error("Pulse mode requires a triggering control.")
      // Default to control 0 if none provided?
      triggeringControl = 0
      // return;
    }

    activeControl = triggeringControl
    console.log(`💓 Pulsing: control ${activeControl}`)

    let value = 0
    let direction = 1

    pulseTimer = setInterval(() => {
      if (activeControl === null) return // Guard

      value += direction * 5
      if (value >= 127) {
        value = 127
        direction = -1
      } else if (value <= 0) {
        value = 0
        direction = 1
      }

      setLed(output, activeControl, value)
    }, 50)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false // Not handled
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
  }
}
