import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  as?: 'input' | 'select' | 'textarea';
  children?: React.ReactNode;
  icon?: any;
  className?: string;
  placeholder?: string;
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  required?: boolean;
  type?: string;
  rows?: number;
  readOnly?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function FormField({ 
  label, 
  error, 
  className, 
  as = 'input', 
  children,
  icon: Icon,
  type,
  disabled,
  ...props 
}: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const Component = as as any;
  
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2 px-1">
        {label}
      </label>
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <Component
          type={inputType}
          disabled={disabled}
          className={cn(
            "w-full bg-slate-50 border rounded-xl text-[10px] font-black uppercase tracking-tight transition-all focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none placeholder:text-slate-400 placeholder:font-bold placeholder:tracking-widest",
            Icon ? "pl-11 pr-4" : "px-4",
            isPassword ? "pr-11" : "",
            "py-2.5",
            error ? "border-red-500 focus:ring-red-500" : "border-slate-200 focus:border-blue-500",
            disabled && "opacity-50 cursor-not-allowed bg-slate-100"
          )}
          {...props}
        >
          {children}
        </Component>
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}
