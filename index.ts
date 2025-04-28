// midi_indicator_only.ts

import midi from 'midi';

const input  = new midi.Input();
const output = new midi.Output();

// map “channel:control” → “knob_<n>”
const seen = new Map<string,string>();
let counter = 1;

// MIDI status bytes
const CC = 0xB0;      // Control Change base
const LED_CH = 1;     // zero-based: 0=Ch1 (ring), 1=Ch2 (indicator)

// — connect to your Twister ports —
function findPort(ports: midi.Input|midi.Output, name: string) {
  for (let i = 0; i < ports.getPortCount(); i++) {
    if (ports.getPortName(i).includes(name)) return i;
  }
  return -1;
}
const inPort  = findPort(input,  'Midi Fighter Twister');
const outPort = findPort(output, 'Midi Fighter Twister');
if (inPort < 0 || outPort < 0) {
  console.error('Midi Fighter Twister not found.');
  process.exit(1);
}
input.openPort(inPort);
output.openPort(outPort);
input.ignoreTypes(false, false, false);

// — on every incoming CC from any channel —
input.on('message', (_dt, [status, control, value]) => {
  if ((status & 0xF0) !== CC) return;     // only CC messages
  const chan = status & 0x0F;
  const key  = `${chan}:${control}`;
  if (!seen.has(key)) {
    seen.set(key, `knob_${counter++}`);
    console.log(`🆕 ${key} → ${seen.get(key)}`);
  }
  console.log(`🔄 ${seen.get(key)} = ${value}`);

  // send override CC on Channel 2 to control the **indicator LED**  [oai_citation:0‡techtools.zendesk.com](https://techtools.zendesk.com/hc/en-us/articles/16809770523917-Midi-Fighter-Twister-channel-settings?utm_source=chatgpt.com)
  const msg = [ CC | LED_CH, control, value ];
  output.sendMessage(msg);
  console.log('→ Sent indicator override:', msg);
});

// — cleanup —
process.once('SIGINT', () => {
  input.closePort();
  output.closePort();
  process.exit(0);
});