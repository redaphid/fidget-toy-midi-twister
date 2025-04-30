import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, BUTTON_CHANNEL } from "./interface.ts"

// State specific to Simon Game
let simonSequence: number[] = []
let simonUserPosition = 0
let simonActive = false
let simonControls = new Set<number>()
let displayTimer: NodeJS.Timeout | null = null

export class SimonMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "simon"
  }

  activate(output: Output, controls: number[]): void {
    console.log(`🎮 Activating Simon game`)
    this.deactivate(output) // Clear previous state

    if (controls.length === 0) {
      console.error("Simon mode requires at least 1 control.")
      return
    }

    simonControls = new Set(controls)
    simonControls.forEach((control) => {
      setLed(output, control, 0)
    })

    simonSequence = []
    simonUserPosition = 0
    simonActive = true

    // Add the first step
    this.addStepToSimon(output)
  }

  handleMessage(output: Output, chan: number, control: number, value: number): boolean {
    if (!simonActive || chan !== BUTTON_CHANNEL || value !== 127 || !simonControls.has(control)) {
      return false // Only handle button presses on active simon controls
    }

    this.checkSimonPress(output, control)
    return true // Handled button press
  }

  deactivate(output: Output): void {
    if (displayTimer) {
      clearTimeout(displayTimer)
      displayTimer = null
    }
    simonControls.forEach((control) => {
      setLed(output, control, 0) // Turn off LEDs
    })
    simonControls.clear()
    simonSequence = []
    simonUserPosition = 0
    simonActive = false
    console.log("🎮 Deactivated Simon game")
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
      // Turn off all LEDs first
      simonControls.forEach((control) => setLed(output, control, 0))

      if (stepIndex < simonSequence.length) {
        const control = simonSequence[stepIndex]
        setLed(output, control, 127) // Light up current step

        stepIndex++
        displayTimer = setTimeout(() => {
          setLed(output, control, 0) // Turn off after delay
          displayTimer = setTimeout(showStep, 200) // Delay before next step
        }, 500)
      } else {
        // Sequence finished displaying, ready for user input
        displayTimer = null
      }
    }
    showStep()
  }

  private checkSimonPress(output: Output, control: number) {
    if (!simonActive) return

    // Prevent input while sequence is displaying
    if (displayTimer) return

    if (control === simonSequence[simonUserPosition]) {
      // Correct press
      setLed(output, control, 127)
      setTimeout(() => setLed(output, control, 0), 150)

      simonUserPosition++

      if (simonUserPosition >= simonSequence.length) {
        // Completed sequence
        console.log(`✅ Sequence complete! Score: ${simonSequence.length}`)
        // Add new step after a short delay
        setTimeout(() => this.addStepToSimon(output), 1000)
      }
    } else {
      // Wrong button - game over
      console.log(`❌ Simon game over! Score: ${simonSequence.length - 1}`)
      this.gameOverAnimation(output)
      simonActive = false // Stop the game
    }
  }

  private gameOverAnimation(output: Output) {
    const flashAll = (times: number) => {
      if (times <= 0 || !simonControls.size) {
        simonControls.forEach((c) => setLed(output, c, 0))
        return
      }

      const onValue = times % 2 === 0 ? 0 : 127
      simonControls.forEach((c) => setLed(output, c, onValue))
      setTimeout(() => flashAll(times - 1), 150)
    }
    flashAll(6) // Flash 3 times
  }
}
