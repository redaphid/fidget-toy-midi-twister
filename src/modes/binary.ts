import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Binary Counter Mode
let binaryTimer: NodeJS.Timeout | null = null
let binaryCounter = 0
let binarySpeed = 300 // ms update interval
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class BinaryMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "binary"
  }

  activate(output: Output): void {
    console.log(`🔢 Activating Binary Counter mode on all knobs`)
    this.deactivate(output)
    binaryCounter = 0
    binarySpeed = 300 // Reset speed

    clearLeds(output, ALL_KNOBS)
    this.startBinaryInterval(output)
  }

  private startBinaryInterval(output: Output) {
    if (binaryTimer) clearInterval(binaryTimer)

    binaryTimer = setInterval(() => {
      const binaryString = binaryCounter.toString(2).padStart(ALL_KNOBS.length, "0")
      ALL_KNOBS.forEach((control, index) => {
        setLed(output, control, binaryString[index] === "1" ? 127 : 0)
      })
      binaryCounter = (binaryCounter + 1) % 2 ** ALL_KNOBS.length
    }, binarySpeed)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map 0-127 to 50ms-1000ms interval
    const newSpeed = 50 + ((127 - value) / 127) * 950
    if (Math.abs(newSpeed - binarySpeed) > 10) {
      // Tolerance
      binarySpeed = newSpeed
      console.log(`🔢 Binary speed set to: ${binarySpeed.toFixed(0)}ms`)
      this.startBinaryInterval(output)
    }
    return true // Handled
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
    binarySpeed = 300
  }
}
