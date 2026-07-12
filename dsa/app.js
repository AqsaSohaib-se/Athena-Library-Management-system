/**
 * Athena DSA Library Management System - Application Controller
 * Professional Brutalist Agency Overhaul
 */

class AppController {
    constructor() {
        this.books = [];
        this.users = [];
        this.historyStack = new HistoryStack();
        this.queues = {}; // Map of bookId -> WaitingQueue
        this.categoryTree = null;
        this.hashIndex = new BookHashMap(13); // Prime size 13
        
        // App settings and states
        this.currentRole = 'admin'; // 'admin' or 'member'
        this.currentStudentId = null;
        this.activeTab = 'dashboard';
        this.activeVisualizer = 'hashmap';
        this.activeVisualizerSubTab = 'visualizer';
        this.sortingInProgress = false;

        // Visualizer settings
        this.selectedQueueBookId = null;
        this.isScanningHash = false;
    }

    // ==========================================
    // INITIALIZATION & CINEMATIC PRELOADER
    // ==========================================
    init() {
        console.log("Initializing Athena Library Archive Index...");
        
        // Start preloader countdown
        this.runPreloaderSequence();
        
        this.loadDatabase();
        
        if (this.users.length > 0 && !this.currentStudentId) {
            this.currentStudentId = this.users[0].id;
        }
        
        this.rebuildHashSearchIndex();
        
        // Populate static UI bindings
        this.populateCategoryDropdowns();
        this.populateUserDropdowns();
        this.populateStudentLoginDropdown();
        this.updateStats();
        
        // Render current state
        this.renderAll();
        
        // Setup initial default queue book in visualizer if none set
        if (this.books.length > 0 && !this.selectedQueueBookId) {
            const queuedBook = this.books.find(b => this.queues[b.id] && !this.queues[b.id].isEmpty());
            this.selectedQueueBookId = queuedBook ? queuedBook.id : this.books[0].id;
        }
    }

    runPreloaderSequence() {
        const bar = document.getElementById('preloader-bar');
        const percentText = document.getElementById('preloader-percent');
        const preloader = document.getElementById('preloader');
        
        if (!bar || !percentText || !preloader) return;
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 6) + 3;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                bar.style.width = `100%`;
                percentText.innerText = `100`;
                
