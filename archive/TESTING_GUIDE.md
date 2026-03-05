# VIGIA End-to-End Testing Guide

## Prerequisites

1. **Start the development server:**
```bash
cd packages/frontend
npm run dev
```

2. **Open browser:**
- Navigate to `http://localhost:3000`
- Open DevTools (F12) → Console tab
- Keep console open to monitor logs

## Test Sequence

### ✅ Test 1: Create First Session

**Steps:**
1. Click "New Session" button in sidebar
2. Search for "Boston"
3. Select "Boston, Massachusetts, United States" from dropdown
4. Wait for map to load (should center on Boston, NOT your location)
5. Click "Draw Coverage Area" button
6. Cursor should change to crosshair
7. Drag on map to draw a rectangle
8. Blue bounding box should appear in real-time
9. Release mouse
10. Coverage panel should show:
    - Area: ~X km²
    - Precision: 7 or 8
    - Tiles: ~XXX
11. Click "Create Session"

**Expected Results:**
- ✅ Tab shows: `● Boston-2026-03-03-001`
- ✅ Sidebar shows: `* Boston-2026-03-03-001` under United States → Massachusetts → Boston
- ✅ Map centers on Boston
- ✅ Console shows: "Session created: Boston-2026-03-03-001"

**Console Logs to Verify:**
```
Session clicked: {...}
Loaded full MapFile: {...}
LiveMap: Loading session {...}
LiveMap: Coverage {...}
LiveMap: Centering on {...}
```

---

### ✅ Test 2: Save Session (Cmd+S)

**Steps:**
1. With Boston session open (showing `●`)
2. Press **Cmd+S** (Mac) or **Ctrl+S** (Windows)
3. Wait for toast notification

**Expected Results:**
- ✅ Console shows: "saveActiveSession called"
- ✅ Console shows: "Saving session data"
- ✅ Console shows: "Session saved"
- ✅ Console shows: "Deleted from temporary storage"
- ✅ Toast shows: "Session saved - Boston-2026-03-03-001"
- ✅ `●` disappears from tab
- ✅ `*` disappears from sidebar
- ✅ Session still visible in sidebar (without asterisk)

---

### ✅ Test 3: Create Second Session

**Steps:**
1. Click "New Session" again
2. Search for "Boston" again
3. Select same location
4. Draw a DIFFERENT bounding box (slightly different area)
5. Click "Create Session"

**Expected Results:**
- ✅ New tab: `● Boston-2026-03-03-002` (incremented sequence)
- ✅ Sidebar shows: `* Boston-2026-03-03-002`
- ✅ Both sessions visible in sidebar

---

### ✅ Test 4: Close Unsaved Session

**Steps:**
1. With Boston-002 open (unsaved, showing `●`)
2. Click X on tab
3. Dialog appears: "Do you want to save...?"
4. Click **"No"**

**Expected Results:**
- ✅ Dialog closes
- ✅ Tab closes
- ✅ Toast shows: "Discarded - Boston-2026-03-03-002 was not saved"
- ✅ Session removed from sidebar
- ✅ Console shows no errors

---

### ✅ Test 5: Create Third Session and Save

**Steps:**
1. Create another Boston session (will be 002 again since we discarded the previous one)
2. Press Cmd+S immediately
3. Verify it saves

**Expected Results:**
- ✅ Session saved successfully
- ✅ Now have 2 saved Boston sessions in sidebar

---

### ✅ Test 6: Session Immutability

**Steps:**
1. Open Boston-2026-03-03-001 (first session)
2. Look at status bar - should show: `📸 SNAPSHOT | [timestamp]`
3. Look for "🔄 Update Snapshot" button
4. Keep session open for 30 seconds
5. Check if hazard count changes

**Expected Results:**
- ✅ Snapshot indicator visible
- ✅ Update button visible
- ✅ Hazard count does NOT change (frozen snapshot)
- ✅ No real-time hazards appear

---

### ✅ Test 7: Update Snapshot

**Steps:**
1. With Boston-001 open
2. Click "🔄 Update Snapshot" button
3. Confirmation dialog appears
4. Click "OK"

**Expected Results:**
- ✅ New session created: `Boston-2026-03-03-003`
- ✅ Original Boston-001 still exists
- ✅ New session opens automatically
- ✅ Toast shows: "Updated snapshot created"

---

### ✅ Test 8: Create Diff (Drag & Drop)

**Steps:**
1. In sidebar, find Boston-2026-03-03-001
2. Click and hold on Boston-001
3. Drag it over Boston-002
4. Release mouse (drop)

**Expected Results:**
- ✅ Console shows: "Diff created: Boston-2026-03-03-001-vs-Boston-2026-03-03-002"
- ✅ New tab opens: `📊 Boston-2026-03-03-001-vs-Boston-2026-03-03-002`
- ✅ Toast shows: "Diff Created"

---

### ✅ Test 9: Diff View UI

