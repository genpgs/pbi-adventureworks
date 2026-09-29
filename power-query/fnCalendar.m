// fnCalendar
// Month-aligned Fiscal Calendar

(
    StartDate as nullable date,
    EndDate as nullable date,
    optional FiscalYearStartMonth as nullable number,
    optional FiscalYearLabelMode as nullable text,
    optional Culture as nullable text
)
as table =>

let

    //----------------------------------------------------------------------
    // Parameter Validation
    //----------------------------------------------------------------------

    CheckedStart =
        if StartDate = null
        then error "StartDate cannot be null."
        else Date.From(StartDate),

    CheckedEnd =
        if EndDate = null
        then error "EndDate cannot be null."
        else Date.From(EndDate),

    _RangeCheck =
        if CheckedEnd < CheckedStart
        then error "EndDate must be on or after StartDate."
        else null,

    FiscalStartMonth =
        if FiscalYearStartMonth = null
        then 1
        else Number.RoundDown(FiscalYearStartMonth),

    _FiscalMonthCheck =
        if FiscalStartMonth >= 1 and FiscalStartMonth <= 12
        then null
        else error "FiscalYearStartMonth must be between 1 and 12.",

    LabelMode =
        Text.Lower(
            if FiscalYearLabelMode = null
                or Text.Trim(FiscalYearLabelMode) = ""
            then "endingyear"
            else FiscalYearLabelMode
        ),

    _LabelModeCheck =
        if List.Contains(
            {"startingyear","endingyear"},
            LabelMode
        )
        then null
        else error "FiscalYearLabelMode must be 'startingYear' or 'endingYear'.",

    CalendarCulture =
        if Culture = null
            or Text.Trim(Culture) = ""
        then "en-US"
        else Culture,

    //----------------------------------------------------------------------
    // Fiscal Year Helper
    //----------------------------------------------------------------------

    FYStart =
        (d as date) as date =>
            if Date.Month(d) >= FiscalStartMonth
            then #date(Date.Year(d), FiscalStartMonth, 1)
            else #date(Date.Year(d) - 1, FiscalStartMonth, 1),

    //----------------------------------------------------------------------
    // Expand to Full Fiscal Years
    //----------------------------------------------------------------------

    RangeStart =
        FYStart(CheckedStart),

    RangeEnd =
        Date.AddDays(
            Date.AddYears(FYStart(CheckedEnd), 1),
            -1
        ),

    Dates =
        List.Dates(
            RangeStart,
            Duration.Days(RangeEnd - RangeStart) + 1,
            #duration(1,0,0,0)
        ),

    BaseTable =
        Table.TransformColumnTypes(
            Table.FromList(
                Dates,
                Splitter.SplitByNothing(),
                {"Date"}
            ),
            {{"Date", type date}}
        ),

    //----------------------------------------------------------------------
    // Gregorian Calendar Attributes
    //----------------------------------------------------------------------

    DateKey =
        Table.AddColumn(
            BaseTable,
            "DateKey",
            each
                Date.Year([Date]) * 10000 +
                Date.Month([Date]) * 100 +
                Date.Day([Date]),
            Int64.Type
        ),

    CalendarYear =
        Table.AddColumn(
            DateKey,
            "CalendarYear",
            each Date.Year([Date]),
            Int64.Type
        ),

    CalendarMonthNumber =
        Table.AddColumn(
            CalendarYear,
            "CalendarMonthNumber",
            each Date.Month([Date]),
            Int64.Type
        ),

    CalendarMonth =
        Table.AddColumn(
            CalendarMonthNumber,
            "CalendarMonth",
            each
                try Date.MonthName([Date], CalendarCulture)
                otherwise Date.MonthName([Date], "en-US"),
            type text
        ),

    CalendarQuarterNumber =
        Table.AddColumn(
            CalendarMonth,
            "CalendarQuarterNumber",
            each Date.QuarterOfYear([Date]),
            Int64.Type
        ),

    CalendarQuarter =
        Table.AddColumn(
            CalendarQuarterNumber,
            "CalendarQuarter",
            each "Q" & Text.From([CalendarQuarterNumber]),
            type text
        ),

    DayNumberOfMonth =
        Table.AddColumn(
            CalendarQuarter,
            "DayOfMonth",
            each Date.Day([Date]),
            Int64.Type
        ),

    DayOfWeekNumber =
        Table.AddColumn(
            DayNumberOfMonth,
            "DayOfWeekNumber",
            each Date.DayOfWeek([Date], Day.Monday) + 1,
            Int64.Type
        ),

    DayOfWeek =
        Table.AddColumn(
            DayOfWeekNumber,
            "DayOfWeek",
            each
                try Date.DayOfWeekName([Date], CalendarCulture)
                otherwise Date.DayOfWeekName([Date], "en-US"),
            type text
        ),

    WeekOfYear =
        Table.AddColumn(
            DayOfWeek,
            "WeekOfYear",
            each Date.WeekOfYear([Date]),
            Int64.Type
        ),

    IsWeekend =
        Table.AddColumn(
            WeekOfYear,
            "IsWeekend",
            each Date.DayOfWeek([Date], Day.Monday) >= 5,
            type logical
        ),

    YearMonth =
        Table.AddColumn(
            IsWeekend,
            "YearMonth",
            each Date.ToText([Date], "yyyy-MM"),
            type text
        ),

    YearMonthSort =
        Table.AddColumn(
            YearMonth,
            "YearMonthSort",
            each [CalendarYear] * 100 + [CalendarMonthNumber],
            Int64.Type
        ),

    MonthStartDate =
        Table.AddColumn(
            YearMonthSort,
            "MonthStartDate",
            each Date.StartOfMonth([Date]),
            type date
        ),

    MonthEndDate =
        Table.AddColumn(
            MonthStartDate,
            "MonthEndDate",
            each Date.EndOfMonth([Date]),
            type date
        ),

    //----------------------------------------------------------------------
    // Fiscal Attributes
    //----------------------------------------------------------------------

    FiscalYearStartDate =
        Table.AddColumn(
            MonthEndDate,
            "FiscalYearStartDate",
            each FYStart([Date]),
            type date
        ),

    FiscalYearEndDate =
        Table.AddColumn(
            FiscalYearStartDate,
            "FiscalYearEndDate",
            each
                Date.AddDays(
                    Date.AddYears([FiscalYearStartDate],1),
                    -1
                ),
            type date
        ),

    FiscalYearEndingYear =
        Table.AddColumn(
            FiscalYearEndDate,
            "_FiscalYearEndingYear",
            each Date.Year([FiscalYearEndDate]),
            Int64.Type
        ),

    FiscalYear =
        Table.AddColumn(
            FiscalYearEndingYear,
            "FiscalYear",
            each
                if LabelMode = "startingyear"
                then Date.Year([FiscalYearStartDate])
                else [_FiscalYearEndingYear],
            Int64.Type
        ),

    FiscalYearLabel =
        Table.AddColumn(
            FiscalYear,
            "FiscalYearLabel",
            each "FY" & Text.From([FiscalYear]),
            type text
        ),

    FiscalMonthNumber =
        Table.AddColumn(
            FiscalYearLabel,
            "FiscalMonthNumber",
            each
                Number.Mod(
                    [CalendarMonthNumber] - FiscalStartMonth,
                    12
                ) + 1,
            Int64.Type
        ),

    FiscalPeriodLabel =
        Table.AddColumn(
            FiscalMonthNumber,
            "FiscalPeriodLabel",
            each
                "P" &
                Text.PadStart(
                    Text.From([FiscalMonthNumber]),
                    2,
                    "0"
                ),
            type text
        ),

    FiscalQuarterNumber =
        Table.AddColumn(
            FiscalPeriodLabel,
            "FiscalQuarterNumber",
            each Number.RoundUp([FiscalMonthNumber] / 3),
            Int64.Type
        ),

    FiscalQuarter =
        Table.AddColumn(
            FiscalQuarterNumber,
            "FiscalQuarter",
            each "FQ" & Text.From([FiscalQuarterNumber]),
            type text
        ),

    FiscalYearQuarter =
        Table.AddColumn(
            FiscalQuarter,
            "FiscalYearQuarter",
            each
                [FiscalYearLabel] &
                " " &
                [FiscalQuarter],
            type text
        ),

    FiscalYearSort =
        Table.AddColumn(
            FiscalYearQuarter,
            "FiscalYearSort",
            each [FiscalYear],
            Int64.Type
        ),

    FiscalYearPeriodSort =
        Table.AddColumn(
            FiscalYearSort,
            "FiscalYearPeriodSort",
            each
                [FiscalYear] * 100 +
                [FiscalMonthNumber],
            Int64.Type
        ),

    //----------------------------------------------------------------------
    // Cleanup
    //----------------------------------------------------------------------

    Result =
        Table.ReorderColumns(
            Table.RemoveColumns(
                FiscalYearPeriodSort,
                {"_FiscalYearEndingYear"}
            ),
            {
                "DateKey",
                "Date",

                "CalendarYear",
                "CalendarQuarterNumber",
                "CalendarQuarter",
                "CalendarMonthNumber",
                "CalendarMonth",
                "YearMonth",
                "YearMonthSort",

                "DayOfMonth",
                "DayOfWeekNumber",
                "DayOfWeek",
                "WeekOfYear",
                "IsWeekend",

                "MonthStartDate",
                "MonthEndDate",

                "FiscalYear",
                "FiscalYearLabel",
                "FiscalYearSort",

                "FiscalYearStartDate",
                "FiscalYearEndDate",

                "FiscalQuarterNumber",
                "FiscalQuarter",
                "FiscalYearQuarter",

                "FiscalMonthNumber",
                "FiscalPeriodLabel",
                "FiscalYearPeriodSort"
            }
        )

in
    Result