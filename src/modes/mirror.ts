import { Output } from "@julusian/midi"
import { type FidgetModeInterface, setLed, clearLeds } from "./interface.ts"

// State specific to Mirror Mode
const MIRROR_CONTROLS = [0, 1] // Activate on first two knobs

export class MirrorMode implements FidgetModeInterface {
  activate(output: Output): void {
    console.log(`🪞 Activating Mirror mode on controls ${MIRROR_CONTROLS.join(" and ")}`)
    clearLeds(output, MIRROR_CONTROLS)
    // Initial sync (optional, could assume 0)
    setLed(output, MIRROR_CONTROLS[0], 0)
    setLed(output, MIRROR_CONTROLS[1], 127)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    let targetControl: number | null = null
    if (control === MIRROR_CONTROLS[0]) {
      targetControl = MIRROR_CONTROLS[1]
    } else if (control === MIRROR_CONTROLS[1]) {
      targetControl = MIRROR_CONTROLS[0]
    }

    if (targetControl !== null) {
      setLed(output, targetControl, 127 - value)
      return true // Handled
    }
    return false // Not one of the mirror controls
  }

  handleButtonPress(output: Output, control: number): boolean {
    // Mirror mode doesn't use button presses
    return false
  }

  deactivate(output: Output): void {
    console.log("🪞 Deactivated Mirror mode")
    clearLeds(output, MIRROR_CONTROLS)
  }
}
