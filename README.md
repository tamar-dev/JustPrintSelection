# Edit2Print — v1.0.0

**Select. Edit. Print.**

A lightweight Chrome Manifest V3 extension to select content from a webpage, edit it in a clean preview, and print or save as PDF.

## Install locally
1. Unzip the extension package.
2. Open `chrome://extensions`, enable Developer mode, and click **Load unpacked**.
3. Select the folder containing `manifest.json`.

## Use
1. Highlight the desired webpage text and images, right-click, and choose **Print selection** (localized to Chrome UI language).
2. Edit the content directly in the preview. Remove unwanted text or images, add a paragraph, or use the Undo / Redo buttons.
3. Click **Print** and print or choose **Save as PDF** in Chrome.

You can also right-click a standalone image to open it in the editable print preview. The editing toolbar stays visible while scrolling long documents.

## Privacy
No account or developer-operated server is required. Selected content is temporarily stored locally to open the preview and removed from extension storage after loading. Images may be fetched from their original websites.

## Limits
- Some websites block extension injection, including browser internal pages and protected pages.
- Embedded frames, canvas, SVG, and complex page styling may not reproduce exactly.
- The editor supports basic HTML editing; it is not a full document layout editor.
- Images may load from the source website.

## Publishing
See `STORE_LISTING.md` and `PRIVACY.md`. Verify the release in Chrome before publishing.
