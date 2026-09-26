#!/usr/bin/env python3
"""
Generate complete PBIR report definition for AdventureWorksSales.Report
"""
import json
from pathlib import Path

report_root = Path("AdventureWorksSales.Report")
definition_dir = report_root / "definition"
pages_dir = definition_dir / "pages"

# Schema URLs
SCHEMA_REPORT = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.0.0/schema.json"
SCHEMA_PAGES_META = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json"
SCHEMA_PAGE = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json"
SCHEMA_VISUAL = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json"

# 1. definition.pbir
report_root.mkdir(parents=True, exist_ok=True)
pbir_data = {
    "version": "4.0",
    "datasetReference": {
        "byPath": {
            "path": "../AdventureWorksSales.SemanticModel"
        }
    }
}
(report_root / "definition.pbir").write_text(json.dumps(pbir_data, indent=2), encoding="utf-8")

# 2. version.json & report.json
definition_dir.mkdir(parents=True, exist_ok=True)
(definition_dir / "version.json").write_text(json.dumps({"version": "2.0.0"}, indent=2), encoding="utf-8")
(definition_dir / "report.json").write_text(json.dumps({
    "$schema": SCHEMA_REPORT,
    "layoutOptimization": "Canvas"
}, indent=2), encoding="utf-8")

# 3. pages.json
pages_dir.mkdir(parents=True, exist_ok=True)
pages_meta = {
    "$schema": SCHEMA_PAGES_META,
    "pageOrder": [
        "ReportSection_ExecutiveOverview",
        "ReportSection_ProductProfitability"
    ],
    "activePageName": "ReportSection_ExecutiveOverview"
}
(pages_dir / "pages.json").write_text(json.dumps(pages_meta, indent=2), encoding="utf-8")


def write_visual(page_name, visual_name, visual_data):
    v_dir = pages_dir / page_name / "visuals" / visual_name
    v_dir.mkdir(parents=True, exist_ok=True)
    (v_dir / "visual.json").write_text(json.dumps(visual_data, indent=2), encoding="utf-8")


# ─── PAGE 1: Executive Overview ──────────────────────────────────────────────
p1_name = "ReportSection_ExecutiveOverview"
p1_dir = pages_dir / p1_name
p1_dir.mkdir(parents=True, exist_ok=True)
(p1_dir / "page.json").write_text(json.dumps({
    "$schema": SCHEMA_PAGE,
    "name": p1_name,
    "displayName": "Executive Overview",
    "displayOption": "FitToPage",
    "height": 720,
    "width": 1280
}, indent=2), encoding="utf-8")

# Visual 1: Title
write_visual(p1_name, "title000000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "title000000000000001",
    "position": {"x": 20, "y": 15, "z": 1000, "height": 55, "width": 880, "tabOrder": 1000},
    "visual": {
        "visualType": "textbox",
        "objects": {
            "general": [{
                "properties": {
                    "paragraphs": [{
                        "textRuns": [{
                            "value": "AdventureWorks Sales Analytics — Executive Overview",
                            "textStyle": {"fontWeight": "bold", "fontSize": "18pt", "color": "#0f172a"}
                        }]
                    }]
                }
            }]
        }
    }
})

# Visual 2: Fiscal Year Slicer
write_visual(p1_name, "slicer00000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "slicer00000000000001",
    "position": {"x": 920, "y": 15, "z": 2000, "height": 55, "width": 340, "tabOrder": 2000},
    "visual": {
        "visualType": "slicer",
        "query": {
            "queryState": {
                "Values": {
                    "projections": [{
                        "field": {
                            "Column": {
                                "Expression": {"SourceRef": {"Entity": "Calendar"}},
                                "Property": "FiscalYearLabel"
                            }
                        },
                        "queryRef": "Calendar.FiscalYearLabel",
                        "nativeQueryRef": "FiscalYearLabel"
                    }]
                }
            }
        }
    }
})

# Visual 3: Multi-value KPI Card Ribbon
write_visual(p1_name, "card0000000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "card0000000000000001",
    "position": {"x": 20, "y": 80, "z": 3000, "height": 95, "width": 1240, "tabOrder": 3000},
    "visual": {
        "visualType": "cardVisual",
        "query": {
            "queryState": {
                "Data": {
                    "projections": [
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                            "queryRef": "FactSales.Total Sales",
                            "nativeQueryRef": "Total Sales"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Profit"}},
                            "queryRef": "FactSales.Total Profit",
                            "nativeQueryRef": "Total Profit"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Profit Margin %"}},
                            "queryRef": "FactSales.Profit Margin %",
                            "nativeQueryRef": "Profit Margin %"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Units Sold"}},
                            "queryRef": "FactSales.Total Units Sold",
                            "nativeQueryRef": "Total Units Sold"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Orders"}},
                            "queryRef": "FactSales.Total Orders",
                            "nativeQueryRef": "Total Orders"
                        }
                    ]
                }
            }
        }
    }
})

