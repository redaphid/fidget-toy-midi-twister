import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Wave Mode
let waveTimer: NodeJS.Timeout | null = null
let phase = 0
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class WaveMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "wave"
  }

  activate(output: Output): void {
    console.log(`〰️ Activating Wave mode on all knobs`)
    this.deactivate(output)
    phase = 0

    waveTimer = setInterval(() => {
      ALL_KNOBS.forEach((control, index) => {
        // Create a sine wave pattern
        const value = Math.floor(63.5 + 63.5 * Math.sin(phase + index * 0.5))
        setLed(output, control, value)
      })

      phase += 0.1
      if (phase > Math.PI * 2) phase -= Math.PI * 2
    }, 50)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false
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
  }
}
