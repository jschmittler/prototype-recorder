---
name: Trajectory Click-Through
url: https://stem-share-31771571.figma.site/
viewport: 1440x900
target_seconds: 80
output: trajectory-click-through-walkthrough.webm
---

<!--
  Structured version of TrajectoryClickThrough.md (authored from the prose brief
  after inspecting the prototype). Direct published figma.site — no auth, no
  iframe. Nav is a left icon rail: Home, Products, Learn, Community, Marketplace,
  Support, Admin. Product-detail screens expose Overview / Assigned users /
  Subscriptions / Usage tabs; Admin exposes People / Billing / … tabs.
-->

## 1. Landing — orient
- waitFor text "Good afternoon"
- pause 2s
- scrollToBottom 2.2s
- pause 0.8s
- scrollToTop 1.6s
- pause 0.6s

## 2. Open the AutoCAD product
- click /AutoCAD/ 1.2s
- waitFor "Assigned users"
- pause 0.8s

## 3. Toggle product tabs
- click "Assigned users" 1.3s
- click "Subscriptions" 1.3s
- click "Usage" 1.3s

## 4. View all products
- click /^Products$/ 1.2s
- waitFor "Compare usage across teams"
- pause 0.8s

## 5. Manage the Fusion product
- clickInRow "Fusion" "Manage" 1.3s
- waitFor "Assigned users"
- pause 1s

## 6. Learn
- click /^Learn$/ 1.2s
- pause 0.8s

## 7. Survey the Learn page
- scrollToBottom 2.2s
- pause 0.7s
- scrollToTop 1.6s
- pause 0.5s

## 8. Community
- click /^Community$/ 1.2s
- pause 0.8s

## 9. Survey the Community page
- scrollToBottom 2.2s
- pause 0.7s
- scrollToTop 1.6s
- pause 0.5s

## 10. Admin
- click /^Admin$/ 1.2s
- waitFor "Billing"
- pause 0.6s

## 11. Billing tab
- click /^Billing$/ 1.3s
- pause 0.6s
- scrollToBottom 2.2s
- pause 0.8s

## 12. People tab
- click /^People$/ 1.3s
- pause 0.6s
- scrollToBottom 2.2s
- pause 0.8s

## 13. Return home
- scrollToTop 1.0s
- click /^Home$/ 1.2s
- waitFor text "Good afternoon"
- hold 4s
