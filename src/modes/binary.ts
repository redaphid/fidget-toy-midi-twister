import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// Game states
const BinaryGameState = {
  SETUP: "SETUP",
  PLAYING: "PLAYING",
  GAME_OVER: "GAME_OVER",
} as const

type BinaryGameStateType = (typeof BinaryGameState)[keyof typeof BinaryGameState]

// Game modes
const BinaryGameMode = {
  BINARY_COUNTER: "Binary Counter",
  BINARY_PUZZLE: "Binary Puzzle",
  BINARY_MEMORY: "Binary Memory",
} as const

type BinaryGameModeType = (typeof BinaryGameMode)[keyof typeof BinaryGameMode]

// Persistent binary game state
interface BinaryState {
  mode: BinaryGameModeType
  gameState: BinaryGameStateType
  counter: number
  targetNumber: number
  userBits: boolean[]
  score: number
  highScore: number
  timeLimit: number
  lastUpdateTime: number
  level: number
  lives: number
  autoIncrement: boolean
  incrementSpeed: number
}

const DEFAULT_INCREMENT_SPEED = 1000 // ms
const MAX_BINARY_VALUE = 255 // 8-bit max (0-255)
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)
const BINARY_KNOBS = Array.from({ length: 8 }, (_, i) => i)
const MODE_SELECTION_KNOBS = [12, 13, 14] // Knobs for selecting mode
const SPEED_CONTROL_KNOB = 15 // Knob for controlling speed
const START_BUTTON = 11 // Button to start game

// Animation timers
let displayTimer: NodeJS.Timeout | null = null
let gameTimer: NodeJS.Timeout | null = null
let incrementTimer: NodeJS.Timeout | null = null

// Initialize state
const state: BinaryState = {
  mode: BinaryGameMode.BINARY_COUNTER,
  gameState: BinaryGameState.SETUP,
  counter: 0,
  targetNumber: 0,
  userBits: Array(8).fill(false),
  score: 0,
  highScore: 0,
  timeLimit: 10000, // 10 seconds initially
  lastUpdateTime: 0,
  level: 1,
  lives: 3,
  autoIncrement: true,
  incrementSpeed: DEFAULT_INCREMENT_SPEED,
}

export class BinaryMode implements FidgetModeInterface {
  getName(): FidgetModeName {
    return "binary"
  }

  activate(output: Output): void {
    console.log("🔢 Activating Binary Game Mode")
    this.deactivate(output) // Clear any previous state

    // Reset the state while preserving high score
    const highScore = state.highScore
    Object.assign(state, {
      mode: BinaryGameMode.BINARY_COUNTER,
      gameState: BinaryGameState.SETUP,
      counter: 0,
      targetNumber: 0,
      userBits: Array(8).fill(false),
      score: 0,
      highScore,
      timeLimit: 10000,
      lastUpdateTime: Date.now(),
      level: 1,
      lives: 3,
      autoIncrement: true,
      incrementSpeed: DEFAULT_INCREMENT_SPEED,
    })

    // Clear all LEDs and show setup screen
    clearLeds(output, ALL_KNOBS)
    this.showModeSelection(output)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Record the time of the last interaction
    state.lastUpdateTime = Date.now()

    if (state.gameState === BinaryGameState.SETUP) {
      // In setup mode, use knobs to select game mode and speed
      if (MODE_SELECTION_KNOBS.includes(control)) {
        const modeIndex = MODE_SELECTION_KNOBS.indexOf(control)
        const gameModes = Object.values(BinaryGameMode)
        if (modeIndex < gameModes.length) {
          state.mode = gameModes[modeIndex]
          this.showModeSelection(output)
        }
      } else if (control === SPEED_CONTROL_KNOB) {
        // Map knob 15 to increment speed (250ms to 2000ms)
        state.incrementSpeed = 2000 - Math.floor((value / 127) * 1750)

        // Update speed indicator
        const brightness = Math.floor((value / 127) * 127)
        setLed(output, SPEED_CONTROL_KNOB, brightness)

        console.log(`🔢 Speed set to ${state.incrementSpeed}ms between increments`)
      }
    } else if (state.gameState === BinaryGameState.PLAYING) {
      if (state.mode === BinaryGameMode.BINARY_PUZZLE || state.mode === BinaryGameMode.BINARY_MEMORY) {
        // In puzzle or memory mode, turning a knob sets that bit
        if (BINARY_KNOBS.includes(control)) {
          // Map 0-127 to boolean (off/on)
          const isOn = value > 64

          // Only update if changed
          if (state.userBits[control] !== isOn) {
            state.userBits[control] = isOn
            setLed(output, control, isOn ? 127 : 0)

            // In puzzle mode, check if the binary value matches target
            if (state.mode === BinaryGameMode.BINARY_PUZZLE) {
              this.checkPuzzleSolution(output)
            }
          }
        }
      }
    }

    return true
  }

