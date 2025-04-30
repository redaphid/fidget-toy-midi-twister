import { Output } from "@julusian/midi"
import { type FidgetModeInterface, type FidgetModeName, setLed, clearLeds } from "./interface.ts"

// State specific to Fibonacci Mode
let fibTimer: NodeJS.Timeout | null = null
let fibPosition = 0
let normalizedFib: number[] = []
let fibSpeed = 300 // ms update interval
const ALL_KNOBS = Array.from({ length: 16 }, (_, i) => i)

// Pre-calculate normalized Fibonacci sequence
function calculateFibonacci(count: number = 20) {
  const fib = [0, 1]
  for (let i = 2; i < count; i++) {
    fib[i] = fib[i - 1] + fib[i - 2]
  }
  const max = Math.max(...fib)
  normalizedFib = max > 0 ? fib.map((n) => Math.floor((n / max) * 127)) : fib.map(() => 0)
}
calculateFibonacci() // Calculate on module load

export class FibonacciMode implements FidgetModeInterface {
  constructor() {
    calculateFibonacci() // Calculate on instantiation
  }

  getName(): FidgetModeName {
    return "fibonacci"
  }

  activate(output: Output): void {
    console.log(`🌀 Activating Fibonacci mode on all knobs`)
    this.deactivate(output)
    fibPosition = 0
    fibSpeed = 300 // Reset speed

    if (normalizedFib.length === 0) calculateFibonacci()
    this.startFibInterval(output)
  }

  private startFibInterval(output: Output) {
    if (fibTimer) clearInterval(fibTimer)

    fibTimer = setInterval(() => {
      ALL_KNOBS.forEach((control, index) => {
        const fibIndex = (fibPosition + index) % normalizedFib.length
        setLed(output, control, normalizedFib[fibIndex])
      })

      fibPosition = (fibPosition + 1) % normalizedFib.length
    }, fibSpeed)
  }

  handleKnobTurn(output: Output, control: number, value: number): boolean {
    // Map 0-127 to 50ms-1000ms interval
    const newSpeed = 50 + ((127 - value) / 127) * 950
    if (Math.abs(newSpeed - fibSpeed) > 10) {
      // Tolerance
      fibSpeed = newSpeed
      console.log(`🌀 Fibonacci speed set to: ${fibSpeed.toFixed(0)}ms`)
      this.startFibInterval(output)
    }
    return true // Handled
  }

  handleButtonPress(output: Output, control: number): boolean {
    return false
  }

  deactivate(output: Output): void {
    console.log("🌀 Deactivated Fibonacci mode")
    if (fibTimer) {
      clearInterval(fibTimer)
      fibTimer = null
    }
    clearLeds(output, ALL_KNOBS)
    fibPosition = 0
    fibSpeed = 300
  }
}
