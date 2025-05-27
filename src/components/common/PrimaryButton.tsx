import React from 'react';

type PrimaryButtonProps = {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string; // Allow additional classes
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, onClick, disabled, type = 'button', className = '' }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${className}`} // Using theme color 'primary', hover:opacity-90. Padding changed to px-4.
    >
      {label}
    </button>
  );
};

export default PrimaryButton;