  handleButtonPress(output: Output, control: number): boolean {
    // Record the time of the last interaction
    state.lastUpdateTime = Date.now()

    if (state.gameState === BinaryGameState.SETUP) {
      // In setup mode, pressing mode selection buttons selects that mode
      if (MODE_SELECTION_KNOBS.includes(control)) {
        const modeIndex = MODE_SELECTION_KNOBS.indexOf(control)
        const gameModes = Object.values(BinaryGameMode)
        if (modeIndex < gameModes.length) {
          state.mode = gameModes[modeIndex]
          this.showModeSelection(output)
        }
      } else if (control === START_BUTTON || BINARY_KNOBS.includes(control)) {
        // Start game when pressing start button or any binary knob
        this.startSelectedMode(output)
      }
    } else if (state.gameState === BinaryGameState.PLAYING) {
      if (state.mode === BinaryGameMode.BINARY_COUNTER) {
        // In counter mode, any button press toggles auto increment
        state.autoIncrement = !state.autoIncrement
        console.log(`🔢 Auto-increment ${state.autoIncrement ? "enabled" : "disabled"}`)

        if (state.autoIncrement) {
          this.startAutoIncrement(output)
        } else if (incrementTimer) {
          clearTimeout(incrementTimer)
          incrementTimer = null
        }
      } else if (state.mode === BinaryGameMode.BINARY_PUZZLE) {
        // In puzzle mode, button press toggles the bit
        if (BINARY_KNOBS.includes(control)) {
          state.userBits[control] = !state.userBits[control]
          setLed(output, control, state.userBits[control] ? 127 : 0)

          // Check if solution is correct
          this.checkPuzzleSolution(output)
        }
      } else if (state.mode === BinaryGameMode.BINARY_MEMORY) {
        // In memory mode, button press submits the answer
        if (control === START_BUTTON) {
          this.checkMemorySolution(output)
        } else if (BINARY_KNOBS.includes(control)) {
          // Toggle bits with button press
          state.userBits[control] = !state.userBits[control]
          setLed(output, control, state.userBits[control] ? 127 : 0)
        }
      }
    } else if (state.gameState === BinaryGameState.GAME_OVER) {
      // Any button press in game over restarts
      this.resetToSetup(output)
    }

    return true // We handled the button press
  }

  // --- Helper methods ---

  private resetToSetup(output: Output) {
    state.gameState = BinaryGameState.SETUP
    this.showModeSelection(output)
  }

  private showModeSelection(output: Output) {
    // Clear all LEDs
    clearLeds(output, ALL_KNOBS)

    // Light up the available game modes with different colors
    const gameModes = Object.values(BinaryGameMode)
    for (let i = 0; i < gameModes.length; i++) {
      const isSelected = gameModes[i] === state.mode
      // Each mode gets a different color
      const color = 30 + i * 30
      setLed(output, MODE_SELECTION_KNOBS[i], isSelected ? 127 : color)
    }

    // Light up start button
    setLed(output, START_BUTTON, 64)

    // Light up speed knob with current speed value
    const speedValue = Math.floor(((2000 - state.incrementSpeed) / 1750) * 127)
    setLed(output, SPEED_CONTROL_KNOB, speedValue)

    console.log(`🔢 Binary Game Setup - Selected mode: ${state.mode}`)
    console.log(`   Turn knobs ${MODE_SELECTION_KNOBS.join(",")} to select mode`)
    console.log(`   Turn knob ${SPEED_CONTROL_KNOB} to adjust speed`)
    console.log(`   Press button ${START_BUTTON} to start`)
  }

