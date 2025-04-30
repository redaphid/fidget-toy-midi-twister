import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Wave Mode
let waveTimer: NodeJS.Timeout | null = null
let phase = 0
let waveSpeed = 0.1 // Phase increment per step
let waveDirection = 1 // 1 or -1
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
    waveDirection = 1 // Default forward

    waveTimer = setInterval(() => {
      ALL_KNOBS.forEach((control, index) => {
        // Adjust index based on direction for visual reversal
        const adjustedIndex = waveDirection === 1 ? index : ALL_KNOBS.length - 1 - index
        const value = Math.floor(63.5 + 63.5 * Math.sin(phase + adjustedIndex * 0.5))
        setLed(output, control, value)
      })

      phase += waveSpeed * waveDirection
      // Keep phase within 0 to 2*PI range
      if (phase > Math.PI * 2) phase -= Math.PI * 2
      if (phase < 0) phase += Math.PI * 2
    }, 50) // Fixed interval, variable phase change
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map 0-127 to phase increment (e.g., 0.01 to 0.5)
    const newSpeed = 0.01 + (value / 127) * 0.49
    if (Math.abs(newSpeed - waveSpeed) > 0.01) {
      waveSpeed = newSpeed
      console.log(`〰️ Wave speed set to: ${waveSpeed.toFixed(2)}`)
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    waveDirection *= -1 // Reverse direction
    console.log(`〰️ Wave direction reversed (${waveDirection === 1 ? "Forward" : "Backward"})`)
    return true
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
    waveDirection = 1 // Reset direction
  }
}
