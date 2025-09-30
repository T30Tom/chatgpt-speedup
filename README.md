# ChatGPT Speedup — MV3 Extension

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![CI](https://github.com/T30Tom/chatgpt-speedup/actions/workflows/ci.yml/badge.svg)](../../actions)

> Make long ChatGPT chats feel snappy. This extension prunes older messages in the DOM and keeps only the most recent **N** visible (default 5). Older turns are archived either in **storage** or moved to a **hidden container**, and can be restored on demand. All data stays **local** in your browser.

## ✨ Features
- Keep last **N** visible; archive older messages (storage or hidden)
- **Popup controls**: Keep N, mode, quick actions (+5, −5, collapse to 1)
- Works on **chat.openai.com** and **chatgpt.com**
- Privacy-friendly: archives live in `chrome.storage.local`
- MV3, Chromium-compatible (Chrome, Opera, Edge)

## 🧩 How it works
The content script detects conversation turns (robust selectors), prunes older nodes, and updates counts. In storage mode, pruned nodes are serialized and removed from the DOM; in hidden mode, they’re moved to an off-screen container for fast restore.

## 🔧 Install (dev)
1. Clone this repo
2. Go to `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the project folder
4. Open a ChatGPT conversation and use the **extension popup**

## 📁 Project structure
manifest.json
background.js
content.js
content.css
popup.html
popup.js
icons/

markdown
Copy code

## 🛠 Settings (Popup)
- **Keep N**: number of visible turns
- **Mode**: `storage` (serialize + remove) or `hidden` (move to hidden container)
- **Quick actions**: +5, −5, collapse to 1
- **Refresh Tabs**: ask open ChatGPT tabs to refresh after updates

## 🧪 Dev tips
- Use DevTools Console on ChatGPT pages for logs
- If popup says it can’t reach the content script, click **Refresh Tabs** or reload the page
- Test both domains: `chat.openai.com` and `chatgpt.com`

## 🔒 Privacy
No servers. No analytics. Archives are saved in your browser’s `chrome.storage.local`.

## 🤝 Contributing
Issues and PRs welcome!  
- Keep PRs focused and well-scoped
- Describe user-visible changes in the PR
- Test on both domains and include a short QA checklist

## 🧾 License
[MIT](LICENSE)

---

**Ideas / roadmap**
- Keyboard shortcuts
- Smarter prune heuristics (skip when user scrolls up)
- Export/import archives (JSON)
- Per-conversation profiles
rnSee: How to cut a releasern
rn## How to cut a release

To create a GitHub Release (the Action zips the extension and attaches a checksum), tag a version and push the tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
git tag -a v0.1.0 -m "v0.1.0" creates an annotated tag locally named v0.1.0.

git push origin v0.1.0 pushes that tag to GitHub.

The Release workflow (triggered by tags matching v*) builds chatgpt-speedup-vX.Y.Z.zip,
generates SHA256SUMS.txt, and publishes a GitHub Release with those files attached.
rnSee: How to cut a releasern
