import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Binary Counter Mode
let binaryTimer: NodeJS.Timeout | null = null
let binaryCounter = 0
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class BinaryMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "binary"
  }

  activate(output: Output): void {
    console.log(`🔢 Activating Binary Counter mode on all knobs`)
    this.deactivate(output)
    binaryCounter = 0

    clearLeds(output, ALL_KNOBS)

    binaryTimer = setInterval(() => {
      const binaryString = binaryCounter.toString(2).padStart(ALL_KNOBS.length, "0")
      ALL_KNOBS.forEach((control, index) => {
        setLed(output, control, binaryString[index] === "1" ? 127 : 0)
      })
      binaryCounter = (binaryCounter + 1) % 2 ** ALL_KNOBS.length
    }, 300)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("🔢 Deactivated Binary Counter mode")
    if (binaryTimer) {
      clearInterval(binaryTimer)
      binaryTimer = null
    }
    clearLeds(output, ALL_KNOBS)
    binaryCounter = 0
  }
}