# Visual 4: Monthly Sales & Profit Trend (Line Chart)
write_visual(p1_name, "trend000000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "trend000000000000001",
    "position": {"x": 20, "y": 190, "z": 4000, "height": 280, "width": 780, "tabOrder": 4000},
    "visual": {
        "visualType": "lineChart",
        "query": {
            "queryState": {
                "Category": {
                    "projections": [{
                        "field": {
                            "Column": {
                                "Expression": {"SourceRef": {"Entity": "Calendar"}},
                                "Property": "CalendarMonth"
                            }
                        },
                        "queryRef": "Calendar.CalendarMonth",
                        "nativeQueryRef": "CalendarMonth"
                    }]
                },
                "Y": {
                    "projections": [
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                            "queryRef": "FactSales.Total Sales",
                            "nativeQueryRef": "Total Sales"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Profit"}},
                            "queryRef": "FactSales.Total Profit",
                            "nativeQueryRef": "Total Profit"
                        }
                    ]
                }
            }
        }
    }
})

# Visual 5: Product Category Breakdown (Horizontal Bar Chart)
write_visual(p1_name, "catbar00000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "catbar00000000000001",
    "position": {"x": 820, "y": 190, "z": 5000, "height": 280, "width": 440, "tabOrder": 5000},
    "visual": {
        "visualType": "barChart",
        "query": {
            "queryState": {
                "Category": {
                    "projections": [{
                        "field": {
                            "Column": {
                                "Expression": {"SourceRef": {"Entity": "DimProduct"}},
                                "Property": "Category"
                            }
                        },
                        "queryRef": "DimProduct.Category",
                        "nativeQueryRef": "Category"
                    }]
                },
                "Y": {
                    "projections": [{
                        "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                        "queryRef": "FactSales.Total Sales",
                        "nativeQueryRef": "Total Sales"
                    }]
                }
            }
        }
    }
})

# Visual 6: Geographic Performance Table
write_visual(p1_name, "table000000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "table000000000000001",
    "position": {"x": 20, "y": 485, "z": 6000, "height": 220, "width": 640, "tabOrder": 6000},
    "visual": {
        "visualType": "tableEx",
        "query": {
            "queryState": {
                "Values": {
                    "projections": [
                        {
                            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimSalesTerritory"}}, "Property": "Country"}},
                            "queryRef": "DimSalesTerritory.Country",
                            "nativeQueryRef": "Country"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                            "queryRef": "FactSales.Total Sales",
                            "nativeQueryRef": "Total Sales"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Profit"}},
                            "queryRef": "FactSales.Total Profit",
                            "nativeQueryRef": "Total Profit"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Profit Margin %"}},
                            "queryRef": "FactSales.Profit Margin %",
                            "nativeQueryRef": "Profit Margin %"
                        }
                    ]
                }
            }
        },
        "objects": {
            "columnHeaders": [{
                "properties": {
                    "autoSizeColumnWidth": {"expr": {"Literal": {"Value": "true"}}},
                    "columnAdjustment": {"expr": {"Literal": {"Value": "'growToFit'"}}}
                }
            }]
        }
    }
})

# Visual 7: Channel Mix
write_visual(p1_name, "chan0000000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "chan0000000000000001",
    "position": {"x": 680, "y": 485, "z": 7000, "height": 220, "width": 580, "tabOrder": 7000},
    "visual": {
        "visualType": "clusteredBarChart",
        "query": {
            "queryState": {
                "Category": {
                    "projections": [{
                        "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimSalesOrder"}}, "Property": "Channel"}},
                        "queryRef": "DimSalesOrder.Channel",
                        "nativeQueryRef": "Channel"
                    }]
                },
                "Y": {
                    "projections": [{
                        "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                        "queryRef": "FactSales.Total Sales",
                        "nativeQueryRef": "Total Sales"
                    }]
                }
            }
        }
    }
})


# ─── PAGE 2: Product & Territory Profitability ───────────────────────────────
p2_name = "ReportSection_ProductProfitability"
p2_dir = pages_dir / p2_name
p2_dir.mkdir(parents=True, exist_ok=True)
(p2_dir / "page.json").write_text(json.dumps({
    "$schema": SCHEMA_PAGE,
    "name": p2_name,
    "displayName": "Product Profitability",
    "displayOption": "FitToPage",
    "height": 720,
    "width": 1280
}, indent=2), encoding="utf-8")

