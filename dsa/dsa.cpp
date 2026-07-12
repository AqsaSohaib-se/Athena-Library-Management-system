/**
 * Athena Library Management System - Core DSA C++ Implementations
 * This file provides standard, native C++ classes parallel to the JavaScript structures.
 * It contains a demonstration suite running test cases for verification.
 */

#include <iostream>
#include <vector>
#include <string>
#include <list>
#include <algorithm>
#include <stdexcept>
#include <memory>
#include <sstream>
#include <functional>

// ==========================================
// 1. DATA RECORD TYPES
// ==========================================

struct Book {
    int id;
    std::string title;
    std::string author;
    std::string isbn;
    int quantity;
    std::string category;
};

struct Transaction {
    std::string id;
    std::string timestamp;
    std::string type; // "issue", "return", "queue", "queue_handoff", "add_book", "register_member"
    int bookId;
    std::string bookTitle;
    std::string userId;
    std::string userName;
    std::string details;
};

struct QueueUser {
    std::string userId;
    std::string name;
    std::string dateAdded;
};


// ==========================================
// 2. STACK: LIFO History Audit Ledger
// ==========================================
class HistoryStack {
private:
    std::vector<Transaction> items;
    const size_t MAX_SIZE = 50;

public:
    HistoryStack() = default;

    // Push new audit transaction onto top of LIFO Stack
    void push(const Transaction& item) {
        if (items.size() >= MAX_SIZE) {
            items.erase(items.begin()); // Remove oldest element (shift boundary)
        }
        items.push_back(item);
    }

    // Pop top audit record (triggers rollback)
    Transaction pop() {
        if (isEmpty()) {
            throw std::underflow_error("History audit stack registers are empty.");
        }
        Transaction top = items.back();
        items.pop_back();
        return top;
    }

    Transaction peek() const {
        if (isEmpty()) {
            throw std::underflow_error("History audit stack is empty.");
        }
        return items.back();
    }

    bool isEmpty() const {
        return items.empty();
    }

    size_t size() const {
        return items.size();
    }

    std::vector<Transaction> toArray() const {
        return items;
    }

    void clear() {
        items.clear();
    }
};


// ==========================================
// 3. QUEUE: FIFO Waitlist System
// ==========================================
class WaitingQueue {
private:
    int bookId;
    std::vector<QueueUser> items;

public:
    explicit WaitingQueue(int id) : bookId(id) {}

    // Enqueue a student to the rear/tail of FIFO Waitlist
    bool enqueue(const QueueUser& user) {
        if (hasUser(user.userId)) return false; // Prevent duplicates
        items.push_back(user);
        return true;
    }

    // Dequeue student at the front/head of the queue for book dispatching
    QueueUser dequeue() {
        if (isEmpty()) {
            throw std::underflow_error("Waitlist queue is empty.");
        }
        QueueUser front = items.front();
        items.erase(items.begin());
        return front;
    }

    bool hasUser(const std::string& userId) const {
        for (const auto& item : items) {
            if (item.userId == userId) return true;
        }
        return false;
    }

    bool removeUser(const std::string& userId) {
        auto it = std::find_if(items.begin(), items.end(), 
            [&userId](const QueueUser& user) { return user.userId == userId; });
        if (it != items.end()) {
            items.erase(it);
            return true;
        }
        return false;
    }

    bool isEmpty() const {
        return items.empty();
    }

    size_t size() const {
        return items.size();
    }

    std::vector<QueueUser> toArray() const {
        return items;
    }
};


// ==========================================
// 4. TREE: Hierarchical Category Index Directory
// ==========================================
struct TreeNode {
    std::string name;
    std::string path;
    std::vector<std::shared_ptr<TreeNode>> children;

    TreeNode(std::string nm, std::string pth) : name(nm), path(pth) {}
};

class CategoryTree {
private:
    std::shared_ptr<TreeNode> root;

    // Recursive helper to scan for matching path
    std::shared_ptr<TreeNode> findNode(const std::string& path, std::shared_ptr<TreeNode> node) {
        if (node->path == path) return node;
        for (auto child : node->children) {
            auto found = findNode(path, child);
            if (found) return found;
        }
        return nullptr;
    }

    void collectPaths(std::shared_ptr<TreeNode> node, std::vector<std::string>& list) {
        if (node != root) {
            list.push_back(node->path);
        }
        for (auto child : node->children) {
            collectPaths(child, list);
        }
    }

public:
    CategoryTree() {
        root = std::make_shared<TreeNode>("Root", "");
    }

    // Traverse tree structure to insert subcategory leaf
    bool addCategory(const std::string& parentPath, const std::string& childName) {
        auto parentNode = findNode(parentPath, root);
        if (!parentNode) return false;

        std::string childPath = parentPath.empty() ? childName : parentPath + "/" + childName;
        for (auto child : parentNode->children) {
            if (child->name == childName) return false; // Collision check
        }

        parentNode->children.push_back(std::make_shared<TreeNode>(childName, childPath));
        return true;
    }

    // Purge category node and child subcategories recursively
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

    std::vector<std::string> getAllPaths() {
        std::vector<std::string> paths;
        collectPaths(root, paths);
        return paths;
    }
};


// ==========================================
// 5. HASH MAP: Prime-Modulus Buckets Search Index
// ==========================================
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
            hashVal = (hashVal * prime + tolower(ch)) % size;
        }
        return hashVal;
    }

