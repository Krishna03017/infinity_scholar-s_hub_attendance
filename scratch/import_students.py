"""
Fresh import with email included from updated Excel file.
Columns: Customer Name(0), Display Name(1), Company Name(2), First Name(3), EmailID(4), Phone(5), MobilePhone(6)
"""
import openpyxl, shutil, re, json

src = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\Student List 26-27.csv"
dst = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\scratch\Student_List_v2.xlsx"
shutil.copy2(src, dst)
mockdata_path = r"c:\Users\LENOVO\Desktop\infinity-scholar's-hub\src\data\mockData.ts"

wb = openpyxl.load_workbook(dst)
ws = wb.active
data_rows = list(ws.iter_rows(values_only=True))[1:]

def make_batch_id(b):
    return "batch_" + re.sub(r'[^a-z0-9]+', '_', b.lower()).strip('_')

def make_display_name(b):
    parts = b.split(); parts[0] = parts[0].capitalize(); return " ".join(parts)

raw_batches = set()
for row in data_rows:
    raw = str(row[2]).strip().strip("[] ") if row[2] else ""
    if raw: raw_batches.add(raw)

batch_info = {}
for b in sorted(raw_batches):
    batch_info[b] = {"batchId": make_batch_id(b), "batchName": make_display_name(b), "batchTag": b}

students = []
for idx, row in enumerate(data_rows):
    raw_batch = str(row[2]).strip().strip("[] ") if row[2] else ""
    if not raw_batch or raw_batch not in batch_info: continue
    bi = batch_info[raw_batch]
    name = str(row[3]).strip() if row[3] else ""
    if not name: continue
    email = str(row[4]).strip() if row[4] and str(row[4]).strip() != "None" else ""
    phone = ""
    if row[6] and str(row[6]).strip() != "None": phone = str(row[6]).strip()
    elif row[5] and str(row[5]).strip() != "None": phone = str(row[5]).strip()
    roll_no = f"26{idx+1:03d}"
    att = round(64.0 + (len(name) * 3 + idx) % 32, 1)
    total, present = 40, int(40 * att / 100)
    absent = total - present
    students.append({
        "id": f"stu_{roll_no}", "name": name, "rollNo": roll_no, "email": email,
        "parentPhone": phone, "parentName": f"Parent of {name.split()[0]}",
        "batch": bi["batchName"], "batchId": bi["batchId"], "targetThreshold": 75,
        "attendancePercentage": att, "status": "Active",
        "stats": {"total": total, "present": present, "absent": absent, "excused": 0},
        "history": [
            {"id": f"h_{roll_no}_1", "date": "2026-06-05", "time": "08:30 AM", "subject": "General",
             "status": "Present" if att >= 75 else "Absent", "markedBy": "Faculty"},
            {"id": f"h_{roll_no}_2", "date": "2026-06-03", "time": "08:30 AM", "subject": "General",
             "status": "Present", "markedBy": "Faculty"}
        ]
    })

print(f"Students: {len(students)}, Batches: {len(batch_info)}")

# Generate TS
fs = json.dumps(students, indent=2)
fs = re.sub(r'"(\w+)":', r'\1:', fs)
ts_students = f"export const INITIAL_STUDENTS: Student[] = {fs};"

# Sessions & batch schedules
bl = sorted(batch_info.values(), key=lambda x: x["batchId"])
rooms = ["Room 101","Room 102","Room 201","Room 202","Room 301","Room 302","Virtual Room A","Virtual Room B"]
times = ["08:30 AM - 10:00 AM","10:15 AM - 11:45 AM","12:00 PM - 01:30 PM","02:00 PM - 03:30 PM","04:00 PM - 05:30 PM"]

sessions = []
bsched = []
for i, bi in enumerate(bl):
    ad = [1,3,5] if i%2==0 else [2,4,6]
    bsched.append({"batchId": bi["batchId"], "batchName": bi["batchName"], "batchTag": bi["batchTag"], "activeDays": ad})
    sc = sum(1 for s in students if s["batchId"] == bi["batchId"])
    sessions.append({"id": f"session_{i+1}", "batchName": bi["batchName"], "batchTag": bi["batchTag"],
        "batchId": bi["batchId"], "subject": f"Session {i+1:02d}", "time": times[i%len(times)],
        "room": rooms[i%len(rooms)], "studentsCount": sc, "status": "Pending", "assignedFaculty": "Faculty"})

fse = json.dumps(sessions, indent=2); fse = re.sub(r'"(\w+)":', r'\1:', fse)
ts_sessions = f"export const INITIAL_SESSIONS: Session[] = {fse};"
fbs = json.dumps(bsched, indent=4); fbs = re.sub(r'"(\w+)":', r'\1:', fbs)

# Read & replace
with open(mockdata_path, "r", encoding="utf-8") as f: content = f.read()
content = re.sub(r'export const INITIAL_STUDENTS: Student\[\] = \[[\s\S]*?\];', ts_students, content)
content = re.sub(r'export const INITIAL_SESSIONS: Session\[\] = \[[\s\S]*?\];', ts_sessions, content)
content = re.sub(r'(batchSchedules:\s*)\[[\s\S]*?\](\s*\};)', r'\1' + fbs + r'\2', content)
# Also replace sms: true -> email: true in settings
content = content.replace("sms: true", "email: true")
content = content.replace("sms: false", "email: false")

with open(mockdata_path, "w", encoding="utf-8") as f: f.write(content)

print("Done! mockData.ts updated with email fields and sms->email in settings.")
for bs in bsched:
    c = sum(1 for s in students if s["batchId"] == bs["batchId"])
    print(f"  {bs['batchName']}: {c} students")
