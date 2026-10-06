import type { ComponentPropsWithRef } from 'react'
import { cn } from './cn'

const cols = ['tw:col-span-12','tw:col-span-1','tw:col-span-2','tw:col-span-3','tw:col-span-4','tw:col-span-5','tw:col-span-6','tw:col-span-7','tw:col-span-8','tw:col-span-9','tw:col-span-10','tw:col-span-11','tw:col-span-12']
const large = ['','tw:min-[992px]:col-span-1','tw:min-[992px]:col-span-2','tw:min-[992px]:col-span-3','tw:min-[992px]:col-span-4','tw:min-[992px]:col-span-5','tw:min-[992px]:col-span-6','tw:min-[992px]:col-span-7','tw:min-[992px]:col-span-8','tw:min-[992px]:col-span-9','tw:min-[992px]:col-span-10','tw:min-[992px]:col-span-11','tw:min-[992px]:col-span-12']

export function GridRow({ className, ...props }: ComponentPropsWithRef<'div'>) { return <div {...props} className={cn('tw:grid tw:grid-cols-12 tw:gap-6', className)} /> }
export function GridCol({ xs = 12, lg, className, ...props }: ComponentPropsWithRef<'div'> & { xs?: number; lg?: number }) { return <div {...props} className={cn('tw:min-w-0', cols[xs], lg && large[lg], className)} /> }