# SovereignSearch

SovereignSearch is a desktop Electron application for browsing DERO / TELA websites and decentralized applications, managing SCIDs and nodes with live tabs, bookmarks, and a search page.

The Electron based application should work on Windows, Linux and MacOS.

**This software is alpha stage software, use only for testing and evaluation purposes.**
## Features

- Multiple tabs with SCID pages or blank/start page
- Node and SCID bookmarks
- Sidebar for quick navigation bookmarks
- Live tab title updates
- Modal for saving bookmarks
- Search SCIDs
## Requirements

- Node.js >= 18.x
- npm or yarn
- Electron (installed via `npm install`)
## Installation

1. Clone the repository:
```
git clone https://github.com/ArcaneSphere/SovereignSearch.git
cd SovereignSearch
```

2. Install dependencies:
```
npm install
```
3. Run the application in a terminal:
```
npm start
```

## Usage

- Use the top bar to input Node & SCID address
- Press "Load Tela" to open SCID in a new tab
- Click ⭐ to save bookmarks
- Toggle sidebar for quick access to saved nodes/SCIDs
- New blank tab opens the search Page
- Searched SCIDs will appear in the topbar when selected, after "Load Tela"

## To-Do's

### Core
- [x] Autostart TELA-Server
- [ ] Autostart Gnomon 
- [x] Resolved entry html rawURL (Solved:~~Only index.html pages load~~)

### Input (NODE)
- [ ] Human-readable domain names for nodes
- [x] "Apply Node" updates Gnomon --daemon-rpc-address=<127.0.0.1:10102>
- [ ] Show last set/saved node address
- [ ] Gnomon restart on Apply (for now start manually)

### Input (SCID)
- [ ] Special characters in the SCID and Node entry won't bookmark, no need for but yeah UX

### Tabs
- [ ] Live tab title updates when not resolved
- [ ] Allows users to rearrange tabs

### Search
- [ ] Startpage refresh on Gnomon start

### Setting Manager
- [x] Settings Manager Menu
- [x] Light/Dark/System
- [ ] Start/Stop/Autostart TELA-Server 

### Gnomon Manager
- [x] Gnomon Manager Menu
- [x] Gnomon alive/ready indicator
- [x] Start/Stop Gnomon
- [ ] Startpage refresh on Gnomon start
- [ ] Display getInfo
- [x] Keeping the log listener alive

### Readme Page
- [ ] How to run you own node Guide
- [ ] Where to find remote nodes

### Search
- [ ] Ratings filter

### User experience
- [ ] Sidebar collapse when pointer leaves, closes onClick somewhere outside sidebar
- [ ] Readme
- [ ] Not all dApps align good in the browserview, it works but need perfection
- [ ] With really big dApps there isn't a instant page view (I mean more than 3/4 sec) UX solution is showing what is going on in the background or an animation.
- [ ] Consistent interface

## Preview

https://x.com/ArcaneSphere/status/2003857606881005760?s=20

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Open a Pull Request
5. Make the world a better place