# Visual 1: Title
write_visual(p2_name, "title000000000000002", {
    "$schema": SCHEMA_VISUAL,
    "name": "title000000000000002",
    "position": {"x": 20, "y": 15, "z": 1000, "height": 45, "width": 1240, "tabOrder": 1000},
    "visual": {
        "visualType": "textbox",
        "objects": {
            "general": [{
                "properties": {
                    "paragraphs": [{
                        "textRuns": [{
                            "value": "AdventureWorks — Product & Customer Profitability Analysis",
                            "textStyle": {"fontWeight": "bold", "fontSize": "16pt", "color": "#0f172a"}
                        }]
                    }]
                }
            }]
        }
    }
})

# Visual 2: Top Products Table
write_visual(p2_name, "table000000000000002", {
    "$schema": SCHEMA_VISUAL,
    "name": "table000000000000002",
    "position": {"x": 20, "y": 70, "z": 2000, "height": 380, "width": 1240, "tabOrder": 2000},
    "visual": {
        "visualType": "tableEx",
        "query": {
            "queryState": {
                "Values": {
                    "projections": [
                        {
                            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimProduct"}}, "Property": "Product"}},
                            "queryRef": "DimProduct.Product",
                            "nativeQueryRef": "Product"
                        },
                        {
                            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimProduct"}}, "Property": "Category"}},
                            "queryRef": "DimProduct.Category",
                            "nativeQueryRef": "Category"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Units Sold"}},
                            "queryRef": "FactSales.Total Units Sold",
                            "nativeQueryRef": "Total Units Sold"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                            "queryRef": "FactSales.Total Sales",
                            "nativeQueryRef": "Total Sales"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Cost"}},
                            "queryRef": "FactSales.Total Cost",
                            "nativeQueryRef": "Total Cost"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Profit"}},
                            "queryRef": "FactSales.Total Profit",
                            "nativeQueryRef": "Total Profit"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Profit Margin %"}},
                            "queryRef": "FactSales.Profit Margin %",
                            "nativeQueryRef": "Profit Margin %"
                        }
                    ]
                }
            }
        },
        "objects": {
            "columnHeaders": [{
                "properties": {
                    "autoSizeColumnWidth": {"expr": {"Literal": {"Value": "true"}}},
                    "columnAdjustment": {"expr": {"Literal": {"Value": "'growToFit'"}}}
                }
            }]
        }
    }
})

# Visual 3: Subcategory Bar Chart
write_visual(p2_name, "subcat00000000000001", {
    "$schema": SCHEMA_VISUAL,
    "name": "subcat00000000000001",
    "position": {"x": 20, "y": 465, "z": 3000, "height": 240, "width": 600, "tabOrder": 3000},
    "visual": {
        "visualType": "barChart",
        "query": {
            "queryState": {
                "Category": {
                    "projections": [{
                        "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimProduct"}}, "Property": "Subcategory"}},
                        "queryRef": "DimProduct.Subcategory",
                        "nativeQueryRef": "Subcategory"
                    }]
                },
                "Y": {
                    "projections": [{
                        "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                        "queryRef": "FactSales.Total Sales",
                        "nativeQueryRef": "Total Sales"
                    }]
                }
            }
        }
    }
})

# Visual 4: Territory Region Performance
write_visual(p2_name, "table000000000000003", {
    "$schema": SCHEMA_VISUAL,
    "name": "table000000000000003",
    "position": {"x": 640, "y": 465, "z": 4000, "height": 240, "width": 620, "tabOrder": 4000},
    "visual": {
        "visualType": "tableEx",
        "query": {
            "queryState": {
                "Values": {
                    "projections": [
                        {
                            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimSalesTerritory"}}, "Property": "Group"}},
                            "queryRef": "DimSalesTerritory.Group",
                            "nativeQueryRef": "Group"
                        },
                        {
                            "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DimSalesTerritory"}}, "Property": "Region"}},
                            "queryRef": "DimSalesTerritory.Region",
                            "nativeQueryRef": "Region"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Sales"}},
                            "queryRef": "FactSales.Total Sales",
                            "nativeQueryRef": "Total Sales"
                        },
                        {
                            "field": {"Measure": {"Expression": {"SourceRef": {"Entity": "FactSales"}}, "Property": "Total Profit"}},
                            "queryRef": "FactSales.Total Profit",
                            "nativeQueryRef": "Total Profit"
                        }
                    ]
                }
            }
        },
        "objects": {
            "columnHeaders": [{
                "properties": {
                    "autoSizeColumnWidth": {"expr": {"Literal": {"Value": "true"}}},
                    "columnAdjustment": {"expr": {"Literal": {"Value": "'growToFit'"}}}
                }
            }]
        }
    }
})

print("Generated full PBIR definition for AdventureWorksSales.Report with 2 pages and 11 visuals.")
