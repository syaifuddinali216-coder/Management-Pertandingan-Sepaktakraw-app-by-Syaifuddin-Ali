// Sepaktakraw challenge review types, shared between the Control Panel
// (which picks the type + result) and the TV Display (which shows the
// big colored verdict). Keeping this in one place avoids the two screens
// ever drifting out of sync on labels/colors.
export const CHALLENGE_TYPES = {
  line: {
    label: 'CHALLENGE LINE',
    options: [
      { value: 'in', label: 'IN', color: '#4ade80' },
      { value: 'out', label: 'OUT', color: '#ff3b3b' },
    ],
  },
  net: {
    label: 'CHALLENGE NET',
    options: [
      { value: 'notover', label: 'NOT OVER', color: '#4ade80' },
      { value: 'over', label: 'OVER', color: '#ff3b3b' },
    ],
  },
  service: {
    label: 'CHALLENGE SERVICE',
    options: [
      { value: 'notfault', label: 'NOT FAULT', color: '#4ade80' },
      { value: 'fault', label: 'FAULT', color: '#ff3b3b' },
    ],
  },
}
