import React from 'react';

type Props = {
  label?: string;
  color: string;
  onChange: (color: string) => void;
  autoFocus?: boolean;
  id?: string;
};

const ColorPicker: React.FC<Props> = ({ label, color, onChange, autoFocus, id }) => {
  return (
    <div className="flex items-center gap-2">
      {label ? (
        <label htmlFor={id} className="text-xs opacity-75">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        autoFocus={autoFocus}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
        aria-label={label ?? 'Color'}
        title={label ?? 'Color'}
      />
    </div>
  );
};

export default ColorPicker;