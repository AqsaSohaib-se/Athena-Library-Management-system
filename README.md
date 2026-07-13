# Athena — Library Management System (DSA Project)

Athena is a browser-based library management system built as a Data Structures & Algorithms showcase. It wraps four core DSA implementations (Stack, Queue, Tree, Hash Map) plus sorting algorithms in a real, working "library archive" UI — with Admin and Member roles, book issuing/returns, waiting queues, category browsing, and a live DSA visualizer/playground. A parallel C++ implementation is included for reference and console-based verification.

## Features

- **Book Catalogue** — add, edit, and browse books by category, with quantity/availability tracking
- **Member Management** — register members, switch between Admin and Member views
- **Issue / Return workflow** — issuing and returning books updates inventory and logs a transaction
- **Waiting Queues** — when a book is unavailable, members join a FIFO queue and are handed off automatically on return
- **Ledger / Audit Stack** — every action (issue, return, queue join, book/member added) is pushed onto a LIFO history stack, viewable as an audit trail
- **Category Tree** — hierarchical browsing of subjects (e.g. Computer Science → DSA, AI, Web Development)
- **Hash-indexed Search** — instant lookup of books by ID, ISBN, title, or individual title words
- **DSA Playground** — a visual tab for watching the Stack, Queue, Tree, Hash Map, and Sorting algorithms operate step by step
- **Cinematic preloader** and a dark, brutalist-styled UI

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework/build step)
- **Reference implementation:** C++ (`dsa.cpp`) mirroring the JS data structures for console-based testing/demo

## Project Structure

```
dsa/
├── index.html      # App shell: header, nav, all view templates (dashboard, catalogue, members, ledger, playground)
├── styles.css       # Full visual styling (brutalist/dark theme, preloader, layouts)
├── dsa.js           # Core data structure classes: HistoryStack, WaitingQueue, TreeNode/CategoryTree,
│                     #   BookHashMap, SortingAlgorithms
├── app.js           # AppController — application state, rendering, event handling, and a
│                     #   self-contained copy of the DSA classes used at runtime
└── dsa.cpp           # Standalone C++ port of the same data structures with a test/demo suite
```

## Data Structures Implemented

| Structure | Class | Used For |
|---|---|---|
| **Stack (LIFO)** | `HistoryStack` | Transaction/audit ledger — capped at 50 entries, oldest dropped first |
| **Queue (FIFO)** | `WaitingQueue` | Per-book waitlists for members when a title is out of stock |
| **Tree** | `TreeNode` / `CategoryTree` | Hierarchical book category system (add/delete/traverse/serialize) |
| **Hash Map** | `BookHashMap` | Multi-key search index (by ID, ISBN, title, title words) using a polynomial rolling hash with a prime bucket size (13) to demonstrate collisions |
| **Sorting** | `SortingAlgorithms` | Bubble Sort and Quick Sort, instrumented with step callbacks for visual playback |

## Running the App

No build tools or dependencies are required.

1. Open `index.html` directly in a browser, **or**
2. Serve the folder locally for best results, e.g.:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```
3. Visit the local URL and use the **Admin / Member** toggle in the header to switch roles.

## Running the C++ Reference Version

```bash
g++ -std=c++17 dsa.cpp -o dsa
./dsa
```

This compiles and runs the demonstration/test suite for the Stack, Queue, Tree, and Hash Map classes independently of the browser UI.

## Roles

- **Admin** — full access: manage the catalogue, members, and categories, view the full ledger
- **Member** — browse the catalogue, view personal borrow history, join queues for unavailable books

## Notes

- All app data (books, members, transactions, categories) persists via the browser's local database layer (`loadDatabase`/save logic in `app.js`) — no backend/server required.
- `dsa.js` and the DSA classes duplicated inside `app.js` are kept in sync; `dsa.js` acts as the standalone/reference module while `app.js` drives the live UI.
