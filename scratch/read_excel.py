"""
Re-read the updated student Excel file and display all data.
"""
import openpyxl
import shutil

src = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\Student List 26-27.csv"
dst = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\scratch\Student_List_v2.xlsx"
shutil.copy2(src, dst)

wb = openpyxl.load_workbook(dst)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
header = rows[0]
data_rows = rows[1:]

print(f"Total columns: {len(header)}")
print(f"Total data rows: {len(data_rows)}")

print(f"\n=== HEADER ===")
for i, h in enumerate(header):
    print(f"  Col {i}: {h}")

print(f"\n=== FIRST 3 DATA ROWS ===")
for i, row in enumerate(data_rows[:3]):
    print(f"\nRow {i}:")
    for j, val in enumerate(row):
        print(f"  Col {j} ({header[j]}): {val}")

print(f"\n=== LAST 3 DATA ROWS ===")
for row in data_rows[-3:]:
    print(f"\nRow:")
    for j, val in enumerate(row):
        print(f"  Col {j} ({header[j]}): {val}")

# Extract unique batches from Company Name column (col 2)
batches = {}
for row in data_rows:
    # Try to find batch info - check each column
    for col_idx in range(len(row)):
        val = str(row[col_idx]).strip() if row[col_idx] else ""
        if val.startswith("[") and val.endswith("]"):
            if val not in batches:
                batches[val] = 0
            batches[val] += 1

print(f"\n=== BATCH-LIKE VALUES (bracketed) ===")
for b in sorted(batches.keys()):
    print(f"  {b}: {batches[b]} students")
