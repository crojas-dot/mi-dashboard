// Presentation recipes: keep data/hooks in the view; edit only tw: classes here.
export default {
  "page": "tw:[margin:-16px] tw:p-6 tw:[min-height:calc(100%_+_32px)] tw:bg-background tw:text-base tw:max-[768px]:p-4",
  "heading": "tw:flex tw:justify-between tw:items-center tw:gap-4 tw:mb-6 tw:[&_h1]:m-0 tw:[&_h1]:[font-size:28px] tw:[&_h1]:font-heading tw:[&_h1]:font-bold tw:[&_h1]:text-[#1a5276] tw:[&_p]:[margin:4px_0_0] tw:[&_p]:text-[#5d6d7e] tw:max-[768px]:flex-wrap",
  "filters": "tw:grid tw:[grid-template-columns:minmax(230px,_2fr)_repeat(2,_minmax(180px,_1fr))] tw:gap-4 tw:mb-4 tw:max-[768px]:[grid-template-columns:1fr]",
  "tableWrap": "tw:overflow-auto tw:rounded-xl tw:border tw:border-[#dce1e6] tw:bg-white tw:shadow-sm tw:[max-height:65vh]",
  "table": "tw:w-full tw:border-collapse tw:text-left",
  "thead": "tw:bg-[#1a5276] tw:text-white tw:font-ui tw:font-semibold",
  "th": "tw:p-4 tw:text-sm tw:uppercase tw:tracking-wider tw:whitespace-nowrap",
  "td": "tw:p-4 tw:text-[#2c3e50] tw:font-sans tw:text-sm tw:border-b tw:border-[#dce1e6]",
  "tbodyTr": "tw:hover:bg-[#f8fafc] tw:transition-colors tw:cursor-pointer",
  "row": "tw:cursor-pointer",
  "unread": "tw:cursor-pointer tw:bg-[#f0f3ff] tw:[&_button]:font-bold",
  "folio": "tw:[border:0] tw:[background:transparent] tw:p-0 tw:text-[#1a5276] tw:font-heading tw:font-bold tw:[letter-spacing:.01em] tw:whitespace-nowrap tw:cursor-pointer tw:[&:hover]:underline",
  "empty": "tw:[min-height:200px] tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:text-[#5d6d7e]"
} as const