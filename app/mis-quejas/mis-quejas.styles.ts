// Presentation recipes: keep data/hooks in the view; edit only tw: classes here.
export default {
  "scrollArea": "tw:overflow-auto tw:overscroll-contain tw:[border:1px_solid_var(--color-qms-border)] tw:[border-radius:var(--radius-lg)] tw:[padding-bottom:1rem] tw:[&_table]:w-full tw:[&_table_tbody]:[content-visibility:auto] tw:[&_table_tbody]:[contain-intrinsic-size:auto_600px] tw:[&_table_td]:whitespace-nowrap",
  "colCliente": "tw:[min-width:10rem]",
  "colCategoria": "tw:[min-width:8.75rem]",
  "folio": "tw:[font-family:ui-monospace,_SFMono-Regular,_Menlo,_Consolas,_'Liberation_Mono',_monospace] tw:[font-size:0.875rem] tw:font-medium",
  "clickable": "tw:cursor-pointer",
  "skeleton": "tw:[height:1rem] tw:[width:75%] tw:[border-radius:0.25rem] tw:[background-color:var(--color-qms-scroll)] tw:animate-pulse"
} as const
