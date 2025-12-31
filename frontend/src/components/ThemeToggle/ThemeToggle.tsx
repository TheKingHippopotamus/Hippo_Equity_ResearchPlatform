import React from 'react';
import './ThemeToggle.css';

export type ThemeId = 'luxury' | 'minimal' | 'tech';

const THEME_OPTIONS: Array<{ id: ThemeId; name: string; description: string }> = [
  { id: 'minimal', name: 'Minimal', description: 'Research Terminal' },
  { id: 'luxury', name: 'Luxury', description: 'Editorial' },
  { id: 'tech', name: 'Tech', description: 'Forward' },
];

interface ThemeToggleProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ value, onChange }) => {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme selection">
      <span className="theme-toggle-label">Theme</span>
      <div className="theme-toggle-options">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`theme-toggle-option ${value === option.id ? 'active' : ''}`}
            onClick={() => onChange(option.id)}
            role="radio"
            aria-checked={value === option.id}
          >
            <span className={`theme-toggle-swatch swatch-${option.id}`} aria-hidden="true" />
            <span className="theme-toggle-text">
              <span className="theme-toggle-title">{option.name}</span>
              <span className="theme-toggle-sub">{option.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeToggle;
