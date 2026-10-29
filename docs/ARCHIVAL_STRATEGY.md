# MongoDB to S3 Archival System - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Why Archive Data](#why-archive-data)
3. [Architecture](#architecture)
4. [Archival Strategy](#archival-strategy)
5. [S3 Storage Lifecycle](#s3-storage-lifecycle)
6. [How to Restore Data](#how-to-restore-data)
7. [Querying Archived Data](#querying-archived-data)
8. [Cost Analysis](#cost-analysis)
9. [Frequently Asked Questions](#frequently-asked-questions)
10. [Troubleshooting](#troubleshooting)
11. [Performance Benchmarks](#performance-benchmarks)

---

## Overview

The Notification Hub implements an automated archival system that moves old data from MongoDB to AWS S3 for long-term storage. This system significantly reduces database costs while maintaining full data retention for compliance and audit requirements.

### Key Features

- ✅ **Automated Daily Archival** - Lambda functions run at 4:00 AM IST daily
- ✅ **Zero Data Loss** - Three-layer S3 verification before MongoDB deletion
- ✅ **Easy Restoration** - NDJSON format compatible with `mongoimport`
- ✅ **Indefinite Retention** - Data stored in S3 forever (no automatic deletion)
- ✅ **Idempotent Operations** - Safe to re-run, automatically catches up on failures
- ✅ **Cost Efficient** - 99% cost reduction compared to MongoDB storage
- ✅ **Scalable** - Handles millions of records with compound cursor pagination

### Quick Stats

| Metric | Value |
|--------|-------|
| **Collections Archived** | DeliveryReportHistory, Notification |
| **Archival Frequency** | Daily at 4:00 AM IST |
| **Performance** | 9,346 records/sec (DeliveryReportHistory), 4,237 records/sec (Notification) |
| **Lambda Timeout** | 900 seconds (15 minutes) |
| **Time Utilization** | ~18% of timeout for 1.25M records |
| **Success Rate** | 100% (load tested with 1.25M records) |
| **Storage Format** | NDJSON (Newline Delimited JSON) |
| **Data Retention** | Indefinite (no automatic deletion) |

---

## Why Archive Data

### The Problem

**MongoDB becomes expensive and slow with historical data:**

1. **Storage Costs**
   - MongoDB: ~$150-200 per 100 GB/month
   - Scales poorly with billions of records
   - Requires high-performance instances

2. **Performance Degradation**
   - Slower queries with larger datasets
   - Index maintenance overhead
   - Backup/restore times increase

3. **TTL Limitations**
   - DeliveryReportHistory: 8-month TTL → data deleted automatically
   - Notification: No TTL but grows indefinitely
   - No way to access deleted data for compliance

### The Solution

**Archive old data to S3:**

1. **Cost Reduction**
   - S3 Deep Archive: ~$1 per TB/month (99.9% cheaper)
   - MongoDB → Store only recent active data
   - Predictable costs at scale

2. **Performance**
   - MongoDB stays fast with smaller dataset
   - Queries remain quick
   - Backups faster

3. **Compliance**
   - Data retained indefinitely
   - Full audit trail preserved
   - Easy restoration when needed

### Why These Thresholds?

**DeliveryReportHistory: 180 days (6 months)**
- High volume data (millions/day)
- 8-month TTL in MongoDB → Archive before deletion
- Rarely queried after 6 months
- **Result:** Prevent data loss, reduce MongoDB size

**Notification: 395 days (~13 months)**
- Important for audit/compliance
- No TTL (kept forever in MongoDB without archival)
- Customer disputes may go back 1 year
- **Result:** Balance between accessibility and cost

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Daily at 4:00 AM IST                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              AWS Lambda Archival Jobs                        │
│  ┌────────────────────────┐  ┌─────────────────────────┐    │
│  │ NotificationArchivalJob│  │DeliveryReportHistory    │    │
│  │ (395 days threshold)   │  │ArchivalJob             │    │
│  │                        │  │(180 days threshold)     │    │
│  └───────────┬────────────┘  └──────────┬──────────────┘    │
│              │                          │                   │
└──────────────┼──────────────────────────┼───────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    MongoDB (Source)                          │
│  ┌─────────────────────┐    ┌──────────────────────────┐    │
│  │  notifications      │    │ deliveryreporthistories  │    │
│  │  (source_creation_  │    │  (createdAt field)       │    │
│  │   timestamp)        │    │                          │    │
│  └─────────┬───────────┘    └──────────┬───────────────┘    │
└────────────┼────────────────────────────┼────────────────────┘
             │                            │
             │  1. Query: createdAt < cutoffDate
             │  2. Fetch in batches (pagination)
             │  3. Group by date
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│              ArchivalService (Core Logic)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Calculate cutoffDate (today - threshold)          │   │
│  │ 2. Fetch records with compound cursor pagination     │   │
│  │ 3. Group records by createdAt date                   │   │
│  │ 4. Upload each date group to S3 (NDJSON)            │   │
│  │ 5. Verify S3 upload (3-layer safety check)          │   │
│  │ 6. Delete from MongoDB only if verified             │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│           S3 Multipart Upload (for large files)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ initMultipartUpload() → Get upload ID                │   │
│  │ uploadBatchPart() → Upload records as NDJSON         │   │
│  │ completeMultipartUpload() → Finalize file            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│              S3 Verification (3-Layer Safety)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Layer 1: Upload success (no exceptions)              │   │
│  │ Layer 2: HeadObject API (file exists in S3)          │   │
│  │ Layer 3: Size validation (50-5000 bytes/record)      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬─────────────────────────────────────────────────┘
             │  ✓ Verified → Delete from MongoDB
             │  ✗ Failed → Keep in MongoDB (data preserved)
             ▼
┌──────────────────────────────────────────────────────────────┐
│                 AWS S3 (Destination)                         │
│  s3://notification-hub-archival-{env}/                       │
│  ├── DeliveryReportHistory/                                  │
│  │   └── {YYYY}/{MM}/{DD}/                                   │
│  │       └── deliveryreporthistory-{YYYY-MM-DD}-{timestamp}-{executionId}.ndjson      │
│  └── Notification/                                           │
│      └── {YYYY}/{MM}/{DD}/                                   │
│          └── notification-{YYYY-MM-DD}-{timestamp}-{executionId}.ndjson               │
│                                                              │
│  Lifecycle: Intelligent-Tiering                              │
│   • 0-90 days: Frequent Access (instant)                    │
│   • 90-180 days: Archive Access (instant)                   │
│   • 180+ days: Deep Archive (12-48hr retrieval)             │
│   • Retention: Indefinite (no deletion)                     │
└──────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**1. NDJSON Format**
- One JSON document per line
- MongoDB's native import/export format
- Memory efficient (stream processing)
- Easy to grep/search
- Direct `mongoimport` compatibility

**2. Compound Cursor Pagination**
- Sorts by: `createdAt ASC, _id ASC`
- Handles records with same createdAt
- Prevents skipping/duplicates
- Stable pagination across batches

**3. Date-Based Grouping**
- One S3 file per date per collection
- Example: `notification-2024-07-07-1720448123456-abc12345.ndjson`
- Easy to locate specific dates
- Supports partial restoration

**4. Three-Layer S3 Verification**
- Prevents data loss if S3 upload silently fails
- Size validation catches corrupted uploads
- MongoDB deletion only after 100% verification

**5. Multipart Upload**
- Supports files up to 5 TB
- Handles daily files with millions of records
- Automatic retry on failures
- Memory efficient (chunks uploaded as generated)


---

## Archival Strategy

### 1. Archival Thresholds

| Collection | Threshold | Reason | MongoDB TTL |
|------------|-----------|--------|-------------|
| **DeliveryReportHistory** | 180 days (6 months) | Archive before 8-month TTL deletes data | 8 months |
| **Notification** | 395 days (~13 months) | Long retention for audit/compliance | None |

### 2. Archival Schedule

**Both jobs run daily at:**
- **Time:** 4:00 AM IST (22:30 UTC)
- **Cron Expression:** `cron(30 22 * * ? *)`
- **Timeout:** 900 seconds (15 minutes)
- **Status:** Enabled in production

**Lambda Functions:**
- `notificationArchivalJob` - Archives Notification collection
- `deliveryReportHistoryArchivalJob` - Archives DeliveryReportHistory collection

**Why 4:00 AM IST?**
- Low traffic period
- Minimal impact on production
- Completed before business hours start

### 3. How Archival Works (Step-by-Step)

#### Step 1: Calculate Cutoff Date
```
Today's Date - Threshold Days = Cutoff Date

Example (Notification):
July 7, 2026 - 395 days = June 8, 2025

All records with createdAt < June 8, 2025 are eligible
```

#### Step 2: Fetch Records from MongoDB
- Query: `createdAt < cutoffDate`
- Pagination: Batches of 1000 records (configurable)
- Sorting: By `createdAt` then `_id` for stable ordering
- Continues until no more records found

#### Step 3: Group Records by Date
- Records grouped by their `createdAt` date (YYYY-MM-DD)
- Example: All records from July 7, 2024 in one group
- Each group becomes one S3 file
- Multiple date groups processed in chronological order

#### Step 4: Upload to S3
- Format: NDJSON (one JSON document per line)
- Location: `s3://notification-hub-archival-{env}/{Collection}/{YYYY}/{MM}/{DD}/{collection}-{date}-{timestamp}-{executionId}.ndjson`
- Method: Multipart upload (supports files up to 5 TB)
- Example: `s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson`

#### Step 5: Verify S3 Upload (Critical Safety Step)

**Three-layer verification before deletion:**

1. **Layer 1: Upload Success**
   - No exceptions during upload
   - Multipart upload completed successfully

2. **Layer 2: File Exists**
   - AWS HeadObject API confirms file in S3
   - File metadata retrieved successfully

3. **Layer 3: Size Validation**
   - Expected size: 50-5000 bytes per record
   - Example: 1000 records = 50 KB to 5 MB expected
   - Catches corrupted/incomplete uploads

**If any layer fails:**
- ❌ Skip MongoDB deletion
- ✅ Data preserved in MongoDB
- 🔔 Error logged for investigation
- ↻ Next day's job will retry

#### Step 6: Delete from MongoDB
- Only executed if ALL verification passes
- Deletion per date group (isolated failure handling)
- Records deleted by `_id` list
- Audit logging for compliance

### 4. S3 File Structure

```
s3://notification-hub-archival-prod/
├── DeliveryReportHistory/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 01/
│   │   │   │   └── deliveryreporthistory-2024-01-01-1720448123456-abc12345.ndjson
│   │   │   ├── 02/
│   │   │   │   └── deliveryreporthistory-2024-01-02-1720449234567-def67890.ndjson
│   │   │   └── ...
│   │   ├── 02/
│   │   └── ...
│   ├── 2025/
│   └── 2026/
└── Notification/
    ├── 2024/
    │   ├── 07/
    │   │   ├── 01/
    │   │   │   ├── notification-2024-07-01-1720448123456-abc12345.ndjson
    │   │   │   └── notification-2024-07-01-1720449876543-xyz98765.ndjson (multiple runs)
    │   │   ├── 02/
    │   │   │   └── notification-2024-07-02-1720450123456-qwe54321.ndjson
    │   │   └── ...
    │   └── ...
    └── ...
```

**File Naming Pattern:**
`{collection-lowercase}-{YYYY-MM-DD}-{timestamp}-{executionId}.ndjson`

Where:
- `{YYYY-MM-DD}`: Date of the records (based on source_creation_timestamp)
- `{timestamp}`: Unix timestamp in milliseconds (Date.now())
- `{executionId}`: Lambda AWS_REQUEST_ID or random ID for uniqueness

**Path Pattern:**
`{Collection}/{YYYY}/{MM}/{DD}/{filename}`

### 5. NDJSON File Format

Each line is a complete MongoDB document in JSON format:

```ndjson
{"_id":"abc123","recipient":"user1@example.com","channel":"email","status":"sent","createdAt":"2024-07-07T10:00:00Z","message":"Welcome!"}
{"_id":"def456","recipient":"user2@example.com","channel":"sms","status":"delivered","createdAt":"2024-07-07T10:05:00Z","message":"Your code is 1234"}
{"_id":"ghi789","recipient":"user3@example.com","channel":"push","status":"failed","createdAt":"2024-07-07T10:10:00Z","error":"Device token invalid"}
```

**Why NDJSON?**
- ✅ MongoDB's native import/export format
- ✅ Can process line-by-line (memory efficient)
- ✅ Human-readable and searchable with grep
- ✅ No conversion needed for restoration
- ✅ Works with `mongoimport` directly

### 6. Failure Handling & Idempotency

**What if yesterday's archival job failed?**

The system is **idempotent** - it automatically catches up:

**Example Scenario:**
- **Monday (July 6):** Job fails, nothing archived
- **Tuesday (July 7):** Job runs successfully
- **Result:** Tuesday's job archives ALL records older than threshold
  - Includes records that should have been archived Monday
  - Plus any new records that became eligible Tuesday

**Key Point:** The job doesn't track "last run date". It queries for ALL records older than the threshold every time, so missed runs are automatically caught up on the next successful run.

**How It Works:**
```
Query: createdAt < cutoffDate (calculated fresh each run)
NOT: createdAt between lastRunDate and cutoffDate
```

This means:
- ✅ No manual intervention needed if job fails
- ✅ No data loss from failed runs
- ✅ Safe to run multiple times
- ✅ Can be triggered manually for testing

**Safety Features:**
1. **S3 verification before deletion** - Data stays in MongoDB if upload fails
2. **Per-date-group processing** - One group's failure doesn't affect others
3. **Detailed CloudWatch logging** - Track every step
4. **CloudWatch alarms** - Alert on failures
5. **Failed deletion tracking** - Records that couldn't be deleted are logged

### 7. Data Retention Policy

**Current Policy: Indefinite Retention**

- ✅ Data stored in S3 forever (no automatic deletion)
- ✅ Full compliance with audit requirements
- ✅ Can query historical data anytime
- ⚠️ Storage costs grow over time (but still 99% cheaper than MongoDB)

**Why No Deletion?**
- Compliance requirements may need historical data
- Legal disputes can arise years later
- Cost of S3 Deep Archive is negligible (~$1/TB/month)
- Better safe than sorry for business-critical data

**Previous Configuration (Now Removed):**
- Files were set to auto-delete after 7 years (2555 days)
- Changed to indefinite retention per business requirements

---

## S3 Storage Lifecycle

### Intelligent-Tiering Overview

AWS S3 automatically moves data between storage tiers based on access patterns to optimize costs:

| File Age in S3 | Storage Tier | Retrieval Speed | Storage Cost (per GB/month) | Retrieval Cost (per GB) |
|----------------|--------------|-----------------|----------------------------|------------------------|
| **0-90 days** | Frequent Access | ⚡ **Instant** (milliseconds) | $0.023 | **FREE** |
| **90-180 days** | Archive Access (Glacier Instant) | ⚡ **Instant** (milliseconds) | $0.004 | $0.03 |
| **180+ days** | Deep Archive | ⏳ **12-48 hours** | $0.00099 | $0.02 + $0.0025 restore fee |

### Timeline for Archived Files

**DeliveryReportHistory Example:**
```
Day 0 (MongoDB):     Record created
Day 180:             Archived to S3 (Frequent Access)
Day 270 (90 in S3):  Moved to Archive Access (still instant)
Day 360 (180 in S3): Moved to Deep Archive (12-48hr retrieval)
Forever:             Retained indefinitely
```

**Notification Example:**
```
Day 0 (MongoDB):     Record created
Day 395:             Archived to S3 (Frequent Access)
Day 485 (90 in S3):  Moved to Archive Access (still instant)
Day 575 (180 in S3): Moved to Deep Archive (12-48hr retrieval)
Forever:             Retained indefinitely
```

### Storage Tier Details

#### Frequent Access (0-90 days)
- **Use Case:** Recently archived data
- **Access:** Instant, just like regular S3
- **Cost:** Moderate storage, free retrieval
- **Example:** Query last quarter's data immediately

#### Archive Access (90-180 days)
- **Use Case:** Medium-old data
- **Access:** Still instant (Glacier Instant Retrieval)
- **Cost:** Cheap storage, small retrieval fee
- **Example:** Query 6-month-old data instantly but pay per query

#### Deep Archive (180+ days)
- **Use Case:** Rarely accessed historical data
- **Access:** 12-48 hour wait time before download
- **Cost:** Cheapest storage, higher retrieval fee
- **Example:** Query 2-year-old data requires restore request first

### Deep Archive Retrieval Process

If you need data older than 180 days in S3:

**Step 1: Request Restore**
```bash
aws s3api restore-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson \
  --restore-request '{"Days":1,"GlacierJobParameters":{"Tier":"Standard"}}'
```

**Step 2: Wait**
- Standard Tier: 12-48 hours (cheapest)
- Expedited Tier: 1-5 minutes (very expensive)

**Step 3: Check Status**
```bash
aws s3api head-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson
```

**Step 4: Download** (once "ongoing-request=false")
```bash
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson ./
```

### When Does Deep Archive Affect You?

**DeliveryReportHistory:**
- Archived after 180 days
- After 180 more days in S3 → Deep Archive
- **Impact:** All archived files >360 days old need 12-48hr restore

**Notification:**
- Archived after 395 days
- After 180 more days in S3 → Deep Archive  
- **Impact:** All archived files >575 days old need 12-48hr restore

**Important:** First 180 days after archival = instant access for both collections

### Recommendation: Remove Deep Archive?

**Consider removing Deep Archive tier if:**
- ✅ You need instant access to historical data (e.g., customer support)
- ✅ 12-48 hour wait is unacceptable for your use case
- ✅ Cost difference acceptable ($0.004 vs $0.001 per GB/month after 180 days)

**Keep Deep Archive if:**
- ✅ Historical data rarely accessed
- ✅ Planned retrievals (can wait 12-48 hours)
- ✅ Minimize storage costs
- ✅ Compliance/legal hold use case


---

## How to Restore Data

### Overview of Restoration Methods

| Method | Use Case | Speed | Complexity |
|--------|----------|-------|------------|
| **grep + jq** | Quick lookup, single record | Instant | Easy |
| **mongoimport** | Full restoration to MongoDB | Fast | Easy |
| **Temporary collection** | Investigation without affecting production | Fast | Easy |
| **AWS Athena** | SQL queries across all archives | Medium | Medium |
| **Node.js script** | Custom processing during restore | Medium | Advanced |

### Method 1: Quick Lookup (No MongoDB Import)

**Best for:** Finding specific records without importing to MongoDB

**Example: Customer asks "Did I receive a notification on July 7, 2024?"**

```bash
# Step 1: Download file from S3
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson ./

# Step 2: Search by recipient
grep '"recipient":"customer@example.com"' notification-2024-07-07.ndjson

# Step 3: Pretty print with jq
grep '"recipient":"customer@example.com"' notification-2024-07-07.ndjson | jq '.'

# Step 4: Count matching records
grep '"recipient":"customer@example.com"' notification-2024-07-07.ndjson | wc -l

# Search by multiple criteria
cat notification-2024-07-07.ndjson | \
  jq 'select(.channel == "email" and .status == "delivered")'
```

**Advantages:**
- ✅ No MongoDB import needed
- ✅ Quick for single-record lookups
- ✅ Works with standard Unix tools
- ✅ No impact on production database

### Method 2: Full Restoration with mongoimport (Recommended)

**Best for:** Restoring archived data back to MongoDB

#### Basic Import

```bash
# Download file
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson ./

# Import to MongoDB
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=notification-2024-07-07.ndjson \
  --type=json
```

#### Import with Duplicate Handling

```bash
# Upsert mode - update if exists, insert if new
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=notification-2024-07-07.ndjson \
  --mode=upsert \
  --upsertFields=_id
```

#### Import Multiple Files

```bash
# Download entire week
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/ ./ --recursive

# Import all files
for file in *.ndjson; do
  echo "Importing $file..."
  mongoimport --uri="mongodb://localhost:27017/notification-prod" \
    --collection=notifications \
    --file="$file"
done
```

#### Performance Tuning

```bash
# Use parallel workers for faster import
mongoimport --numInsertionWorkers=4 \
  --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=notification-2024-07-07.ndjson

# Continue on duplicate key errors
mongoimport --stopOnError=false \
  --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=notification-2024-07-07.ndjson
```

### Method 3: Temporary Collection (For Investigation)

**Best for:** Temporary restore for debugging/investigation without affecting production

```bash
# Step 1: Import to temporary collection
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications_temp \
  --file=notification-2024-07-07.ndjson

# Step 2: Query as normal
mongo notification-prod --eval '
  db.notifications_temp.find({ 
    recipient: "customer@example.com",
    status: "delivered" 
  }).pretty()
'

# Step 3: Run aggregations
mongo notification-prod --eval '
  db.notifications_temp.aggregate([
    { $match: { channel: "email" } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ])
'

# Step 4: Cleanup when done
mongo notification-prod --eval 'db.notifications_temp.drop()'
```

### Method 4: Selective Restore (Filter Before Import)

**Best for:** Restoring only specific records

```bash
# Filter for specific recipient
grep '"recipient":"customer@example.com"' notification-2024-07-07.ndjson > filtered.ndjson

# Import filtered records only
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=filtered.ndjson

# Filter by multiple criteria using jq
cat notification-2024-07-07.ndjson | \
  jq 'select(.channel == "email" and .status == "delivered")' | \
  mongoimport --uri="mongodb://localhost:27017/notification-prod" \
    --collection=notifications
```

### Important: TTL Index Handling (DeliveryReportHistory Only)

⚠️ **Warning:** DeliveryReportHistory has an 8-month TTL index. Restored records older than 8 months will be immediately deleted by MongoDB!

**Solution: Temporarily disable TTL before import**

```bash
# Step 1: Check TTL indexes
mongo notification-prod --eval 'db.deliveryreporthistories.getIndexes()'

# Step 2: Drop TTL index before import
mongo notification-prod --eval 'db.deliveryreporthistories.dropIndex("createdAt_1")'

# Step 3: Import data
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=deliveryreporthistories \
  --file=deliveryreporthistory-2024-07-07.ndjson

# Step 4: (Optional) Re-enable TTL if you want auto-deletion
mongo notification-prod --eval '
  db.deliveryreporthistories.createIndex(
    { "createdAt": 1 }, 
    { expireAfterSeconds: 20736000 }
  )
'
```

**Notification collection:** No TTL, safe to import anytime without special handling.

### Verify Restoration

```bash
# Count restored records
mongo notification-prod --eval '
  db.notifications.countDocuments({
    createdAt: {
      $gte: ISODate("2024-07-07T00:00:00Z"),
      $lt: ISODate("2024-07-08T00:00:00Z")
    }
  })
'

# Sample restored data
mongo notification-prod --eval '
  db.notifications.findOne({
    createdAt: {
      $gte: ISODate("2024-07-07T00:00:00Z")
    }
  })
'
```

---

## Querying Archived Data

### Option 1: Download and Search Locally

**Best for:** One-off lookups, specific dates

**Advantages:**
- ✅ Simple, uses standard tools
- ✅ No infrastructure setup
- ✅ Works offline after download

**Example Use Cases:**

```bash
# Count records by status
grep '"status":"delivered"' notification-2024-07-07.ndjson | wc -l
grep '"status":"failed"' notification-2024-07-07.ndjson | wc -l

# Find all failed email notifications
cat notification-2024-07-07.ndjson | \
  jq 'select(.channel == "email" and .status == "failed")'

# Extract specific fields
cat notification-2024-07-07.ndjson | \
  jq '{recipient: .recipient, status: .status, timestamp: .createdAt}'

# Find records within time range
cat notification-2024-07-07.ndjson | \
  jq 'select(.createdAt >= "2024-07-07T10:00:00Z" and .createdAt < "2024-07-07T11:00:00Z")'
```

### Option 2: AWS Athena (SQL Queries)

**Best for:** Ad-hoc SQL queries across all archived data, multi-month analysis

**Advantages:**
- ✅ Query across years of data without downloading
- ✅ Familiar SQL syntax
- ✅ Works with Deep Archive (auto-restores temporarily)
- ✅ Pay per query (~$5 per TB scanned)
- ✅ No infrastructure to maintain

**Setup Athena Tables:**

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS notification_archive;

-- Create table for Notification
CREATE EXTERNAL TABLE notification_archive.notifications (
  _id STRING,
  recipient STRING,
  channel STRING,
  status STRING,
  createdAt TIMESTAMP,
  message STRING,
  metadata STRING,
  error STRING
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://notification-hub-archival-prod/Notification/'
TBLPROPERTIES ('has_encrypted_data'='false');

-- Create table for DeliveryReportHistory
CREATE EXTERNAL TABLE notification_archive.delivery_reports (
  _id STRING,
  notificationId STRING,
  status STRING,
  channel STRING,
  recipient STRING,
  createdAt TIMESTAMP,
  deliveredAt TIMESTAMP,
  error STRING
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://notification-hub-archival-prod/DeliveryReportHistory/'
TBLPROPERTIES ('has_encrypted_data'='false');
```

**Query Examples:**

```sql
-- Find all notifications for a recipient
SELECT * 
FROM notification_archive.notifications
WHERE recipient = 'customer@example.com'
  AND year = '2024' 
  AND month = '07'
LIMIT 100;

-- Count notifications by status for a date range
SELECT status, COUNT(*) as count
FROM notification_archive.notifications
WHERE createdAt >= TIMESTAMP '2024-07-01'
  AND createdAt < TIMESTAMP '2024-08-01'
GROUP BY status
ORDER BY count DESC;

-- Failed deliveries by channel
SELECT channel, COUNT(*) as failures
FROM notification_archive.delivery_reports
WHERE status = 'failed'
  AND year = '2024'
  AND month = '07'
GROUP BY channel
ORDER BY failures DESC;

-- Find specific notification by ID (requires year for performance)
SELECT * 
FROM notification_archive.notifications
WHERE _id = 'abc123'
  AND year = '2024';

-- Delivery success rate by channel
SELECT 
  channel,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
  ROUND(100.0 * SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM notification_archive.delivery_reports
WHERE year = '2024' AND month = '07'
GROUP BY channel;
```

**Performance Tips:**
- Always filter by `year` and `month` (partition columns)
- Use `LIMIT` for exploratory queries
- Create views for frequently used queries

### Option 3: S3 Select (Single File Query)

**Best for:** Querying a single S3 file without downloading

```bash
# Query specific records from S3 directly
aws s3api select-object-content \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson \
  --expression "SELECT * FROM s3object[*] s WHERE s.recipient = 'customer@example.com'" \
  --expression-type SQL \
  --input-serialization '{"JSON": {"Type": "LINES"}}' \
  --output-serialization '{"JSON": {}}' \
  output.json
```

**Use Cases:**
- Query single day's data
- Filter before downloading
- Reduce data transfer costs

### Comparison of Query Methods

| Method | Setup Time | Query Speed | Cost | Best For |
|--------|-----------|-------------|------|----------|
| **grep/jq** | None | Instant (after download) | FREE | Single file, known date |
| **Athena** | 5 min (one-time) | Fast (5-30 sec) | ~$5/TB scanned | Multi-month analysis, SQL |
| **S3 Select** | None | Medium | $0.002/GB scanned | Single file filtering |
| **mongoimport + query** | None | Fast | FREE | Complex MongoDB queries |


---

## Cost Analysis

### Storage Cost Comparison

#### MongoDB vs S3 (Per 100 GB)

| Storage | Monthly Cost | Annual Cost | Notes |
|---------|-------------|-------------|-------|
| **MongoDB** | $150-200 | $1,800-2,400 | Includes compute, backup, replication |
| **S3 Frequent** | $2.30 | $27.60 | 0-90 days after archival |
| **S3 Archive** | $0.40 | $4.80 | 90-180 days after archival |
| **S3 Deep Archive** | $0.10 | $1.20 | 180+ days after archival |

**Savings:** 99% reduction in storage costs by archiving to S3

### Detailed Cost Breakdown

**Scenario: 100 GB of notification data stored for 1 year**

| Period | Storage Tier | Storage Cost | Retrieval Cost (5 accesses) | Subtotal |
|--------|--------------|-------------|----------------------------|----------|
| **Month 1-3** (0-90 days) | Frequent Access | $6.90 | FREE | **$6.90** |
| **Month 4-6** (90-180 days) | Archive Access | $1.20 | $15.00 ($3 per access) | **$16.20** |
| **Month 7-12** (180+ days) | Deep Archive | $0.59 | $2.25 ($0.45 per access) | **$2.84** |
| **Year 1 Total** | | | | **$25.94** |
| **Year 2+ (all Deep Archive)** | Deep Archive | $1.20 | $2.25 (if accessed) | **$3.45** |

**Compare to MongoDB:** $1,800-2,400 per year for same 100 GB

### Real-World Cost Example

**Assumptions:**
- 1 million notifications per day
- ~300 bytes average per NDJSON record
- 300 GB per day archived
- 100 TB per year total

**Annual Costs:**

| Component | Cost |
|-----------|------|
| **Storage (mostly Deep Archive)** | ~$1,000/year |
| **Retrieval (occasional queries)** | ~$100/year |
| **Data Transfer (egress)** | ~$50/year |
| **Lambda Execution** | ~$50/year |
| **Total** | **~$1,200/year** |

**MongoDB Equivalent:** ~$180,000/year for 100 TB

**Annual Savings:** $178,800 (99.3% reduction)

### Retrieval Costs

| Data Age | Storage Tier | Retrieval Time | Cost per 100 GB |
|----------|--------------|----------------|-----------------|
| 0-90 days | Frequent Access | Instant | **FREE** |
| 90-180 days | Archive Access | Instant | $3.00 |
| 180+ days | Deep Archive | 12-48 hours | $2.25 + restore fee |

**Key Insight:** Most retrieval costs come from Archive Access (90-180 days), not Deep Archive.

### Cost Optimization Tips

1. **Remove Deep Archive Tier** (if frequent access needed)
   - Save operational time (no 12-48hr waits)
   - Small cost increase ($0.003/GB/month)
   - Worth it for customer support use cases

2. **Use Athena for Queries** (instead of downloading)
   - Pay only for data scanned (~$5/TB)
   - No download egress charges
   - Faster than downloading large files

3. **Partition by Date** (already implemented)
   - Athena only scans relevant files
   - Reduced query costs
   - Example: Query July 2024 only scans July files

4. **Intelligent-Tiering** (already enabled)
   - Automatic cost optimization
   - No manual tier management
   - Optimizes based on access patterns

### Cost vs Benefit Analysis

| Benefit | Value |
|---------|-------|
| **Storage cost savings** | $178,800/year (for 100 TB) |
| **MongoDB performance** | Faster queries on smaller dataset |
| **Compliance** | Indefinite retention for audit |
| **Scalability** | Linear cost scaling with data |

| Trade-off | Impact |
|-----------|--------|
| **Deep Archive delay** | 12-48hr wait for old data |
| **Retrieval costs** | Small fee for accessing archived data |
| **Query complexity** | Need Athena or restoration for complex queries |
| **Operational overhead** | Managing S3, occasional restorations |

**Verdict:** Massive cost savings far outweigh trade-offs for historical data

---

## Frequently Asked Questions

### General Questions

**Q1: What happens if the archival job fails for a day?**

**A:** The system automatically catches up on the next successful run. The job queries for ALL records older than the threshold (not just new records since last run), so no data is missed. No manual intervention needed.

**Example:**
- Monday: Job fails, nothing archived
- Tuesday: Job runs, archives BOTH Monday's and Tuesday's eligible records

---

**Q2: How do I know if yesterday's job ran successfully?**

**A:** Check CloudWatch:
```bash
# View job logs
aws logs tail /aws/lambda/notification-hub-prod-notificationArchivalJob --since 1d

# Check for success message
aws logs filter-pattern \
  --log-group-name /aws/lambda/notification-hub-prod-notificationArchivalJob \
  --filter-pattern "Summary" \
  --since 1d
```

Or check S3 for new files:
```bash
aws s3 ls s3://notification-hub-archival-prod/Notification/2026/07/06/
```

---

**Q3: Can I run the archival job manually?**

**A:** Yes, invoke the Lambda function directly:
```bash
aws lambda invoke \
  --function-name notification-hub-prod-notificationArchivalJob \
  --log-type Tail \
  response.json
```

Safe to run anytime (idempotent) - won't create duplicates.

---

**Q4: Will archiving impact production performance?**

**A:** No. The job:
- Runs at 4:00 AM IST (low traffic)
- Uses batch processing (1000 records at a time)
- Includes sleep between batches
- Uses MongoDB read replicas if configured
- Timeout: 15 minutes max

Tested with 1.25M records: 166 seconds (18% of timeout), zero impact on production.

---

### Restoration Questions

**Q5: How do I find a notification sent 2 years ago?**

**A:** Three methods:

**Method 1: Quick lookup** (if you know the date)
```bash
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson ./
grep '"recipient":"user@example.com"' notification-2024-07-07.ndjson | jq '.'
```

**Method 2: Athena SQL** (if you don't know the date)
```sql
SELECT * FROM notification_archive.notifications
WHERE recipient = 'user@example.com'
  AND year = '2024'
LIMIT 10;
```

**Method 3: Import to MongoDB temporarily**
```bash
mongoimport --collection=notifications_temp --file=notification-2024-07-07.ndjson
mongo --eval "db.notifications_temp.find({recipient: 'user@example.com'})"
```

---

**Q6: Can I import archived NDJSON files back into MongoDB?**

**A:** Yes! NDJSON is MongoDB's native format:

```bash
mongoimport --uri="mongodb://localhost:27017/notification-prod" \
  --collection=notifications \
  --file=notification-2024-07-07.ndjson
```

Works perfectly out of the box - no conversion needed.

---

**Q7: What if I need data that's in Deep Archive (180+ days old)?**

**A:** Request a restore (wait 12-48 hours):

```bash
# Step 1: Request restore
aws s3api restore-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson \
  --restore-request '{"Days":1,"GlacierJobParameters":{"Tier":"Standard"}}'

# Step 2: Wait 12-48 hours (AWS will email when ready)

# Step 3: Download
aws s3 cp s3://notification-hub-archival-prod/Notification/2024/07/07/notification-2024-07-07.ndjson ./
```

**Alternative:** Use Athena - it can query Deep Archive directly (still slower than regular S3 but no manual restore).

---

**Q8: Will restored records be immediately deleted by TTL?**

**A:** Only for DeliveryReportHistory (8-month TTL). Solution:

```bash
# Drop TTL before import
mongo --eval 'db.deliveryreporthistories.dropIndex("createdAt_1")'

# Import data
mongoimport ...

# Optionally re-enable TTL later
```

**Notification collection:** No TTL, safe to import anytime.

---

### Data Retention Questions

**Q9: How long is data kept in S3?**

**A:** Indefinitely. There is no automatic deletion. Data is retained forever for compliance and audit purposes.

**Previous policy:** 7 years (removed per business requirements)

---

**Q10: What's the difference between archival threshold and retention?**

**A:**
- **Archival Threshold:** When data moves from MongoDB to S3
  - Notification: 395 days
  - DeliveryReportHistory: 180 days

- **Retention:** How long data stays in S3
  - Current: Indefinite (forever)

---

**Q11: Can I change the archival threshold?**

**A:** Yes, update environment variable in `serverless.deploy.yml`:

```yaml
deliveryReportHistoryArchivalJob:
  environment:
    ARCHIVAL_THRESHOLD_DAYS: 180  # Change this value
```

Deploy changes: `serverless deploy`

**Common values:**
- 180 days (6 months) - DeliveryReportHistory
- 395 days (13 months) - Notification
- 30 days (1 month) - Aggressive archival
- 730 days (2 years) - Extended retention

---

### Storage Tier Questions

**Q12: Should I remove the Deep Archive tier?**

**A:** Consider removing if:
- ✅ You need instant access to old data (e.g., customer support)
- ✅ 12-48 hour wait is unacceptable
- ✅ You query archived data frequently

Keep Deep Archive if:
- ✅ Historical data rarely accessed
- ✅ Planned retrievals acceptable
- ✅ Want maximum cost savings
- ✅ Compliance/legal hold use case

**Cost difference:** $0.004/GB vs $0.001/GB per month (after 180 days)

---

**Q13: What's the total age of data in each tier?**

**DeliveryReportHistory:**
| Total Age | MongoDB | S3 Tier |
|-----------|---------|---------|
| 0-180 days | ✅ Active | - |
| 180-270 days | - | Frequent Access (instant) |
| 270-360 days | - | Archive Access (instant) |
| 360+ days | - | Deep Archive (12-48hr) |

**Notification:**
| Total Age | MongoDB | S3 Tier |
|-----------|---------|---------|
| 0-395 days | ✅ Active | - |
| 395-485 days | - | Frequent Access (instant) |
| 485-575 days | - | Archive Access (instant) |
| 575+ days | - | Deep Archive (12-48hr) |

---

### Technical Questions

**Q14: Why NDJSON instead of JSON array or CSV?**

**A:** NDJSON advantages:
- ✅ MongoDB's native format (`mongoimport` support)
- ✅ Stream processing (memory efficient)
- ✅ One record per line (easy grep/search)
- ✅ No need to load entire file into memory
- ✅ Handles large files (millions of records)
- ✅ Human-readable

**JSON array issues:**
- ❌ Must load entire file into memory
- ❌ Difficult to process line-by-line
- ❌ Not MongoDB's native format

**CSV issues:**
- ❌ Nested objects problematic
- ❌ Type information lost
- ❌ Harder to restore to MongoDB

---

**Q15: What is the three-layer S3 verification?**

**A:** Safety mechanism before deleting from MongoDB:

**Layer 1:** Upload completes without exceptions
**Layer 2:** AWS HeadObject API confirms file exists
**Layer 3:** File size reasonable (50-5000 bytes per record)

If ANY layer fails → data stays in MongoDB (no deletion)

**Why important:** Prevents data loss if S3 upload silently fails or gets corrupted.

---

**Q16: How does compound cursor pagination work?**

**A:** Prevents skipping/duplicating records when multiple records have the same `createdAt`:

**Sort order:** `createdAt ASC, _id ASC`

**Query logic:**
```
First batch: createdAt < cutoffDate
Next batches: 
  (createdAt > lastCreatedAt AND createdAt < cutoffDate) OR
  (createdAt = lastCreatedAt AND _id > lastId)
```

This ensures stable pagination across batches even when dates collide.

---

**Q17: How are files organized in S3?**

**A:** Hierarchical structure by date:

```
{Collection}/{YYYY}/{MM}/{DD}/{collection}-{date}.ndjson
```

Example:
```
Notification/2024/07/07/notification-2024-07-07.ndjson
```

**Benefits:**
- Easy to locate specific dates
- Athena can partition by year/month/day
- Reduced query costs (only scan relevant files)
- Organized browsing

---

**Q18: What's the Lambda timeout and why 15 minutes?**

**A:** Timeout: 900 seconds (15 minutes)

**Why sufficient:**
- Load tested with 1.25M records: 166 seconds (18% of timeout)
- Batch processing: 1000 records at a time
- Average: ~9,000 records/second
- Headroom for variations and retries

**What if timeout occurs:**
- Next day's job catches up (idempotent)
- Partial archival still valid (per-date-group processing)
- CloudWatch alarm triggers for investigation

---

**Q19: Can I query archived data without downloading or importing?**

**A:** Yes, use AWS Athena:

```sql
SELECT * FROM notification_archive.notifications
WHERE recipient = 'user@example.com'
  AND year = '2024'
LIMIT 10;
```

Athena queries S3 directly, no download needed. Cost: ~$5 per TB scanned.

---

**Q20: What happens to records that fail S3 verification?**

**A:**
1. S3 upload attempted
2. Verification fails (file missing or wrong size)
3. MongoDB deletion **skipped** for that date group
4. Error logged to CloudWatch
5. Records remain in MongoDB
6. Next day's job will retry archival

**Result:** No data loss - records preserved until successful archival.


---

## Troubleshooting

### Issue 1: Archival Job Failed

**Symptoms:**
- CloudWatch alarm triggered
- No new S3 files created
- Records remain in MongoDB

**Diagnosis:**

```bash
# Check Lambda logs
aws logs tail /aws/lambda/notification-hub-prod-notificationArchivalJob --follow

# Check for errors
aws logs filter-pattern \
  --log-group-name /aws/lambda/notification-hub-prod-notificationArchivalJob \
  --filter-pattern "ERROR" \
  --since 1d

# Verify S3 files exist
aws s3 ls s3://notification-hub-archival-prod/Notification/2026/07/06/

# Count eligible MongoDB records
mongo notification-prod --eval '
  db.notifications.countDocuments({
    createdAt: { $lt: new Date(Date.now() - 395 * 24 * 60 * 60 * 1000) }
  })
'
```

**Common Causes:**
1. **Lambda timeout** - Job taking >15 minutes
2. **MongoDB connection** - Network issues or authentication
3. **S3 permissions** - IAM role missing PutObject permission
4. **Memory exhaustion** - Too many records in batch

**Solution:**
- Next day's job will automatically catch up (idempotent)
- For persistent failures, check Lambda configuration
- Review IAM permissions
- Verify MongoDB connectivity

---

### Issue 2: S3 Verification Failed

**Symptoms:**
- Logs show "S3 verification FAILED"
- Files uploaded to S3 but not deleted from MongoDB
- Potential duplicate records on next run

**Diagnosis:**

```bash
# Check if file exists
aws s3api head-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2026/07/06/notification-2026-07-06.ndjson

# Check file size
aws s3 ls --human-readable \
  s3://notification-hub-archival-prod/Notification/2026/07/06/

# Download and verify locally
aws s3 cp s3://notification-hub-archival-prod/Notification/2026/07/06/notification-2026-07-06.ndjson ./
wc -l notification-2026-07-06.ndjson
```

**Common Causes:**
1. **File too small** - Empty records or upload interrupted
2. **File too large** - Unusual for errors, but possible with very long error messages
3. **S3 eventual consistency** - Rare, but HeadObject might not see just-uploaded file

**Solution:**
- If file is valid: Delete from S3, next run will re-upload
- If file is corrupt: Delete from S3 and MongoDB records (they'll be re-archived)
- If persistent: Check S3 multipart upload logic

---

### Issue 3: Deep Archive Restore Taking Too Long

**Symptoms:**
- Requested restore >24 hours ago
- File still not accessible
- "ongoing-request=true" in HeadObject response

**Diagnosis:**

```bash
# Check restore status
aws s3api head-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson

# Look for:
# - "Restore: ongoing-request="true"" → still restoring
# - "Restore: ongoing-request="false"" → ready to download
```

**Expected Times:**
- **Standard Tier:** 12-48 hours (varies by AWS load)
- **Expedited Tier:** 1-5 minutes (very expensive)

**Solution:**
- **Wait:** Standard restore can take full 48 hours during peak times
- **Expedited:** If urgent, request expedited restore:

```bash
aws s3api restore-object \
  --bucket notification-hub-archival-prod \
  --key Notification/2024/07/07/notification-2024-07-07.ndjson \
  --restore-request '{"Days":1,"GlacierJobParameters":{"Tier":"Expedited"}}'
```

**Cost:** ~$0.03/GB for expedited vs $0.0025/GB for standard

---

### Issue 4: mongoimport Fails with Duplicate Key Errors

**Symptoms:**
- `mongoimport` shows "E11000 duplicate key error"
- Only partial import successful
- Records already exist in MongoDB

**Solution:**

```bash
# Option 1: Use upsert mode (update existing, insert new)
mongoimport --mode=upsert --upsertFields=_id \
  --uri="..." --collection=notifications --file=...

# Option 2: Continue on errors (skip duplicates)
mongoimport --stopOnError=false \
  --uri="..." --collection=notifications --file=...

# Option 3: Import to temporary collection first
mongoimport --collection=notifications_temp --file=...
# Then manually merge or query
```

**Prevention:**
- Use temporary collections for investigation
- Check if records already exist before importing
- Use upsert mode by default

---

### Issue 5: Restored Records Immediately Deleted (DeliveryReportHistory)

**Symptoms:**
- Import succeeds but records disappear within seconds
- TTL index actively deleting old records

**Diagnosis:**

```bash
# Check TTL indexes
mongo notification-prod --eval '
  db.deliveryreporthistories.getIndexes().forEach(function(idx) {
    if (idx.expireAfterSeconds) {
      print("TTL Index: " + idx.name + " expires after " + idx.expireAfterSeconds + " seconds");
    }
  })
'
```

**Solution:**

```bash
# Step 1: Drop TTL index before import
mongo notification-prod --eval 'db.deliveryreporthistories.dropIndex("createdAt_1")'

# Step 2: Import data
mongoimport --uri="..." --collection=deliveryreporthistories --file=...

# Step 3: Optionally re-enable TTL (only if you want auto-deletion)
mongo notification-prod --eval '
  db.deliveryreporthistories.createIndex(
    { "createdAt": 1 }, 
    { expireAfterSeconds: 20736000 }
  )
'
```

**Note:** Notification collection has no TTL, no special handling needed.

---

### Issue 6: Athena Query Returns No Results

**Symptoms:**
- Athena query runs successfully but returns 0 rows
- Data definitely exists in S3

**Common Causes:**

1. **Missing partition filters:**
```sql
-- ❌ Slow and expensive (scans everything)
SELECT * FROM notification_archive.notifications
WHERE recipient = 'user@example.com';

-- ✅ Fast and cheap (scans only relevant partitions)
SELECT * FROM notification_archive.notifications
WHERE recipient = 'user@example.com'
  AND year = '2024' 
  AND month = '07';
```

2. **SERDE issues:**
- Verify table created with `org.openx.data.jsonserde.JsonSerDe`
- Check NDJSON format (one JSON per line)

3. **S3 path incorrect:**
```sql
-- Verify LOCATION points to correct bucket
SHOW CREATE TABLE notification_archive.notifications;
```

**Solution:**
- Always include year and month filters
- Recreate table if SERDE wrong
- Verify S3 path matches actual data location

---

### Issue 7: Lambda Running Out of Memory

**Symptoms:**
- Lambda error: "Process exited before completing request"
- Logs show gradual memory increase
- Timeout during large batches

**Diagnosis:**

```bash
# Check Lambda memory configuration
aws lambda get-function-configuration \
  --function-name notification-hub-prod-notificationArchivalJob \
  | jq '.MemorySize, .Timeout'
```

**Solution:**
- Reduce batch size (environment variable `BATCH_SIZE`)
- Increase Lambda memory allocation
- Ensure batch arrays are cleared between iterations

---

### Issue 8: CloudWatch Alarm Triggered

**Symptoms:**
- Email alert received
- "Archival Job Error" alarm triggered

**Response Steps:**

1. **Check job status:**
```bash
aws logs tail /aws/lambda/notification-hub-prod-notificationArchivalJob --since 1h
```

2. **Verify S3 files created:**
```bash
aws s3 ls s3://notification-hub-archival-prod/Notification/$(date -u +%Y/%m/%d)/
```

3. **Check for errors:**
```bash
aws logs filter-pattern \
  --log-group-name /aws/lambda/notification-hub-prod-notificationArchivalJob \
  --filter-pattern "ERROR" \
  --since 1d
```

4. **Assess impact:**
- Records remain in MongoDB (safe)
- Next day's job will catch up
- No immediate action required unless repeated failures

---

## Performance Benchmarks

### Load Test Results (V2 - Latest)

**Test Configuration:**
- MongoDB: Dockerized local instance
- S3: LocalStack (simulated)
- Environment: MacBook Pro (representative of Lambda performance)
- Date Range: December 4-8, 2025 (5 days)

### DeliveryReportHistory Performance

| Metric | Value |
|--------|-------|
| **Total Records** | 1,000,000 |
| **Records/Day** | 200,000 |
| **Date Range** | 5 days |
| **Archival Time** | 107 seconds |
| **Throughput** | 9,346 records/second |
| **S3 Files Created** | 6 files (1 per day) |
| **Success Rate** | 100% (0 failures) |
| **Data Loss** | 0 records |

### Notification Performance

| Metric | Value |
|--------|-------|
| **Total Records** | 250,000 |
| **Records/Day** | 50,000 |
| **Date Range** | 5 days |
| **Archival Time** | 59 seconds |
| **Throughput** | 4,237 records/second |
| **S3 Files Created** | 6 files (1 per day) |
| **Success Rate** | 100% (0 failures) |
| **Data Loss** | 0 records |

### Combined Performance

| Metric | Value |
|--------|-------|
| **Total Records** | 1,250,000 |
| **Total Time** | 166 seconds (2 min 46 sec) |
| **Lambda Timeout** | 900 seconds (15 minutes) |
| **Timeout Utilization** | 18% |
| **Headroom** | 82% (734 seconds remaining) |

### S3 File Sizes

| Collection | Avg Bytes/Record | 1M Records (approx) |
|------------|------------------|---------------------|
| DeliveryReportHistory | 270 bytes | 270 MB |
| Notification | 350 bytes | 350 MB |

**With GZIP compression:** ~50-70% reduction

### Scalability Projections

| Daily Volume | Archival Time | Lambda Timeout % |
|--------------|---------------|------------------|
| 100K records | ~15 seconds | 2% |
| 500K records | ~75 seconds | 8% |
| 1M records | ~150 seconds | 17% |
| 2M records | ~300 seconds | 33% |
| 5M records | ~750 seconds | 83% |

**Recommendation:** Current 15-minute timeout sufficient for up to 5 million records per day.

### MongoDB Query Performance

| Operation | Time (1M records) |
|-----------|-------------------|
| Find first batch | ~50ms |
| Find subsequent batch | ~10ms |
| Delete batch (1000 records) | ~20ms |

**Compound cursor pagination:** Prevents performance degradation with large offsets.

---

## Best Practices

### 1. Regular Testing

**Quarterly:**
- Test restoration process with real data
- Verify Athena queries work
- Practice emergency recovery scenarios
- Validate S3 file integrity with checksums

**Monthly:**
- Review CloudWatch logs for warnings
- Check S3 storage costs
- Verify archival job success rate

### 2. Monitoring

**Set up alerts for:**
- Lambda function failures
- S3 verification failures
- Execution time exceeding 50% of timeout
- Unexpected increase in failed deletions

**Monitor metrics:**
- Records archived per day
- S3 storage size growth
- Query/retrieval frequency
- Cost trends

### 3. Access Control

**S3 Bucket:**
- Restrict access to DevOps and authorized personnel
- Enable versioning for accident recovery
- Enable access logging for audit trail
- Use bucket policies to prevent accidental deletion

**Lambda Functions:**
- IAM role with minimum required permissions
- CloudWatch Logs for audit trail
- No public access

### 4. Cost Management

**Optimize costs:**
- Use Athena instead of downloading full files
- Filter by year/month in Athena queries (partition pruning)
- Consider removing Deep Archive if data frequently accessed
- Monitor retrieval costs separately from storage

**Budget alerts:**
- Set up AWS Budget alerts for S3 storage
- Alert if retrieval costs exceed expected
- Track month-over-month growth

### 5. Documentation

**Maintain:**
- Runbook for common restoration scenarios
- Contact list for archival system issues
- Decision log for threshold changes
- Compliance documentation for audit

### 6. Data Governance

**Regular reviews:**
- Audit archived data retention policy
- Verify compliance with data regulations (GDPR, etc.)
- Document data lifecycle in compliance reports
- Review access logs quarterly

### 7. Backup Strategy

**Even though data is in S3:**
- Enable S3 versioning (accidental deletion protection)
- Consider S3 Cross-Region Replication for disaster recovery
- Test restoration process regularly
- Document recovery time objectives (RTO)

---

## Related Documentation

- **S3 Structure Details:** `S3_STRUCTURE.md`
- **Executive Summary:** `ARCHIVAL_EXECUTIVE_SUMMARY.md`
- **Load Test Results:** `load-testing/LOAD_TEST_RESULTS.md`
- **S3 Verification Safety:** `load-testing/S3_VERIFICATION_SAFETY.md`
- **Quick Reference Guide:** `docs/ARCHIVAL_QUICK_REFERENCE.md`

---

## Support and Contact

### For Issues

1. **Check CloudWatch Logs:**
   - `/aws/lambda/notification-hub-{env}-notificationArchivalJob`
   - `/aws/lambda/notification-hub-{env}-deliveryReportHistoryArchivalJob`

2. **Verify S3:**
   - Bucket: `notification-hub-archival-{env}`
   - Check for recent files in expected date folders

3. **Contact DevOps Team:**
   - Check team contact list in wiki
   - Include CloudWatch log URLs in ticket
   - Specify date range affected

### AWS Resources

- [S3 Intelligent-Tiering Documentation](https://aws.amazon.com/s3/storage-classes/intelligent-tiering/)
- [Glacier Restore Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects.html)
- [Athena Query Guide](https://docs.aws.amazon.com/athena/latest/ug/querying.html)
- [Lambda Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions.html)

### MongoDB Resources

- [mongoimport Documentation](https://docs.mongodb.com/database-tools/mongoimport/)
- [TTL Index Documentation](https://docs.mongodb.com/manual/core/index-ttl/)
- [Cursor Pagination Best Practices](https://docs.mongodb.com/manual/reference/method/cursor.sort/)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-07 | Initial documentation |

**Maintained By:** Notification Hub Development Team  
**Last Reviewed:** 2026-07-07

---

## Appendix: Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCHIVAL_THRESHOLD_DAYS` | 395 (Notification), 180 (DeliveryReport) | Days before archival |
| `BATCH_SIZE` | 1000 | Records per batch |
| `ARCHIVAL_BUCKET_NAME` | notification-hub-archival-{env} | S3 bucket name |
| `AWS_REGION` | ap-south-1 | AWS region |
| `MONGO_CONNECTION_URL` | - | MongoDB connection string |

### Lambda Configuration

| Setting | Value |
|---------|-------|
| **Timeout** | 900 seconds (15 min) |
| **Memory** | 1024 MB (configurable) |
| **Runtime** | Node.js 18.x |
| **Handler** | handler function |
| **Schedule** | cron(30 22 * * ? *) |

### S3 Lifecycle Configuration

```yaml
IntelligentTieringConfigurations:
  - Days: 90
    AccessTier: ARCHIVE_ACCESS
  - Days: 180
    AccessTier: DEEP_ARCHIVE_ACCESS

Retention: Indefinite (no expiration)
```

---

**END OF DOCUMENTATION**
