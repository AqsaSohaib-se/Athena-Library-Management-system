/**
 * DSA Library Management System - Core Data Structures
 * This file contains custom implementations of core DSA concepts for both business logic and visual playback.
 */

// ==========================================
// 1. STACK: Borrow History Tracking
// ==========================================
class HistoryStack {
    constructor(initialItems = []) {
        this.items = [...initialItems];
    }

    push(item) {
        // Limit history to last 50 entries to keep memory clean
        if (this.items.length >= 50) {
            this.items.shift(); // Remove oldest
        }
        this.items.push({
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleString(),
            ...item
        });
    }

    pop() {
        return this.items.pop();
    }

    peek() {
        return this.items[this.items.length - 1];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    toArray() {
        return [...this.items];
    }

    clear() {
        this.items = [];
    }
}

// ==========================================
// 2. QUEUE: Waiting List System (FIFO)
// ==========================================
class WaitingQueue {
    constructor(bookId, initialItems = []) {
        this.bookId = bookId;
        this.items = [...initialItems]; // Array of { userId, name, dateAdded }
    }

    enqueue(user) {
        // Prevent duplicate queue entries for the same user-book combination
        if (this.hasUser(user.userId)) return false;
        
        this.items.push({
            userId: user.userId,
            name: user.name,
            dateAdded: new Date().toLocaleString()
        });
        return true;
    }

    dequeue() {
        if (this.isEmpty()) return null;
        return this.items.shift();
    }

    peek() {
        if (this.isEmpty()) return null;
        return this.items[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }

    hasUser(userId) {
        return this.items.some(item => item.userId === userId);
    }

    removeUser(userId) {
        const index = this.items.findIndex(item => item.userId === userId);
        if (index !== -1) {
            return this.items.splice(index, 1)[0];
        }
        return null;
    }

    toArray() {
        return [...this.items];
    }
}

// ==========================================
// 3. TREE: Category Tree Structure
// ==========================================
class TreeNode {
    constructor(name, path) {
        this.name = name;
        this.path = path; // e.g. "Computer Science/DSA"
        this.children = [];
    }
}

class CategoryTree {
    constructor(savedTree = null) {
        if (savedTree) {
            this.root = this.deserialize(savedTree);
        } else {
            this.root = new TreeNode("Root", "");
            this.initializeDefaultCategories();
        }
    }

    initializeDefaultCategories() {
        this.addCategory("", "Computer Science");
        this.addCategory("Computer Science", "DSA");
        this.addCategory("Computer Science", "AI");
        this.addCategory("Computer Science", "Web Development");

        this.addCategory("", "Mathematics");
        this.addCategory("Mathematics", "Calculus");
        this.addCategory("Mathematics", "Algebra");

        this.addCategory("", "Physics");
        this.addCategory("Physics", "Quantum");
        this.addCategory("Physics", "Mechanics");
    }

    // Find node by path
    findNode(path, node = this.root) {
        if (!path) return this.root;
        if (node.path === path) return node;

        for (let child of node.children) {
            const found = this.findNode(path, child);
            if (found) return found;
        }
        return null;
    }

    // Add child to a parent path
    addCategory(parentPath, childName) {
        const parentNode = this.findNode(parentPath);
        if (!parentNode) return false;

        const childPath = parentPath ? `${parentPath}/${childName}` : childName;
        
        // Prevent duplicate child name
        if (parentNode.children.some(c => c.name === childName)) return false;

        const newNode = new TreeNode(childName, childPath);
        parentNode.children.push(newNode);
        return true;
    }

    // Delete node and its subcategories
    deleteCategory(path) {
        if (!path) return false;
        
        const parts = path.split('/');
        const nameToDelete = parts.pop();
        const parentPath = parts.join('/');
        
        const parentNode = this.findNode(parentPath);
        if (!parentNode) return false;

        const index = parentNode.children.findIndex(c => c.name === nameToDelete);
        if (index !== -1) {
            parentNode.children.splice(index, 1);
            return true;
        }
        return false;
    }

    // Helper to traverse and build list of categories
    getAllPaths(node = this.root, list = []) {
        if (node !== this.root) {
            list.push(node.path);
        }
        for (let child of node.children) {
            this.getAllPaths(child, list);
        }
        return list;
    }

    // Serialize tree structure to clean JSON object
    serialize(node = this.root) {
        return {
            name: node.name,
            path: node.path,
            children: node.children.map(child => this.serialize(child))
        };
    }

    // Deserialize tree from JSON object
    deserialize(data) {
        const node = new TreeNode(data.name, data.path);
        node.children = data.children.map(childData => this.deserialize(childData));
        return node;
    }
}

// ==========================================
// 4. HASH MAP: Fast Search System (ISBN/Title/Author)
// ==========================================
class BookHashMap {
    constructor(size = 13) { // Size 13 (prime) to demonstrate collisions beautifully
        this.size = size;
        this.buckets = Array(size).fill(null).map(() => []);
    }

