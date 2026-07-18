# Accessible report navigation journey

Environment: local production-style Playwright server and controlled sample fixture.

1. Generate the bundled sample and open the completed report.
   - Expected result: one horizontal tablist with eight named tabs and one visible tabpanel.
2. Focus Candidate Brief and use Right Arrow through all eight tabs.
   - Expected result: focus, selection, the controlled panel, and visible content move together.
3. Use Home, End, Right Arrow, and Left Arrow at the boundaries.
   - Expected result: first/last shortcuts and wraparound work; the active tab stays visible.
4. Select a non-ZIP file, then submit with no valid file.
   - Expected result: the file control is invalid, describes its alert, and remains available for recovery.
5. Open a missing stored-report URL.
   - Expected result: the failure is announced and Start a new analysis is keyboard reachable.
6. Open an expired share token.
   - Expected result: the failure is announced and Retry plus Back to home remain keyboard reachable.

Isolation: the bundled sample and temporary Playwright report/share records only. No production records are created or deleted. No analytics read-back is required for this accessibility-only journey; event verification is out of scope because tab changes and recovery navigation do not emit product events.
