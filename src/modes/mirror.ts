import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, KNOB_CHANNEL } from "./interface.ts"

// State specific to Mirror Mode
let mirroredControls = new Set<number>()
let controlA: number | null = null
let controlB: number | null = null

export class MirrorMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "mirror"
  }

  activate(output: Output, controls: number[]): void {
    console.log(`🪞 Activating Mirror mode`)
    this.deactivate(output) // Clear previous state

    if (controls.length !== 2) {
      console.error("Mirror mode requires exactly 2 controls.")
      return
    }

    controlA = controls[0]
    controlB = controls[1]
    mirroredControls.add(controlA)
    mirroredControls.add(controlB)

    console.log(`🪞 Mirroring: ${controlA} ↔ ${controlB}`)

    // Initial synchronization (assuming value access - needs refactor?)
    // TODO: Need a way to get current knob value from main state
    // For now, just set B based on A being 0 initially
    setLed(output, controlB, 127)
    setLed(output, controlA, 0)
  }

  handleMessage(output: Output, chan: number, control: number, value: number): boolean {
    if (chan !== KNOB_CHANNEL || !mirroredControls.has(control)) {
      return false // Only handle knob turns on mirrored controls
    }

    let targetControl: number | null = null
    if (control === controlA) {
      targetControl = controlB
    } else if (control === controlB) {
      targetControl = controlA
    }

    if (targetControl !== null) {
      setLed(output, targetControl, 127 - value)
    }

    return true // Handled knob turn for mirroring
  }

  deactivate(output: Output): void {
    mirroredControls.forEach((control) => {
      setLed(output, control, 0) // Turn off LEDs
    })
    mirroredControls.clear()
    controlA = null
    controlB = null
    console.log("🪞 Deactivated Mirror mode")
  }
}