  private startSelectedMode(output: Output) {
    clearLeds(output, ALL_KNOBS)
    state.gameState = BinaryGameState.PLAYING
    state.counter = 0
    state.userBits = Array(8).fill(false)
    state.score = 0
    state.level = 1
    state.lives = 3

    console.log(`🔢 Starting ${state.mode} game mode`)

    // Initialize game based on selected mode
    switch (state.mode) {
      case BinaryGameMode.BINARY_COUNTER:
        this.startBinaryCounter(output)
        break
      case BinaryGameMode.BINARY_PUZZLE:
        this.startBinaryPuzzle(output)
        break
      case BinaryGameMode.BINARY_MEMORY:
        this.startBinaryMemory(output)
        break
    }
  }

  // --- Binary Counter Mode ---

  private startBinaryCounter(output: Output) {
    state.counter = 0
    this.displayBinaryValue(output, state.counter)

    if (state.autoIncrement) {
      this.startAutoIncrement(output)
    }

    console.log(`🔢 Binary Counter started at 0`)
    console.log(`   Press any button to toggle auto-increment`)
  }

  private startAutoIncrement(output: Output) {
    // Clear any existing timer
    if (incrementTimer) {
      clearTimeout(incrementTimer)
    }

    // Set timer to increment counter
    incrementTimer = setInterval(() => {
      this.incrementCounter(output)
    }, state.incrementSpeed)
  }

  private incrementCounter(output: Output) {
    // Increment counter and wrap around at MAX_BINARY_VALUE
    state.counter = (state.counter + 1) % (MAX_BINARY_VALUE + 1)
    this.displayBinaryValue(output, state.counter)
  }

  private displayBinaryValue(output: Output, value: number) {
    // Convert number to 8-bit binary and light up corresponding LEDs
    for (let i = 0; i < 8; i++) {
      const bitValue = (value >> i) & 1
      setLed(output, i, bitValue ? 127 : 0)
    }

    // When in counter mode, also display the decimal value
    if (state.mode === BinaryGameMode.BINARY_COUNTER) {
      // Display the decimal value in the top row (optional)
      const decimalDigits = value.toString().padStart(3, "0")
      console.log(`🔢 Binary: ${value.toString(2).padStart(8, "0")} (${value})`)
    }
  }

  // --- Binary Puzzle Mode ---

  private startBinaryPuzzle(output: Output) {
    // Reset state for puzzle
    state.userBits = Array(8).fill(false)
    state.targetNumber = Math.floor(Math.random() * (MAX_BINARY_VALUE + 1))
    state.timeLimit = 10000 - state.level * 500 // Reduce time as level increases

    // Display initial state - all bits off for user input
    BINARY_KNOBS.forEach((knob) => setLed(output, knob, 0))

    // Show target number visually using top row
    this.showTargetHint(output)

    // Start timer
    this.startPuzzleTimer(output)

    console.log(`🔢 Binary Puzzle Level ${state.level}: Convert decimal ${state.targetNumber} to binary`)
    console.log(`   Turn knobs or press buttons 0-7 to toggle bits`)
    console.log(`   Time remaining: ${state.timeLimit / 1000}s`)
  }

  private showTargetHint(output: Output) {
    // Clear hint area
    for (let i = 8; i < 12; i++) {
      setLed(output, i, 0)
    }

    // Show target number visually using knobs 8-11
    // We can encode the digits in binary or some other visual representation
    const targetStr = state.targetNumber.toString().padStart(3, "0")

    // Flash the target number
    let flashCount = 0
    const flashTarget = () => {
      if (flashCount >= 6 || state.gameState !== BinaryGameState.PLAYING) {
        return
      }

      const isOn = flashCount % 2 === 0
      const brightness = isOn ? 64 : 0

      // Show digits in top row
      for (let i = 8; i < 12; i++) {
        // Each LED can represent part of the target number
        const digitPosition = i - 8
        if (digitPosition < targetStr.length) {
          const digitValue = parseInt(targetStr[digitPosition])
          setLed(output, i, isOn ? digitValue * 15 : 0)
        }
      }

      flashCount++
      setTimeout(flashTarget, 300)
    }

    flashTarget()
  }

