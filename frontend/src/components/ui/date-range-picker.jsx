import * as React from "react"
import { CalendarIcon, RefreshCw } from "lucide-react"
import { addDays, format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
  date,
  setDate,
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "h-12 w-[260px] justify-start text-left font-normal border-primary/20 hover:border-primary/50 transition-all bg-background/50 backdrop-blur-sm",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-primary/20 bg-card shadow-2xl ring-1 ring-black/50" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={(selectedRange, selectedDay) => {
              if (date?.from && date?.to) {
                setDate({ from: selectedDay, to: undefined })
              } else {
                setDate(selectedRange)
              }
            }}
            numberOfMonths={2}
            className="p-4"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
