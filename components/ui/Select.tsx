'use client'
import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { children: React.ReactNode }
const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className = '', children, ...props }, ref) => <div className="relative"><select ref={ref} className={`h-10 appearance-none rounded-lg border border-input bg-card py-2 pl-3 pr-9 text-sm text-foreground transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></div>)
Select.displayName = 'Select'
export default Select
