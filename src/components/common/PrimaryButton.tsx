import React from 'react';

type PrimaryButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, onClick, disabled, type = 'button' }) => {
  return (
    <button type={type} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

export default PrimaryButton;
