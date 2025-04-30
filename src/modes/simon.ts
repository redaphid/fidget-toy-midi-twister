import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds, BUTTON_CHANNEL } from "./interface.ts"

// Game state enums
const GameState = {
  IDLE: "IDLE",
  DISPLAYING_SEQUENCE: "DISPLAYING_SEQUENCE",
  WAITING_FOR_INPUT: "WAITING_FOR_INPUT",
  LEVEL_COMPLETE: "LEVEL_COMPLETE",
  GAME_OVER: "GAME_OVER",
} as const

type GameStateType = (typeof GameState)[keyof typeof GameState]

const Difficulty = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
} as const

type DifficultyType = (typeof Difficulty)[keyof typeof Difficulty]

// State specific to Simon Game
interface SimonGameState {
  sequence: number[]
  userPosition: number
  active: boolean
  state: GameStateType
  difficulty: DifficultyType
  score: number
  highScore: number
  speedMultiplier: number
  mistakesAllowed: number
  mistakesMade: number
  knobValues: number[]
  colorValues: number[]
  lastActionTime: number
}

// Persistent game state
const state: SimonGameState = {
  sequence: [],
  userPosition: 0,
  active: false,
  state: GameState.IDLE,
  difficulty: Difficulty.EASY,
  score: 0,
  highScore: 0,
  speedMultiplier: 1,
  mistakesAllowed: 0,
  mistakesMade: 0,
  knobValues: Array(16).fill(0),
  colorValues: [127, 64, 32, 96, 16, 48, 80, 112], // Default colors
  lastActionTime: 0,
}

const simonControlsArray = Array.from({ length: 16 }, (_, i) => i) // All 16 controls (0-15)
const simonControls = new Set<number>(simonControlsArray)
let displayTimer: NodeJS.Timeout | null = null
let idleTimer: NodeJS.Timeout | null = null

// Difficulty settings
const difficultySettings = {
  [Difficulty.EASY]: { speedMultiplier: 1, mistakesAllowed: 2 },
  [Difficulty.MEDIUM]: { speedMultiplier: 1.5, mistakesAllowed: 1 },
  [Difficulty.HARD]: { speedMultiplier: 2, mistakesAllowed: 0 },
  [Difficulty.EXPERT]: { speedMultiplier: 3, mistakesAllowed: 0 },
}

