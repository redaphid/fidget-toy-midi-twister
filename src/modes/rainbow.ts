import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)
let colorOffset = 0 // State to hold the color shift

export class RainbowMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "rainbow"
  }

  activate(output: Output): void {
    console.log(`🌈 Activating Rainbow mode on all knobs`)
    this.deactivate(output)
    colorOffset = 0 // Reset offset
    this.updateLeds(output)
  }

  private updateLeds(output: Output) {
    ALL_KNOBS.forEach((control, index) => {
      // Calculate color based on index and offset
      const effectiveIndex = (index + colorOffset) % ALL_KNOBS.length
      const rainbowValue = Math.floor((effectiveIndex / ALL_KNOBS.length) * 127)
      setLed(output, control, rainbowValue)
    })
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map knob value (0-127) to a color offset (e.g., 0-15)
    const newOffset = Math.floor((value / 127) * (ALL_KNOBS.length - 1))
    if (newOffset !== colorOffset) {
      colorOffset = newOffset
      console.log(`🌈 Rainbow offset: ${colorOffset}`)
      this.updateLeds(output)
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("🌈 Deactivated Rainbow mode")
    clearLeds(output, ALL_KNOBS)
    colorOffset = 0
  }
}
