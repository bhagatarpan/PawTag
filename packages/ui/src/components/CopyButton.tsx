import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  size?: number;
}

/**
 * Reusable copy-to-clipboard button.
 * Shows a brief checkmark animation after copying.
 *
 * Design tokens (from DESIGN.md):
 * - Default: text-gray-400 hover:text-primary-600
 * - Active: text-green-500
 * - Transition: transition-colors duration-150
 * - Spacing: ml-1.5 (gap between ID text and icon)
 */
export function CopyButton({ text, label = 'Copied to clipboard', className = '', size = 12 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Brief visual feedback
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center transition-colors duration-150 ${
        copied
          ? 'text-green-500'
          : 'text-gray-400 hover:text-primary-600'
      } ${className}`}
      title={label}
      aria-label={label}
      type="button"
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