export class SimonMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "simon"
  }

  activate(output: Output): void {
    console.log(`🎮 Activating Simon game on all 16 knobs`)
    this.deactivate(output) // Clear previous state

    // Reset state but preserve high score
    const highScore = state.highScore
    Object.assign(state, {
      sequence: [],
      userPosition: 0,
      active: true,
      state: GameState.IDLE,
      difficulty: Difficulty.EASY,
      score: 0,
      highScore,
      speedMultiplier: difficultySettings[Difficulty.EASY].speedMultiplier,
      mistakesAllowed: difficultySettings[Difficulty.EASY].mistakesAllowed,
      mistakesMade: 0,
      knobValues: Array(16).fill(0),
      lastActionTime: Date.now(),
    })

    // Ensure the fixed set of controls is used
    simonControlsArray.forEach((control) => {
      setLed(output, control, 0)
    })

    // Show welcome animation and instructions
    this.showWelcomeAnimation(output)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    if (!state.active || !simonControls.has(control)) {
      return false
    }

    state.lastActionTime = Date.now()
    state.knobValues[control] = value

    // Different behavior based on game state
    if (state.state === GameState.IDLE) {
      // In IDLE, knob turns change difficulty or start game
      if (control === 0) {
        // Knob 0 controls difficulty
        const difficultyLevels = Object.values(Difficulty)
        const difficultyIndex = Math.floor(value / (128 / difficultyLevels.length))
        const newDifficulty = difficultyLevels[difficultyIndex] as DifficultyType

        if (newDifficulty !== state.difficulty) {
          state.difficulty = newDifficulty
          const settings = difficultySettings[newDifficulty]
          state.speedMultiplier = settings.speedMultiplier
          state.mistakesAllowed = settings.mistakesAllowed

          console.log(`🎮 Difficulty set to ${newDifficulty} (Speed: ${settings.speedMultiplier}x, Mistakes: ${settings.mistakesAllowed})`)

          // Update difficulty display
          this.showDifficultySelection(output)
        }
      } else if (control === 15 && value > 100) {
        // Start game when knob 15 is turned fully clockwise
        this.startGame(output)
      }
    } else if (state.state === GameState.WAITING_FOR_INPUT) {
      // In some advanced modes, knob values could matter
      // For now, just use as visual feedback
      const brightness = Math.min(127, Math.max(0, value))
      setLed(output, control, brightness)
    }

    return true
  }

  handleButtonPress(output: Output, control: number): boolean {
    if (!state.active || !simonControls.has(control)) {
      return false // Only handle button presses on active simon controls (0-15)
    }

    state.lastActionTime = Date.now()

    if (state.state === GameState.IDLE) {
      // In IDLE state, button press starts the game
      this.startGame(output)
      return true
    } else if (state.state === GameState.WAITING_FOR_INPUT) {
      this.checkSimonPress(output, control)
    } else if (state.state === GameState.GAME_OVER || state.state === GameState.LEVEL_COMPLETE) {
      // Reset to IDLE state
      state.state = GameState.IDLE
      this.showDifficultySelection(output)
    }

    return true // Handled button press
  }

  deactivate(output: Output): void {
    console.log("🎮 Deactivated Simon game")
    if (displayTimer) {
      clearTimeout(displayTimer)
      displayTimer = null
    }
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    clearLeds(output, simonControlsArray)
    state.active = false
    state.state = GameState.IDLE
  }

  // --- Mode specific methods ---

  private showWelcomeAnimation(output: Output) {
    // Clear all LEDs
    clearLeds(output, simonControlsArray)

    // Sequential light up animation
    let step = 0
    const totalSteps = 16

    const animateStep = () => {
      if (step < totalSteps) {
        // Light up one knob at a time in sequence
        const control = step
        const color = state.colorValues[step % state.colorValues.length]
        setLed(output, control, color)

        step++
        displayTimer = setTimeout(animateStep, 100)
      } else {
        // Animation complete, show difficulty selection
        displayTimer = null
        setTimeout(() => this.showDifficultySelection(output), 200)
      }
    }

    animateStep()
  }

  private showDifficultySelection(output: Output) {
    // Clear previous LEDs
    clearLeds(output, simonControlsArray)

    // Show current difficulty level
    const difficultyLevels = Object.values(Difficulty)
    const currentIndex = difficultyLevels.indexOf(state.difficulty)

    // Light up difficulty indicator (knobs 0-3)
    for (let i = 0; i < difficultyLevels.length; i++) {
      const brightness = i === currentIndex ? 127 : 20
      setLed(output, i, brightness)
    }

    // Light up start indicator (knob 15)
    setLed(output, 15, 64)

    console.log(`🎮 Simon game ready! Turn knob 0 to select difficulty, press any button or turn knob 15 to start`)
    console.log(`   Current difficulty: ${state.difficulty} (Mistakes allowed: ${state.mistakesAllowed})`)

    // Set idle timer to show occasional hints
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => this.pulseStartButton(output), 3000)
  }

  private pulseStartButton(output: Output) {
    if (state.state !== GameState.IDLE) return

    let brightness = 20
    let direction = 5
    let pulseCount = 0

    const pulse = () => {
      if (state.state !== GameState.IDLE || pulseCount >= 3) {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = null
        return
      }

      brightness += direction
      if (brightness >= 127) {
        brightness = 127
        direction = -5
      } else if (brightness <= 20) {
        brightness = 20
        direction = 5
        pulseCount++
      }

      setLed(output, 15, brightness)
      idleTimer = setTimeout(pulse, 30)
    }

    pulse()
  }

  private startGame(output: Output) {
    state.sequence = []
    state.userPosition = 0
    state.state = GameState.LEVEL_COMPLETE // Triggers adding a new step
    state.score = 0
    state.mistakesMade = 0

    console.log(`🎮 Starting Simon game (${state.difficulty} mode)`)

    // Show countdown animation
    let countdown = 3
    this.showCountdown(output, countdown, () => {
      // Add the first step
      this.addStepToSimon(output)
    })
  }

  private showCountdown(output: Output, count: number, callback: () => void) {
    if (count <= 0) {
      callback()
      return
    }

    // Clear all LEDs
    clearLeds(output, simonControlsArray)

    // Show countdown number
    const controlsToLight = []
    if (count === 3) {
      // Pattern for "3"
      controlsToLight.push(0, 1, 2, 3, 7, 11, 12, 13, 14, 15)
    } else if (count === 2) {
      // Pattern for "2"
      controlsToLight.push(0, 1, 2, 3, 7, 8, 9, 10, 12, 13, 14, 15)
    } else if (count === 1) {
      // Pattern for "1"
      controlsToLight.push(1, 5, 9, 13)
    }

    controlsToLight.forEach((c) => setLed(output, c, 127))

    displayTimer = setTimeout(() => {
      this.showCountdown(output, count - 1, callback)
    }, 800)
  }

  private addStepToSimon(output: Output) {
    if (!state.active) return

    // Add a step that depends on current sequence
    let newStep: number

    if (state.sequence.length === 0) {
      // First step is random
      newStep = Math.floor(Math.random() * 16)
    } else {
      // Advanced sequences depend on previous steps
      const lastStep = state.sequence[state.sequence.length - 1]
      const options = []

      // Include horizontal neighbors
      if (lastStep % 4 > 0) options.push(lastStep - 1)
      if (lastStep % 4 < 3) options.push(lastStep + 1)

      // Include vertical neighbors
      if (lastStep >= 4) options.push(lastStep - 4)
      if (lastStep < 12) options.push(lastStep + 4)

      // On hard and expert, include diagonals and wrapping sides
      if (state.difficulty === Difficulty.HARD || state.difficulty === Difficulty.EXPERT) {
        // Diagonals
        if (lastStep % 4 > 0 && lastStep >= 4) options.push(lastStep - 5)
        if (lastStep % 4 < 3 && lastStep >= 4) options.push(lastStep - 3)
        if (lastStep % 4 > 0 && lastStep < 12) options.push(lastStep + 3)
        if (lastStep % 4 < 3 && lastStep < 12) options.push(lastStep + 5)

        // Expert also adds wrapping sides
        if (state.difficulty === Difficulty.EXPERT) {
          if (lastStep % 4 === 0) options.push(lastStep + 3)
          if (lastStep % 4 === 3) options.push(lastStep - 3)
          if (lastStep < 4) options.push(lastStep + 12)
          if (lastStep >= 12) options.push(lastStep - 12)
        }
      }

      // Remove duplicates and positions already in sequence for level consistency
      const validOptions = [...new Set(options)].filter((pos) => !state.sequence.slice(-3).includes(pos)) // Don't repeat recent steps

      if (validOptions.length > 0) {
        newStep = validOptions[Math.floor(Math.random() * validOptions.length)]
      } else {
        // Fallback to random if no valid options
        newStep = Math.floor(Math.random() * 16)
      }
    }

    state.sequence.push(newStep)
    state.userPosition = 0
    state.state = GameState.DISPLAYING_SEQUENCE
    state.score = state.sequence.length

    // Update high score if needed
    if (state.score > state.highScore) {
      state.highScore = state.score
    }

    console.log(`🎮 Adding step ${state.sequence.length}: Control ${newStep}`)
    this.displaySequence(output)
  }

  private displaySequence(output: Output) {
    if (!state.active) return
    if (displayTimer) clearTimeout(displayTimer)

    // Clear all LEDs before showing sequence
    clearLeds(output, simonControlsArray)

    // Calculate speed based on difficulty
    const baseDisplayTime = 500 / state.speedMultiplier
    const basePauseTime = 200 / state.speedMultiplier

    let stepIndex = 0
    const showStep = () => {
      if (!state.active || state.state !== GameState.DISPLAYING_SEQUENCE) return

      if (stepIndex < state.sequence.length) {
        const control = state.sequence[stepIndex]
        // Use color based on position to help with memorization
        const colorIndex = control % state.colorValues.length
        const color = state.colorValues[colorIndex]

        setLed(output, control, color)

        stepIndex++
        displayTimer = setTimeout(() => {
          setLed(output, control, 0)
          displayTimer = setTimeout(showStep, basePauseTime)
        }, baseDisplayTime)
      } else {
        // Sequence display complete
        displayTimer = null
        state.state = GameState.WAITING_FOR_INPUT
        console.log(`🎮 Your turn! Repeat the sequence (${state.sequence.length} steps)`)
      }
    }

    // Start showing sequence after a short pause
    displayTimer = setTimeout(showStep, 500)
  }

  private checkSimonPress(output: Output, control: number) {
    if (!state.active || state.state !== GameState.WAITING_FOR_INPUT || displayTimer) return

    const expectedControl = state.sequence[state.userPosition]

    if (control === expectedControl) {
      // Correct input
      const colorIndex = control % state.colorValues.length
      const color = state.colorValues[colorIndex]

      // Light up button and play success animation
      setLed(output, control, color)
      setTimeout(() => {
        if (state.state !== GameState.WAITING_FOR_INPUT) return
        setLed(output, control, 0)
      }, 150)

      state.userPosition++

      if (state.userPosition >= state.sequence.length) {
        // Level complete
        console.log(`✅ Sequence complete! Score: ${state.score}`)
        state.state = GameState.LEVEL_COMPLETE

        // Level completion animation
        this.showLevelCompleteAnimation(output, () => {
          // Add next step after animation
          setTimeout(() => this.addStepToSimon(output), 500)
        })
      }
    } else {
      // Wrong input
      state.mistakesMade++

      if (state.mistakesMade > state.mistakesAllowed) {
        // Game over
        console.log(`❌ Simon game over! Score: ${state.score} (High Score: ${state.highScore})`)
        state.state = GameState.GAME_OVER
        this.gameOverAnimation(output)
      } else {
        // Still have mistakes left
        console.log(`⚠️ Wrong button! Mistakes: ${state.mistakesMade}/${state.mistakesAllowed + 1}`)

        // Show error animation
        this.showErrorAnimation(output, control, () => {
          // Show sequence again to help the player
          state.state = GameState.DISPLAYING_SEQUENCE
          setTimeout(() => this.displaySequence(output), 500)
        })
      }
    }
  }

  private showLevelCompleteAnimation(output: Output, callback: () => void) {
    // Spiral animation from center outward
    const spiralOrder = [5, 6, 9, 10, 1, 2, 4, 7, 8, 11, 13, 14, 0, 3, 12, 15]
    let step = 0

    const showNext = () => {
      if (step < spiralOrder.length) {
        const control = spiralOrder[step]
        const color = state.colorValues[step % state.colorValues.length]
        setLed(output, control, color)
        step++
        displayTimer = setTimeout(showNext, 50)
      } else {
        // Short pause at full brightness
        displayTimer = setTimeout(() => {
          clearLeds(output, simonControlsArray)
          displayTimer = null
          callback()
        }, 300)
      }
    }

    clearLeds(output, simonControlsArray)
    showNext()
  }

  private showErrorAnimation(output: Output, wrongControl: number, callback: () => void) {
    const expectedControl = state.sequence[state.userPosition]

    // Flash wrong button in red-like color
    const flashWrong = (times: number) => {
      if (times <= 0) {
        // Then show the correct button
        setLed(output, expectedControl, 127)
        setTimeout(() => {
          setLed(output, expectedControl, 0)
          callback()
        }, 800)
        return
      }

      setLed(output, wrongControl, 127) // Red-like
      setTimeout(() => {
        setLed(output, wrongControl, 0)
        setTimeout(() => flashWrong(times - 1), 200)
      }, 200)
    }

    flashWrong(2)
  }

  private gameOverAnimation(output: Output) {
    // Animate from outer to inner
    const animationOrder = [
      [0, 1, 2, 3, 12, 13, 14, 15, 4, 7, 8, 11], // Outer ring
      [5, 6, 9, 10], // Inner squares
    ]

    const showFinalScore = () => {
      clearLeds(output, simonControlsArray)

      // Display score and high score using binary representation
      setTimeout(() => {
        const scoreBinary = state.score.toString(2).padStart(8, "0")
        const highScoreBinary = state.highScore.toString(2).padStart(8, "0")

        // Top row shows score
        for (let i = 0; i < 8; i++) {
          if (scoreBinary[i] === "1") {
            setLed(output, i, 64) // Green for score
          }
        }

        // Bottom row shows high score
        for (let i = 0; i < 8; i++) {
          if (highScoreBinary[i] === "1") {
            setLed(output, i + 8, 16) // Blue for high score
          }
        }

        console.log(`🎮 Game over! Score: ${state.score}, High Score: ${state.highScore}`)
        console.log(`   Press any button to return to difficulty selection`)
      }, 500)
    }

    const fadeOutRing = (ringIndex: number) => {
      if (ringIndex >= animationOrder.length) {
        showFinalScore()
        return
      }

      const ring = animationOrder[ringIndex]
      let brightness = 127

      // Flash the ring
      const fadeStep = () => {
        if (brightness <= 0) {
          ring.forEach((control) => setLed(output, control, 0))
          fadeOutRing(ringIndex + 1)
          return
        }

        ring.forEach((control) => setLed(output, control, brightness))
        brightness -= 10
        displayTimer = setTimeout(fadeStep, 50)
      }

      fadeStep()
    }

    // Start the animation
    fadeOutRing(0)
  }
}
