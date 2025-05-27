import React from 'react';

type InputFieldProps = {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string; // Only for input type='text', 'email', 'password', etc.
  placeholder?: string;
  required?: boolean;
  as?: 'input' | 'textarea';
  rows?: number;
  disabled?: boolean; // Added disabled prop as it was in PrimaryButton
  name?: string; // Standard HTML attribute
};

const InputField: React.FC<InputFieldProps> = ({
  label,
  id,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  as = 'input',
  rows = 3,
  disabled,
  name,
}) => {
  const commonProps = {
    id,
    name: name || id, // Default name to id if not provided
    value,
    onChange,
    placeholder,
    required,
    disabled,
    className: 'mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none invalid:border-pink-500 invalid:text-pink-600 focus:invalid:border-pink-500 focus:invalid:ring-pink-500', // Using theme color 'primary'
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {as === 'textarea' ? (
        <textarea {...commonProps} rows={rows} />
      ) : (
        <input type={type} {...commonProps} />
      )}
    </div>
  );
};

export default InputField;
