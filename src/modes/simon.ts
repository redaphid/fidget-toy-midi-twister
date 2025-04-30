import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds, BUTTON_CHANNEL } from "./interface.ts"

// State specific to Simon Game
let simonSequence: number[] = []
let simonUserPosition = 0
let simonActive = false
const simonControls = new Set<number>(Array.from({ length: 16 }, (_, i) => i)) // Always use 16 controls (0-15)
let displayTimer: NodeJS.Timeout | null = null

export class SimonMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "simon"
  }

  activate(output: Output): void {
    console.log(`🎮 Activating Simon game on all 16 knobs`)
    this.deactivate(output) // Clear previous state

    // Ensure the fixed set of controls is used
    simonControls.forEach((control) => {
      setLed(output, control, 0)
    })

    simonSequence = []
    simonUserPosition = 0
    simonActive = true

    // Add the first step
    this.addStepToSimon(output)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    return false // Simon doesn't use knob turns
  }

  handleButtonPress(output: Output, control: number): boolean {
    if (!simonActive || !simonControls.has(control)) {
      return false // Only handle button presses on active simon controls (0-15)
    }
    this.checkSimonPress(output, control)
    return true // Handled button press
  }

  deactivate(output: Output): void {
    console.log("🎮 Deactivated Simon game")
    if (displayTimer) {
      clearTimeout(displayTimer)
      displayTimer = null
    }
    clearLeds(output, Array.from(simonControls)) // Use Array.from for Set
    // No need to clear simonControls as it's fixed
    simonSequence = []
    simonUserPosition = 0
    simonActive = false
  }

  // --- Mode specific methods ---

  private addStepToSimon(output: Output) {
    if (!simonActive) return
    const controlsArray = Array.from(simonControls)
    const randomIndex = Math.floor(Math.random() * controlsArray.length)
    simonSequence.push(controlsArray[randomIndex])
    simonUserPosition = 0
    this.displaySequence(output)
  }

  private displaySequence(output: Output) {
    if (!simonActive) return
    if (displayTimer) clearTimeout(displayTimer)

    let stepIndex = 0
    const showStep = () => {
      if (!simonActive) return
      simonControls.forEach((control) => setLed(output, control, 0)) // Clear all

      if (stepIndex < simonSequence.length) {
        const control = simonSequence[stepIndex]
        setLed(output, control, 127)

        stepIndex++
        displayTimer = setTimeout(() => {
          setLed(output, control, 0)
          displayTimer = setTimeout(showStep, 200)
        }, 500)
      } else {
        displayTimer = null
      }
    }
    showStep()
  }

  private checkSimonPress(output: Output, control: number) {
    if (!simonActive || displayTimer) return // Ignore if displaying

    if (control === simonSequence[simonUserPosition]) {
      setLed(output, control, 127)
      setTimeout(() => setLed(output, control, 0), 150)
      simonUserPosition++
      if (simonUserPosition >= simonSequence.length) {
        console.log(`✅ Sequence complete! Score: ${simonSequence.length}`)
        setTimeout(() => this.addStepToSimon(output), 1000)
      }
    } else {
      console.log(`❌ Simon game over! Score: ${simonSequence.length - 1}`)
      this.gameOverAnimation(output)
      simonActive = false
    }
  }

  private gameOverAnimation(output: Output) {
    const controlsArray = Array.from(simonControls)
    const flashAll = (times: number) => {
      if (times <= 0 || controlsArray.length === 0) {
        clearLeds(output, controlsArray)
        return
      }
      const onValue = times % 2 === 0 ? 0 : 127
      controlsArray.forEach((c) => setLed(output, c, onValue))
      setTimeout(() => flashAll(times - 1), 150)
    }
    flashAll(6) // Flash 3 times
  }
}
