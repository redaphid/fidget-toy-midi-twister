import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, KNOB_CHANNEL, BUTTON_CHANNEL } from "./interface.ts"

// State specific to Normal/Linking Mode
let firstKnob: { control: number; value: number } | null = null
const linkedKnobs = new Map<number, number[]>() // source -> [destinations]
const knobValues = new Map<number, number>() // Keep track of knob values for linking

export class NormalMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "normal"
  }

  activate(output: Output, controls: number[]): void {
    // Normal mode doesn't have an explicit activation for specific controls
    // It's the default state
    console.log("🔄 Mode: Normal (Linking)")
    firstKnob = null // Reset linking state on activation
    linkedKnobs.clear()
    knobValues.clear()
  }

  handleMessage(output: Output, chan: number, control: number, value: number): boolean {
    // Store knob value when moved
    if (chan === KNOB_CHANNEL) {
      knobValues.set(control, value)
    }

    // Handle button presses for linking
    if (chan === BUTTON_CHANNEL && value === 127) {
      this.handleLinking(output, control)
      return true // Message handled
    }

    // Handle knob movements for updating linked knobs
    if (chan === KNOB_CHANNEL) {
      this.updateLinkedKnobs(output, control, value)
      // Don't return true, as other modes might want to act on knob turns
    }

    return false // Message not fully handled (allow fallthrough)
  }

  deactivate(output: Output): void {
    // Reset state when switching away from normal mode
    firstKnob = null
    linkedKnobs.clear()
    knobValues.clear()
    // No LEDs to clear specifically for this mode
  }

  // --- Mode specific methods ---

  private handleLinking(output: Output, control: number) {
    const currentValue = knobValues.get(control) || 0

    if (firstKnob === null) {
      // Store the first knob
      firstKnob = { control, value: currentValue }
      console.log(`📌 Link Source: control ${control}`)
    } else {
      // Second button press - link the knobs
      console.log(`🔗 Linking: ${firstKnob.control} → ${control}`)

      // Add to linked knobs map
      if (!linkedKnobs.has(firstKnob.control)) {
        linkedKnobs.set(firstKnob.control, [])
      }
      const destinations = linkedKnobs.get(firstKnob.control)
      if (destinations && !destinations.includes(control)) {
        destinations.push(control)
      }

      // Send initial value to the new linked knob
      setLed(output, control, firstKnob.value)

      // Reset for next pair
      firstKnob = null
    }
  }

  private updateLinkedKnobs(output: Output, control: number, value: number) {
    // Update stored value if this is the *currently selected* source knob
    if (firstKnob?.control === control) {
      firstKnob.value = value
    }

    // If this knob is a source in any link, update its destinations
    const destinations = linkedKnobs.get(control)
    if (destinations) {
      for (const destControl of destinations) {
        setLed(output, destControl, value)
      }
    }
  }
}
