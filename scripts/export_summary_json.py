#!/usr/bin/env python3
"""
Precompute summary stats for AdventureWorks Sales to data/summary.json
"""
import json
import pandas as pd

excel_path = "data/AdventureWorks Sales.xlsx"

print("Loading Sales_data...")
df_sales = pd.read_excel(excel_path, sheet_name="Sales_data")
print("Loading other sheets...")
df_date = pd.read_excel(excel_path, sheet_name="Date_data")
df_prod = pd.read_excel(excel_path, sheet_name="Product_data")
df_terr = pd.read_excel(excel_path, sheet_name="Sales Territory_data")
df_cust = pd.read_excel(excel_path, sheet_name="Customer_data")
df_ord = pd.read_excel(excel_path, sheet_name="Sales Order_data")

# Merge Date
df = df_sales.merge(df_date, left_on="OrderDateKey", right_on="DateKey")
df = df.merge(df_prod[["ProductKey", "Product", "Category", "Subcategory"]], on="ProductKey")
df = df.merge(df_terr[["SalesTerritoryKey", "Region", "Country", "Group"]], on="SalesTerritoryKey")
df = df.merge(df_ord[["SalesOrderLineKey", "Channel", "Sales Order"]], on="SalesOrderLineKey")

total_sales = float(df["Sales Amount"].sum())
total_cost = float(df["Total Product Cost"].sum())
total_profit = total_sales - total_cost
margin_pct = (total_profit / total_sales) * 100
total_units = int(df["Order Quantity"].sum())
total_orders = int(df["Sales Order"].nunique())

# Yearly summary
yearly = []
for fy, grp in df.groupby("Fiscal Year"):
    s = float(grp["Sales Amount"].sum())
    c = float(grp["Total Product Cost"].sum())
    p = s - c
    u = int(grp["Order Quantity"].sum())
    o = int(grp["Sales Order"].nunique())
    yearly.append({
        "fiscal_year": fy,
        "sales": round(s, 2),
        "cost": round(c, 2),
        "profit": round(p, 2),
        "margin_pct": round((p / s) * 100, 2),
        "units": u,
        "orders": o
    })

# Monthly trend
monthly = []
for (m_key, m_label), grp in df.groupby(["MonthKey", "Month"]):
    s = float(grp["Sales Amount"].sum())
    c = float(grp["Total Product Cost"].sum())
    monthly.append({
        "month_key": int(m_key),
        "month": str(m_label),
        "sales": round(s, 2),
        "profit": round(s - c, 2),
        "units": int(grp["Order Quantity"].sum())
    })
monthly.sort(key=lambda x: x["month_key"])

# Category
category = []
for cat, grp in df.groupby("Category"):
    s = float(grp["Sales Amount"].sum())
    c = float(grp["Total Product Cost"].sum())
    category.append({
        "category": cat,
        "sales": round(s, 2),
        "profit": round(s - c, 2),
        "margin_pct": round(((s - c) / s) * 100, 2),
        "share_pct": round((s / total_sales) * 100, 2)
    })
category.sort(key=lambda x: x["sales"], reverse=True)

# Country
countries = []
for ctry, grp in df.groupby("Country"):
    s = float(grp["Sales Amount"].sum())
    c = float(grp["Total Product Cost"].sum())
    countries.append({
        "country": ctry,
        "sales": round(s, 2),
        "profit": round(s - c, 2),
        "margin_pct": round(((s - c) / s) * 100, 2),
        "share_pct": round((s / total_sales) * 100, 2)
    })
countries.sort(key=lambda x: x["sales"], reverse=True)

# Top 10 Products
top_products = []
for prod, grp in df.groupby("Product"):
    s = float(grp["Sales Amount"].sum())
    c = float(grp["Total Product Cost"].sum())
    u = int(grp["Order Quantity"].sum())
    cat = grp["Category"].iloc[0]
    top_products.append({
        "product": prod,
        "category": cat,
        "sales": round(s, 2),
        "profit": round(s - c, 2),
        "margin_pct": round(((s - c) / s) * 100, 2),
        "units": u
    })
top_products.sort(key=lambda x: x["sales"], reverse=True)
top_products = top_products[:10]

summary = {
    "kpis": {
        "total_sales": round(total_sales, 2),
        "total_cost": round(total_cost, 2),
        "total_profit": round(total_profit, 2),
        "margin_pct": round(margin_pct, 2),
        "total_units": total_units,
        "total_orders": total_orders
    },
    "yearly": yearly,
    "monthly": monthly,
    "category": category,
    "countries": countries,
    "top_products": top_products
}

with open("data/summary.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("Precomputed summary saved to data/summary.json")
