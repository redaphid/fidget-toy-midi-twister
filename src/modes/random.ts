import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Random Mode
let randomTimer: NodeJS.Timeout | null = null
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

    randomTimer = setInterval(() => {
      ALL_KNOBS.forEach((control) => {
        setLed(output, control, randomValue())
      })
    }, 200)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("🎲 Deactivated Random mode")
    if (randomTimer) {
      clearInterval(randomTimer)
      randomTimer = null
    }
    clearLeds(output, ALL_KNOBS)
  }
}