                setTimeout(() => {
                    preloader.classList.add('loaded');
                    setTimeout(() => {
                        preloader.remove();
                        this.showToast("Operational Archive Synced Successfully", "success");
                    }, 1200); // Match CSS slider transition duration
                }, 150);
            } else {
                bar.style.width = `${progress}%`;
                percentText.innerText = progress < 10 ? `0${progress}` : `${progress}`;
            }
        }, 20);
    }

    // Load from local storage or seed default data
    loadDatabase() {
        const storedBooks = localStorage.getItem('athena_books');
        const storedUsers = localStorage.getItem('athena_users');
        const storedHistory = localStorage.getItem('athena_history');
        const storedQueues = localStorage.getItem('athena_queues');
        const storedTree = localStorage.getItem('athena_tree');
        
        // 1. Load Category Tree
        if (storedTree) {
            this.categoryTree = new CategoryTree(JSON.parse(storedTree));
        } else {
            this.categoryTree = new CategoryTree();
            this.saveTreeToStorage();
        }

        // 2. Load Members / Users
        if (storedUsers) {
            this.users = JSON.parse(storedUsers);
        } else {
            this.users = [
                { id: '1001', name: 'Rahul Sharma', email: 'rahul@university.edu', role: 'student', issuedBooks: [] },
                { id: '1002', name: 'Aarav Mehta', email: 'aarav@university.edu', role: 'student', issuedBooks: [] },
                { id: '1003', name: 'Priya Patel', email: 'priya@university.edu', role: 'student', issuedBooks: [] },
                { id: '1004', name: 'Ananya Rao', email: 'ananya@university.edu', role: 'student', issuedBooks: [] }
            ];
            this.saveUsersToStorage();
        }

        // 3. Load Books
        if (storedBooks) {
            this.books = JSON.parse(storedBooks);
        } else {
            this.books = [
                { id: 201, title: 'Introduction to Algorithms', author: 'Thomas Cormen', isbn: '9780262033848', quantity: 2, category: 'Computer Science/DSA' },
                { id: 202, title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell', isbn: '9780136042594', quantity: 1, category: 'Computer Science/AI' },
                { id: 203, title: 'Clean Code', author: 'Robert Martin', isbn: '9780132350884', quantity: 0, category: 'Computer Science/Web Development' },
                { id: 204, title: 'Calculus Made Easy', author: 'Silvanus Thompson', isbn: '9780312185480', quantity: 3, category: 'Mathematics/Calculus' },
                { id: 205, title: 'Quantum Mechanics', author: 'Richard Feynman', isbn: '9780486477220', quantity: 1, category: 'Physics/Quantum' }
            ];
            this.saveBooksToStorage();
        }

        // 4. Load Waiting Queues (FIFO)
        if (storedQueues) {
            const rawQueues = JSON.parse(storedQueues);
            Object.keys(rawQueues).forEach(bookId => {
                this.queues[bookId] = new WaitingQueue(Number(bookId), rawQueues[bookId].items);
            });
        } else {
            this.queues = {};
            this.books.forEach(book => {
                this.queues[book.id] = new WaitingQueue(book.id);
            });
            // Seed Aarav Mehta in the waiting list for 'Clean Code' which has 0 quantity
            const cleanCodeBook = this.books.find(b => b.id === 203);
            if (cleanCodeBook) {
                const user = this.users[1]; 
                this.queues[cleanCodeBook.id].enqueue({ userId: user.id, name: user.name });
            }
            this.saveQueuesToStorage();
        }

        // 5. Load History Stack (LIFO)
        if (storedHistory) {
            const parsedHistory = JSON.parse(storedHistory);
            this.historyStack = new HistoryStack(parsedHistory);
        } else {
            this.historyStack = new HistoryStack();
            // Seed initial stack history
            this.historyStack.push({
                type: 'issue',
                bookId: 201,
                bookTitle: 'Introduction to Algorithms',
                userId: '1001',
                userName: 'Rahul Sharma',
                details: 'Issued volume physically restocked trace'
            });
            const student1 = this.users.find(u => u.id === '1001');
            const book1 = this.books.find(b => b.id === 201);
            if (student1 && book1) {
                student1.issuedBooks.push(book1.id);
                book1.quantity--;
                this.saveUsersToStorage();
                this.saveBooksToStorage();
            }
            this.saveHistoryToStorage();
        }
    }

    // Persist tools
    saveBooksToStorage() { localStorage.setItem('athena_books', JSON.stringify(this.books)); }
    saveUsersToStorage() { localStorage.setItem('athena_users', JSON.stringify(this.users)); }
    saveHistoryToStorage() { localStorage.setItem('athena_history', JSON.stringify(this.historyStack.toArray())); }
    saveTreeToStorage() { localStorage.setItem('athena_tree', JSON.stringify(this.categoryTree.serialize())); }
    saveQueuesToStorage() {
        const rawQueues = {};
        Object.keys(this.queues).forEach(bId => {
            rawQueues[bId] = { bookId: Number(bId), items: this.queues[bId].toArray() };
        });
        localStorage.setItem('athena_queues', JSON.stringify(rawQueues));
    }

    rebuildHashSearchIndex() {
        this.hashIndex.rebuildIndex(this.books);
    }

    // ==========================================
    // ROLE & TAB SWITCHERS
    // ==========================================
    setRole(role) {
        this.currentRole = role;
        
        document.getElementById('role-admin-btn').classList.toggle('active', role === 'admin');
        document.getElementById('role-member-btn').classList.toggle('active', role === 'member');
        
        document.getElementById('user-role-badge').innerText = role === 'admin' ? 'Admin' : 'Member';
        document.getElementById('user-role-badge').style.color = role === 'admin' ? 'var(--accent-gold)' : 'var(--text-secondary)';
        
        document.getElementById('admin-quick-actions').style.display = role === 'admin' ? 'flex' : 'none';
        document.getElementById('member-quick-actions').style.display = role === 'member' ? 'block' : 'none';
        document.getElementById('quick-action-badge').innerText = role === 'admin' ? 'Admin Commands' : 'Student Portal';
        document.getElementById('quick-action-badge').className = role === 'admin' ? 'badge badge-cyan' : 'badge badge-success';
        
        // Show student profile selector in header when in member mode
        const studentSelector = document.getElementById('student-selector-wrapper');
        if (studentSelector) {
            studentSelector.style.display = role === 'member' ? 'flex' : 'none';
            if (role === 'member') {
                this.populateStudentLoginDropdown();
            }
        }

        // Hide/show administrative tabs
        const navUsers = document.getElementById('nav-users');
        const navHistory = document.getElementById('nav-history');
        if (navUsers) navUsers.style.display = role === 'admin' ? '' : 'none';
        if (navHistory) navHistory.style.display = role === 'admin' ? '' : 'none';

        // Redirect member from admin-only tabs
        if (role === 'member' && (this.activeTab === 'users' || this.activeTab === 'history')) {
            this.switchTab('dashboard');
        } else {
            this.renderAll();
        }
        
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = role === 'admin' ? '' : 'none';
        });

        this.showToast(`Active privilege: ${role.toUpperCase()}`, "info");
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        
        const targetLink = document.getElementById(`nav-${tabId}`);
        if (targetLink) targetLink.classList.add('active');
        
        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.add('active');

        if (tabId === 'visualizer') {
            this.switchVisualizer(this.activeVisualizer);
        } else {
            this.renderAll();
        }
    }

    updateStats() {
        document.getElementById('stat-total-books').innerText = this.books.length;
        
        if (this.currentRole === 'admin') {
            document.getElementById('stat-label-card2').innerText = "Students Registered";
            document.getElementById('stat-total-members').innerText = this.users.length;
            
            document.getElementById('stat-label-card3').innerText = "Active Borrowed";
            const totalIssues = this.users.reduce((sum, u) => sum + (u.issuedBooks ? u.issuedBooks.length : 0), 0);
            document.getElementById('stat-active-issues').innerText = totalIssues;
            
            document.getElementById('stat-label-card4').innerText = "Waiting Queues";
            const totalWaiting = Object.values(this.queues).reduce((sum, q) => sum + q.size(), 0);
            document.getElementById('stat-waiting-queue').innerText = totalWaiting;
        } else {
            // Student portal mode
            const student = this.users.find(u => u.id === this.currentStudentId);
            const issuedCount = student && student.issuedBooks ? student.issuedBooks.length : 0;
            
            document.getElementById('stat-label-card2').innerText = "Your Borrowed Books";
            document.getElementById('stat-total-members').innerText = issuedCount;
            
            document.getElementById('stat-label-card3').innerText = "Your Queue Positions";
            let queuePositions = 0;
            Object.values(this.queues).forEach(q => {
                if (q && typeof q.hasUser === 'function' && q.hasUser(this.currentStudentId)) {
                    queuePositions++;
                }
            });
            document.getElementById('stat-active-issues').innerText = queuePositions;
            
            document.getElementById('stat-label-card4').innerText = "Your Portal Role";
            document.getElementById('stat-waiting-queue').innerText = "STUDENT";
        }
    }

    // ==========================================
    // BOOK & USER ACTIONS (BUSINESS LOGIC)
    // ==========================================
    
    // CRUD: Add/Edit Book
    handleBookFormSubmit(event) {
        event.preventDefault();
        
        const bookIdInput = document.getElementById('form-book-id').value;
        const title = document.getElementById('form-book-title').value;
        const author = document.getElementById('form-book-author').value;
        const isbn = document.getElementById('form-book-isbn').value;
        const quantity = Number(document.getElementById('form-book-qty').value);
        const category = document.getElementById('form-book-category').value;
        
        if (bookIdInput) {
            const bookId = Number(bookIdInput);
            const bookIndex = this.books.findIndex(b => b.id === bookId);
            if (bookIndex !== -1) {
                const oldBook = this.books[bookIndex];
                this.books[bookIndex] = { id: bookId, title, author, isbn, quantity, category };
                
                this.historyStack.push({
                    type: 'edit_book',
                    bookId: bookId,
                    bookTitle: title,
                    userName: 'System Admin',
                    details: `Register field edit (Qty: ${oldBook.quantity} -> ${quantity})`
                });
                
                this.showToast(`Catalogue volume record "${title}" committed.`, "success");
            }
        } else {
            if (this.books.some(b => b.isbn === isbn)) {
                this.showToast("ISBN collision identified in archive!", "error");
                return;
            }
            
            const newBookId = this.books.length > 0 ? Math.max(...this.books.map(b => b.id)) + 1 : 201;
            const newBook = { id: newBookId, title, author, isbn, quantity, category };
            
            this.books.push(newBook);
            this.queues[newBookId] = new WaitingQueue(newBookId);
            
            this.historyStack.push({
                type: 'add_book',
                bookId: newBookId,
                bookTitle: title,
                userName: 'System Admin',
                details: `Allocated new volume register Qty: ${quantity}`
            });
            
            this.showToast(`Catalogue volume "${title}" added.`, "success");
        }
        
        this.saveBooksToStorage();
        this.saveQueuesToStorage();
        this.saveHistoryToStorage();
        this.rebuildHashSearchIndex();
        
        this.closeBookModal();
        this.updateStats();
        this.renderAll();
    }

    deleteBook(bookId) {
        const bookIndex = this.books.findIndex(b => b.id === bookId);
        if (bookIndex === -1) return;
        const book = this.books[bookIndex];
        
        const isIssued = this.users.some(u => u.issuedBooks && u.issuedBooks.includes(bookId));
        if (isIssued) {
            this.showToast("Cannot purge volume! Outward copies currently active.", "error");
            return;
        }

        if (confirm(`Are you sure you want to permanently purge "${book.title}" from index registers?`)) {
            this.books.splice(bookIndex, 1);
            delete this.queues[bookId];
            
            this.historyStack.push({
                type: 'delete_book',
                bookId: bookId,
                bookTitle: book.title,
                userName: 'System Admin',
                details: `Purged volume record from library registry`
            });
            
            this.saveBooksToStorage();
            this.saveQueuesToStorage();
            this.saveHistoryToStorage();
            this.rebuildHashSearchIndex();
            
            this.updateStats();
            this.renderAll();
            this.showToast("Catalogue volume purged", "success");
        }
    }

    // CRUD: Add Member
    handleMemberFormSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('form-member-name').value;
        const email = document.getElementById('form-member-email').value;
        
        if (this.users.some(u => u.email === email)) {
            this.showToast("Profile email conflicts with active register!", "error");
            return;
        }

        const newId = this.users.length > 0 ? (Math.max(...this.users.map(u => Number(u.id))) + 1).toString() : "1001";
        const newMember = { id: newId, name, email, role: 'student', issuedBooks: [] };
        
        this.users.push(newMember);
        
        this.historyStack.push({
            type: 'register_member',
            userId: newId,
            userName: name,
            bookTitle: '-',
            details: `Registered profile into student directory`
        });
        
        this.saveUsersToStorage();
        this.saveHistoryToStorage();
        
        this.closeMemberModal();
        this.updateStats();
        this.renderAll();
        this.populateUserDropdowns();
        this.showToast(`Registered profile: ${name}`, "success");
    }

    deleteMember(memberId) {
        const userIndex = this.users.findIndex(u => u.id === memberId);
        if (userIndex === -1) return;
        const member = this.users[userIndex];
        
        if (member.issuedBooks && member.issuedBooks.length > 0) {
            this.showToast("Profile has outstanding volume dispatches to return!", "error");
            return;
        }

        if (confirm(`Purge profile "${member.name}" from active registry?`)) {
            Object.keys(this.queues).forEach(bId => {
                this.queues[bId].removeUser(memberId);
            });
            this.saveQueuesToStorage();
            
            this.users.splice(userIndex, 1);
            
            this.historyStack.push({
                type: 'delete_member',
                userId: memberId,
                userName: member.name,
                bookTitle: '-',
                details: `Purged profile records from library system`
            });
            
            this.saveUsersToStorage();
            this.saveHistoryToStorage();
            
            this.updateStats();
            this.renderAll();
            this.populateUserDropdowns();
            this.showToast("Student profile purged", "success");
        }
    }

    // ==========================================
    // DISPATCH SYSTEM: ISSUE & RETURN SYSTEM
    // ==========================================
    handleIssueFormSubmit(event) {
        event.preventDefault();
        const bookId = Number(document.getElementById('form-issue-book-id').value);
        const userId = document.getElementById('form-issue-user-select').value;
        
        const book = this.books.find(b => b.id === bookId);
        const user = this.users.find(u => u.id === userId);
        
        if (!book || !user) return;

        if (user.issuedBooks && user.issuedBooks.includes(bookId)) {
            this.showToast("Volume already allocated in student active ledger!", "error");
            return;
        }

        const queue = this.queues[bookId];

        if (book.quantity > 0) {
            book.quantity--;
            user.issuedBooks.push(bookId);
            
            this.historyStack.push({
                type: 'issue',
                bookId: bookId,
                bookTitle: book.title,
                userId: userId,
                userName: user.name,
                details: `Dispatched volume copy (${book.quantity} remaining in stock)`
            });

            this.showToast(`Dispatched "${book.title}" to student register.`, "success");
        } else {
            if (queue.hasUser(userId)) {
                this.showToast("Student is already nested inside the waitlist queue!", "error");
                return;
            }

            const success = queue.enqueue({ userId: userId, name: user.name });
            if (success) {
                this.historyStack.push({
                    type: 'queue',
                    bookId: bookId,
                    bookTitle: book.title,
                    userId: userId,
                    userName: user.name,
                    details: `Nested profile in FIFO Waitlist register (Position: ${queue.size()})`
                });
                
                this.showToast(`Added profile to waitlist register for "${book.title}"`, "warning");
            }
        }

        this.saveBooksToStorage();
        this.saveUsersToStorage();
        this.saveQueuesToStorage();
        this.saveHistoryToStorage();
        this.rebuildHashSearchIndex();
        
        this.closeIssueModal();
        this.updateStats();
        this.renderAll();
    }

    returnBook(bookId, userId) {
        const book = this.books.find(b => b.id === bookId);
        const user = this.users.find(u => u.id === userId);
        
        if (!book || !user) return;

        const index = user.issuedBooks.indexOf(bookId);
        if (index !== -1) {
            user.issuedBooks.splice(index, 1);
        }

        const queue = this.queues[bookId];

        if (queue && !queue.isEmpty()) {
            const nextInLine = queue.dequeue();
            const recipientUser = this.users.find(u => u.id === nextInLine.userId);
            
            if (recipientUser) {
                recipientUser.issuedBooks.push(bookId);
                
                this.historyStack.push({
                    type: 'queue_handoff',
                    bookId: bookId,
                    bookTitle: book.title,
                    userId: recipientUser.id,
                    userName: recipientUser.name,
                    previousUserId: userId,
                    previousUserName: user.name,
                    details: `Auto allocation shift from ${user.name} to waitlist front: ${recipientUser.name}`
                });
                
                this.showToast(`Returned volume shift: Auto-allocated to waitlist student ${recipientUser.name}`, "success");
            } else {
                book.quantity++;
                this.historyStack.push({
                    type: 'return',
                    bookId: bookId,
                    bookTitle: book.title,
                    userId: userId,
                    userName: user.name,
                    details: `Returned volume physically restocked`
                });
                this.showToast(`Volume returned and physical stock restocked.`, "success");
            }
        } else {
            book.quantity++;
            this.historyStack.push({
                type: 'return',
                bookId: bookId,
                bookTitle: book.title,
                userId: userId,
                userName: user.name,
                details: `Returned volume physically restocked (Stock: ${book.quantity})`
            });
            this.showToast(`Returned volume synced in ledger database.`, "success");
        }

        this.saveBooksToStorage();
        this.saveUsersToStorage();
        this.saveQueuesToStorage();
        this.saveHistoryToStorage();
        this.rebuildHashSearchIndex();
        
        this.updateStats();
        this.renderAll();
    }

    // ==========================================
    // REVERSIBLE OPERATIONS: UNDO LAST TRANSACTION
    // ==========================================
    popHistoryStack() {
        if (this.historyStack.isEmpty()) {
            this.showToast("Transaction ledger stack registers are empty!", "error");
            return;
        }

        const txn = this.historyStack.pop();
        let message = "";
        
        if (txn.type === 'issue') {
            const book = this.books.find(b => b.id === txn.bookId);
            const user = this.users.find(u => u.id === txn.userId);
            if (book) book.quantity++;
            if (user && user.issuedBooks) {
                const idx = user.issuedBooks.indexOf(txn.bookId);
                if (idx !== -1) user.issuedBooks.splice(idx, 1);
            }
            message = `Rolled back Dispatch: Restored "${txn.bookTitle}" stock from ${txn.userName}`;
        } 
        else if (txn.type === 'return') {
            const book = this.books.find(b => b.id === txn.bookId);
            const user = this.users.find(u => u.id === txn.userId);
            if (book && book.quantity > 0) {
                book.quantity--;
                if (user) user.issuedBooks.push(txn.bookId);
                message = `Rolled back Return: Re-allocated "${txn.bookTitle}" copy to ${txn.userName}`;
            } else {
                this.showToast("Rollback blocked: Target volume register state mismatch.", "error");
                this.historyStack.push(txn); 
                return;
            }
        } 
        else if (txn.type === 'queue') {
            const queue = this.queues[txn.bookId];
            if (queue) {
                queue.removeUser(txn.userId);
                message = `Rolled back Waitlist: Removed ${txn.userName} from "${txn.bookTitle}" queue`;
            }
        } 
        else if (txn.type === 'queue_handoff') {
            const book = this.books.find(b => b.id === txn.bookId);
            const recipient = this.users.find(u => u.id === txn.userId);
            const originalBorrower = this.users.find(u => u.id === txn.previousUserId);
            const queue = this.queues[txn.bookId];
            
            if (recipient && recipient.issuedBooks) {
                const idx = recipient.issuedBooks.indexOf(txn.bookId);
                if (idx !== -1) recipient.issuedBooks.splice(idx, 1);
            }
            
            if (queue && recipient) {
                queue.items.unshift({
                    userId: recipient.id,
                    name: recipient.name,
                    dateAdded: new Date().toLocaleString()
                });
            }

            if (originalBorrower) {
                originalBorrower.issuedBooks.push(txn.bookId);
            }
            
            message = `Rolled back Auto Allocation Handoff. Sync restored.`;
        }
        else if (txn.type === 'add_book') {
            const idx = this.books.findIndex(b => b.id === txn.bookId);
            if (idx !== -1) this.books.splice(idx, 1);
            delete this.queues[txn.bookId];
            message = `Rolled back Addition: Removed "${txn.bookTitle}"`;
        }
        else if (txn.type === 'delete_book') {
            this.showToast("Cannot undo direct book deletions via stack. Re-add the book manually.", "error");
            this.historyStack.push(txn);
            return;
        }
        else if (txn.type === 'register_member') {
            const idx = this.users.findIndex(u => u.id === txn.userId);
            if (idx !== -1) this.users.splice(idx, 1);
            message = `Rolled back Profile: Removed "${txn.userName}"`;
        }
        else {
            message = "Executed rollback audit trace";
        }

        this.saveBooksToStorage();
        this.saveUsersToStorage();
        this.saveHistoryToStorage();
        this.saveQueuesToStorage();
        this.rebuildHashSearchIndex();
        
        this.updateStats();
        this.renderAll();
        
        this.showToast(message, "info");
    }

    clearHistory() {
        if (confirm("Are you sure you want to permanently purge audit stack logs?")) {
            this.historyStack.clear();
            this.saveHistoryToStorage();
            this.renderAll();
            this.showToast("Audited history stack registers purged.", "success");
        }
    }

    // ==========================================
    // UI RENDER INTEGRATION
    // ==========================================
    renderAll() {
        this.updateStats();
        this.renderDashboardRecentHistory();
        this.renderBooksDirectoryTable(this.books);
        this.renderUsersDirectoryTable();
        this.renderHistoryFullTable();
        
        if (this.activeTab === 'visualizer') {
            this.renderVisualizerTabContent();
        }
    }

    renderDashboardRecentHistory() {
        const container = document.getElementById('dashboard-recent-history-list');
        container.innerHTML = '';
        
        const stackItems = this.historyStack.toArray();
        let itemsToShow = stackItems;
        if (this.currentRole === 'member') {
            itemsToShow = stackItems.filter(txn => txn.userId === this.currentStudentId);
        }

        if (itemsToShow.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 40px 0;">No active history stack register.</div>';
            return;
        }

        const recent = [...itemsToShow].reverse().slice(0, 5);
        recent.forEach(txn => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            let color = 'var(--accent-gold)';
            let label = txn.type.toUpperCase();
            if (txn.type === 'issue') color = 'var(--accent-slate)';
            if (txn.type === 'return') color = 'var(--accent-sage)';
            if (txn.type === 'queue' || txn.type === 'queue_handoff') color = 'var(--accent-crimson)';
            
            item.style.setProperty('--history-glow', color);
            
            item.innerHTML = `
                <div class="history-detail">
                    <h4>${txn.bookTitle}</h4>
                    <p>${txn.userName} • ${txn.timestamp.split(',')[1] || txn.timestamp}</p>
                </div>
                <div class="history-badge" style="color: ${color};">${label}</div>
            `;
            container.appendChild(item);
        });
    }

    renderBooksDirectoryTable(booksList) {
        const tbody = document.getElementById('books-directory-tbody');
        tbody.innerHTML = '';
        
        if (booksList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px 0;">Zero catalogue volume registries fit search parameters.</td></tr>';
            return;
        }

        booksList.forEach(book => {
            const tr = document.createElement('tr');
            tr.id = `book-row-${book.id}`;
            
            let qBadge = `<span class="badge badge-success">${book.quantity} Available</span>`;
            if (book.quantity === 0) {
                qBadge = `<span class="badge badge-danger">Out of Stock</span>`;
            } else if (book.quantity <= 2) {
                qBadge = `<span class="badge badge-amber">${book.quantity} Stock low</span>`;
            }

            const queue = this.queues[book.id];
            const qSize = queue ? queue.size() : 0;
            let qBadgeText = "";
            if (this.currentRole === 'admin') {
                qBadgeText = qSize > 0 
                    ? `<span class="badge badge-danger" style="cursor: pointer;" onclick="app.viewQueueInVisualizer(${book.id})">${qSize} Waiting</span>` 
                    : `<span class="badge" style="color: var(--text-dim); border: 1px solid hsla(0, 0%, 100%, 0.05)">None</span>`;
            } else {
                const studentId = this.currentStudentId;
                if (queue && typeof queue.hasUser === 'function' && queue.hasUser(studentId)) {
                    const pos = queue.toArray().findIndex(item => item.userId === studentId) + 1;
                    qBadgeText = `<span class="badge badge-amber">You are #${pos}</span>`;
                } else {
                    qBadgeText = qSize > 0 
                        ? `<span class="badge" style="color: var(--text-muted); border: 1px solid hsla(0, 0%, 100%, 0.05)">${qSize} Waiting</span>` 
                        : `<span class="badge" style="color: var(--text-dim); border: 1px solid hsla(0, 0%, 100%, 0.05)">None</span>`;
                }
            }

            let actionButtons = "";
            if (this.currentRole === 'admin') {
                actionButtons = `
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-icon-only" onclick="app.openEditBookModal(${book.id})" title="Edit Details">✏️</button>
                        <button class="btn-icon-only" onclick="app.openIssueBookModal(${book.id})" title="Issue/Queue Book">📤</button>
                        <button class="btn-icon-only" onclick="app.deleteBook(${book.id})" title="Purge Record" style="color: var(--accent-crimson);">🗑️</button>
                    </div>
                `;
            } else {
                const student = this.users.find(u => u.id === this.currentStudentId) || this.users[0]; 
                const isIssued = student.issuedBooks && student.issuedBooks.includes(book.id);
                
                if (isIssued) {
                    actionButtons = `
                        <button class="btn-danger" style="padding: 6px 14px; font-size: 0.7rem;" onclick="app.returnBook(${book.id}, '${student.id}')">
                            Return volume
                        </button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn-primary" style="padding: 6px 14px; font-size: 0.7rem;" onclick="app.requestMemberBookAction(${book.id})">
                            ${book.quantity > 0 ? 'Issue Copy' : 'Join waitlist'}
                        </button>
                    `;
                }
            }

            tr.innerHTML = `
                <td><code style="color: var(--text-muted);">#${book.id}</code></td>
                <td><span style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">${book.title}</span></td>
                <td><span style="color: var(--text-secondary);">${book.author}</span></td>
                <td><code>${book.isbn}</code></td>
                <td><span style="font-size: 0.75rem; color: var(--text-muted);">${book.category}</span></td>
                <td>${qBadge}</td>
                <td>${qBadgeText}</td>
                <td>${actionButtons}</td>
            `;
            tbody.appendChild(tr);
        });

        if (this.activeTab === 'visualizer' && this.activeVisualizer === 'sorting') {
            this.renderSortingVisualizerWorkspace();
        }
    }

    renderUsersDirectoryTable() {
        const tbody = document.getElementById('users-directory-tbody');
        tbody.innerHTML = '';
        
        this.users.forEach(user => {
            const tr = document.createElement('tr');
            
            let issuedTitles = [];
            if (user.issuedBooks && user.issuedBooks.length > 0) {
                user.issuedBooks.forEach(bId => {
                    const book = this.books.find(b => b.id === bId);
                    if (book) {
                        issuedTitles.push(`<span class="badge badge-cyan" style="margin: 2px;" onclick="app.returnBook(${book.id}, '${user.id}')" title="Click to Return Volume">${book.title} ×</span>`);
                    }
                });
            }
            
            const titlesCell = issuedTitles.length > 0 ? issuedTitles.join(" ") : '<span style="color: var(--text-dim);">No volumes active</span>';

            let actionsCell = "";
            if (this.currentRole === 'admin') {
                actionsCell = `
                    <button class="btn-icon-only admin-only" onclick="app.deleteMember('${user.id}')" title="Purge Student Profile" style="color: var(--accent-crimson);">🗑️</button>
                `;
            }

            tr.innerHTML = `
                <td><code style="color: var(--text-muted);">#${user.id}</code></td>
                <td><span style="font-weight: 700;">${user.name}</span></td>
                <td><span style="color: var(--text-secondary);">${user.email}</span></td>
                <td><span class="badge" style="color: var(--accent-gold);">${user.role.toUpperCase()}</span></td>
                <td>${titlesCell}</td>
                <td class="admin-only" style="display: ${this.currentRole === 'admin' ? '' : 'none'};">${actionsCell}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderHistoryFullTable() {
        const tbody = document.getElementById('history-full-tbody');
        tbody.innerHTML = '';
        
        let stackItems = this.historyStack.toArray();
        if (this.currentRole === 'member') {
            stackItems = stackItems.filter(txn => txn.userId === this.currentStudentId);
        }
        if (stackItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No logs recorded in transaction stack registers.</td></tr>';
            return;
        }

        const recent = [...stackItems].reverse();
        recent.forEach(txn => {
            const tr = document.createElement('tr');
            
            let color = 'var(--accent-gold)';
            let labelClass = 'badge-amber';
            if (txn.type === 'issue') { color = 'var(--accent-slate)'; labelClass = 'badge-cyan'; }
            if (txn.type === 'return') { color = 'var(--accent-sage)'; labelClass = 'badge-success'; }
            if (txn.type === 'queue' || txn.type === 'queue_handoff') { color = 'var(--accent-crimson)'; labelClass = 'badge-danger'; }

            tr.innerHTML = `
                <td><code style="color: var(--text-muted);">${txn.id.substr(0, 10)}...</code></td>
                <td><span style="color: var(--text-muted); font-size: 0.75rem;">${txn.timestamp}</span></td>
                <td><span class="badge ${labelClass}">${txn.type.toUpperCase()}</span></td>
                <td><span style="font-weight: 600;">${txn.userName || '-'}</span></td>
                <td><span style="font-weight: 700; color: var(--text-primary);">${txn.bookTitle || '-'}</span> <br><small style="color: var(--text-muted);">${txn.details || ''}</small></td>
            `;
            tbody.appendChild(tr);
        });
    }

    requestMemberBookAction(bookId) {
        const member = this.users.find(u => u.id === this.currentStudentId) || this.users[0];
        document.getElementById('form-issue-book-id').value = bookId;
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;

        if (book.quantity > 0) {
            book.quantity--;
            member.issuedBooks.push(bookId);
            this.historyStack.push({
                type: 'issue',
                bookId: bookId,
                bookTitle: book.title,
                userId: member.id,
                userName: member.name,
                details: `Dispatched volume successfully via student register portal`
            });
            this.showToast(`Successfully issued copy of "${book.title}"!`, "success");
        } else {
            const queue = this.queues[bookId];
            if (queue.hasUser(member.id)) {
                this.showToast("Profile is already nested inside the waitlist queue!", "error");
                return;
            }
            queue.enqueue({ userId: member.id, name: member.name });
            this.historyStack.push({
                type: 'queue',
                bookId: bookId,
                bookTitle: book.title,
                userId: member.id,
                userName: member.name,
                details: `Nested in FIFO Queue (Pos: ${queue.size()})`
            });
            this.showToast(`Placed in waiting queue register for "${book.title}"!`, "warning");
        }

        this.saveBooksToStorage();
        this.saveUsersToStorage();
        this.saveQueuesToStorage();
        this.saveHistoryToStorage();
        this.rebuildHashSearchIndex();
        
        this.updateStats();
        this.renderAll();
    }

    // ==========================================
    // SYSTEM MODALS DISPATCH
    // ==========================================
    openAddBookModal() {
        document.getElementById('book-modal-title').innerText = "Catalogue Volume Record";
        document.getElementById('book-modal-form').reset();
        document.getElementById('form-book-id').value = "";
        
        this.populateCategoryDropdowns();
        document.getElementById('book-modal').classList.add('active');
    }

    openEditBookModal(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;

        document.getElementById('book-modal-title').innerText = "Catalogue Volume Edit";
        document.getElementById('form-book-id').value = book.id;
        document.getElementById('form-book-title').value = book.title;
        document.getElementById('form-book-author').value = book.author;
        document.getElementById('form-book-isbn').value = book.isbn;
        document.getElementById('form-book-qty').value = book.quantity;
        
        this.populateCategoryDropdowns();
        document.getElementById('form-book-category').value = book.category;
        
        document.getElementById('book-modal').classList.add('active');
    }

    closeBookModal() {
        document.getElementById('book-modal').classList.remove('active');
    }

    openRegisterMemberModal() {
        document.getElementById('member-modal-form').reset();
        document.getElementById('member-modal').classList.add('active');
    }

    closeMemberModal() {
        document.getElementById('member-modal').classList.remove('active');
    }

    openIssueBookModal(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;

        document.getElementById('form-issue-book-id').value = book.id;
        document.getElementById('form-issue-book-title').value = book.title;
        
        this.populateUserDropdowns();
        
        document.getElementById('issue-waiting-warning').style.display = book.quantity === 0 ? 'block' : 'none';
        document.getElementById('form-issue-submit-btn').innerText = book.quantity === 0 ? 'Enqueue Student' : 'Dispatch Transaction';
        
        document.getElementById('issue-modal').classList.add('active');
    }

    closeIssueModal() {
        document.getElementById('issue-modal').classList.remove('active');
    }

    // Select dynamic populates
    populateCategoryDropdowns() {
        const select = document.getElementById('form-book-category');
        select.innerHTML = '';
        
        const paths = this.categoryTree.getAllPaths();
        paths.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            select.appendChild(opt);
        });

        const filterSelect = document.getElementById('books-category-filter');
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="">All Categories</option>';
        paths.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = currentVal;
    }

    populateUserDropdowns() {
        const select = document.getElementById('form-issue-user-select');
        select.innerHTML = '';
        
        this.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.innerText = `${u.name} (ID: ${u.id})`;
            select.appendChild(opt);
        });
    }

    populateStudentLoginDropdown() {
        const select = document.getElementById('student-login-select');
        if (!select) return;
        select.innerHTML = '';
        this.users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.innerText = `${u.name} (ID: ${u.id})`;
            select.appendChild(opt);
        });
        select.value = this.currentStudentId;
    }

    switchStudentProfile(studentId) {
        this.currentStudentId = studentId;
        const student = this.users.find(u => u.id === studentId);
        if (student) {
            this.showToast(`Switched student portal to: ${student.name}`, "success");
        }
        this.renderAll();
    }

    switchVisualizerSubTab(subTabId) {
        this.activeVisualizerSubTab = subTabId;
        
        const vizBtn = document.getElementById('subtab-visualizer-btn');
        const cppBtn = document.getElementById('subtab-cpp-btn');
        const vizBox = document.getElementById('visualizer-workspace-box');
        const cppBox = document.getElementById('visualizer-cpp-box');
        
        if (vizBtn) vizBtn.classList.toggle('active', subTabId === 'visualizer');
        if (cppBtn) cppBtn.classList.toggle('active', subTabId === 'cpp');
        
        if (vizBox) vizBox.style.display = subTabId === 'visualizer' ? 'flex' : 'none';
        if (cppBox) cppBox.style.display = subTabId === 'cpp' ? 'flex' : 'none';
        
        if (subTabId === 'cpp') {
            this.renderCppCode();
        } else {
            this.renderVisualizerTabContent();
        }
    }

    renderCppCode() {
        const codeElement = document.getElementById('cpp-code-content');
        if (!codeElement) return;
        
        const snippets = {
            hashmap: `// =================================================================
// C++ Implementation: BookHashMap (Chaining Collision Resolution)
// =================================================================
#include <iostream>
#include <vector>
#include <string>
#include <list>
#include <algorithm>

struct Book {
    int id;
    std::string title;
    std::string author;
    std::string isbn;
    int quantity;
    std::string category;
};

struct HashNode {
    std::string key;
    Book book;
};

class BookHashMap {
private:
    int size;
    std::vector<std::list<HashNode>> buckets;

    // Polynomial rolling hash function modulus prime size
    int hash(const std::string& key) {
        int hashVal = 0;
        const int prime = 31;
        for (char ch : key) {
            hashVal = (hashVal * prime + ch) % size;
        }
        return hashVal;
    }

public:
    BookHashMap(int sz = 13) : size(sz), buckets(sz) {}

    // Insert key-value mapping into Chaining bucket array
    void put(const std::string& key, const Book& book) {
        std::string normKey = key;
        std::transform(normKey.begin(), normKey.end(), normKey.begin(), ::tolower);
        int index = hash(normKey);
        
        auto& bucket = buckets[index];
        for (auto& node : bucket) {
            if (node.book.id == book.id && node.key == normKey) {
                return; // Prevent duplicate indices
            }
        }
        bucket.push_back({normKey, book});
    }

    // Retrieve matches for search lookup
    std::vector<Book> get(const std::string& key) {
        std::string normKey = key;
        std::transform(normKey.begin(), normKey.end(), normKey.begin(), ::tolower);
        int index = hash(normKey);
        
        std::vector<Book> matches;
        for (const auto& node : buckets[index]) {
            if (node.key == normKey || node.key.find(normKey) != std::string::npos) {
                matches.push_back(node.book);
            }
        }
        return matches;
    }
};`,
            queue: `// =================================================================
// C++ Implementation: WaitingQueue (FIFO Waitlist Register)
// =================================================================
#include <iostream>
#include <vector>
#include <string>
#include <stdexcept>

struct QueueUser {
    std::string userId;
    std::string name;
    std::string dateAdded;
};

class WaitingQueue {
private:
    int bookId;
    std::vector<QueueUser> items; // Underneath sequence buffer

public:
    WaitingQueue(int id) : bookId(id) {}

    // Add student to the rear of the waitlist (FIFO Tail)
    bool enqueue(const QueueUser& user) {
        if (hasUser(user.userId)) return false;
        items.push_back(user);
        return true;
    }

    // Dispatch/allocate copy to student at the front of the queue (FIFO Head)
    QueueUser dequeue() {
        if (isEmpty()) {
            throw std::underflow_error("Waiting list register is empty.");
        }
        QueueUser front = items.front();
        items.erase(items.begin()); // Shift element out
        return front;
    }

    bool hasUser(const std::string& userId) const {
        for (const auto& item : items) {
            if (item.userId == userId) return true;
        }
        return false;
    }

    bool isEmpty() const { return items.empty(); }
    size_t size() const { return items.size(); }
};`,
            stack: `// =================================================================
// C++ Implementation: HistoryStack (LIFO Transaction Audits)
// =================================================================
#include <iostream>
#include <vector>
#include <string>
#include <stdexcept>

struct Transaction {
    std::string id;
    std::string timestamp;
    std::string type;
    int bookId;
    std::string bookTitle;
    std::string userName;
    std::string details;
};

class HistoryStack {
private:
    std::vector<Transaction> items; // Stack register
    const size_t MAX_SIZE = 50;

public:
    // Push new audit frame onto top of LIFO Stack
    void push(const Transaction& item) {
        if (items.size() >= MAX_SIZE) {
            items.erase(items.begin()); // Retain clean boundary
        }
        items.push_back(item);
    }

    // Pop top transaction (Executes state rollback)
    Transaction pop() {
        if (isEmpty()) {
            throw std::underflow_error("Audit history stack registers are empty.");
        }
        Transaction top = items.back();
        items.pop_back();
        return top;
    }

    Transaction peek() const {
        if (isEmpty()) throw std::underflow_error("Stack is empty.");
        return items.back();
    }

    bool isEmpty() const { return items.empty(); }
    size_t size() const { return items.size(); }
};`,
            tree: `// =================================================================
// C++ Implementation: CategoryTree (Hierarchical Index Tree)
// =================================================================
#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include <sstream>

struct TreeNode {
    std::string name;
    std::string path;
    std::vector<std::shared_ptr<TreeNode>> children;

    TreeNode(std::string nm, std::string pth) : name(nm), path(pth) {}
};

class CategoryTree {
private:
    std::shared_ptr<TreeNode> root;

    std::shared_ptr<TreeNode> findNode(const std::string& path, std::shared_ptr<TreeNode> node) {
        if (node->path == path) return node;
        for (auto child : node->children) {
            auto found = findNode(path, child);
            if (found) return found;
        }
        return nullptr;
    }

public:
    CategoryTree() {
        root = std::make_shared<TreeNode>("Root", "");
    }

    // Traverse directory structure to append subcategory leaf
    bool addCategory(const std::string& parentPath, const std::string& childName) {
        auto parentNode = findNode(parentPath, root);
        if (!parentNode) return false;

        std::string childPath = parentPath.empty() ? childName : parentPath + "/" + childName;
        for (auto child : parentNode->children) {
            if (child->name == childName) {
                return false; // Collision check
            }
        }

        parentNode->children.push_back(std::make_shared<TreeNode>(childName, childPath));
        return true;
    }

    // Delete node and its branches
    bool deleteCategory(const std::string& path) {
        if (path.empty()) return false;
        
        size_t idx = path.find_last_of('/');
        std::string nameToDelete = (idx == std::string::npos) ? path : path.substr(idx + 1);
        std::string parentPath = (idx == std::string::npos) ? "" : path.substr(0, idx);

        auto parentNode = findNode(parentPath, root);
        if (!parentNode) return false;

        auto& vec = parentNode->children;
        for (auto it = vec.begin(); it != vec.end(); ++it) {
            if ((*it)->name == nameToDelete) {
                vec.erase(it);
                return true;
            }
        }
        return false;
    }
};`,
            sorting: `// =================================================================
// C++ Template Implementation: Bubble Sort & Quick Sort
// =================================================================
#include <iostream>
#include <vector>
#include <functional>
#include <algorithm>

// 1. Bubble Sort: O(N^2) Iterative Swaps
template<typename T>
void bubbleSort(std::vector<T>& arr, std::function<bool(const T&, const T&)> compare) {
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (compare(arr[j], arr[j + 1])) {
                std::swap(arr[j], arr[j + 1]);
            }
        }
    }
}

// 2. Quick Sort: O(N log N) Divide and Conquer Partitioning
template<typename T>
int partition(std::vector<T>& arr, int low, int high, std::function<bool(const T&, const T&)> compare) {
    T pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (compare(arr[j], pivot)) {
            i++;
            std::swap(arr[i], arr[j]);
        }
    }
    std::swap(arr[i + 1], arr[high]);
    return i + 1;
}

