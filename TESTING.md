# VIGIA Testing Checklist

## Session Management

### Create Session
- [ ] Search for a location (e.g., "Boston")
- [ ] Select location from dropdown
- [ ] Map loads centered on selected location
- [ ] Click "Draw Coverage Area" button
- [ ] Cursor changes to crosshair
- [ ] Drag on map to draw bounding box
- [ ] Blue rectangle appears in real-time
- [ ] Release mouse to finalize
- [ ] Coverage details panel shows:
  - [ ] Area in km²
  - [ ] Geohash precision
  - [ ] Number of tiles
- [ ] Click "Create Session"
- [ ] Tab shows: `● Boston-2026-03-03-001`
- [ ] Sidebar shows: `* Boston-2026-03-03-001`
- [ ] Map centers on Boston (not current location)

### Save Session (Cmd+S / Ctrl+S)
- [ ] Create a session (shows `●` in tab, `*` in sidebar)
- [ ] Press Cmd+S (Mac) or Ctrl+S (Windows)
- [ ] Console logs show save process
- [ ] Toast shows "Session saved"
- [ ] `●` disappears from tab
- [ ] `*` disappears from sidebar
- [ ] Session appears in sidebar without asterisk
- [ ] Temporary file removed from IndexedDB

### Close Unsaved Session
- [ ] Create a session (unsaved)
- [ ] Click X on tab
- [ ] Dialog appears: "Do you want to save...?"
- [ ] Click "No"
- [ ] Session discarded
- [ ] Removed from sidebar
- [ ] Toast shows "Discarded"

### Close Saved Session
- [ ] Create and save a session
- [ ] Click X on tab
- [ ] No dialog (closes immediately)

### Open Session from Sidebar
- [ ] Click temporary session (`*` prefix)
- [ ] Map centers on correct location
- [ ] Tab shows `●` indicator
- [ ] Click saved session (no `*`)
- [ ] Map centers on correct location
- [ ] Tab shows no `●` indicator

### Delete Session
- [ ] Right-click session in sidebar
- [ ] Click "Delete"
- [ ] Confirmation dialog appears
- [ ] Click "OK"
- [ ] Session removed from both temporary and permanent storage
- [ ] Sidebar refreshes

### Update Session Snapshot
- [ ] Open a saved session
- [ ] Status bar shows: `📸 SNAPSHOT | [timestamp]`
- [ ] Click "🔄 Update Snapshot" button
- [ ] Confirmation dialog appears
- [ ] Click "OK"
- [ ] New session created with incremented sequence number
- [ ] Original session preserved
- [ ] New session opens automatically

## Session Immutability

### Real-time Hazards
- [ ] Open live map (no session selected)
- [ ] Real-time hazards appear as detected
- [ ] Open a session snapshot
- [ ] Real-time hazards DON'T appear
- [ ] Session shows frozen state from creation time

### Temporal Comparison
- [ ] Create Session 1: `Boston-2026-03-01-001`
- [ ] Note hazard count
- [ ] Create Session 2: `Boston-2026-03-15-001`
- [ ] Note hazard count
- [ ] Both sessions maintain their original hazard counts
- [ ] No auto-updates

## Diff Feature (Phase 2)

### Create Diff
- [ ] Open sidebar with 2+ sessions
- [ ] Drag one session
- [ ] Drop onto another session
- [ ] Console shows: "Diff created: [name]"
- [ ] New tab opens with diff view

### Diff View UI
- [ ] Two maps side-by-side
- [ ] Left map shows Session A
- [ ] Right map shows Session B
- [ ] Both maps centered on same location
- [ ] Hazard markers color-coded:
  - [ ] Red = New hazards
  - [ ] Green = Fixed hazards
  - [ ] Orange = Worsened hazards
  - [ ] Gray = Unchanged hazards

### Synchronized Navigation
- [ ] Click hazard on left map
- [ ] Right map centers on same location
- [ ] Click hazard on right map
- [ ] Left map centers on same location
- [ ] Zoom on one map
- [ ] Other map zooms to match

