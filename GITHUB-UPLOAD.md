# Publishing this project on GitHub

Never publish `.env`, `ngrok.txt`, `session/`, `multi_sessions/` or `data/`. They hold tokens and WhatsApp logins.
The `.gitignore` already excludes them, and the GitHub zip contains none of them.

## Option A - Android, Termux (recommended)
1. Install Termux from F-Droid (the Play Store version is outdated).
2. In Termux:
   ```
   pkg update -y && pkg install -y git unzip
   termux-setup-storage
   cd ~
   unzip ~/storage/downloads/RAUF-X-LUCIFER-MD-BOT-v25.2-GITHUB.zip
   cd RAUF-X-LUCIFER-MD-BOT
   ```
3. On GitHub create a new **Private** repository (no README, no .gitignore).
4. Create a token: Settings > Developer settings > Fine-grained tokens. Select only that repository, permission **Contents: Read and write**, expiry 7 days.
5. Upload:
   ```
   git init
   git config user.name "your-name"
   git config user.email "your-email"
   git add .
   git commit -m "RAUF x LUCIFER MD BOT v25.2"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO.git
   git push -u origin main
   ```
   Username: your GitHub username. Password: paste the token.
6. Revoke the token on GitHub when finished.

## Option B - computer
Same commands as step 5, run inside the extracted folder.

## Option C - GitHub website (no commands)
1. Extract the zip with a file manager.
2. Open your repository > Add file > Upload files.
3. Drag the extracted files and folders in (a computer browser can upload whole folders; a phone browser needs one folder at a time).
4. Commit changes.

## Next versions
Replace the files, then:
```
git add .
git commit -m "v25.2"
git push
```
Create a Release on GitHub with the same version number.

## Using it on a server
Copy `.env.example` to `.env` and fill it in, optionally copy `ngrok.txt.example` to `ngrok.txt`, then run `npm install --legacy-peer-deps` and `npm start`.

## Letting an AI do it
Give it a fine-grained token limited to this one repository (Contents: Read and write, short expiry) and revoke the token afterwards. Never share a token with a service you do not trust.
