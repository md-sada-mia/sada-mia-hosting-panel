import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
// Import styles for react-day-picker
import "react-day-picker/dist/style.css"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center transition-opacity text-foreground"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-2",
        head_row: "flex mb-2",
        head_cell: "text-muted-foreground w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2 bg-[#1f1f22] rounded-xl overflow-hidden shadow-sm",
        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          "h-10 w-9 p-0 font-normal text-foreground hover:bg-white/10 transition-colors rounded-xl"
        ),
        day_range_start: "day-range-start !bg-white !text-black font-medium !rounded-xl",
        range_start: "range-start !bg-white !text-black font-medium !rounded-xl",
        day_range_end: "day-range-end !bg-white !text-black font-medium !rounded-xl",
        range_end: "range-end !bg-white !text-black font-medium !rounded-xl",
        day_selected:
          "!bg-white !text-black focus:!bg-white focus:!text-black font-medium !rounded-xl",
        selected: "!bg-white !text-black focus:!bg-white focus:!text-black font-medium !rounded-xl",
        day_today: "text-accent-foreground font-bold",
        today: "text-accent-foreground font-bold",
        day_outside: "text-muted-foreground opacity-30",
        outside: "text-muted-foreground opacity-30",
        day_disabled: "text-muted-foreground opacity-30",
        disabled: "text-muted-foreground opacity-30",
        day_range_middle: "!bg-transparent !text-foreground font-normal aria-selected:!bg-transparent aria-selected:!text-foreground",
        range_middle: "!bg-transparent !text-foreground font-normal aria-selected:!bg-transparent aria-selected:!text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
