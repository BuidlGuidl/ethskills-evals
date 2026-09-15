import { ARMS, ARM_LABELS, type Arm } from "../lib/grid.js";

export const ArmSwitch = ({ arm, onChange }: { arm: Arm; onChange: (arm: Arm) => void }) => (
  <div className="arm-switch" role="group" aria-label="Skill used">
    {ARMS.map(value => <button key={value} type="button" aria-pressed={arm === value}
      onClick={() => onChange(value)}>{ARM_LABELS[value]}</button>)}
  </div>
);
