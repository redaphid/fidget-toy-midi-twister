import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class RainbowMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "rainbow"
  }

  activate(output: Output): void {
    console.log(`🌈 Activating Rainbow mode on all knobs`)
    this.deactivate(output)

    ALL_KNOBS.forEach((control, index) => {
      const rainbowValue = Math.floor((index / ALL_KNOBS.length) * 127)
      setLed(output, control, rainbowValue)
    })
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("🌈 Deactivated Rainbow mode")
    clearLeds(output, ALL_KNOBS)
  }
}
