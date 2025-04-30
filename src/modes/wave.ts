import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Wave Mode
let waveTimer: NodeJS.Timeout | null = null
let phase = 0
let waveSpeed = 0.1 // Phase increment per step
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class WaveMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "wave"
  }

  activate(output: Output): void {
    console.log(`〰️ Activating Wave mode on all knobs`)
    this.deactivate(output)
    phase = 0
    waveSpeed = 0.1 // Reset speed

    waveTimer = setInterval(() => {
      ALL_KNOBS.forEach((control, index) => {
        // Create a sine wave pattern
        const value = Math.floor(63.5 + 63.5 * Math.sin(phase + index * 0.5))
        setLed(output, control, value)
      })

      phase += waveSpeed // Use dynamic speed
      if (phase > Math.PI * 2) phase -= Math.PI * 2
    }, 50) // Fixed interval, variable phase change
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map 0-127 to phase increment (e.g., 0.01 to 0.5)
    const newSpeed = 0.01 + (value / 127) * 0.49
    if (Math.abs(newSpeed - waveSpeed) > 0.01) {
      // Tolerance
      waveSpeed = newSpeed
      console.log(`〰️ Wave speed set to: ${waveSpeed.toFixed(2)}`)
      // No need to restart timer, just use new speed
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("〰️ Deactivated Wave mode")
    if (waveTimer) {
      clearInterval(waveTimer)
      waveTimer = null
    }
    clearLeds(output, ALL_KNOBS)
    waveSpeed = 0.1 // Reset on deactivate
    phase = 0
  }
}