template<typename T>
void quickSort(std::vector<T>& arr, int low, int high, std::function<bool(const T&, const T&)> compare) {
    if (low < high) {
        int pi = partition(arr, low, high, compare);
        quickSort(arr, low, pi - 1, compare);
        quickSort(arr, pi + 1, high, compare);
    }
}
`
        };
        
        codeElement.innerText = snippets[this.activeVisualizer] || "// No C++ code registered for this structure.";
    }

    filterBooksByCategory(catPath) {
        if (!catPath) {
            this.renderBooksDirectoryTable(this.books);
            return;
        }

        const filtered = this.books.filter(b => b.category === catPath || b.category.startsWith(catPath + "/"));
        this.renderBooksDirectoryTable(filtered);
    }

    searchBooks(query) {
        if (!query) {
            this.renderBooksDirectoryTable(this.books);
            return;
        }

        const result = this.hashIndex.get(query);
        this.renderBooksDirectoryTable(result.matches);
    }

    sortBooks(criteria) {
        const [field, order] = criteria.split('-');
        const compare = SortingAlgorithms.getCompareFunction(field, order);
        const sorted = [...this.books].sort(compare);
        this.renderBooksDirectoryTable(sorted);
    }

    // ==========================================
    // DSA VISUALIZER LABS OVERHAUL
    // ==========================================
    switchVisualizer(visType) {
        this.activeVisualizer = visType;
        
        document.querySelectorAll('.dsa-menu-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`menu-v-${visType}`).classList.add('active');

        const title = document.getElementById('visualizer-title');
        const desc = document.getElementById('visualizer-description');
        const badge = document.getElementById('visualizer-badge');

        if (visType === 'hashmap') {
            title.innerText = "Search Index Register (Hash Map)";
            badge.innerText = "O(1) Avg Complexity";
            badge.className = "badge badge-cyan";
            desc.innerHTML = `
                This view traces collision bucket chains in a custom <strong>Chaining Hash Map</strong>. 
                Type a query into the input below to watch the visual scan trace evaluate and hash the key query indices step-by-step.
            `;
        } 
        else if (visType === 'queue') {
            title.innerText = "Allocation Waitlist (FIFO Queue)";
            badge.innerText = "O(1) Enqueue/Dequeue";
            badge.className = "badge badge-danger";
            desc.innerHTML = `
                Sleek blueprint sequence tracing nested profile allocations. Returning a volume automatically 
                dispatches the copy to the student register nested at the Front of the FIFO Waitlist queue.
            `;
        } 
        else if (visType === 'stack') {
            title.innerText = "Ledger Stack Pile (LIFO Stack)";
            badge.innerText = "O(1) Push/Pop";
            badge.className = "badge badge-success";
            desc.innerHTML = `
                Tracing memory allocation stack traces. Click "Pop Top" inside the Sandbox to trigger a reverse operational rollback 
                of book register states dynamically.
            `;
        } 
        else if (visType === 'tree') {
            title.innerText = "Index Category Tree (Tree Directory)";
            badge.innerText = "O(log N) Traversals";
            badge.className = "badge badge-violet";
            desc.innerHTML = `
                Visual tree hierarchy register cataloging category nodes. You can expand branches, add leaf categories, 
                or delete categories instantly.
            `;
        } 
        else if (visType === 'sorting') {
            title.innerText = "Catalogue Sorter (Merge / Quick Sort)";
            badge.innerText = "O(N log N) Sorting";
            badge.className = "badge badge-amber";
            desc.innerHTML = `
                Simulate sorting arrays visually. Select an algorithm and sort key to play a slow-motion animation 
                evaluating comparing blocks (Gold) and swapping elements (Crimson) in real-time.
            `;
        }

        this.renderVisualizerTabContent();
    }

    renderVisualizerTabContent() {
        const box = document.getElementById('visualizer-workspace-box');
        box.innerHTML = ''; 

        if (this.activeVisualizer === 'hashmap') {
            this.renderHashMapVisualizerWorkspace(box);
        } else if (this.activeVisualizer === 'queue') {
            this.renderQueueVisualizerWorkspace(box);
        } else if (this.activeVisualizer === 'stack') {
            this.renderStackVisualizerWorkspace(box);
        } else if (this.activeVisualizer === 'tree') {
            this.renderTreeVisualizerWorkspace(box);
        } else if (this.activeVisualizer === 'sorting') {
            this.renderSortingVisualizerWorkspace(box);
        }
    }

    // --- 5.1 VISUALIZER: SEARCH INDEX REGISTER (HASH MAP) ---
    renderHashMapVisualizerWorkspace(container) {
        this.hashIndex.rebuildIndex(this.books);

        const vDiv = document.createElement('div');
        vDiv.className = 'hashmap-visualizer';
        vDiv.innerHTML = `
            <div style="display: flex; gap: 16px; margin-bottom: 8px; align-items: center; width: 100%;">
                <div class="search-wrapper" style="flex: 1;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="hash-visual-search" placeholder="Type title/ISBN/author to watcher the hash trace..." oninput="app.visualHashSearch(this.value)">
                </div>
                <div id="hash-calc-indicator" style="font-size: 0.75rem; font-weight: 700; color: var(--accent-gold); letter-spacing: 0.05em; min-width: 180px; text-transform: uppercase;">
                    Hash: -
                </div>
            </div>
            
            <div class="hash-slots-grid" id="hash-slots-container"></div>
        `;
        container.appendChild(vDiv);
        this.renderHashMapBuckets();
    }

    renderHashMapBuckets(activeSlot = null, scanSlot = null, matchedKeys = []) {
        const grid = document.getElementById('hash-slots-container');
        if (!grid) return;
        grid.innerHTML = '';

        for (let i = 0; i < this.hashIndex.size; i++) {
            const row = document.createElement('div');
            row.className = 'hash-slot-row';
            row.style.display = 'flex';
            row.style.alignItems = 'stretch';
            
            if (scanSlot === i) row.classList.add('scanning');
            if (activeSlot === i) row.classList.add('active');

            const indexBox = document.createElement('div');
            indexBox.className = 'hash-slot-index';
            indexBox.style.display = 'flex';
            indexBox.style.alignItems = 'center';
            indexBox.style.justifyContent = 'center';
            indexBox.innerText = i < 10 ? `0${i}` : i;

            const chainBox = document.createElement('div');
            chainBox.className = 'hash-slot-chain';
            chainBox.style.display = 'flex';
            chainBox.style.alignItems = 'center';
            chainBox.style.gap = '12px';
            chainBox.style.flexWrap = 'wrap';
            chainBox.style.flex = '1';

            const bucket = this.hashIndex.buckets[i];
            if (bucket.length === 0) {
                chainBox.innerHTML = '<span style="color: var(--text-dim); font-size: 0.7rem; font-weight: 600; letter-spacing:0.05em; text-transform:uppercase;">NULL REGISTER</span>';
            } else {
                bucket.forEach((item, nodeIndex) => {
                    const nodeEl = document.createElement('div');
                    nodeEl.className = 'hash-chain-node';
                    
                    const isMatched = matchedKeys.some(mk => mk.id === item.book.id && item.key.includes(mk.query.toLowerCase()));
                    if (isMatched) nodeEl.classList.add('matched');

                    nodeEl.innerHTML = `
                        <span class="key-tag">"${item.key}"</span>
                        <span style="color:var(--text-muted); font-weight:700;">→</span>
                        <span class="val-tag">ID ${item.book.id}</span>
                    `;
                    chainBox.appendChild(nodeEl);
                    
                    if (nodeIndex < bucket.length - 1) {
                        const spacer = document.createElement('span');
                        spacer.style.color = 'var(--text-dim)';
                        spacer.style.fontWeight = '700';
                        spacer.innerHTML = ' • ';
                        chainBox.appendChild(spacer);
                    }
                });
            }

            row.appendChild(indexBox);
            row.appendChild(chainBox);
            grid.appendChild(row);
        }
    }

    async visualHashSearch(query) {
        if (this.isScanningHash) return;
        
        if (!query || query.trim().length === 0) {
            document.getElementById('hash-calc-indicator').innerHTML = 'Hash: -';
            this.renderHashMapBuckets();
            return;
        }

        this.isScanningHash = true;
        const norm = query.toLowerCase().trim();
        const hashIdx = this.hashIndex.hash(norm);
        
        document.getElementById('hash-calc-indicator').innerHTML = `
            hash("${norm.substring(0,6)}") % 13 = <strong style="font-size:1.1rem; color: var(--accent-gold);">${hashIdx}</strong>
        `;

        for (let i = 0; i < this.hashIndex.size; i++) {
            this.renderHashMapBuckets(null, i, []);
            await new Promise(r => setTimeout(r, 45));
        }

        const result = this.hashIndex.get(query);
        const matchRecords = result.matches.map(m => ({ id: m.id, query: norm }));

        this.renderHashMapBuckets(hashIdx, null, matchRecords);
        this.isScanningHash = false;
    }

    viewQueueInVisualizer(bookId) {
        this.selectedQueueBookId = bookId;
        this.switchTab('visualizer');
        this.switchVisualizer('queue');
    }

    // --- 5.2 VISUALIZER: WAITLIST REGISTER (FIFO QUEUE) ---
    renderQueueVisualizerWorkspace(container) {
        const vDiv = document.createElement('div');
        vDiv.className = 'queue-visualizer-container';
        vDiv.style.width = '100%';
        vDiv.style.display = 'flex';
        vDiv.style.flexDirection = 'column';
        vDiv.style.gap = '24px';
        
        let optionsHtml = "";
        this.books.forEach(b => {
            const queueSize = this.queues[b.id] ? this.queues[b.id].size() : 0;
            const selectMark = this.selectedQueueBookId === b.id ? "selected" : "";
            optionsHtml += `<option value="${b.id}" ${selectMark}>${b.title} (${queueSize} Waiting)</option>`;
        });

        let userOpts = "";
        this.users.forEach(u => {
            userOpts += `<option value="${u.id}">${u.name} (ID: ${u.id})</option>`;
        });

        vDiv.innerHTML = `
            <div class="sorting-controls" style="justify-content: space-between; width: 100%;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <label style="margin: 0; white-space: nowrap;">Target Waitlist:</label>
                    <select id="visual-queue-book-select" style="width: 280px;" onchange="app.handleVisualQueueBookChange(Number(this.value))">
                        ${optionsHtml}
                    </select>
                </div>
                
                <div class="admin-only" style="display: ${this.currentRole === 'admin' ? 'flex' : 'none'}; gap: 10px; align-items: center;">
                    <select id="visual-queue-user-select" style="width: 180px;">
                        ${userOpts}
                    </select>
                    <button class="btn-primary" onclick="app.visualEnqueue()">Enqueue</button>
                    <button class="btn-secondary" onclick="app.visualDequeue()">Dequeue Front</button>
                </div>
            </div>

            <div class="queue-belt" id="queue-belt-container"></div>
        `;
        container.appendChild(vDiv);
        this.renderQueueElements();
    }

    renderQueueElements() {
        const belt = document.getElementById('queue-belt-container');
        if (!belt) return;
        belt.innerHTML = '';

        const queue = this.queues[this.selectedQueueBookId];
        if (!queue || queue.isEmpty()) {
            belt.innerHTML = '<div style="color: var(--text-muted); text-align: center; width: 100%; padding: 40px 0; font-size: 0.75rem; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">WAITLIST FIFO REGISTER EMPTY</div>';
            return;
        }

        const list = queue.toArray();
        list.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'queue-element';
            if (index === 0) el.classList.add('front');
            if (index === list.length - 1 && list.length > 1) el.classList.add('back');

            let tag = `Pos 0${index + 1}`;
            if (index === 0) tag = "FRONT / FIFO HEAD";
            if (index === list.length - 1 && list.length > 1) tag = "TAIL / REAR";

            const isCurrentUser = (this.currentRole === 'member' && item.userId === this.currentStudentId);
            const displayName = (this.currentRole === 'admin' || isCurrentUser) ? item.name : "Student (Anonymized)";
            const displayId = (this.currentRole === 'admin' || isCurrentUser) ? `#${item.userId}` : "HIDDEN";
            const displayTime = (this.currentRole === 'admin' || isCurrentUser) ? `T: ${item.dateAdded.split(',')[1] || item.dateAdded}` : "";

            el.innerHTML = `
                <div class="queue-element-tag">${tag}</div>
                <h4>${displayName} ${isCurrentUser ? '(You)' : ''}</h4>
                <p>ID REGISTER ${displayId}</p>
                <p style="font-size:0.6rem; margin-top:6px; color: var(--text-dim);">${displayTime}</p>
            `;
            belt.appendChild(el);
        });
    }

    visualEnqueue() {
        const bookId = this.selectedQueueBookId;
        const userId = document.getElementById('visual-queue-user-select').value;
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const queue = this.queues[bookId];
        const success = queue.enqueue({ userId: userId, name: user.name });
        
        if (success) {
            this.historyStack.push({
                type: 'queue',
                bookId: bookId,
                bookTitle: this.books.find(b => b.id === bookId).title,
                userId: userId,
                userName: user.name,
                details: `Enqueued via visual sandbox`
            });
            this.saveQueuesToStorage();
            this.saveHistoryToStorage();
            
            this.renderQueueElements();
            this.updateStats();
            this.showToast(`Enqueued student: ${user.name}`, "success");
        } else {
            this.showToast("Student profile is already nested in this queue!", "error");
        }
    }

    async visualDequeue() {
        const bookId = this.selectedQueueBookId;
        const queue = this.queues[bookId];
        if (!queue || queue.isEmpty()) {
            this.showToast("Queue is empty!", "error");
            return;
        }

        const belt = document.getElementById('queue-belt-container');
        const frontEl = belt.querySelector('.queue-element.front');
        if (frontEl) {
            frontEl.classList.add('dequeuing');
            await new Promise(r => setTimeout(r, 400));
        }

        const poppedUser = queue.dequeue();
        
        this.historyStack.push({
            type: 'return', 
            bookId: bookId,
            bookTitle: this.books.find(b => b.id === bookId).title,
            userId: poppedUser.userId,
            userName: poppedUser.name,
            details: `Dequeued visually from waitlist sandbox`
        });
        
        this.saveQueuesToStorage();
        this.saveHistoryToStorage();
        
        this.renderQueueElements();
        this.updateStats();
        this.showToast(`Dequeued waitlist front: ${poppedUser.name}`, "info");
    }

    // --- 5.3 VISUALIZER: LEDGER PILE (LIFO STACK) ---
    renderStackVisualizerWorkspace(container) {
        const vDiv = document.createElement('div');
        vDiv.style.display = 'flex';
        vDiv.style.flexDirection = 'column';
        vDiv.style.alignItems = 'center';
        vDiv.style.gap = '24px';
        vDiv.style.width = '100%';

        vDiv.innerHTML = `
            <div class="sorting-controls admin-only" style="justify-content: center; width: 100%; display: ${this.currentRole === 'admin' ? 'flex' : 'none'};">
                <button class="btn-primary" onclick="app.visualStackPop()">Pop Top (Undo / Rollback)</button>
                <button class="btn-secondary" onclick="app.clearHistory()">Purge Stack</button>
            </div>
            
            <div class="stack-visualizer" id="stack-visualizer-container"></div>
        `;
        container.appendChild(vDiv);
        this.renderStackNodes();
    }

    renderStackNodes() {
        const container = document.getElementById('stack-visualizer-container');
        if (!container) return;
        container.innerHTML = '';

        let stackItems = this.historyStack.toArray();
        if (this.currentRole === 'member') {
            stackItems = stackItems.filter(txn => txn.userId === this.currentStudentId);
        }
        if (stackItems.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 60px 0; width: 100%; font-size: 0.75rem; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">STACK LEDGER EMPTY</div>';
            return;
        }

        stackItems.forEach((txn, index) => {
            const el = document.createElement('div');
            el.className = 'stack-element';
            
            let typeColor = 'var(--accent-gold)';
            if (txn.type === 'issue') typeColor = 'var(--accent-slate)';
            if (txn.type === 'return') typeColor = 'var(--accent-sage)';
            if (txn.type === 'queue' || txn.type === 'queue_handoff') typeColor = 'var(--accent-crimson)';
            
            el.style.borderLeft = `3px solid ${typeColor}`;

            el.innerHTML = `
                <div class="stack-mem-addr">0x7FF00A${(index * 16).toString(16).toUpperCase()}</div>
                <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary); text-transform: uppercase;">${txn.bookTitle.substring(0, 36)}</div>
                <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; letter-spacing:0.02em;">
                    <strong>[${txn.type.toUpperCase()}]</strong> ${txn.userName} • ${txn.timestamp.split(',')[1] || txn.timestamp}
                </div>
            `;
            container.appendChild(el);
        });
    }

    async visualStackPop() {
        if (this.historyStack.isEmpty()) {
            this.showToast("Stack is empty!", "error");
            return;
        }

        const container = document.getElementById('stack-visualizer-container');
        const elements = container.querySelectorAll('.stack-element');
        const topEl = elements[elements.length - 1];
        if (topEl) {
            topEl.classList.add('popping');
            await new Promise(r => setTimeout(r, 400));
        }

        this.popHistoryStack();
        this.renderStackNodes();
    }

    // --- 5.4 VISUALIZER: TREE INDEX ---
    renderTreeVisualizerWorkspace(container) {
        const vDiv = document.createElement('div');
        vDiv.className = 'tree-visualizer';
        vDiv.innerHTML = `
            <div id="tree-container-box"></div>
        `;
        container.appendChild(vDiv);
        this.renderCategoryTreeLayout();
    }

    renderCategoryTreeLayout() {
        const box = document.getElementById('tree-container-box');
        if (!box) return;
        box.innerHTML = '';

        const buildNodeHtml = (node, isRoot = false) => {
            const wrapper = document.createElement('div');
            wrapper.className = isRoot ? 'tree-root-node' : 'tree-node-wrapper';

            const row = document.createElement('div');
            row.className = 'tree-node-row open';
            
            const hasChildren = node.children.length > 0;
            const toggleIcon = hasChildren 
                ? `<span class="tree-node-toggle"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg></span>` 
                : `<span class="tree-node-toggle" style="opacity: 0.15;">•</span>`;
                
            const folderIcon = isRoot 
                ? `<span class="tree-node-icon" style="color: var(--accent-gold);"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>`
                : `<span class="tree-node-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>`;

            let actions = "";
            if (this.currentRole === 'admin') {
                actions = `
                    <div class="tree-node-actions">
                        <button class="btn-icon-only" style="width:20px; height:20px;" onclick="app.addCategoryVisualPrompt('${node.path}')" title="Add Subcategory">+</button>
                        ${!isRoot ? `<button class="btn-icon-only" style="width:20px; height:20px; color:var(--accent-crimson);" onclick="app.deleteCategoryVisual('${node.path}')" title="Delete Category">-</button>` : ""}
                    </div>
                `;
            }

            row.innerHTML = `
                ${toggleIcon}
                ${folderIcon}
                <span class="tree-node-label">${node.name}</span>
                ${actions}
            `;
            
            row.querySelector('.tree-node-toggle').addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = row.classList.contains('open');
                row.classList.toggle('open', !isOpen);
                const childrenWrapper = row.nextElementSibling;
                if (childrenWrapper) {
                    childrenWrapper.style.display = isOpen ? 'none' : 'flex';
                }
            });

            wrapper.appendChild(row);

            if (node.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children-container';
                childContainer.style.display = 'flex';
                childContainer.style.flexDirection = 'column';
                childContainer.style.gap = '2px';
                
                node.children.forEach(child => {
                    childContainer.appendChild(buildNodeHtml(child));
                });
                wrapper.appendChild(childContainer);
            }

            return wrapper;
        };

        box.appendChild(buildNodeHtml(this.categoryTree.root, true));
    }

    addCategoryVisualPrompt(parentPath) {
        const name = prompt(`Add subcategory leaf under: "${parentPath || 'Root'}":`);
        if (!name) return;
        
        const success = this.categoryTree.addCategory(parentPath, name.trim());
        if (success) {
            this.saveTreeToStorage();
            this.renderCategoryTreeLayout();
            this.populateCategoryDropdowns();
            this.showToast(`Category leaf "${name}" added!`, "success");
        } else {
            this.showToast("Category name already exists in tree register!", "error");
        }
    }

    deleteCategoryVisual(path) {
        const hasBooks = this.books.some(b => b.category === path || b.category.startsWith(path + "/"));
        if (hasBooks) {
            this.showToast("Purge blocked: Volume copies filed under this category register.", "error");
            return;
        }

        if (confirm(`Are you sure you want to purge tree category "${path}"?`)) {
            const success = this.categoryTree.deleteCategory(path);
            if (success) {
                this.saveTreeToStorage();
                this.renderCategoryTreeLayout();
                this.populateCategoryDropdowns();
                this.showToast("Category pruned from tree register", "success");
            }
        }
    }

    // --- 5.5 VISUALIZER: EDITORIAL CATALOGUE SORTER ---
    renderSortingVisualizerWorkspace(container) {
        if (!container) container = document.getElementById('visualizer-workspace-box');
        if (!container) return;
        container.innerHTML = '';

        const vDiv = document.createElement('div');
        vDiv.className = 'sorting-visualizer-container';
        vDiv.innerHTML = `
            <div class="sorting-controls">
                <label style="margin:0;">Sort Register Field:</label>
                <select id="visual-sort-field" style="width: 140px;">
                    <option value="quantity">Quantity Stock</option>
                    <option value="title">Title Length</option>
                </select>

                <label style="margin:0;">Algorithm:</label>
                <select id="visual-sort-algo" style="width: 140px;">
                    <option value="bubble">Bubble Sort</option>
                    <option value="quick">Quick Sort</option>
                </select>

                <button class="btn-primary" id="visual-sort-play-btn" onclick="app.playVisualSort()">Execute Sorting</button>
            </div>

            <div class="sorting-track" id="sorting-track-container"></div>
        `;
        container.appendChild(vDiv);
        this.renderSortingBars();
    }

    renderSortingBars(items = this.books, compareIndices = [], swapIndices = []) {
        const track = document.getElementById('sorting-track-container');
        if (!track) return;
        track.innerHTML = '';

        const maxVal = Math.max(...items.map(item => Number(item.quantity) + 1), 6);

        items.forEach((item, index) => {
            const bar = document.createElement('div');
            bar.className = 'sorting-bar';
            bar.style.display = 'flex';
            bar.style.flexDirection = 'column';
            bar.style.alignItems = 'center';
            
            if (compareIndices.includes(index)) bar.classList.add('comparing');
            if (swapIndices.includes(index)) bar.classList.add('swapping');

            const scaleQty = Number(item.quantity);
            const heightPx = 50 + (scaleQty / maxVal) * 150;

            bar.innerHTML = `
                <span class="sorting-bar-value">${scaleQty}</span>
                <div class="sorting-bar-pillar" style="height: ${heightPx}px; width:100%;"></div>
                <span class="sorting-bar-label" title="${item.title}">${item.title.substring(0, 10)}...</span>
            `;
            track.appendChild(bar);
        });
    }

    async playVisualSort() {
        if (this.sortingInProgress) return;
        this.sortingInProgress = true;
        
        const playBtn = document.getElementById('visual-sort-play-btn');
        if (playBtn) {
            playBtn.innerText = "Executing...";
            playBtn.style.opacity = '0.5';
        }

        const field = document.getElementById('visual-sort-field').value;
        const algo = document.getElementById('visual-sort-algo').value;

        let itemsToSort = [...this.books];

        const compareFn = (a, b) => {
            if (field === 'quantity') {
                return Number(a.quantity) - Number(b.quantity);
            } else {
                return a.title.length - b.title.length;
            }
        };

        const onStep = async (currentArray, compares, swaps) => {
            this.renderSortingBars(currentArray, compares, swaps);
            await new Promise(r => setTimeout(r, 600));
        };

        try {
            if (algo === 'bubble') {
                await SortingAlgorithms.bubbleSort(itemsToSort, compareFn, onStep);
            } else {
                await SortingAlgorithms.quickSort(itemsToSort, compareFn, onStep);
            }
            this.showToast("Sandbox array sorted successfully!", "success");
        } catch (err) {
            console.error(err);
            this.showToast("Sorting interrupted", "error");
        } finally {
            this.sortingInProgress = false;
            const playBtn = document.getElementById('visual-sort-play-btn');
            if (playBtn) {
                playBtn.innerText = "Execute Sorting";
                playBtn.style.opacity = '1';
            }
            this.renderSortingBars(itemsToSort);
        }
    }

    // ==========================================
    // SYSTEM ALERTS NOTIFICATION (MINIMAL TOASTS)
    // ==========================================
    showToast(message, type = "info") {
        const container = document.getElementById('toast-container-box');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let label = "SYSTEM AUDIT";
        if (type === "success") label = "SUCCESS COMMIT";
        if (type === "error") label = "ERROR EXCEPTION";
        if (type === "warning") label = "PENDING ACTION";

        toast.innerHTML = `
            <div style="font-size:0.6rem; font-weight:700; color:var(--text-muted); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:4px;">${label}</div>
            <p>${message}</p>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }
}

// Instantiate and expose globally
const app = new AppController();
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
window.app = app;