    // Visualizable Hash Function (Polynomial rolling hash or simple string sum)
    hash(key) {
        let hashVal = 0;
        const prime = 31;
        for (let i = 0; i < Math.min(key.length, 10); i++) {
            hashVal = (hashVal * prime + key.charCodeAt(i)) % this.size;
        }
        return hashVal;
    }

    // Put a book in the hash map (can map a single key to multiple books - e.g. multi-value search index)
    put(key, book) {
        const normalizedKey = key.toLowerCase().trim();
        const index = this.hash(normalizedKey);
        
        const bucket = this.buckets[index];
        // Check if book already exists in bucket, to avoid duplicates
        const exists = bucket.some(item => item.book.id === book.id && item.key === normalizedKey);
        if (!exists) {
            bucket.push({ key: normalizedKey, book: book });
        }
    }

    // Rebuild hash map index from complete book list
    rebuildIndex(books) {
        this.buckets = Array(this.size).fill(null).map(() => []);
        
        books.forEach(book => {
            // Index by ID
            this.put(book.id.toString(), book);
            // Index by ISBN
            if (book.isbn) this.put(book.isbn, book);
            // Index by Title
            if (book.title) {
                this.put(book.title, book);
                // Also index by individual words in title for elastic-like search
                book.title.split(/\s+/).forEach(word => {
                    if (word.length > 2) this.put(word, book);
                });
            }
            // Index by Author
            if (book.author) {
                this.put(book.author, book);
                book.author.split(/\s+/).forEach(word => {
                    if (word.length > 2) this.put(word, book);
                });
            }
        });
    }

    // Get matching books for a search key, returning hashing lookup trace steps
    get(key) {
        const normalizedKey = key.toLowerCase().trim();
        const index = this.hash(normalizedKey);
        const bucket = this.buckets[index];
        
        const matches = [];
        const trace = {
            searchKey: key,
            hashIndex: index,
            bucketSize: bucket.length,
            comparisons: []
        };

        for (let i = 0; i < bucket.length; i++) {
            const item = bucket[i];
            trace.comparisons.push({
                slotIndex: i,
                comparedKey: item.key,
                match: item.key === normalizedKey || item.key.includes(normalizedKey) || normalizedKey.includes(item.key)
            });
            
            if (item.key === normalizedKey || item.key.includes(normalizedKey) || normalizedKey.includes(item.key)) {
                // Ensure no duplicate books are added to match list
                if (!matches.some(m => m.id === item.book.id)) {
                    matches.push(item.book);
                }
            }
        }

        return { matches, trace };
    }
}

// ==========================================
// 5. SORTING: Visual Merge/Quick Sort Tracker
// ==========================================
class SortingAlgorithms {
    // Generate comparisons & swaps for visual playback in UI
    
    // 5a. Visual Bubble Sort (Highly visual for step-by-step swaps)
    static async bubbleSort(arr, compareFn, onStep) {
        let items = [...arr];
        let n = items.length;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n - i - 1; j++) {
                // Highlighting index j and j+1
                await onStep([...items], [j, j + 1], []);
                
                if (compareFn(items[j], items[j + 1]) > 0) {
                    // Swapping
                    let temp = items[j];
                    items[j] = items[j + 1];
                    items[j + 1] = temp;
                    
                    // Highlight swapped items
                    await onStep([...items], [], [j, j + 1]);
                }
            }
        }
        await onStep([...items], [], []);
        return items;
    }

    // 5b. Visual Quick Sort (Divide & Conquer)
    static async quickSort(arr, compareFn, onStep) {
        let items = [...arr];
        
        const partition = async (low, high) => {
            let pivot = items[high];
            let i = low - 1;
            
            for (let j = low; j < high; j++) {
                // j and high (pivot) are being compared
                await onStep([...items], [j, high], []);
                
                if (compareFn(items[j], pivot) < 0) {
                    i++;
                    let temp = items[i];
                    items[i] = items[j];
                    items[j] = temp;
                    await onStep([...items], [], [i, j]);
                }
            }
            
            let temp = items[i + 1];
            items[i + 1] = items[high];
            items[high] = temp;
            await onStep([...items], [], [i + 1, high]);
            return i + 1;
        };

        const quickSortHelper = async (low, high) => {
            if (low < high) {
                let pi = await partition(low, high);
                await quickSortHelper(low, pi - 1);
                await quickSortHelper(pi + 1, high);
            }
        };

        await quickSortHelper(0, items.length - 1);
        await onStep([...items], [], []);
        return items;
    }

    // Comparison functions for Books
    static getCompareFunction(sortBy, order = 'asc') {
        const multiplier = order === 'asc' ? 1 : -1;
        
        return (a, b) => {
            let valA, valB;
            if (sortBy === 'title') {
                valA = a.title.toLowerCase();
                valB = b.title.toLowerCase();
            } else if (sortBy === 'author') {
                valA = a.author.toLowerCase();
                valB = b.author.toLowerCase();
            } else if (sortBy === 'quantity') {
                valA = Number(a.quantity);
                valB = Number(b.quantity);
            } else {
                valA = a.id;
                valB = b.id;
            }

            if (valA < valB) return -1 * multiplier;
            if (valA > valB) return 1 * multiplier;
            return 0;
        };
    }
}
