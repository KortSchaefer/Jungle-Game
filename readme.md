## Jungle Game (Electron)

### Build A Downloadable Windows Installer

This repo is set up to package with `electron-builder`.

1. Install dependencies:
```powershell
npm install
```

2. Build an installer:
```powershell
npm run dist
```

Output goes to the `release/` folder:
- `release/win-unpacked/` (portable folder build)
- `release/*.exe` (NSIS installer, when packaging completes successfully)

### If Packaging Fails With A Symlink Error (Windows)

If you see an error like:
`ERROR: Cannot create symbolic link : A required privilege is not held by the client.`

Fix options:
1. Enable **Developer Mode** in Windows:
   Settings -> Privacy & security -> For developers -> Developer Mode -> On
2. Or run your terminal as **Administrator** and rerun:
```powershell
npm run dist
```

### Sharing With Others

Recommended:
- Upload the generated installer `.exe` from `release/` to GitHub Releases (or any file host).

Fallback (no installer):
- Zip `release/win-unpacked/` and share the zip. Users can run the `.exe` inside that folder.
