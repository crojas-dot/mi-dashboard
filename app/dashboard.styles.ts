// Presentation recipes: keep data/hooks in the view; edit only tw: classes here.
export default {
  "dashboard": "tw:[margin:-16px] tw:p-6 tw:[min-height:calc(100%_+_32px)] tw:bg-background tw:text-base tw:max-[768px]:p-4",
  "heading": "tw:flex tw:items-center tw:justify-between tw:gap-4 tw:mb-5 tw:[&_h1]:[font-size:28px] tw:[&_h1]:font-medium tw:[&_h1]:m-0 tw:[&_p]:[margin:4px_0_0] tw:[&_p]:text-muted tw:max-[768px]:flex-wrap",
  "chartLarge": "tw:[height:300px] tw:relative",
  "chartMedium": "tw:[height:240px] tw:relative",
  "trafficChart": "tw:[height:300px] tw:relative tw:mt-10",
  "donut": "tw:[height:200px] tw:[width:200px] tw:[margin:4px_auto_20px] tw:relative tw:max-[768px]:mx-auto",
  "donutTotal": "tw:absolute tw:inset-0 tw:flex tw:flex-col tw:justify-center tw:items-center tw:pointer-events-none tw:[&_strong]:[font-size:30px] tw:[&_strong]:font-medium tw:[&_strong]:[line-height:1.2] tw:[&_strong]:tabular-nums tw:[&_span]:text-sm tw:[&_span]:text-muted",
  "legend": "tw:flex tw:justify-center tw:flex-wrap tw:[gap:14px_18px] tw:[&_>_span]:flex tw:[&_>_span]:items-center tw:[&_>_span]:gap-2 tw:[&_>_span]:text-sm tw:[&_>_span]:text-foreground tw:[&_i]:w-3 tw:[&_i]:h-3 tw:[&_i]:[border-radius:2px] tw:[&_i]:bg-muted tw:[&_i]:shrink-0 tw:[&_strong]:tabular-nums",
  "folio": "tw:text-primary tw:font-bold tw:[letter-spacing:.01em] tw:whitespace-nowrap tw:no-underline tw:[&:hover]:underline",
  "timeline": "tw:[list-style:none] tw:m-0 tw:[padding:0_0_0_8px] tw:[&_li]:[padding:0_0_24px_20px] tw:[&_li]:[border-left:1px_solid_var(--color-qms-border)] tw:[&_li]:relative tw:[&_li::before]:[content:''] tw:[&_li::before]:absolute tw:[&_li::before]:[width:9px] tw:[&_li::before]:[height:9px] tw:[&_li::before]:bg-primary tw:[&_li::before]:[border-radius:50%] tw:[&_li::before]:[left:-5px] tw:[&_li::before]:[top:7px] tw:[&_li:last-child]:[border-color:transparent] tw:[&_li:last-child]:pb-0 tw:[&_p]:[margin:0_0_6px] tw:[&_time]:text-sm tw:[&_time]:text-muted",
  "empty": "tw:flex tw:flex-col tw:gap-4 tw:justify-center tw:items-center tw:[padding:40px_24px] tw:[min-height:200px] tw:text-muted",
  "emptyTable": "tw:[padding:20px_12px] tw:text-center tw:text-muted",
  "chartNote": "tw:text-muted tw:text-sm tw:[line-height:1.6] tw:[margin:0_0_20px]",
  "breakdownChart": "tw:relative tw:[min-height:210px] tw:w-full",
  "moduleLinks": "tw:grid tw:[grid-template-columns:repeat(auto-fit,_minmax(185px,_1fr))] tw:gap-2",
  "moduleLink": "tw:flex tw:items-center tw:[gap:9px] tw:min-w-0 tw:[padding:8px_10px] tw:[border:1px_solid_var(--color-qms-border)] tw:[border-radius:var(--radius-qms-control)] tw:text-foreground tw:no-underline tw:text-sm tw:[&:hover]:[border-color:var(--color-qms-primary)] tw:[&:hover]:text-primary tw:[&:focus-visible]:[border-color:var(--color-qms-primary)] tw:[&:focus-visible]:text-primary",
  "moduleSwatch": "tw:[width:11px] tw:[height:11px] tw:[border-radius:2px] tw:[flex:none]",
  "moduleValue": "tw:[margin-inline-start:auto] tw:tabular-nums"
} as const
