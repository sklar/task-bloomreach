# Date Range Picker

A design-system date range picker: a trigger that opens a popover with a two-month calendar, a presets sidebar, and a footer summary. Selecting a range and applying it emits the range to the consumer.

## Language

**Range**:
A pair of inclusive calendar dates — a start day and an end day. Has no time-of-day component; a range is days, not instants. Day count is inclusive (10 Jan → 9 Feb = 31 days).
_Avoid_: interval, period, datetime range.

**Preset**:
A named shortcut that maps to a Range (e.g. Today, This month, Last 7 days). Selecting one fills the calendar. Any manual day selection switches the active preset to **Custom range**.
_Avoid_: shortcut, quick-pick, option.

**Custom range**:
The preset that is active whenever the current Range was set by manual day selection rather than by choosing a named Preset.

**Lifetime**:
The open-ended Preset: all data since the beginning, with no lower bound. Its Range has a `null` start (the picker has no notion of the earliest date) and ends today. The footer shows only "Lifetime" with no day count.

**Timezone**:
A display-only label shown in the footer summary (e.g. `Europe/Bratislava`), read from the browser via `Intl`. Not configurable and not part of the emitted value. Because a Range carries no time-of-day, the timezone does not affect any date math — it is informational only.

**Trigger**:
The input-like element that displays the committed Range in compact form (`10 Jan 2024 - 9 Feb 2024`) and opens the picker popover.

**Committed range** vs **Draft range**:
The Committed range is what the Trigger shows and what was last Applied. The Draft range is the in-progress selection inside the open popover. Cancel discards the Draft; Apply promotes the Draft to Committed.
