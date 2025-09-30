Contributing to ChatGPT Speedup

🎉 Thanks for your interest in contributing! This project is open-source under the MIT license. We welcome bug fixes, new features, documentation improvements, and ideas for making ChatGPT faster and easier to use.

🪛 How to Contribute
1. Fork & Clone

Fork this repository

Clone your fork locally:

git clone https://github.com/YOUR-USERNAME/chatgpt-speedup.git
cd chatgpt-speedup

2. Set Up the Extension

Open chrome://extensions (or opera://extensions)

Enable Developer Mode

Click Load unpacked and select your local project folder

Open a ChatGPT conversation and test changes

3. Make Changes

Keep code clean and readable

Comment tricky logic (especially DOM selectors and pruning logic)

Test on both:

https://chat.openai.com/
*

https://chatgpt.com/
*

4. Commit & Push
git checkout -b my-feature-branch
# make your changes
git add .
git commit -m "feat: describe your change here"
git push origin my-feature-branch

5. Open a Pull Request

Go to your fork on GitHub and open a PR against main.
Please include:

What you changed

Why it’s useful

How you tested it

🧪 QA Checklist (before submitting)

 Extension loads with no errors in chrome://extensions

 Popup works: can set Keep N, Mode, Storage Cap

 Popup stats update (visible / total)

 Buttons (+5, −5, Collapse) work correctly

 No console errors on ChatGPT pages

 Works on both chat domains

💡 Ideas / Future Improvements

Auto-refresh stats in popup

Keyboard shortcuts for actions

Smarter pruning (pause pruning if user scrolls up)

Export/import of archives

Dark/light mode styling for popup

📜 Code of Conduct

Be respectful and constructive. Feedback should focus on the code, not the person.

🤝 Getting Help

Open a GitHub Issue for bugs or feature requests

Start a Discussion if you want to propose bigger changes