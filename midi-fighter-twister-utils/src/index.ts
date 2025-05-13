export * from "./constants"
export * from "./midiUtils"

// You could potentially add a class wrapper here in the future
// if managing the Output instance becomes more complex.
// For example:
/*
import { type Output } from "@julusian/midi";
import * as midiUtils from "./midiUtils";
import * as constants from "./constants";

export class TwisterController {
    private output: Output;

    constructor(output: Output) {
        this.output = output;
    }

    setLed(knobIndex: number, value: number): void {
        midiUtils.setLed(this.output, knobIndex, value);
    }

    clearLeds(knobs: number[]): void {
        midiUtils.clearLeds(this.output, knobs);
    }

    clearAllLeds(): void {
        midiUtils.clearAllLeds(this.output);
    }

    // Add other methods as needed
}

// Also export constants and raw functions if desired
export { constants, midiUtils };
*/
