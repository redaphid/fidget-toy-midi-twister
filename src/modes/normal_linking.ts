import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds, KNOB_CHANNEL, BUTTON_CHANNEL } from "./interface.ts"

// State specific to Normal/Linking Mode
let firstKnob: { control: number; value: number } | null = null
const linkedKnobs = new Map<number, number[]>() // source -> [destinations]
const knobValues = new Map<number, number>() // Keep track of knob values for linking
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

export class NormalLinkingMode implements FidgetModeInterface {
  activate(output: Output): void {
    console.log("🔄 Mode: Normal Linking")
    firstKnob = null // Reset linking state
    linkedKnobs.clear()
    knobValues.clear()
    // Clear all LEDs on activation to ensure clean state
    clearLeds(output, ALL_KNOBS)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    knobValues.set(control, value)
    this.updateLinkedKnobs(output, control, value)
    // Also update the knob being turned, in case it was previously linked
    setLed(output, control, value)
    return false // Allow other potential global handlers (like brightness?) - maybe should be true?
  }

  handleButtonPress(output: Output, control: number): boolean {
    this.handleLinking(output, control)
    return true // Linking handles the press
  }

  // handleButtonRelease not needed for linking

  deactivate(output: Output): void {
    console.log("Deactivating Linking Mode...")
    firstKnob = null
    linkedKnobs.clear()
    knobValues.clear()
    // Optionally clear LEDs on deactivate, or let the next mode handle it
    clearLeds(output, ALL_KNOBS)
  }

  // --- Mode specific methods ---

  private handleLinking(output: Output, control: number) {
    const currentValue = knobValues.get(control) || 0

    if (firstKnob === null) {
      firstKnob = { control, value: currentValue }
      console.log(`📌 Link Source: control ${control}`)
      // Maybe flash the source knob briefly?
      setLed(output, control, 127)
      setTimeout(() => setLed(output, control, currentValue), 200)
    } else {
      if (firstKnob.control === control) {
        // Pressed same knob twice
        console.log(`🚫 Link Cancelled (pressed source knob ${control} again)`)
        setLed(output, control, currentValue) // Restore original value display
        firstKnob = null
        return
      }

      console.log(`🔗 Linking: ${firstKnob.control} → ${control}`)

      if (!linkedKnobs.has(firstKnob.control)) {
        linkedKnobs.set(firstKnob.control, [])
      }
      const destinations = linkedKnobs.get(firstKnob.control)
      if (destinations && !destinations.includes(control)) {
        destinations.push(control)
        // Unlink the destination from any *other* source it might have been linked to
        linkedKnobs.forEach((dests, src) => {
          if (src !== firstKnob?.control) {
            linkedKnobs.set(
              src,
              dests.filter((d) => d !== control)
            )
          }
        })
      }

      setLed(output, control, firstKnob.value) // Set destination LED

      // Flash destination knob
      setTimeout(() => setLed(output, control, currentValue), 200)

      // Restore source knob LED (might have been flashed)
      setLed(output, firstKnob.control, firstKnob.value)

      firstKnob = null // Reset for next link
    }
  }

  private updateLinkedKnobs(output: Output, control: number, value: number) {
    if (firstKnob?.control === control) {
      firstKnob.value = value
    }

    const destinations = linkedKnobs.get(control)
    if (destinations) {
      destinations.forEach((destControl) => {
        setLed(output, destControl, value)
      })
    }
  }
}