  private startPuzzleTimer(output: Output) {
    // Clear any existing timer
    if (gameTimer) {
      clearTimeout(gameTimer)
    }

    const startTime = Date.now()
    const updateTimer = () => {
      if (state.gameState !== BinaryGameState.PLAYING || state.mode !== BinaryGameMode.BINARY_PUZZLE) {
        return
      }

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, state.timeLimit - elapsed)

      // Update visual timer every 100ms
      if (remaining > 0) {
        // Calculate progress 0-1
        const progress = remaining / state.timeLimit

        // Visualize remaining time with LED brightness
        const brightness = Math.floor(progress * 127)
        setLed(output, START_BUTTON, brightness)

        // Continue timer
        gameTimer = setTimeout(updateTimer, 100)
      } else {
        // Time's up!
        this.handlePuzzleTimeout(output)
      }
    }

    // Start the timer
    gameTimer = setTimeout(updateTimer, 100)
  }

  private checkPuzzleSolution(output: Output) {
    // Convert userBits to number
    const userValue = state.userBits.reduce((acc, bit, index) => {
      return acc + (bit ? Math.pow(2, index) : 0)
    }, 0)

    if (userValue === state.targetNumber) {
      // Correct answer!
      console.log(`🔢 Correct! ${state.targetNumber} = ${state.targetNumber.toString(2).padStart(8, "0")}`)

      // Increase score and level
      state.score += Math.floor(state.level * 10)
      state.level++

      // Show success animation
      this.showSuccessAnimation(output, () => {
        // Start next puzzle after animation
        this.startBinaryPuzzle(output)
      })
    }
  }

  private handlePuzzleTimeout(output: Output) {
    console.log(`🔢 Time's up! The correct binary for ${state.targetNumber} was ${state.targetNumber.toString(2).padStart(8, "0")}`)

    // Lose a life
    state.lives--

    if (state.lives <= 0) {
      // Game over
      this.gameOver(output)
    } else {
      // Show timeout animation
      this.showTimeoutAnimation(output, () => {
        // Start next puzzle after animation
        this.startBinaryPuzzle(output)
      })
    }
  }

  // --- Binary Memory Mode ---

  private startBinaryMemory(output: Output) {
    // Generate a random number to memorize
    state.targetNumber = Math.floor(Math.random() * (Math.pow(2, state.level) - 1) + 1)
    state.userBits = Array(8).fill(false)

    // Reset LEDs
    clearLeds(output, ALL_KNOBS)

    // Show submit button
    setLed(output, START_BUTTON, 64)

    // Show the target number briefly
    this.displayBinaryValue(output, state.targetNumber)
    console.log(`🔢 Memorize this binary: ${state.targetNumber.toString(2).padStart(8, "0")}`)

    // After a delay, clear the display and wait for user input
    const viewTime = Math.max(3000 - state.level * 200, 1000) // Less time as level increases
    setTimeout(() => {
      // Clear the binary display
      BINARY_KNOBS.forEach((knob) => setLed(output, knob, 0))
      console.log(`🔢 Now enter the binary number and press button ${START_BUTTON} to submit`)
    }, viewTime)
  }

  private checkMemorySolution(output: Output) {
    // Convert userBits to number
    const userValue = state.userBits.reduce((acc, bit, index) => {
      return acc + (bit ? Math.pow(2, index) : 0)
    }, 0)

    if (userValue === state.targetNumber) {
      // Correct answer!
      console.log(`🔢 Correct! ${state.targetNumber} = ${state.targetNumber.toString(2).padStart(8, "0")}`)

      // Increase score and level
      state.score += state.level * 5
      state.level++

      // Update high score if needed
      if (state.score > state.highScore) {
        state.highScore = state.score
      }

      // Show success animation
      this.showSuccessAnimation(output, () => {
        // Start next memory challenge
        this.startBinaryMemory(output)
      })
    } else {
      // Wrong answer
      console.log(`🔢 Wrong! You entered: ${userValue.toString(2).padStart(8, "0")}`)
      console.log(`   Correct was: ${state.targetNumber.toString(2).padStart(8, "0")}`)

      // Lose a life
      state.lives--

      if (state.lives <= 0) {
        // Game over
        this.gameOver(output)
      } else {
        // Show the correct answer
        this.displayBinaryValue(output, state.targetNumber)

        // Show mistake animation
        this.showMistakeAnimation(output, () => {
          // Start next memory challenge
          this.startBinaryMemory(output)
        })
      }
    }
  }

  // --- Game Animations ---

  private showSuccessAnimation(output: Output, callback: () => void) {
    let step = 0
    const runStep = () => {
      if (step >= 8 || state.gameState !== BinaryGameState.PLAYING) {
        if (callback) callback()
        return
      }

      // Light up all bits
      BINARY_KNOBS.forEach((knob) => {
        const brightness = step % 2 === 0 ? 127 : 0
        setLed(output, knob, brightness)
      })

      step++
      displayTimer = setTimeout(runStep, 100)
    }

    // Start animation
    if (displayTimer) clearTimeout(displayTimer)
    runStep()
  }

  private showTimeoutAnimation(output: Output, callback: () => void) {
    // Flash the correct answer
    let step = 0
    const runStep = () => {
      if (step >= 6 || state.gameState !== BinaryGameState.PLAYING) {
        // Display correct answer
        this.displayBinaryValue(output, state.targetNumber)

        setTimeout(() => {
          if (callback) callback()
        }, 1000)
        return
      }

      const isOn = step % 2 === 0

      // Toggle between showing correct answer and blank
      if (isOn) {
        this.displayBinaryValue(output, state.targetNumber)
      } else {
        BINARY_KNOBS.forEach((knob) => setLed(output, knob, 0))
      }

      step++
      displayTimer = setTimeout(runStep, 300)
    }

    // Start animation
    if (displayTimer) clearTimeout(displayTimer)
    runStep()
  }

  private showMistakeAnimation(output: Output, callback: () => void) {
    // Flash the incorrect bits
    let step = 0
    const runStep = () => {
      if (step >= 6 || state.gameState !== BinaryGameState.PLAYING) {
        if (callback) callback()
        return
      }

      const isOn = step % 2 === 0

      // Highlight wrong bits
      BINARY_KNOBS.forEach((knob) => {
        const correctBit = ((state.targetNumber >> knob) & 1) === 1
        const userBit = state.userBits[knob]

        if (correctBit !== userBit) {
          // This bit is wrong
          setLed(output, knob, isOn ? 127 : 0)
        } else {
          // This bit is correct
          setLed(output, knob, correctBit ? 64 : 0)
        }
      })

      step++
      displayTimer = setTimeout(runStep, 300)
    }

    // Start animation
    if (displayTimer) clearTimeout(displayTimer)
    runStep()
  }

  private gameOver(output: Output) {
    state.gameState = BinaryGameState.GAME_OVER

    console.log(`🔢 Game Over! Score: ${state.score}, High Score: ${state.highScore}`)
    console.log(`   Level Reached: ${state.level}`)

    // Update high score if needed
    if (state.score > state.highScore) {
      state.highScore = state.score
    }

    // Show game over animation
    let step = 0
    const totalSteps = 16

    const animate = () => {
      if (step >= totalSteps || state.gameState !== BinaryGameState.GAME_OVER) {
        // After animation, display score in binary
        this.displayBinaryValue(output, state.score)

        // Show high score indicator
        for (let i = 8; i < 12; i++) {
          setLed(output, i, 32) // Medium brightness
        }

        console.log(`   Press any button to return to mode selection`)
        return
      }

      // Circle animation
      const LEDOrder = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4, 5, 6, 10, 9]
      // Turn on one LED at a time in sequence
      ALL_KNOBS.forEach((knob) => {
        setLed(output, knob, LEDOrder[step] === knob ? 127 : 0)
      })

      step++
      displayTimer = setTimeout(animate, 100)
    }

    // Start animation
    if (displayTimer) clearTimeout(displayTimer)
    animate()
  }

  deactivate(output: Output): void {
    console.log("🔢 Deactivating Binary Game Mode")

    // Clear all timers
    if (displayTimer) {
      clearTimeout(displayTimer)
      displayTimer = null
    }

    if (gameTimer) {
      clearTimeout(gameTimer)
      gameTimer = null
    }

    if (incrementTimer) {
      clearTimeout(incrementTimer)
      incrementTimer = null
    }

    // Clear all LEDs
    clearLeds(output, ALL_KNOBS)
  }
}
