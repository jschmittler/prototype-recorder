---
name: Autodesk Post-Purchase Onboarding
url: https://pull-doll-48384505.figma.site/
viewport: 1440x900
target_seconds: 85
output: autodesk-post-purchase-onboarding-walkthrough.webm
close_ignore: ["payment failed"]
---

<!--
  Reference journey for the Autodesk post-purchase onboarding prototype.
  This reproduces the original hand-built walkthrough entirely from the DSL.
  See PLAYBOOK.md for how to author a script for a new prototype, and
  script.template.md for the full step vocabulary.
-->

## 1. Signed-out landing page
- waitFor "Sign In"
- pause 2.2s
- click "Sign In" 0.9s
- waitFor text "Welcome back, Maya."

## 2. Survey the homepage
- pause 0.4s
- scrollBy 700 1.2s
- pause 0.55s
- scrollBy 800 1.3s
- pause 0.55s
- scrollToBottom 2.0s
- pause 0.8s
- scrollToTop 1.3s
- pause 0.5s

## 3. Search
- fill placeholder "Search" "Fusion"
- waitFor text "RESULTS"
- pause 2s
- closeOverlay
- waitForHidden text "RESULTS"

## 4. Maya profile
- click /Maya/ 1.0s
- waitFor "Close"
- clickEach ["Home", "Apps", "Files", "Benefits", "Start", "Marketplace"] 0.85s
- click "Close" 0.9s
- waitFor text "Welcome back, Maya."

## 5. Starter Path
- scrollTo /View starter path/i
- click /View starter path/i 1.2s
- pause 0.8s
- scrollOverlayToBottom 2.0s
- pause 0.7s
- closeOverlay
- waitFor text "Welcome back, Maya."

## 6. Your Alerts
- scrollTo text "YOUR ALERTS"
- pause 0.6s
- click /EXPIRING/ 1.1s
- click /OPPORTUNITIES/ 1.1s

## 7. Recommended workflow
- scrollTo /Start recommended workflow/i
- click /Start recommended workflow/i 1.2s
- pause 2s
- closeOverlay
- pause 0.7s

## 8. Products
- scrollToTop 0.9s
- click role button "Products" 1.2s
- waitFor text "Products I own"
- scrollTo text "Products I own" 1.1s
- pause 0.8s
- click /Fusion.*Flex Plan/i 1.2s
- click /AutoCAD.*Single-user/i 1.2s
- scrollToBottom 2.1s
- pause 0.8s

## 9. Assistant
- click /Open Autodesk Assistant/i 1.2s
- pause 2s
- closeOverlay
- pause 0.7s

## 10. Return home
- scrollToTop 1.0s
- click alt "Autodesk" 1.2s
- waitFor text "Welcome back, Maya."
- hold 4s
