'use client'
import { createContext, useContext, type ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const TabStyle = createContext<'pills' | 'underline-border'>('underline-border')

export function Tabs({ variant = 'underline-border', as: _as, className, onKeyDown, children, ...props }: ComponentPropsWithRef<'nav'> & { variant?: 'pills' | 'underline-border'; as?: string }) {
  void _as
  return <TabStyle.Provider value={variant}><nav {...props} onKeyDown={event => {
    onKeyDown?.(event)
    if (event.defaultPrevented || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0 || !buttons.length) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus(); buttons[next]?.click()
  }} className={cn('tw:flex tw:flex-wrap tw:gap-2', variant === 'underline-border' && 'tw:border-b tw:border-border', className)}>{children}</nav></TabStyle.Provider>
}
export function Tab({ active, as: _as, className, type = 'button', ...props }: ComponentPropsWithRef<'button'> & { active?: boolean; as?: string }) {
  void _as
  const variant = useContext(TabStyle)
  return <button {...props} type={type} data-active={active || undefined} className={cn('tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:bg-transparent tw:text-base tw:font-medium tw:leading-relaxed tw:disabled:opacity-50 tw:focus:outline-none tw:focus:ring-2 tw:focus:ring-primary/30 tw:focus:ring-offset-2 tw:transition-colors', variant === 'pills' ? 'tw:w-full tw:rounded-lg tw:px-4 tw:py-3 tw:text-left tw:hover:bg-primary/5 tw:data-[active]:bg-primary/10 tw:data-[active]:font-semibold tw:data-[active]:text-primary' : 'tw:-mb-px tw:border-b-2 tw:border-transparent tw:px-1 tw:py-3 tw:text-muted-foreground tw:hover:text-foreground tw:data-[active]:border-primary tw:data-[active]:font-semibold tw:data-[active]:text-foreground', className)} />
}