### Diff Statistics Panel
- [ ] Shows total new hazards
- [ ] Shows total fixed hazards
- [ ] Shows total worsened hazards
- [ ] Shows degradation score (0-100)
- [ ] Shows time span between sessions

### Agent Analysis
- [ ] Diff view opens
- [ ] Agent Traces tab shows orchestrator agent
- [ ] Agent automatically analyzes diff
- [ ] Natural language summary appears
- [ ] Degradation assessment shown
- [ ] Recommendations listed

### Interactive Chat
- [ ] Click in chat input
- [ ] Type: "What are the main issues?"
- [ ] Agent responds with context-aware answer
- [ ] Type: "Which areas worsened the most?"
- [ ] Agent provides specific locations
- [ ] Chat history preserved

### Save Diff (.dmap file)
- [ ] Create diff
- [ ] Press Cmd+S
- [ ] Diff saved to permanent storage
- [ ] Appears in sidebar with diff icon
- [ ] Can be reopened later

## Storage & Performance

### IndexedDB (Temporary)
- [ ] Create 10 sessions
- [ ] Check browser DevTools → Application → IndexedDB
- [ ] Verify sessions stored
- [ ] Save all sessions
- [ ] Verify temporary storage cleared

### VFSManager (Permanent)
- [ ] Save sessions
- [ ] Refresh browser
- [ ] Sessions still appear in sidebar
- [ ] Can open saved sessions

### Storage Limits
- [ ] Create 200+ sessions (stress test)
- [ ] Verify LRU eviction works
- [ ] Oldest sessions removed when quota exceeded

## UI/UX

### Monochrome Design
- [ ] All UI uses monochrome palette
- [ ] Backgrounds: #FFFFFF, #F5F5F5
- [ ] Borders: #CBD5E1
- [ ] Diff colors: Red, Green, Orange

### Keyboard Shortcuts
- [ ] Cmd+S / Ctrl+S saves session
- [ ] Cmd+K / Ctrl+K opens command palette
- [ ] Cmd+, / Ctrl+, opens settings

### Visual Indicators
- [ ] `●` = Unsaved tab
- [ ] `*` = Temporary session in sidebar
- [ ] `📸 SNAPSHOT` = Viewing session
- [ ] `🔄` = Update snapshot button

## Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to save session
- [ ] Error message shown
- [ ] Session remains in temporary storage

### Invalid Data
- [ ] Try to create diff with incompatible sessions
- [ ] Error message shown
- [ ] No crash

### Storage Full
- [ ] Fill IndexedDB quota
- [ ] Try to create new session
- [ ] LRU eviction triggers
- [ ] Oldest session removed
- [ ] New session created

## Console Logs (Debug)

### Session Creation
```
Session clicked: {...}
Loaded full MapFile: {...}
LiveMap: Loading session {...}
LiveMap: Coverage {...}
LiveMap: Centering on {...}
```

### Save Process
```
saveActiveSession called {...}
Active tab: {...}
VFSManager: {...}
Saving session data: {...}
Session saved: {...}
Deleted from temporary storage
```

### Diff Creation
```
Diff created: Boston-vs-Boston
Computing diff...
Diff result: {...}
Agent analysis started
```

## Test Data

### Sample Locations
- Boston, Massachusetts, USA
- San Francisco, California, USA
- London, United Kingdom
- Tokyo, Japan

### Sample Workflow
1. Create session: Boston-2026-03-01-001 (50 hazards)
2. Save session
3. Create session: Boston-2026-03-15-001 (75 hazards)
4. Save session
5. Drag Boston-03-01 onto Boston-03-15
6. Diff shows: 25 new hazards, 0 fixed, degradation score: 65
7. Agent analysis: "Road quality has degraded significantly..."

## Success Criteria

- [ ] All session management features work
- [ ] Sessions are immutable snapshots
- [ ] Diff creation works via drag-and-drop
- [ ] Side-by-side maps render correctly
- [ ] Agent provides meaningful analysis
- [ ] Interactive chat responds accurately
- [ ] Storage limits respected
- [ ] No console errors
- [ ] UI is responsive and intuitive
