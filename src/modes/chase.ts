import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Chase Mode
let chaseSequence: number[] = []
let chasePosition = 0
let chaseTimer: NodeJS.Timeout | null = null
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

    clearLeds(output, ALL_KNOBS)

    // Start the chase
    chaseTimer = setInterval(() => {
      const prevPos = (chasePosition - 1 + chaseSequence.length) % chaseSequence.length
      setLed(output, chaseSequence[prevPos], 0)
      setLed(output, chaseSequence[chasePosition], 127)
      chasePosition = (chasePosition + 1) % chaseSequence.length
    }, 150)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false // Not handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false // Not handled
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
  }
}
