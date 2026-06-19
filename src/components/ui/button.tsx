import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl'

    const variants = {
      primary: 'bg-rose-400 hover:bg-rose-500 text-white focus:ring-rose-300 shadow-sm',
      secondary: 'bg-pink-100 hover:bg-pink-200 text-rose-700 focus:ring-pink-200',
      outline: 'border border-rose-300 text-rose-600 hover:bg-rose-50 focus:ring-rose-200 bg-white',
      ghost: 'text-gray-600 hover:bg-gray-100 focus:ring-gray-200',
      danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-300',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5 min-h-11',
      md: 'px-4 py-2.5 text-sm gap-2 min-h-11',
      lg: 'px-6 py-3 text-base gap-2 min-h-11',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
