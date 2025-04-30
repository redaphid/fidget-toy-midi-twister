import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed } from "./interface.ts"

// State specific to Chase Mode
let chaseSequence: number[] = []
let chasePosition = 0
let chaseTimer: NodeJS.Timeout | null = null
let activeControls = new Set<number>()

export class ChaseMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "chase"
  }

  activate(output: Output, controls: number[]): void {
    console.log(`🏃 Activating Chase mode`)
    this.deactivate(output) // Clear previous state

    if (controls.length < 2) {
      console.error("Chase mode requires at least 2 controls.")
      return
    }

    chaseSequence = [...controls]
    chasePosition = 0
    activeControls = new Set(controls)

    controls.forEach((control) => {
      setLed(output, control, 0)
    })

    // Start the chase
    chaseTimer = setInterval(() => {
      // Clear previous position
      const prevPos = (chasePosition - 1 + chaseSequence.length) % chaseSequence.length
      setLed(output, chaseSequence[prevPos], 0)

      // Light up current position
      setLed(output, chaseSequence[chasePosition], 127)

      // Move to next position
      chasePosition = (chasePosition + 1) % chaseSequence.length
    }, 150)
  }

  handleMessage(output: Output, chan: number, control: number, value: number): boolean {
    // Chase mode is automatic, doesn't react to input
    return false
  }

  deactivate(output: Output): void {
    if (chaseTimer) {
      clearInterval(chaseTimer)
      chaseTimer = null
    }
    activeControls.forEach((control) => {
      setLed(output, control, 0) // Turn off LEDs
    })
    activeControls.clear()
    chaseSequence = []
    chasePosition = 0
    console.log("🏃 Deactivated Chase mode")
  }
}
