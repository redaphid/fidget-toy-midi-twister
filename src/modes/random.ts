import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Random Mode
let randomTimer: NodeJS.Timeout | null = null
let randomSpeed = 200 // ms update interval
let isFrozen = false
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

// Generate random value helper
function randomValue() {
  return Math.floor(Math.random() * 128)
}

export class RandomMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "random"
  }

  activate(output: Output): void {
    console.log(`🎲 Activating Random mode on all knobs`)
    this.deactivate(output)
    randomSpeed = 200 // Reset speed
    isFrozen = false
    this.startRandomInterval(output)
  }

  private startRandomInterval(output: Output) {
    if (randomTimer) clearInterval(randomTimer)

    randomTimer = setInterval(() => {
      if (isFrozen) return // Don't update if frozen

      ALL_KNOBS.forEach((control) => {
        setLed(output, control, randomValue())
      })
    }, randomSpeed)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map 0-127 to 50ms-1000ms interval
    const newSpeed = 50 + ((127 - value) / 127) * 950
    if (Math.abs(newSpeed - randomSpeed) > 10) {
      // Tolerance
      randomSpeed = newSpeed
      console.log(`🎲 Random speed set to: ${randomSpeed.toFixed(0)}ms`)
      // Only restart if not frozen, otherwise speed applies when unfrozen
      if (!isFrozen) {
        this.startRandomInterval(output)
      }
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    isFrozen = !isFrozen
    console.log(`🎲 Random mode ${isFrozen ? "Frozen" : "Unfrozen"}`)
    if (!isFrozen) {
      // Restart timer if unfreezing to apply potential speed changes
      this.startRandomInterval(output)
    }
    return true // Handled
  }

  deactivate(output: Output): void {
    console.log("🎲 Deactivated Random mode")
    if (randomTimer) {
      clearInterval(randomTimer)
      randomTimer = null
    }
    clearLeds(output, ALL_KNOBS)
    randomSpeed = 200
    isFrozen = false
  }
}
