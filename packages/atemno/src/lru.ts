class LRUNode<Key, Value> {
  public next: LRUNode<Key, Value> | undefined;
  public prev: LRUNode<Key, Value> | undefined;

  constructor(
    public key: Key,
    public value: Value,
  ) {}
}

/**
 * Doubly linked list LRU. The head is the most recently used entry and the
 * tail is the next to be evicted.
 */
export class LRUMap<Key, Value> {
  private nodes = new Map<Key, LRUNode<Key, Value>>();

  private head: LRUNode<Key, Value> | undefined;
  private tail: LRUNode<Key, Value> | undefined;

  constructor(public limit: number) {}

  has(key: Key) {
    return this.nodes.has(key);
  }

  get(key: Key): Value | undefined {
    const result = this.nodes.get(key);
    if (result) {
      this.moveToHead(result);
      return result.value;
    }
    return undefined;
  }

  set(key: Key, value: Value): void {
    // An existing entry takes the new value and becomes the most recent
    const existing = this.nodes.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }

    // Make room before adding, so the new entry is never the one evicted
    if (this.nodes.size >= this.limit && this.tail) {
      this.delete(this.tail.key);
    }

    const node = new LRUNode(key, value);
    this.insertHead(node);
    this.nodes.set(key, node);
  }

  delete(key: Key): void {
    const result = this.nodes.get(key);

    if (result) {
      this.removeNode(result);
      this.nodes.delete(key);
    }
  }

  private insertHead(node: LRUNode<Key, Value>): void {
    node.prev = undefined;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    } else {
      this.tail = node;
    }
    this.head = node;
  }

  private removeNode(node: LRUNode<Key, Value>): void {
    // Link the neighbors to each other, or move the ends of the list
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = undefined;
    node.next = undefined;
  }

  private moveToHead(node: LRUNode<Key, Value>): void {
    if (node !== this.head) {
      this.removeNode(node);
      this.insertHead(node);
    }
  }
}
