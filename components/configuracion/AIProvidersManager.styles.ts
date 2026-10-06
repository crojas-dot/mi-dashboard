// Presentation recipes: keep data/hooks in the view; edit only tw: classes here.
export default {
  "panel": "tw:bg-surface tw:[border:1px_solid_var(--color-qms-border)] tw:rounded-lg tw:[box-shadow:0_1px_2px_rgba(15,_23,_42,_0.04)] tw:overflow-hidden tw:[&_+div]:mt-5",
  "panelHead": "tw:flex tw:gap-3.5 tw:items-start tw:[padding:20px_24px] tw:[border-bottom:1px_solid_var(--color-qms-border)] tw:[&_h3]:[font-size:17px] tw:[&_h3]:[line-height:1.4] tw:[&_h3]:[margin:0_0_4px] tw:[&_h3]:font-semibold tw:[&_h3]:text-foreground tw:[&_p]:[font-size:13px] tw:[&_p]:m-0 tw:[&_p]:text-muted tw:[&_p]:[line-height:1.6] tw:max-[576px]:p-4",
  "panelBody": "tw:[padding:20px_24px_24px] tw:max-[576px]:p-4",
  "sectionIcon": "tw:grid tw:[place-items:center] tw:shrink-0 tw:w-10 tw:h-10 tw:[background:var(--color-qms-primary-subtle)] tw:text-primary tw:rounded-lg",
  "toolbar": "tw:flex tw:items-center tw:gap-3 tw:flex-wrap tw:mb-4",
  "fieldLabel": "tw:[font-size:11px] tw:font-semibold tw:uppercase tw:[letter-spacing:0.04em] tw:text-muted",
  "expandContent": "tw:[border-left:3px_solid_var(--color-qms-primary)] tw:pl-4",
  "fallbackGrid": "tw:grid tw:[grid-template-columns:repeat(2,_minmax(0,_1fr))] tw:gap-3.5 tw:[margin-top:2px] tw:[&_>_div]:flex tw:[&_>_div]:flex-col tw:[&_>_div]:gap-1.5 tw:[&_>_div]:min-w-0 tw:[&:is(input,textarea)]:w-full tw:[&_select]:w-full tw:max-[576px]:[grid-template-columns:minmax(0,_1fr)]",
  "saveBar": "tw:flex tw:items-center tw:gap-3 tw:flex-wrap tw:mt-4 tw:pt-4 tw:[border-top:1px_solid_var(--color-qms-border)]",
  "ttlRow": "tw:flex tw:items-end tw:gap-4 tw:flex-wrap tw:[&_>_div]:flex tw:[&_>_div]:flex-col tw:[&_>_div]:gap-1.5"
} as const