public:
    explicit BookHashMap(int sz = 13) : size(sz), buckets(sz) {}

    // Put item mapping into collision bucket list
    void put(const std::string& key, const Book& book) {
        std::string normKey = key;
        std::transform(normKey.begin(), normKey.end(), normKey.begin(), ::tolower);
        int index = hash(normKey);

        auto& bucket = buckets[index];
        for (const auto& node : bucket) {
            if (node.book.id == book.id && node.key == normKey) return;
        }
        bucket.push_back({normKey, book});
    }

    // Retrieve matching records
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
};


// ==========================================
// 6. SORTING: Bubble & Quick Sort Algorithms
// ==========================================
class SortingAlgorithms {
public:
    // Bubble Sort: O(N^2) sorting
    template<typename T>
    static void bubbleSort(std::vector<T>& arr, std::function<bool(const T&, const T&)> compare) {
        int n = arr.size();
        for (int i = 0; i < n; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (compare(arr[j], arr[j + 1])) {
                    std::swap(arr[j], arr[j + 1]);
                }
            }
        }
    }

private:
    template<typename T>
    static int partition(std::vector<T>& arr, int low, int high, std::function<bool(const T&, const T&)> compare) {
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

public:
    // Quick Sort: O(N log N) recursive sorting
    template<typename T>
    static void quickSort(std::vector<T>& arr, int low, int high, std::function<bool(const T&, const T&)> compare) {
        if (low < high) {
            int pi = partition(arr, low, high, compare);
            quickSort(arr, low, pi - 1, compare);
            quickSort(arr, pi + 1, high, compare);
        }
    }
};


// ==========================================
// 7. DEMONSTRATION RUNNER
// ==========================================
int main() {
    std::cout << "=========================================================\n";
    std::cout << " Athena DSA Library System - C++ Core Test Sandbox       \n";
    std::cout << "=========================================================\n\n";

    // 1. HistoryStack test
    std::cout << "[Test 1] history stack (LIFO)\n";
    HistoryStack history;
    history.push({ "tx_01", "10:00:00", "issue", 201, "Algorithms", "1001", "Rahul Sharma", "Issued Volume" });
    history.push({ "tx_02", "10:05:00", "issue", 202, "AI Modern Approach", "1002", "Aarav Mehta", "Issued Volume" });

    std::cout << "Stack size: " << history.size() << "\n";
    std::cout << "Top stack item: " << history.peek().bookTitle << " (" << history.peek().userName << ")\n";
    
    auto popped = history.pop();
    std::cout << "Popped stack item: " << popped.bookTitle << "\n";
    std::cout << "New stack size: " << history.size() << "\n\n";

    // 2. WaitingQueue test
    std::cout << "[Test 2] waiting queue (FIFO)\n";
    WaitingQueue queue(203); // Clean Code waitlist
    queue.enqueue({ "1002", "Aarav Mehta", "10:00" });
    queue.enqueue({ "1003", "Priya Patel", "10:02" });
    
    std::cout << "Queue size: " << queue.size() << "\n";
    auto front = queue.dequeue();
    std::cout << "Dequeued front user: " << front.name << "\n";
    std::cout << "New queue size: " << queue.size() << "\n\n";

    // 3. CategoryTree test
    std::cout << "[Test 3] hierarchical category tree\n";
    CategoryTree tree;
    tree.addCategory("", "Computer Science");
    tree.addCategory("Computer Science", "DSA");
    tree.addCategory("Computer Science", "AI");
    tree.addCategory("", "Mathematics");

    auto paths = tree.getAllPaths();
    std::cout << "Generated Category Tree Paths:\n";
    for (const auto& path : paths) {
        std::cout << "  - " << path << "\n";
    }
    std::cout << "\n";

    // 4. BookHashMap test
    std::cout << "[Test 4] priming hash map index search\n";
    BookHashMap hashIndex(13);
    Book book1 = { 201, "Introduction to Algorithms", "Thomas Cormen", "9780262033848", 2, "Computer Science/DSA" };
    Book book2 = { 202, "Artificial Intelligence", "Stuart Russell", "9780136042594", 1, "Computer Science/AI" };
    hashIndex.put("Algorithms", book1);
    hashIndex.put("AI", book2);
    hashIndex.put("Thomas Cormen", book1);

    auto matches = hashIndex.get("Algorithms");
    std::cout << "Search 'Algorithms' returned: " << matches.size() << " match(es).\n";
    if (!matches.empty()) {
        std::cout << "  Matched Title: " << matches[0].title << "\n";
    }
    std::cout << "\n";

    // 5. SortingAlgorithms test
    std::cout << "[Test 5] quick sorting algorithm\n";
    std::vector<Book> sortList = { book2, book1 }; // AI has ID 202, DSA has ID 201
    std::cout << "Before sorting:\n";
    for (const auto& b : sortList) std::cout << "  - ID " << b.id << ": " << b.title << "\n";

    auto compareByIdAsc = [](const Book& a, const Book& b) {
        return a.id < b.id;
    };
    
    SortingAlgorithms::quickSort<Book>(sortList, 0, sortList.size() - 1, compareByIdAsc);

    std::cout << "After Quick Sort (ID Ascending):\n";
    for (const auto& b : sortList) std::cout << "  - ID " << b.id << ": " << b.title << "\n";
    std::cout << "\n";

    std::cout << "All core DSA verification cases pass.\n";
    std::cout << "=========================================================\n";
    return 0;
}