**Steps:**
1. With diff tab open, verify layout:

**Expected Results:**
- ✅ Two maps side-by-side
- ✅ Left map labeled: "Boston-2026-03-03-001"
- ✅ Right map labeled: "Boston-2026-03-03-002"
- ✅ Statistics panel shows:
  - New: X
  - Fixed: X
  - Worsened: X
  - Degradation Score: XX.X
- ✅ Chat panel on right (400px width)
- ✅ "Sync Maps" toggle visible

---

### ✅ Test 10: Hazard Markers

**Steps:**
1. Look at both maps
2. Identify colored markers

**Expected Results:**
- ✅ Red markers (●) = New hazards (only on right map)
- ✅ Green markers (✓) = Fixed hazards (only on left map)
- ✅ Orange markers (▲) = Worsened hazards (on both maps)
- ✅ Gray markers (○) = Unchanged hazards (on both maps)
- ✅ Click marker → Popup shows hazard details

---

### ✅ Test 11: Synchronized Navigation

**Steps:**
1. Verify "Sync Maps" is checked
2. Click and drag on left map
3. Observe right map

**Expected Results:**
- ✅ Right map moves in sync with left map
- ✅ Zoom on left → right zooms too
- ✅ Uncheck "Sync Maps" → maps move independently
- ✅ Re-check → sync resumes

---

### ✅ Test 12: Agent Analysis

**Steps:**
1. Look at chat panel on right
2. Wait for initial message to appear (may take 5-10 seconds)

**Expected Results:**
- ✅ Chat shows "🤖 Infrastructure Analysis Agent" header
- ✅ First message appears with:
  - **Analysis Summary**
  - **Degradation Assessment**
  - **Recommendations** (numbered list)
- ✅ Console shows: "Diff analysis complete"
- ✅ If Bedrock fails, fallback analysis appears

---

### ✅ Test 13: Interactive Chat

**Steps:**
1. In chat input, type: "What are the main issues?"
2. Press Enter
3. Wait for response

**Expected Results:**
- ✅ Your message appears (blue bubble, right-aligned)
- ✅ Loading indicator appears
- ✅ Agent response appears (gray bubble, left-aligned)
- ✅ Response is context-aware (mentions specific hazards/locations)

**Try these questions:**
- "Which areas worsened the most?"
- "What should be prioritized for maintenance?"
- "How many new potholes were detected?"

---

### ✅ Test 14: Save Diff (Cmd+S)

**Steps:**
1. With diff tab open
2. Press Cmd+S
3. Wait for toast

**Expected Results:**
- ✅ Toast shows: "Diff saved - [diff name]"
- ✅ Console shows: "Diff saved to IndexedDB"
- ✅ No errors in console

---

### ✅ Test 15: Verify Persistence

**Steps:**
1. Refresh browser (F5)
2. Check sidebar

**Expected Results:**
- ✅ All saved sessions still visible
- ✅ Temporary sessions (with `*`) are gone
- ✅ Can click and open saved sessions
- ✅ Map centers correctly on each session

---

### ✅ Test 16: Delete Session

**Steps:**
1. Right-click on a session in sidebar
2. Click "Delete"
3. Confirmation dialog appears
4. Click "OK"

**Expected Results:**
- ✅ Session removed from sidebar
- ✅ If tab was open, it closes
- ✅ Toast shows: "Session deleted successfully"
- ✅ Deleted from both temporary AND permanent storage

---

### ✅ Test 17: Storage Limits

**Steps:**
1. Check browser DevTools → Application → IndexedDB
2. Expand "VigiaMapFiles"
3. Check stores:
   - mapFiles
   - branches
   - diffMaps

**Expected Results:**
- ✅ Saved sessions in `mapFiles`
- ✅ Diffs in `diffMaps`
- ✅ No temporary sessions (they were deleted after save)

---

## Common Issues & Solutions

### Issue: Map shows Rourkela instead of Boston
**Solution:** 
- Check console for "LiveMap: Centering on" log
- Verify session has `coverage.centerPoint` data
- Try creating a new session

### Issue: Drag-drop doesn't create diff
**Solution:**
- Check console for errors
- Verify both sessions have hazard data
- Try refreshing and dragging again

### Issue: Agent analysis doesn't appear
**Solution:**
- Check console for "Failed to fetch agent analysis"
- Fallback analysis should appear even if Bedrock fails
- Check network tab for API call to `/diff-analysis`

### Issue: Cmd+S doesn't save
**Solution:**
- Check console for "saveActiveSession called"
- Verify VFSManager is initialized
- Check for error messages in console

---

## Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ All features working as expected
- ✅ Sessions are immutable snapshots
- ✅ Diff creation works via drag-and-drop
- ✅ Agent provides meaningful analysis
- ✅ Storage persists across refresh

---

## Report Issues

If any test fails, note:
1. Which test failed
2. Console error messages
3. Expected vs actual behavior
4. Screenshots if applicable
