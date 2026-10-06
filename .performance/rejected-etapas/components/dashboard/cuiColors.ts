'use client'
import { getStyle } from '@coreui/utils'
export interface CuiColors {primary:string;success:string;info:string;warning:string;danger:string;secondary:string;body:string;muted:string;grid:string}
/** Chart.js needs resolved colors. Cards and canvas share the CoreUI tokens. */
export function cuiColors():CuiColors {
 const root=typeof document==='undefined'?undefined:document.querySelector<HTMLElement>('.coreui-scope')??document.documentElement
 const read=(name:string)=>root?(getStyle('--cui-'+name,root)??''):''
 return {primary:read('primary'),success:read('success'),info:read('info'),warning:read('warning'),danger:read('danger'),secondary:read('secondary'),body:read('body-color'),muted:read('secondary-color'),grid:read('border-color-translucent')}
}
